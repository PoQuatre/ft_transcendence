package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alexedwards/scs/v2"
	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
)

func TestAuthenticationRoutes(t *testing.T) {
	sessions := scs.New()
	e := echo.New()
	e.Use(echo.WrapMiddleware(sessions.LoadAndSave))
	e.GET("/session/:id", func(c *echo.Context) error {
		sessions.Put(c.Request().Context(), "user_id", c.Param("id"))
		return c.NoContent(http.StatusNoContent)
	})
	handler := func(c *echo.Context) error {
		if id, ok := UserID(c.Request().Context()); ok {
			return c.String(http.StatusOK, id.String())
		}
		return c.String(http.StatusOK, "guest")
	}
	e.GET("/optional", handler, Middleware(sessions, nil, AnonymousAllowed))
	e.GET("/required", handler, Middleware(sessions, nil, AuthenticatedUser))

	cookie := func(id string) *http.Cookie {
		t.Helper()
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/session/"+id, nil))
		return rec.Result().Cookies()[0]
	}
	valid := cookie("2f1d5420-370b-45f9-96f9-d98bc909b974")
	malformed := cookie("not-a-uuid")
	invalid := &http.Cookie{Name: sessions.Cookie.Name, Value: "invalid"}
	for _, tc := range []struct {
		name, path, body string
		cookie           *http.Cookie
		status           int
	}{
		{"guest optional", "/optional", "guest", nil, 200},
		{"guest required", "/required", "", nil, 401},
		{"invalid optional", "/optional", "guest", invalid, 200},
		{"invalid required", "/required", "", invalid, 401},
		{"authenticated optional", "/optional", "2f1d5420-370b-45f9-96f9-d98bc909b974", valid, 200},
		{"authenticated required", "/required", "2f1d5420-370b-45f9-96f9-d98bc909b974", valid, 200},
		{"malformed optional", "/optional", "", malformed, 500},
		{"malformed required", "/required", "", malformed, 500},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, tc.path, nil)
			if tc.cookie != nil {
				req.AddCookie(tc.cookie)
			}
			rec := httptest.NewRecorder()
			e.ServeHTTP(rec, req)
			if rec.Code != tc.status || (tc.body != "" && rec.Body.String() != tc.body) {
				t.Fatalf("got status %d, body %q; want %d, %q", rec.Code, rec.Body.String(), tc.status, tc.body)
			}
		})
	}
}

func TestVerifiedAuthenticationRoute(t *testing.T) {
	sessions := scs.New()
	repo := newMockRepository()
	verifiedID := uuid.MustParse("2f1d5420-370b-45f9-96f9-d98bc909b974")
	unverifiedID := uuid.MustParse("3f1d5420-370b-45f9-96f9-d98bc909b974")
	repo.users["verified"] = &User{ID: verifiedID, Verified: true}
	repo.users["unverified"] = &User{ID: unverifiedID}
	e := echo.New()
	e.Use(echo.WrapMiddleware(sessions.LoadAndSave))
	e.GET("/session/:id", func(c *echo.Context) error {
		sessions.Put(c.Request().Context(), "user_id", c.Param("id"))
		return c.NoContent(http.StatusNoContent)
	})
	e.GET("/verified", func(c *echo.Context) error {
		return c.NoContent(http.StatusNoContent)
	}, Middleware(sessions, NewService(repo), VerifiedUser))
	e.GET("/missing-service", func(c *echo.Context) error {
		return c.NoContent(http.StatusNoContent)
	}, Middleware(sessions, nil, VerifiedUser))
	e.GET("/invalid-policy", func(c *echo.Context) error {
		return c.NoContent(http.StatusNoContent)
	}, Middleware(sessions, nil, 0))
	for _, tc := range []struct {
		name, path, id string
		want           int
	}{
		{"anonymous", "/verified", "", http.StatusUnauthorized},
		{"unverified", "/verified", unverifiedID.String(), http.StatusForbidden},
		{"verified", "/verified", verifiedID.String(), http.StatusNoContent},
		{"deleted user", "/verified", uuid.NewString(), http.StatusNotFound},
		{"malformed session", "/verified", "not-a-uuid", http.StatusInternalServerError},
		{"missing service", "/missing-service", verifiedID.String(), http.StatusInternalServerError},
		{"invalid policy", "/invalid-policy", "", http.StatusInternalServerError},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, tc.path, nil)
			if tc.id != "" {
				rec := httptest.NewRecorder()
				e.ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/session/"+tc.id, nil))
				req.AddCookie(rec.Result().Cookies()[0])
			}
			rec := httptest.NewRecorder()
			e.ServeHTTP(rec, req)
			if rec.Code != tc.want {
				t.Fatalf("status = %d, want %d", rec.Code, tc.want)
			}
		})
	}
}
