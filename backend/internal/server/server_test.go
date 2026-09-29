package server

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
)

func TestNewHealthzWithoutDatabase(t *testing.T) {
	response := serve(t, New(), http.MethodGet, "/healthz")

	if response.Code != http.StatusOK {
		t.Fatalf("GET /healthz status = %d, want %d", response.Code, http.StatusOK)
	}
	assertStatusResponse(t, response, "ok")
}

func TestNewHealthzWithUnavailableDatabase(t *testing.T) {
	database := unavailableDatabase(t)
	response := serve(t, New(WithDatabase(database)), http.MethodGet, "/healthz")

	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("GET /healthz status = %d, want %d", response.Code, http.StatusServiceUnavailable)
	}
	assertStatusResponse(t, response, "unavailable")
}

func TestNewDoesNotRegisterAuthRoutesWithoutDatabase(t *testing.T) {
	response := serve(t, New(), http.MethodGet, "/api/auth")

	if response.Code != http.StatusNotFound {
		t.Errorf("GET /api/auth status = %d, want %d", response.Code, http.StatusNotFound)
	}
}

// func TestNewDoesNotRegisterTodoRoutesWithoutDatabase(t *testing.T) {
// 	response := serve(t, New(), http.MethodGet, "/api/todos")
//
// 	if response.Code != http.StatusNotFound {
// 		t.Errorf("GET /api/todos status = %d, want %d", response.Code, http.StatusNotFound)
// 	}
// }

func serve(t *testing.T, handler http.Handler, method, target string) *httptest.ResponseRecorder {
	t.Helper()
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequestWithContext(t.Context(), method, target, nil))
	return response
}

func assertStatusResponse(t *testing.T, response *httptest.ResponseRecorder, want string) {
	t.Helper()
	var got struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(response.Body).Decode(&got); err != nil {
		t.Fatalf("decode response body %q: %v", response.Body.String(), err)
	}
	if got.Status != want {
		t.Errorf("response status = %q, want %q", got.Status, want)
	}
}

func unavailableDatabase(t *testing.T) *bun.DB {
	t.Helper()
	sqlDatabase := sql.OpenDB(pgdriver.NewConnector())
	if err := sqlDatabase.Close(); err != nil {
		t.Fatal(err)
	}
	return bun.NewDB(sqlDatabase, pgdialect.New())
}
