package auth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v5"
)

func setupTestServer(t *testing.T) (*echo.Echo, *mockRepository) {
	t.Helper()
	e := echo.New()
	repo := newMockRepository()
	svc := NewService(repo)

	group := e.Group("/auth")
	if err := RegisterRoutes(group, svc); err != nil {
		t.Fatalf("failed to register routes: %v", err)
	}

	return e, repo
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
			req := httptest.NewRequest(http.MethodPost, "/auth/signup", strings.NewReader(tt.body))
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
	e, _ := setupTestServer(t)

	// 1. Inscription préalable
	signupBody := `{"username":"dave","email":"dave@example.com","password":"SuperPassword123!"}`
	req := httptest.NewRequest(http.MethodPost, "/auth/signup", strings.NewReader(signupBody))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	// 2. Connexion pour récupérer le cookie
	loginBody := `{"identifier":"dave@example.com","password":"SuperPassword123!"}`
	req = httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(loginBody))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("login failed, expected 200 got %d", rec.Code)
	}

	// Extraire le cookie de la réponse
	res := rec.Result()
	cookies := res.Cookies()
	var sessionCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == sessionCookieName {
			sessionCookie = c
			break
		}
	}

	if sessionCookie == nil || sessionCookie.Value == "" {
		t.Fatal("expected session cookie to be set")
	}

	// 3. Appel de /me avec le cookie
	req = httptest.NewRequest(http.MethodGet, "/auth/me", nil)
	req.AddCookie(sessionCookie)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected /me to return 200 OK, got %d", rec.Code)
	}

	// 4. Test /me sans cookie (doit renvoyer 401 Unauthorized)
	reqUnauthorized := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
	recUnauthorized := httptest.NewRecorder()
	e.ServeHTTP(recUnauthorized, reqUnauthorized)

	if recUnauthorized.Code != http.StatusUnauthorized {
		t.Errorf("expected /me without cookie to return 401, got %d", recUnauthorized.Code)
	}
}
