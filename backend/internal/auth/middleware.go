package auth

import (
	"context"
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
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			if access != AnonymousAllowed && access != AuthenticatedUser && access != VerifiedUser {
				return echo.NewHTTPError(http.StatusInternalServerError, "invalid access policy")
			}

			ctx := c.Request().Context()

			if !sessions.Exists(ctx, "user_id") {
				if access != AnonymousAllowed {
					return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized")
				}

				return next(c)
			}

			id, err := uuid.Parse(sessions.GetString(ctx, "user_id"))
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "invalid session user id")
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
