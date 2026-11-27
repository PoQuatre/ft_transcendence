package server

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
)

func TestAPIKeyRoutesWithPostgres(t *testing.T) {
	dsn := os.Getenv("TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("TEST_POSTGRES_DSN is not set")
	}
	admin := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn)))
	defer func() {
		if err := admin.Close(); err != nil {
			t.Error(err)
		}
	}()
	schema := "api_key_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if _, err := admin.ExecContext(t.Context(), `CREATE SCHEMA "`+schema+`"`); err != nil {
		t.Fatal(err)
	}
	defer func() {
		if _, err := admin.ExecContext(t.Context(), `DROP SCHEMA "`+schema+`" CASCADE`); err != nil {
			t.Error(err)
		}
	}()
	db := bun.NewDB(sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn), pgdriver.WithConnParams(map[string]any{"search_path": schema}))), pgdialect.New())
	defer func() {
		if err := db.Close(); err != nil {
			t.Error(err)
		}
	}()
	files, err := filepath.Glob("../../migrations/*.tx.up.sql")
	if err != nil || len(files) == 0 {
		t.Fatalf("find migrations: %v", err)
	}
	for _, file := range files {
		query, readErr := os.ReadFile(file)
		if readErr != nil {
			t.Fatal(readErr)
		}
		if _, execErr := db.ExecContext(t.Context(), strings.ReplaceAll(string(query), "public.", `"`+schema+`".`)); execErr != nil {
			t.Fatalf("apply %s: %v", file, execErr)
		}
	}
	handler, err := New(WithDatabase(db))
	if err != nil {
		t.Fatal(err)
	}
	ip := "192.0.2.1:1234"
	request := func(method, path, body, key string, cookie *http.Cookie) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequestWithContext(t.Context(), method, path, strings.NewReader(body))
		req.RemoteAddr = ip
		req.Header.Set("Content-Type", "application/json")
		if key != "" {
			req.Header.Set("X-API-Key", key)
		}
		if cookie != nil {
			req.AddCookie(cookie)
		}
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		return rec
	}
	rec := request("POST", "/api/auth/signup", `{"username":"alice","email":"alice@example.com","password":"SuperPassword123!"}`, "", nil)
	if rec.Code != http.StatusCreated {
		t.Fatalf("signup: %d %s", rec.Code, rec.Body.String())
	}
	if _, err := db.ExecContext(t.Context(), "UPDATE users SET verified = true"); err != nil {
		t.Fatal(err)
	}
	rec = request("POST", "/api/auth/login", `{"email":"alice@example.com","password":"SuperPassword123!"}`, "", nil)
	if rec.Code != http.StatusOK || len(rec.Result().Cookies()) == 0 {
		t.Fatalf("login: %d %s", rec.Code, rec.Body.String())
	}
	cookie := rec.Result().Cookies()[0]
	rec = request("POST", "/api/auth/api-key", "{}", "", cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create key: %d %s", rec.Code, rec.Body.String())
	}
	var response struct {
		Key string `json:"key"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	var storedHash string
	if err := db.NewRaw("SELECT key_hash FROM api_keys").Scan(t.Context(), &storedHash); err != nil {
		t.Fatal(err)
	}
	if storedHash == response.Key || storedHash == "" {
		t.Fatal("the full API key must not be stored")
	}
	if _, err := db.ExecContext(t.Context(), "UPDATE users SET verified = false"); err != nil {
		t.Fatal(err)
	}
	rec = request("GET", "/api/friends/list", "", response.Key, nil)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("unverified key access: %d %s", rec.Code, rec.Body.String())
	}
	var lastUsed sql.NullTime
	if err := db.NewRaw("SELECT last_used_at FROM api_keys").Scan(t.Context(), &lastUsed); err != nil || !lastUsed.Valid {
		t.Fatalf("last use after forbidden response: %v, %v", lastUsed, err)
	}
	if _, err := db.ExecContext(t.Context(), "UPDATE users SET verified = true"); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"/api/auth/me", "/api/friends/list", "/api/friends/requests/list"} {
		rec = request("GET", path, "", response.Key, nil)
		if rec.Code != http.StatusOK {
			t.Fatalf("key access %s: %d %s", path, rec.Code, rec.Body.String())
		}
		rec = request("GET", path, "", "", cookie)
		if rec.Code != http.StatusOK {
			t.Fatalf("session access %s: %d %s", path, rec.Code, rec.Body.String())
		}
	}
	rec = request("GET", "/api/auth/api-key", "", "", cookie)
	if rec.Code != http.StatusOK || strings.Contains(rec.Body.String(), `"last_used_at":null`) {
		t.Fatalf("last use: %d %s", rec.Code, rec.Body.String())
	}
	paths := []string{"/api/auth/me", "/api/friends/list", "/api/friends/requests/list"}
	for i := 0; i < 56; i++ {
		rec = request("GET", paths[i%len(paths)], "", response.Key, nil)
		if rec.Code != http.StatusOK {
			t.Fatalf("request %d: %d %s", i+5, rec.Code, rec.Body.String())
		}
	}
	ip = "192.0.2.2:1234"
	rec = request("GET", "/api/friends/list", "", response.Key, nil)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("shared key limit: %d %s", rec.Code, rec.Body.String())
	}
	ip = "192.0.2.3:1234"
	for _, path := range []string{"/api/friends/chat/get-messages", "/api/auth/api-key"} {
		rec = request("GET", path, "", response.Key, cookie)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("session-only %s: %d %s", path, rec.Code, rec.Body.String())
		}
	}
	rec = request("POST", "/api/friends/requests/send", "{}", response.Key, cookie)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("session-only friend action: %d %s", rec.Code, rec.Body.String())
	}
	rec = request("POST", "/api/auth/api-key", "{}", "", cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("regenerate key: %d %s", rec.Code, rec.Body.String())
	}
	oldKey := response.Key
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Key == oldKey {
		t.Fatal("regeneration returned the same key")
	}
	rec = request("GET", "/api/auth/me", "", response.Key, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("new key has its own limit: %d %s", rec.Code, rec.Body.String())
	}
	statuses := make(chan int, 70)
	for range 70 {
		go func() {
			statuses <- request("GET", "/api/auth/me", "", response.Key, nil).Code
		}()
	}
	counts := make(map[int]int)
	for range 70 {
		counts[<-statuses]++
	}
	if counts[http.StatusOK] != 59 || counts[http.StatusTooManyRequests] != 11 {
		t.Fatalf("concurrent rate limit: %v", counts)
	}
	ip = "192.0.2.4:1234"
	rec = request("GET", "/api/auth/me", "", oldKey, cookie)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("replaced key: %d %s", rec.Code, rec.Body.String())
	}
	rec = request("DELETE", "/api/auth/api-key", "", "", cookie)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("delete key: %d %s", rec.Code, rec.Body.String())
	}
	rec = request("GET", "/api/auth/me", "", response.Key, cookie)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("revoked key: %d %s", rec.Code, rec.Body.String())
	}
}
