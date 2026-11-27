package server

import (
	"database/sql"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/alexedwards/scs/bunstore"
	"github.com/alexedwards/scs/v2"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
)

func TestSessionsSurviveServerRestart(t *testing.T) {
	dsn := os.Getenv("TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("TEST_POSTGRES_DSN is not set")
	}
	admin := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn)))
	defer func() {
		if closeErr := admin.Close(); closeErr != nil {
			t.Error(closeErr)
		}
	}()
	schema := "session_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if _, err := admin.ExecContext(t.Context(), `CREATE SCHEMA "`+schema+`"`); err != nil {
		t.Fatal(err)
	}
	defer func() {
		if _, dropErr := admin.ExecContext(t.Context(), `DROP SCHEMA "`+schema+`" CASCADE`); dropErr != nil {
			t.Error(dropErr)
		}
	}()
	db := bun.NewDB(sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn), pgdriver.WithConnParams(map[string]any{"search_path": schema}))), pgdialect.New())
	defer func() {
		if closeErr := db.Close(); closeErr != nil {
			t.Error(closeErr)
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
	first, err := New(WithDatabase(db))
	if err != nil {
		t.Fatal(err)
	}
	request := func(handler http.Handler, method, path, body string, cookie *http.Cookie) *httptest.ResponseRecorder {
		req := httptest.NewRequestWithContext(t.Context(), method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		if cookie != nil {
			req.AddCookie(cookie)
		}
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		return rec
	}
	signup := request(first, "POST", "/api/auth/signup", `{"username":"alice","email":"alice@example.com","password":"SuperPassword123!"}`, nil)
	if signup.Code != http.StatusCreated {
		t.Fatalf("signup: %d %s", signup.Code, signup.Body.String())
	}
	cookies := make([]*http.Cookie, 0, 2)
	for _, stay := range []bool{false, true} {
		login := request(first, "POST", "/api/auth/login", fmt.Sprintf(`{"email":"alice@example.com","password":"SuperPassword123!","staySignedIn":%t}`, stay), nil)
		if login.Code != http.StatusOK || len(login.Result().Cookies()) == 0 {
			t.Fatalf("login: %d %s", login.Code, login.Body.String())
		}
		cookie := login.Result().Cookies()[0]
		if cookie.Expires.IsZero() == stay {
			t.Fatalf("stay=%t: cookie expiry = %v", stay, cookie.Expires)
		}
		cookies = append(cookies, cookie)
		var count int
		if scanErr := db.NewRaw("SELECT count(*) FROM sessions WHERE token = ?", cookie.Value).Scan(t.Context(), &count); scanErr != nil {
			t.Fatal(scanErr)
		}
		if count != 0 {
			t.Fatal("session token was stored without hashing")
		}
	}
	second, err := New(WithDatabase(db))
	if err != nil {
		t.Fatal(err)
	}
	for _, cookie := range cookies {
		if rec := request(second, "GET", "/api/auth/me", "", cookie); rec.Code != http.StatusOK {
			t.Fatalf("session after restart: %d %s", rec.Code, rec.Body.String())
		}
	}
	if rec := request(second, "POST", "/api/auth/logout", "", cookies[0]); rec.Code != http.StatusOK {
		t.Fatalf("logout: %d %s", rec.Code, rec.Body.String())
	}
	if rec := request(second, "GET", "/api/auth/me", "", cookies[0]); rec.Code != http.StatusUnauthorized {
		t.Fatalf("logged out session: %d", rec.Code)
	}
	if rec := request(second, "GET", "/api/auth/me", "", cookies[1]); rec.Code != http.StatusOK {
		t.Fatalf("other session after logout: %d", rec.Code)
	}
	store, err := bunstore.NewWithCleanupInterval(db, 0)
	if err != nil {
		t.Fatal(err)
	}
	manager := scs.New()
	manager.Store = store
	manager.HashTokenInStore = true
	ctx, err := manager.Load(t.Context(), "")
	if err != nil {
		t.Fatal(err)
	}
	manager.RememberMe(ctx, true)
	manager.SetDeadline(ctx, time.Now().Add(90*24*time.Hour))
	token, _, err := manager.Commit(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if rec := request(second, "POST", "/api/auth/signup", `{"username":"bob","email":"bob@example.com","password":"SuperPassword123!"}`, nil); rec.Code != http.StatusCreated {
		t.Fatalf("second signup: %d %s", rec.Code, rec.Body.String())
	}
	login := request(second, "POST", "/api/auth/login", `{"email":"bob@example.com","password":"SuperPassword123!","staySignedIn":false}`, &http.Cookie{Name: "session", Value: token})
	if login.Code != http.StatusOK || len(login.Result().Cookies()) == 0 || !login.Result().Cookies()[0].Expires.IsZero() {
		t.Fatalf("ordinary login after persistent session: %d, cookies %v", login.Code, login.Result().Cookies())
	}
}
