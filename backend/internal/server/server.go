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
	"github.com/PoQuatre/ft_transcendence/backend/internal/game/webrtc"
	"github.com/PoQuatre/ft_transcendence/backend/internal/helpers"
)

type config struct {
	database *bun.DB
	webrtc   *webrtc.Server
}

type Option func(*config)

func WithDatabase(database *bun.DB) Option {
	return func(config *config) { config.database = database }
}

func WithWebRTC(webrtcServer *webrtc.Server) Option {
	return func(config *config) { config.webrtc = webrtcServer }
}

func New(options ...Option) (http.Handler, error) {
	cfg := config{}
	for _, option := range options {
		option(&cfg)
	}

	e := echo.New()
	e.IPExtractor = echo.ExtractIPFromXFFHeader()

	e.Use(middleware.RequestID())
	e.Use(middleware.RequestLogger())
	e.Use(middleware.Recover())

	sessionManager := scs.New()
	sessionManager.IdleTimeout = 1 * time.Hour
	sessionManager.Cookie.Persist = false
	sessionManager.Cookie.SameSite = http.SameSiteLaxMode
	sessionManager.Cookie.Secure = true

	e.Use(echo.WrapMiddleware(sessionManager.LoadAndSave))

	validat, err := helpers.NewCustomValidator()
	if err != nil {
		return nil, fmt.Errorf("custom validator : %w", err)
	}

	e.GET("/healthz", func(c *echo.Context) error {
		if cfg.database != nil {
			if err := cfg.database.PingContext(c.Request().Context()); err != nil {
				return c.JSON(http.StatusServiceUnavailable, map[string]string{"status": "unavailable"})
			}
		}
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})

	if cfg.database != nil {
		auth.RegisterRoutes(e.Group("/api/auth"), *auth.NewService(auth.NewRepository(cfg.database)), sessionManager, validat)
	}
	if cfg.webrtc != nil {
		webrtc.RegisterRoutes(e.Group("/api/webrtc"), cfg.webrtc)
	}

	return e, nil
}
