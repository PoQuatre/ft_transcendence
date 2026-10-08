// Package auth owns the /auth endpoint set and its handler, service and repository layers.
package auth

import (
	"errors"
	"net/http"

	"github.com/alexedwards/scs/v2"
	"github.com/google/uuid"
	"github.com/labstack/echo/v5"

	"github.com/PoQuatre/ft_transcendence/backend/internal/helpers"
)

type handler struct {
	service        Service
	validator      *helpers.CustomValidator
	sessionManager *scs.SessionManager
}

func RegisterRoutes(group *echo.Group, service Service, sessionManager *scs.SessionManager, val *helpers.CustomValidator) {
	h := handler{
		service:        service,
		validator:      val,
		sessionManager: sessionManager,
	}

	group.POST("/signup", h.signup)
	group.POST("/login", h.login)
	group.POST("/logout", h.logout)
	group.GET("/me", h.me)
}

func apiError(err error) error {
	switch {
	case errors.Is(err, ErrNotFound):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case errors.Is(err, ErrInvalidCredentials):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case errors.Is(err, ErrAlreadyExists),
		errors.Is(err, ErrEmailAlreadyExists),
		errors.Is(err, ErrUsernameAlreadyExists):
		return echo.NewHTTPError(http.StatusConflict, err.Error())
	default:
		return err
	}
}

func (h *handler) signup(c *echo.Context) error {
	var req SignupRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if err := h.validator.Validate(&req); err != nil {
		return err
	}

	userResp, err := h.service.SignUp(c.Request().Context(), req)
	if err != nil {
		return apiError(err)
	}

	return c.JSON(http.StatusCreated, userResp)
}

func (h *handler) login(c *echo.Context) error {
	ctx := c.Request().Context()
	if h.sessionManager.Exists(ctx, "user_id") {
		return echo.NewHTTPError(http.StatusBadRequest, "already logged in")
	}

	var req LoginRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if err := h.validator.Validate(&req); err != nil {
		return err
	}

	userResp, err := h.service.Login(c.Request().Context(), req)
	if err != nil {
		return apiError(err)
	}

	if err := h.sessionManager.RenewToken(c.Request().Context()); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to renew session")
	}

	h.sessionManager.Put(c.Request().Context(), "user_id", userResp.ID)

	return c.JSON(http.StatusOK, map[string]any{"message": "logged in successfully"})
}

func (h *handler) logout(c *echo.Context) error {
	ctx := c.Request().Context()
	if !h.sessionManager.Exists(ctx, "user_id") {
		return echo.NewHTTPError(http.StatusBadRequest, "not logged in")
	}

	h.sessionManager.Remove(c.Request().Context(), "user_id")
	if err := h.sessionManager.RenewToken(ctx); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to renew session")
	}

	return c.JSON(http.StatusOK, map[string]any{"message": "logged out successfully"})
}

func (h *handler) me(c *echo.Context) error {
	userIDStr := h.sessionManager.GetString(c.Request().Context(), "user_id")
	if userIDStr == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized")
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal server error")
	}

	userResp, err := h.service.GetUserByID(c.Request().Context(), userID)
	if err != nil {
		return apiError(err)
	}

	return c.JSON(http.StatusOK, userResp)
}
