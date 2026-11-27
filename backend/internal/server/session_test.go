package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v5"

	"github.com/PoQuatre/ft_transcendence/backend/internal/auth"
)

func TestSessionInactivity(t *testing.T) {
	for _, tc := range []struct {
		name       string
		stay       bool
		inactive   time.Duration
		wantStatus int
	}{
		{"ordinary expires after one hour", false, 2 * time.Hour, http.StatusUnauthorized},
		{"persistent survives two hours", true, 2 * time.Hour, http.StatusOK},
		{"persistent expires after thirty days", true, 31 * 24 * time.Hour, http.StatusUnauthorized},
	} {
		t.Run(tc.name, func(t *testing.T) {
			sm, err := newSessionManager(nil)
			if err != nil {
				t.Fatal(err)
			}
			e := echo.New()
			setupSessionMiddleware(e, sm)
			e.GET("/me", func(c *echo.Context) error {
				return c.NoContent(http.StatusOK)
			}, auth.Middleware(sm, nil, auth.AuthenticatedUser))
			ctx, err := sm.Load(t.Context(), "")
			if err != nil {
				t.Fatal(err)
			}
			sm.Put(ctx, "user_id", "2f1d5420-370b-45f9-96f9-d98bc909b974")
			sm.Put(ctx, "stay_signed_in", tc.stay)
			sm.Put(ctx, "last_activity", time.Now().Add(-tc.inactive).UnixNano())
			token, _, err := sm.Commit(ctx)
			if err != nil {
				t.Fatal(err)
			}
			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/me", nil)
			req.AddCookie(&http.Cookie{Name: sm.Cookie.Name, Value: token})
			rec := httptest.NewRecorder()
			e.ServeHTTP(rec, req)
			if rec.Code != tc.wantStatus {
				t.Fatalf("got %d, want %d", rec.Code, tc.wantStatus)
			}
			if rec.Code == http.StatusOK {
				ctx, err = sm.Load(t.Context(), token)
				if err != nil {
					t.Fatal(err)
				}
				if time.Since(time.Unix(0, sm.GetInt64(ctx, "last_activity"))) > time.Minute {
					t.Fatal("successful request did not refresh inactivity timeout")
				}
			}
		})
	}
}
