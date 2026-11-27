package auth

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"net/http"

	"github.com/alexedwards/scs/v2"
	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
)

type userIDKey struct{}

type Access int

const (
	AnonymousAllowed Access = iota + 1
	AuthenticatedUser
	VerifiedUser
)

func UserID(ctx context.Context) (uuid.UUID, bool) {
	id, ok := ctx.Value(userIDKey{}).(uuid.UUID)
	return id, ok
}

func Middleware(sessions *scs.SessionManager, service *Service, access Access) echo.MiddlewareFunc {
	return middleware(sessions, service, access, false)
}

func APIKeyMiddleware(sessions *scs.SessionManager, service *Service, access Access) echo.MiddlewareFunc {
	return middleware(sessions, service, access, true)
}

func middleware(sessions *scs.SessionManager, service *Service, access Access, allowAPIKey bool) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			if access != AnonymousAllowed && access != AuthenticatedUser && access != VerifiedUser {
				return echo.NewHTTPError(http.StatusInternalServerError, "invalid access policy")
			}

			ctx := c.Request().Context()

			var id uuid.UUID
			values, hasKey := c.Request().Header[http.CanonicalHeaderKey("X-API-Key")]
			switch {
			case hasKey:
				if !allowAPIKey || len(values) != 1 || len(values[0]) != 64 {
					return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized")
				}
				if service == nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "authentication service unavailable")
				}
				hash := sha256.Sum256([]byte(values[0]))
				var err error
				id, err = service.repo.UseAPIKey(ctx, hex.EncodeToString(hash[:]))
				if errors.Is(err, sql.ErrNoRows) {
					return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized")
				}
				if err != nil {
					return err
				}
			case !sessions.Exists(ctx, "user_id"):
				if access != AnonymousAllowed {
					return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized")
				}

				return next(c)
			default:
				var err error
				id, err = uuid.Parse(sessions.GetString(ctx, "user_id"))
				if err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "invalid session user id")
				}
			}

			if access == VerifiedUser {
				if service == nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "verification service unavailable")
				}

				user, err := service.GetUserByID(ctx, id)
				if err != nil {
					return apiError(err)
				}

				if !user.Verified {
					return echo.NewHTTPError(http.StatusForbidden, "you need to verify your mail")
				}
			}

			c.SetRequest(c.Request().WithContext(context.WithValue(ctx, userIDKey{}, id)))
			return next(c)
		}
	}
}
