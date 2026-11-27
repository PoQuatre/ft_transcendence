package auth

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

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
