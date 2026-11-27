package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
)

func (r *bunRepository) GetAPIKey(ctx context.Context, userID uuid.UUID) (*APIKey, error) {
	key := new(APIKey)
	err := r.db.NewSelect().Model(key).Where("user_id = ?", userID).Scan(ctx)
	return key, err
}

func (r *bunRepository) SaveAPIKey(ctx context.Context, key *APIKey) error {
	_, err := r.db.NewInsert().Model(key).
		On("CONFLICT (user_id) DO UPDATE").
		Set("key_hash = EXCLUDED.key_hash").
		Set("prefix = EXCLUDED.prefix").
		Set("created_at = EXCLUDED.created_at").
		Set("last_used_at = NULL").
		Exec(ctx)
	return err
}

func (r *bunRepository) DeleteAPIKey(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.NewDelete().Model((*APIKey)(nil)).Where("user_id = ?", userID).Exec(ctx)
	return err
}

func (r *bunRepository) UseAPIKey(ctx context.Context, hash string) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.db.NewUpdate().Model((*APIKey)(nil)).
		Set("last_used_at = current_timestamp").
		Where("key_hash = ?", hash).
		Returning("user_id").
		Scan(ctx, &id)
	return id, err
}

// getAPIKey godoc
// @Summary      Get API key metadata
// @Description  Requires a verified account and the session cookie from login. The secret is not returned.
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
// @Description  Requires a verified account and the session cookie from login. Replaces any existing key; the secret is returned only once.
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

	var random [32]byte
	if _, err := rand.Read(random[:]); err != nil {
		return err
	}

	secret := hex.EncodeToString(random[:])
	hash := sha256.Sum256([]byte(secret))
	key := &APIKey{
		UserID:    id,
		KeyHash:   hex.EncodeToString(hash[:]),
		Prefix:    secret[:8],
		CreatedAt: time.Now().UTC(),
	}

	if err := h.service.repo.SaveAPIKey(c.Request().Context(), key); err != nil {
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
