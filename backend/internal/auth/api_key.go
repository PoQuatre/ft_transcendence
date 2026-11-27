package auth

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/labstack/echo/v5"
)

// getAPIKey godoc
// @Summary      Get API key metadata
// @Description  Requires a verified account and the session cookie from login. The secret is not returned. Keys do not expire automatically. last_used_at records successful key authentication, even if the endpoint subsequently returns an error.
// @Tags         API Keys
// @Produce      json
// @Security     SessionCookie
// @Success      200 {object} auth.APIKey
// @Success      204 "No API key exists"
// @Failure      401 {object} map[string]string "unauthorized"
// @Failure      403 {object} map[string]string "email not verified"
// @Failure      500 {object} map[string]string "internal server error"
// @Router       /api/auth/api-key [get].
func (h *handler) getAPIKey(c *echo.Context) error {
	id, _ := UserID(c.Request().Context())
	key, err := h.service.repo.GetAPIKey(c.Request().Context(), id)
	if errors.Is(err, sql.ErrNoRows) {
		return c.NoContent(http.StatusNoContent)
	}
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, key)
}

// createAPIKey godoc
// @Summary      Create or regenerate an API key
// @Description  Requires a verified account and the session cookie from login. Replaces any existing key; the secret is returned only once. Keys do not expire automatically.
// @Tags         API Keys
// @Produce      json
// @Security     SessionCookie
// @Success      201 {object} auth.APIKey{key=string}
// @Failure      401 {object} map[string]string "unauthorized"
// @Failure      403 {object} map[string]string "email not verified"
// @Failure      500 {object} map[string]string "internal server error"
// @Router       /api/auth/api-key [post].
func (h *handler) createAPIKey(c *echo.Context) error {
	id, _ := UserID(c.Request().Context())

	key, secret, err := h.service.CreateAPIKey(c.Request().Context(), id)
	if err != nil {
		return err
	}

	return c.JSON(http.StatusCreated, struct {
		*APIKey
		Key string `json:"key"`
	}{key, secret})
}

// deleteAPIKey godoc
// @Summary      Delete an API key
// @Description  Requires a verified account and the session cookie from login. Succeeds even if no key exists.
// @Tags         API Keys
// @Security     SessionCookie
// @Success      204 "API key deleted or absent"
// @Failure      401 {object} map[string]string "unauthorized"
// @Failure      403 {object} map[string]string "email not verified"
// @Failure      500 {object} map[string]string "internal server error"
// @Router       /api/auth/api-key [delete].
func (h *handler) deleteAPIKey(c *echo.Context) error {
	id, _ := UserID(c.Request().Context())

	if err := h.service.repo.DeleteAPIKey(c.Request().Context(), id); err != nil {
		return err
	}

	return c.NoContent(http.StatusNoContent)
}
