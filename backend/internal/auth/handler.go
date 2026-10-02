// Package auth owns the /auth endpoint set and its handler, service and repository layers.
package auth

import (
	"errors"
	"net/http"
	"time"
	"unicode"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v5"
)

type CustomValidator struct {
	validator *validator.Validate
}

func (cv *CustomValidator) Validate(i any) error {
	if err := cv.validator.Struct(i); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return nil
}

func NewCustomValidator() (*CustomValidator, error) {
	v := validator.New()
	err := v.RegisterValidation("password_complexity", func(fl validator.FieldLevel) bool {
		pass := fl.Field().String()
		var hasNum, hasUpper, hasLower, hasSpecial bool
		for _, r := range pass {
			switch {
			case '0' <= r && r <= '9':
				hasNum = true
			case 'a' <= r && r <= 'z':
				hasLower = true
			case 'A' <= r && r <= 'Z':
				hasUpper = true
			case unicode.IsPunct(r) || unicode.IsSymbol(r):
				hasSpecial = true
			}
		}
		return hasNum && hasUpper && hasLower && hasSpecial
	})
	if err != nil {
		return nil, err
	}
	return &CustomValidator{validator: v}, nil
}

const sessionCookieName = "session_id"

type handler struct {
	service   Service
	validator *CustomValidator
}

func RegisterRoutes(group *echo.Group, service Service) error {
	val, err := NewCustomValidator()
	if err != nil {
		return err
	}

	h := handler{
		service:   service,
		validator: val,
	}

	group.POST("/signup", h.signup)
	group.POST("/login", h.login)
	group.POST("/logout", h.logout)
	group.GET("/me", h.me)

	return nil
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
	case errors.Is(err, ErrSessionNotFound),
		errors.Is(err, ErrSessionExpired):
		return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized")
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
	var req LoginRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if err := h.validator.Validate(&req); err != nil {
		return err
	}

	session, err := h.service.Login(c.Request().Context(), req)
	if err != nil {
		return apiError(err)
	}

	cookie := &http.Cookie{
		Name:     sessionCookieName,
		Value:    session.ID,
		Expires:  session.ExpiresAt,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   true, // Theorically we should always be on https
		// Secure: c.Scheme() == "https",
	}
	c.SetCookie(cookie)

	return c.JSON(http.StatusOK, map[string]any{"message": "logged in successfully"})
}

func (h *handler) logout(c *echo.Context) error {
	cookie, err := c.Cookie(sessionCookieName)
	if err == nil && cookie.Value != "" {
		_ = h.service.Logout(c.Request().Context(), cookie.Value)
	}

	expiredCookie := &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		Path:     "/",
		HttpOnly: true,
	}
	c.SetCookie(expiredCookie)

	return c.JSON(http.StatusOK, map[string]any{"message": "logged out successfully"})
}

func (h *handler) me(c *echo.Context) error {
	cookie, err := c.Cookie(sessionCookieName)
	if err != nil || cookie.Value == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized")
	}

	userResp, err := h.service.GetSession(c.Request().Context(), cookie.Value)
	if err != nil {
		return apiError(err)
	}

	return c.JSON(http.StatusOK, userResp)
}
