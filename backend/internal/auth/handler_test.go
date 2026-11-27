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

func setupTestServer(t *testing.T, onLogout func(string)) (*echo.Echo, *scs.SessionManager) {
	t.Helper()
	e := echo.New()
	repo := newMockRepository()
	svc := NewService(repo)

	sessionManager := scs.New()
	sessionManager.Cookie.Persist = false

	group := e.Group("/auth")

	validat, err := helpers.NewCustomValidator()
	if err != nil {
		t.Fatalf("failed to create custom validator : %v", err)
		return nil, nil
	}
	group.Use(echo.WrapMiddleware(sessionManager.LoadAndSave))

	RegisterRoutes(group, svc, sessionManager, validat, onLogout)

	return e, sessionManager
}

func TestHandler_SignUp(t *testing.T) {
	e, _ := setupTestServer(t, nil)

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
	var revokedID string
	e, sm := setupTestServer(t, func(id string) { revokedID = id })

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
	ctx, err := sm.Load(t.Context(), sessionCookie.Value)
	if err != nil {
		t.Fatal(err)
	}
	if remaining := time.Until(sm.Deadline(ctx)); remaining < 23*time.Hour || remaining > 24*time.Hour {
		t.Fatalf("ordinary session deadline remaining = %v", remaining)
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
	if revokedID == "" {
		t.Error("logout did not revoke the user's connection")
	}
	for _, cookie := range recLogout.Result().Cookies() {
		if cookie.Name == sm.Cookie.Name && cookie.Value != "" && cookie.MaxAge >= 0 {
			t.Fatalf("logout left a session cookie: %+v", cookie)
		}
	}

	reqAfterLogout := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/auth/me", nil)
	reqAfterLogout.AddCookie(sessionCookie)
	recAfterLogout := httptest.NewRecorder()
	e.ServeHTTP(recAfterLogout, reqAfterLogout)

	if recAfterLogout.Code != http.StatusUnauthorized {
		t.Errorf("expected /me after logout to return 401, got %d", recAfterLogout.Code)
	}
}

func TestLoginStaySignedInCookie(t *testing.T) {
	e, sm := setupTestServer(t, nil)
	signup := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/auth/signup", strings.NewReader(`{"username":"alice","email":"alice@example.com","password":"SuperPassword123!"}`))
	signup.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	e.ServeHTTP(httptest.NewRecorder(), signup)

	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/auth/login", strings.NewReader(`{"email":"alice@example.com","password":"SuperPassword123!","staySignedIn":true}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("login: %d: %s", rec.Code, rec.Body.String())
	}
	for _, cookie := range rec.Result().Cookies() {
		if cookie.Name == sm.Cookie.Name && cookie.Expires.After(time.Now().Add(89*24*time.Hour)) {
			ctx, err := sm.Load(t.Context(), cookie.Value)
			if err != nil {
				t.Fatal(err)
			}
			if remaining := time.Until(sm.Deadline(ctx)); remaining < 89*24*time.Hour || remaining > 90*24*time.Hour {
				t.Fatalf("persistent session deadline remaining = %v", remaining)
			}
			return
		}
	}
	t.Fatal("expected persistent session cookie lasting up to 90 days")
}
