// Package server provides the backend HTTP handler.
package server

import (
	"fmt"
	"net/http"
	"time"

	"github.com/alexedwards/scs/v2"
	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"
	"github.com/uptrace/bun"

	"github.com/PoQuatre/ft_transcendence/backend/internal/auth"
	"github.com/PoQuatre/ft_transcendence/backend/internal/helpers"
)

type config struct {
	database *bun.DB
}

type Option func(*config)

func WithDatabase(database *bun.DB) Option {
	return func(config *config) { config.database = database }
}

func New(options ...Option) (http.Handler, error) {
	cfg := config{}
	for _, option := range options {
		option(&cfg)
	}

	e := echo.New()

	e.Use(middleware.RequestID())
	e.Use(middleware.RequestLogger())
	e.Use(middleware.Recover())

	sessionManager := scs.New()
	sessionManager.IdleTimeout = 1 * time.Hour
	sessionManager.Cookie.Persist = false
	sessionManager.Cookie.SameSite = http.SameSiteLaxMode
	sessionManager.Cookie.Secure = true

	e.GET("/healthz", func(c *echo.Context) error {
		if cfg.database != nil {
			if err := cfg.database.PingContext(c.Request().Context()); err != nil {
				return c.JSON(http.StatusServiceUnavailable, map[string]string{"status": "unavailable"})
			}
		}
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})

	if cfg.database != nil {
		validat, err := helpers.NewCustomValidator()
		if err != nil {
			return nil, fmt.Errorf("custom validator : %w", err)
		}
		group := e.Group("/api/auth")
		group.Use(echo.WrapMiddleware(sessionManager.LoadAndSave))
		auth.RegisterRoutes(group, *auth.NewService(auth.NewRepository(cfg.database)), sessionManager, validat)
	}

	return e, nil
}
