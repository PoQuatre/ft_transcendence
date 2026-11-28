package auth

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/alexedwards/scs/v2"
	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
)

func (m *mockRepository) GetAPIKey(_ context.Context, id uuid.UUID) (*APIKey, error) {
	key, ok := m.apiKeys[id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return key, nil
}

func TestAPIKeyLifecycle(t *testing.T) {
	repo := newMockRepository()
	id := uuid.New()
	user := &User{ID: id, Verified: true}
	repo.users["alice"] = user
	sessions := scs.New()
	e := echo.New()
	e.Use(echo.WrapMiddleware(sessions.LoadAndSave))
	service := NewService(repo)
	h := &handler{service: service}
	e.GET("/api-key", h.getAPIKey, Middleware(sessions, service, VerifiedUser))
	e.POST("/api-key", h.createAPIKey, Middleware(sessions, service, VerifiedUser))
	e.DELETE("/api-key", h.deleteAPIKey, Middleware(sessions, service, VerifiedUser))
	ctx, err := sessions.Load(t.Context(), "")
	if err != nil {
		t.Fatal(err)
	}
	sessions.Put(ctx, "user_id", id.String())
	token, _, err := sessions.Commit(ctx)
	if err != nil {
		t.Fatal(err)
	}
	request := func(method string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequestWithContext(t.Context(), method, "/api-key", nil)
		req.AddCookie(&http.Cookie{Name: sessions.Cookie.Name, Value: token})
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		return rec
	}
	if rec := request(http.MethodGet); rec.Code != http.StatusNoContent {
		t.Fatalf("missing key: %d %s", rec.Code, rec.Body.String())
	}
	create := func() (string, string) {
		t.Helper()
		rec := request(http.MethodPost)
		if rec.Code != http.StatusCreated {
			t.Fatalf("create: %d %s", rec.Code, rec.Body.String())
		}
		var response struct {
			Key    string `json:"key"`
			Prefix string `json:"prefix"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
			t.Fatal(err)
		}
		if len(response.Key) < 32 || !strings.HasPrefix(response.Key, response.Prefix) || response.Prefix == "" {
			t.Fatalf("invalid key response: %s", rec.Body.String())
		}
		return response.Key, response.Prefix
	}
	first, _ := create()
	rec := request(http.MethodGet)
	if rec.Code != http.StatusOK || strings.Contains(rec.Body.String(), first) || !strings.Contains(rec.Body.String(), `"last_used_at":null`) {
		t.Fatalf("get key: %d %s", rec.Code, rec.Body.String())
	}
	second, prefix := create()
	if first == second {
		t.Fatal("regeneration returned the same key")
	}
	rec = request(http.MethodGet)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), prefix) {
		t.Fatalf("get regenerated key: %d %s", rec.Code, rec.Body.String())
	}
	for range 2 {
		if rec := request(http.MethodDelete); rec.Code != http.StatusNoContent {
			t.Fatalf("delete: %d %s", rec.Code, rec.Body.String())
		}
	}
	if rec := request(http.MethodGet); rec.Code != http.StatusNoContent {
		t.Fatalf("deleted key: %d %s", rec.Code, rec.Body.String())
	}
	user.Verified = false
	for _, method := range []string{http.MethodGet, http.MethodPost, http.MethodDelete} {
		if rec := request(method); rec.Code != http.StatusForbidden {
			t.Fatalf("unverified %s: %d %s", method, rec.Code, rec.Body.String())
		}
	}
}

func (m *mockRepository) SaveAPIKey(_ context.Context, key *APIKey) error {
	m.apiKeys[key.UserID] = key
	return nil
}

func (m *mockRepository) DeleteAPIKey(_ context.Context, id uuid.UUID) error {
	delete(m.apiKeys, id)
	return nil
}

func (m *mockRepository) UseAPIKey(_ context.Context, hash string) (uuid.UUID, error) {
	m.apiKeyUses++
	for _, key := range m.apiKeys {
		if key.KeyHash == hash {
			now := time.Now()
			key.LastUsedAt = &now
			return key.UserID, nil
		}
	}
	return uuid.Nil, sql.ErrNoRows
}

func TestAPIKeyManagementRequiresSession(t *testing.T) {
	e, _ := setupTestServer(t, nil)
	for _, method := range []string{http.MethodGet, http.MethodPost, http.MethodDelete} {
		t.Run(method, func(t *testing.T) {
			req := httptest.NewRequestWithContext(t.Context(), method, "/auth/api-key", nil)
			rec := httptest.NewRecorder()
			e.ServeHTTP(rec, req)
			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("got %d, want 401", rec.Code)
			}
		})
	}
}

func TestAPIKeyLastUsedWhenAccessRejected(t *testing.T) {
	repo := newMockRepository()
	id := uuid.New()
	repo.users["alice"] = &User{ID: id, Verified: false}
	secret := strings.Repeat("a", 64)
	key := &APIKey{UserID: id, KeyHash: hashSecret(secret)}
	repo.apiKeys[id] = key
	sessions := scs.New()
	service := NewService(repo)
	e := echo.New()
	e.Use(echo.WrapMiddleware(sessions.LoadAndSave))
	e.GET("/verified", func(c *echo.Context) error {
		return c.NoContent(http.StatusNoContent)
	}, APIKeyMiddleware(sessions, service, VerifiedUser))

	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/verified", nil)
	req.Header.Set("X-API-Key", secret)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden || key.LastUsedAt == nil {
		t.Fatalf("got status %d and last_used_at %v, want 403 and timestamp", rec.Code, key.LastUsedAt)
	}
}

func TestAPIKeyAuthenticatesMe(t *testing.T) {
	repo := newMockRepository()
	id := uuid.New()
	repo.users["alice"] = &User{ID: id, Username: "alice", Email: "alice@example.com", Verified: true}
	sessions := scs.New()
	e := echo.New()
	e.Use(echo.WrapMiddleware(sessions.LoadAndSave))
	service := NewService(repo)
	RegisterRoutes(e.Group("/api/auth"), service, sessions, nil, nil)
	ctx, err := sessions.Load(t.Context(), "")
	if err != nil {
		t.Fatal(err)
	}
	sessions.Put(ctx, "user_id", id.String())
	token, _, err := sessions.Commit(ctx)
	if err != nil {
		t.Fatal(err)
	}
	create := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/auth/api-key", nil)
	create.AddCookie(&http.Cookie{Name: sessions.Cookie.Name, Value: token})
	created := httptest.NewRecorder()
	e.ServeHTTP(created, create)
	if created.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", created.Code, created.Body.String())
	}
	var key struct {
		Secret string `json:"key"`
	}
	if err = json.Unmarshal(created.Body.Bytes(), &key); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("X-API-Key", key.Secret)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"email":"alice@example.com"`) {
		t.Fatalf("key request: %d %s", rec.Code, rec.Body.String())
	}
	bobID := uuid.New()
	repo.users["bob"] = &User{ID: bobID, Username: "bob", Email: "bob@example.com", Verified: true}
	bobCtx, err := sessions.Load(t.Context(), "")
	if err != nil {
		t.Fatal(err)
	}
	sessions.Put(bobCtx, "user_id", bobID.String())
	bobToken, _, err := sessions.Commit(bobCtx)
	if err != nil {
		t.Fatal(err)
	}
	request := func(method, path string, keys []string, cookie string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequestWithContext(t.Context(), method, path, nil)
		for _, value := range keys {
			req.Header.Add("X-API-Key", value)
		}
		if cookie != "" {
			req.AddCookie(&http.Cookie{Name: sessions.Cookie.Name, Value: cookie})
		}
		result := httptest.NewRecorder()
		e.ServeHTTP(result, req)
		return result
	}
	rec = request(http.MethodGet, "/api/auth/me", []string{key.Secret}, bobToken)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"email":"alice@example.com"`) {
		t.Fatalf("key must override session: %d %s", rec.Code, rec.Body.String())
	}
	for _, keys := range [][]string{{""}, {"invalid"}, {strings.Repeat("a", 64)}, {key.Secret, key.Secret}} {
		rec = request(http.MethodGet, "/api/auth/me", keys, bobToken)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("invalid key must not fall back to session: %d %s", rec.Code, rec.Body.String())
		}
	}
	for _, path := range []string{"/api/auth/api-key", "/api/auth/me/export"} {
		rec = request(http.MethodGet, path, []string{key.Secret}, token)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("key on session-only %s: %d %s", path, rec.Code, rec.Body.String())
		}
	}
	rec = request(http.MethodGet, "/api/auth/api-key", nil, token)
	if rec.Code != http.StatusOK || strings.Contains(rec.Body.String(), `"last_used_at":null`) {
		t.Fatalf("last use: %d %s", rec.Code, rec.Body.String())
	}
	rec = request(http.MethodPost, "/api/auth/api-key", nil, token)
	if rec.Code != http.StatusCreated {
		t.Fatalf("regenerate: %d %s", rec.Code, rec.Body.String())
	}
	oldSecret := key.Secret
	key.Secret = ""
	if err := json.Unmarshal(rec.Body.Bytes(), &key); err != nil {
		t.Fatal(err)
	}
	if key.Secret == "" || key.Secret == oldSecret {
		t.Fatal("regeneration must return a new secret")
	}
	if rec = request(http.MethodGet, "/api/auth/me", []string{oldSecret}, ""); rec.Code != http.StatusUnauthorized {
		t.Fatalf("old key after regeneration: %d %s", rec.Code, rec.Body.String())
	}
	if rec = request(http.MethodGet, "/api/auth/me", []string{key.Secret}, ""); rec.Code != http.StatusOK {
		t.Fatalf("regenerated key: %d %s", rec.Code, rec.Body.String())
	}
	if rec := request(http.MethodDelete, "/api/auth/api-key", nil, token); rec.Code != http.StatusNoContent {
		t.Fatalf("delete: %d %s", rec.Code, rec.Body.String())
	}
	if rec := request(http.MethodGet, "/api/auth/me", []string{key.Secret}, ""); rec.Code != http.StatusUnauthorized {
		t.Fatalf("deleted key: %d %s", rec.Code, rec.Body.String())
	}
}

func TestRateLimiterAllowsManyDistinctEntries(t *testing.T) {
	now := time.Now()
	limiter := rateLimiter{now: func() time.Time { return now }}
	for i := 0; i <= 10000; i++ {
		if !limiter.allow(strconv.Itoa(i)) {
			t.Fatalf("first attempt for entry %d was rejected", i)
		}
	}
	now = now.Add(time.Minute)
	if !limiter.allow("new") || len(limiter.entries) != 1 {
		t.Fatalf("expired entries not cleaned up: %d entries", len(limiter.entries))
	}
}

func TestAPIKeyRateLimit(t *testing.T) {
	repo := newMockRepository()
	id := uuid.New()
	repo.users["alice"] = &User{ID: id, Verified: true}
	sessions := scs.New()
	e := echo.New()
	e.Use(echo.WrapMiddleware(sessions.LoadAndSave))
	service := NewService(repo)
	now := time.Now()
	service.keyLimits.now = func() time.Time { return now }
	service.ipLimits.now = func() time.Time { return now }
	RegisterRoutes(e.Group("/api/auth"), service, sessions, nil, nil)
	ctx, err := sessions.Load(t.Context(), "")
	if err != nil {
		t.Fatal(err)
	}
	sessions.Put(ctx, "user_id", id.String())
	token, _, err := sessions.Commit(ctx)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/auth/api-key", nil)
	req.AddCookie(&http.Cookie{Name: sessions.Cookie.Name, Value: token})
	created := httptest.NewRecorder()
	e.ServeHTTP(created, req)
	var key struct {
		Secret string `json:"key"`
	}
	if created.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", created.Code, created.Body.String())
	}
	if err := json.Unmarshal(created.Body.Bytes(), &key); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 61; i++ {
		if i == 1 {
			now = now.Add(30 * time.Second)
		}
		req = httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/auth/me", nil)
		req.RemoteAddr = "192.0.2." + strconv.Itoa(i+1) + ":1234"
		req.Header.Set("X-API-Key", key.Secret)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		want := http.StatusOK
		if i == 60 {
			want = http.StatusTooManyRequests
		}
		if rec.Code != want {
			t.Fatalf("request %d: got %d, want %d", i+1, rec.Code, want)
		}
	}
	now = now.Add(30 * time.Second)
	req = httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/auth/me", nil)
	req.RemoteAddr = "192.0.2.100:1234"
	req.Header.Set("X-API-Key", key.Secret)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("rejected requests should count toward the rolling limit: got %d", rec.Code)
	}
	now = now.Add(time.Minute)
	req = httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/auth/me", nil)
	req.RemoteAddr = "192.0.2.101:1234"
	req.Header.Set("X-API-Key", key.Secret)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("window should expire: got %d", rec.Code)
	}
}

func TestInvalidAPIKeyRateLimit(t *testing.T) {
	repo := newMockRepository()
	id := uuid.New()
	repo.users["alice"] = &User{ID: id, Verified: true}
	secret := strings.Repeat("b", 64)
	hash := sha256.Sum256([]byte(secret))
	repo.apiKeys[id] = &APIKey{UserID: id, KeyHash: hex.EncodeToString(hash[:])}
	sessions := scs.New()
	e := echo.New()
	e.Use(echo.WrapMiddleware(sessions.LoadAndSave))
	service := NewService(repo)
	now := time.Now()
	service.ipLimits.now = func() time.Time { return now }
	RegisterRoutes(e.Group("/api/auth"), service, sessions, nil, nil)
	request := func(ip, key string) int {
		t.Helper()
		req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/auth/me", nil)
		req.RemoteAddr = ip + ":1234"
		req.Header.Set("X-API-Key", key)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		return rec.Code
	}
	for i := 0; i < 61; i++ {
		key := "malformed"
		if i%2 == 0 {
			key = strings.Repeat("a", 64)
		}
		want := http.StatusUnauthorized
		if i == 60 {
			want = http.StatusTooManyRequests
		}
		if got := request("192.0.2.1", key); got != want {
			t.Fatalf("invalid attempt %d: got %d, want %d", i+1, got, want)
		}
	}
	if got := request("192.0.2.2", "invalid"); got != http.StatusUnauthorized {
		t.Fatalf("other IP: got %d", got)
	}
	uses := repo.apiKeyUses
	if got := request("192.0.2.1", strings.Repeat("a", 64)); got != http.StatusTooManyRequests {
		t.Fatalf("invalid key from rate-limited IP: got %d", got)
	}
	if got := request("192.0.2.1", secret); got != http.StatusTooManyRequests {
		t.Fatalf("valid key from rate-limited IP: got %d", got)
	}
	if repo.apiKeyUses != uses || repo.apiKeys[id].LastUsedAt != nil {
		t.Fatal("rate-limited request must not reach the repository")
	}
	if got := request("192.0.2.2", secret); got != http.StatusOK {
		t.Fatalf("valid key from another IP: got %d", got)
	}
	now = now.Add(time.Minute)
	if got := request("192.0.2.1", "invalid"); got != http.StatusUnauthorized {
		t.Fatalf("window should expire: got %d", got)
	}
}
