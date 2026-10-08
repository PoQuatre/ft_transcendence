package auth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/alexedwards/scs/v2"
	"github.com/labstack/echo/v5"

	"github.com/PoQuatre/ft_transcendence/backend/internal/helpers"
)

func setupTestServer(t *testing.T) (*echo.Echo, *scs.SessionManager) {
	t.Helper()
	e := echo.New()
	repo := newMockRepository()
	svc := NewService(repo)

	sessionManager := scs.New()
	sessionManager.IdleTimeout = 1 * time.Hour
	sessionManager.Cookie.Persist = false

	group := e.Group("/auth")

	validat, err := helpers.NewCustomValidator()
	if err != nil {
		t.Fatalf("failed to create custom validator : %v", err)
		return nil, nil
	}
	group.Use(echo.WrapMiddleware(sessionManager.LoadAndSave))

	RegisterRoutes(group, *svc, sessionManager, validat)

	return e, sessionManager
}

func TestHandler_SignUp(t *testing.T) {
	e, _ := setupTestServer(t)

	tests := []struct {
		name           string
		body           string
		expectedStatus int
	}{
		{
			name:           "Valid Signup",
			body:           `{"username":"charlie","email":"charlie@example.com","password":"SuperPassword123!"}`,
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "Invalid Password (no uppercase/symbol)",
			body:           `{"username":"charlie","email":"charlie@example.com","password":"password123"}`,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Invalid Email Format",
			body:           `{"username":"charlie","email":"not-an-email","password":"SuperPassword123!"}`,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Missing Required Field",
			body:           `{"username":"","email":"charlie@example.com","password":"SuperPassword123!"}`,
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/auth/signup", strings.NewReader(tt.body))
			req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
			rec := httptest.NewRecorder()

			e.ServeHTTP(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d. Body: %s", tt.expectedStatus, rec.Code, rec.Body.String())
			}
		})
	}
}

func TestHandler_LoginAndMeFlow(t *testing.T) {
	e, sm := setupTestServer(t)

	signupBody := `{"username":"dave","email":"dave@example.com","password":"SuperPassword123!"}`
	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/auth/signup", strings.NewReader(signupBody))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("signup failed, expected 201 got %d", rec.Code)
	}

	loginBody := `{"email":"dave@example.com","password":"SuperPassword123!"}`
	req = httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/auth/login", strings.NewReader(loginBody))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("login failed, expected 200 got %d", rec.Code)
	}

	res := rec.Result()
	cookies := res.Cookies()
	var sessionCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == sm.Cookie.Name {
			sessionCookie = c
			break
		}
	}

	if sessionCookie == nil || sessionCookie.Value == "" {
		t.Fatal("expected SCS session cookie to be set")
	}

	req = httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/auth/me", nil)
	req.AddCookie(sessionCookie)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected /me to return 200 OK, got %d", rec.Code)
	}

	reqUnauthorized := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/auth/me", nil)
	recUnauthorized := httptest.NewRecorder()
	e.ServeHTTP(recUnauthorized, reqUnauthorized)

	if recUnauthorized.Code != http.StatusUnauthorized {
		t.Errorf("expected /me without cookie to return 401, got %d", recUnauthorized.Code)
	}

	reqLogout := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/auth/logout", nil)
	reqLogout.AddCookie(sessionCookie)
	recLogout := httptest.NewRecorder()
	e.ServeHTTP(recLogout, reqLogout)

	if recLogout.Code != http.StatusOK {
		t.Errorf("expected logout to return 200 OK, got %d", recLogout.Code)
	}

	reqAfterLogout := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/auth/me", nil)
	reqAfterLogout.AddCookie(sessionCookie)
	recAfterLogout := httptest.NewRecorder()
	e.ServeHTTP(recAfterLogout, reqAfterLogout)

	if recAfterLogout.Code != http.StatusUnauthorized {
		t.Errorf("expected /me after logout to return 401, got %d", recAfterLogout.Code)
	}
}
