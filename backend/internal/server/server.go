// Package server provides the backend HTTP handler.
//
// @title           Transcendence API
// @version         1.0
// @description     Backend API for ft_transcendence
// @BasePath        /
// @securityDefinitions.apikey APIKeyAuth
// @in header
// @name X-API-Key
// @securityDefinitions.apikey SessionCookie
// @in header
// @name Cookie
package server

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/alexedwards/scs/bunstore"
	"github.com/alexedwards/scs/v2"
	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"

	"github.com/uptrace/bun"

	"github.com/PoQuatre/ft_transcendence/backend/internal/auth"
	"github.com/PoQuatre/ft_transcendence/backend/internal/friends"
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
	locks map[string]*keyedLock
	mu    sync.Mutex
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

type sessionStore struct {
	*bunstore.BunStore
	db *bun.DB
}

// BunStore.FindCtx treats query errors as missing sessions when the count is zero.
func (s *sessionStore) FindCtx(ctx context.Context, token string) ([]byte, bool, error) {
	var data []byte
	err := s.db.NewSelect().Table("sessions").Column("data").
		Where("token = ? AND expiry >= ?", token, time.Now()).Scan(ctx, &data)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, false, nil
	}
	return data, err == nil, err
}

func WithDatabase(database *bun.DB) Option {
	return func(config *config) { config.database = database }
}

func WithWebRTC(webrtcServer *webrtc.Server) Option {
	return func(config *config) { config.webrtc = webrtcServer }
}

func newSessionManager(database *bun.DB) (*scs.SessionManager, error) {
	manager := scs.New()
	manager.HashTokenInStore = true
	manager.Cookie.Persist = false
	manager.Cookie.SameSite = http.SameSiteLaxMode
	manager.Cookie.Secure = true
	if database != nil {
		store, err := bunstore.New(database)
		if err != nil {
			return nil, fmt.Errorf("create session store: %w", err)
		}
		manager.Store = &sessionStore{BunStore: store, db: database}
	}
	return manager, nil
}

func setupSessionMiddleware(e *echo.Echo, sessionManager *scs.SessionManager) {
	var sessionLocks, accountLocks keyedLocks
	needsLock := func(path string) bool {
		return path == webrtcPrefix+webrtc.OfferPath || path == authPrefix+auth.LogoutPath
	}

	// Serialize requests for the same session so logout cannot be undone by a stale save.
	e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			if cookie, err := c.Request().Cookie(sessionManager.Cookie.Name); err == nil && cookie.Value != "" {
				unlock := sessionLocks.lock(cookie.Value)
				defer unlock()
			}
			return next(c)
		}
	})

	e.Use(echo.WrapMiddleware(sessionManager.LoadAndSave))

	// Apply the inactivity limit selected at login and refresh it on activity.
	e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			ctx := c.Request().Context()
			if sessionManager.Exists(ctx, "user_id") {
				idle := time.Hour
				if sessionManager.GetBool(ctx, "stay_signed_in") {
					idle = 30 * 24 * time.Hour
				}
				now := time.Now()
				if now.Sub(time.Unix(0, sessionManager.GetInt64(ctx, "last_activity"))) >= idle {
					if err := sessionManager.Destroy(ctx); err != nil {
						return err
					}
				} else {
					sessionManager.Put(ctx, "last_activity", now.UnixNano())
				}
			}
			return next(c)
		}
	})

	// Coordinate logout and WebRTC offers across an account's sessions.
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

	sessionManager, sessionErr := newSessionManager(cfg.database)
	if sessionErr != nil {
		return nil, sessionErr
	}
	setupSessionMiddleware(e, sessionManager)

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
		authService := auth.NewService(auth.NewRepository(cfg.database))
		auth.RegisterRoutes(e.Group("/api/auth"), authService, sessionManager, validat, onLogout)
		friends.RegisterRoutes(e.Group("/api/friends"), friends.NewService(friends.NewRepository(cfg.database)), sessionManager, authService)
	}
	if cfg.webrtc != nil {
		webrtc.RegisterRoutes(e.Group(webrtcPrefix, auth.Middleware(sessionManager, nil, auth.AnonymousAllowed)), cfg.webrtc, func(r *http.Request) (webrtc.Identity, error) {
			id, ok := auth.UserID(r.Context())
			if !ok {
				return webrtc.Identity{}, nil
			}
			if cfg.database == nil {
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
