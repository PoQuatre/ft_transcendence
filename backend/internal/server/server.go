// Package server provides the backend HTTP handler.
//
// @title           Transcendence API
// @version         1.0
// @description     Backend API for ft_transcendence
// @BasePath        /
package server

import (
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/alexedwards/scs/v2"
	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"

	"github.com/uptrace/bun"

	"github.com/PoQuatre/ft_transcendence/backend/internal/auth"
	"github.com/PoQuatre/ft_transcendence/backend/internal/game/webrtc"
	"github.com/PoQuatre/ft_transcendence/backend/internal/helpers"
	"github.com/PoQuatre/ft_transcendence/backend/internal/swagger"
)

const (
	authPrefix   = "/api/auth"
	webrtcPrefix = "/api/webrtc"
)

type config struct {
	database *bun.DB
	webrtc   *webrtc.Server
}

type keyedLocks struct {
	mu    sync.Mutex
	locks map[string]*keyedLock
}

type keyedLock struct {
	mu   sync.Mutex
	refs int
}

func (k *keyedLocks) lock(key string) func() {
	k.mu.Lock()
	if k.locks == nil {
		k.locks = make(map[string]*keyedLock)
	}
	lock := k.locks[key]
	if lock == nil {
		lock = &keyedLock{}
		k.locks[key] = lock
	}
	lock.refs++
	k.mu.Unlock()
	lock.mu.Lock()
	return func() {
		lock.mu.Unlock()
		k.mu.Lock()
		lock.refs--
		if lock.refs == 0 {
			delete(k.locks, key)
		}
		k.mu.Unlock()
	}
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

	// Lock before loading a session, then by account to cover multiple sessions.
	var sessionLocks, accountLocks keyedLocks
	needsLock := func(path string) bool {
		return path == webrtcPrefix+webrtc.OfferPath || path == authPrefix+auth.LogoutPath
	}
	e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			if needsLock(c.Request().URL.Path) {
				if cookie, err := c.Request().Cookie(sessionManager.Cookie.Name); err == nil && cookie.Value != "" {
					unlock := sessionLocks.lock(cookie.Value)
					defer unlock()
				}
			}
			return next(c)
		}
	})
	e.Use(echo.WrapMiddleware(sessionManager.LoadAndSave))
	e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			if needsLock(c.Request().URL.Path) {
				if id := sessionManager.GetString(c.Request().Context(), "user_id"); id != "" {
					unlock := accountLocks.lock(id)
					defer unlock()
				}
			}
			return next(c)
		}
	})

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

	swagger.RegisterRoutes(e.Group("/api/docs"))

	if cfg.database != nil {
		var onLogout func(string)
		if cfg.webrtc != nil {
			onLogout = cfg.webrtc.DisconnectAccount
		}
		auth.RegisterRoutes(e.Group(authPrefix), *auth.NewService(auth.NewRepository(cfg.database)), sessionManager, validat, onLogout)
	}
	if cfg.webrtc != nil {
		webrtc.RegisterRoutes(e.Group(webrtcPrefix), cfg.webrtc, func(r *http.Request) (webrtc.Identity, error) {
			_, cookieErr := r.Cookie(sessionManager.Cookie.Name)
			if errors.Is(cookieErr, http.ErrNoCookie) && r.Header.Get("Authorization") == "" {
				return webrtc.Identity{}, nil
			}
			id, err := uuid.Parse(sessionManager.GetString(r.Context(), "user_id"))
			if err != nil || cfg.database == nil || r.Header.Get("Authorization") != "" {
				return webrtc.Identity{}, echo.NewHTTPError(http.StatusUnauthorized, "invalid or expired credentials")
			}
			user, err := auth.NewService(auth.NewRepository(cfg.database)).GetUserByID(r.Context(), id)
			if err != nil {
				if errors.Is(err, auth.ErrNotFound) {
					return webrtc.Identity{}, echo.NewHTTPError(http.StatusUnauthorized, "invalid or expired credentials")
				}
				return webrtc.Identity{}, err
			}
			return webrtc.Identity{AccountID: id.String(), Username: user.Username}, nil
		})
	}

	return e, nil
}
