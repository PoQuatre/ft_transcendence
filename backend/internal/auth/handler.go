// Package auth owns the /auth endpoint set and its handler, service and repository layers.
package auth

import (
	"errors"
	"net/http"

	"github.com/alexedwards/scs/v2"
	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/PoQuatre/ft_transcendence/backend/internal/helpers"

	_ "github.com/PoQuatre/ft_transcendence/backend/docs"
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
	group.POST("/verify-email/request", h.requestEmailVerification)
	group.POST("/verify-email/confirm", h.confirmEmailVerification)
	group.POST("/change-password", h.changePassword)

	group.POST("/forgot-password", h.forgotPassword) // Sends the mail with the link
	group.POST("/reset-password", h.resetPassword)   // Sent by the link in the mail
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

// resetPassword godoc
// @Summary      Reset password
// @Description  Resets user password using a valid reset token
// @Tags         Password Reset
// @Accept       json
// @Produce      json
// @Param        request body auth.ResetPasswordRequest true "Reset token and new password"
// @Success      200 {object} map[string]string "password successfully updated."
// @Failure      400 {object} map[string]string "invalid request body or validation error"
// @Router       /api/auth/reset-password [post].
func (h *handler) resetPassword(c *echo.Context) error {
	ctx := c.Request().Context()
	var req ResetPasswordRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if err := h.validator.Validate(&req); err != nil {
		return err
	}
	if err := h.service.ResetPasswordWithToken(ctx, req.Token, req.Password); err != nil {
		return err
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "password successfully updated."})
}

// forgotPassword godoc
// @Summary      Request password reset
// @Description  Sends a password reset email with a magic link if the account exists and the email is verified
// @Tags         Password Reset
// @Accept       json
// @Produce      json
// @Param        request body auth.ForgotPasswordRequest true "User email"
// @Success      200 {object} map[string]string "email successfully sent."
// @Failure      400 {object} map[string]string "invalid request body or email not verified"
// @Failure      500 {object} map[string]string "internal server error"
// @Router       /api/auth/forgot-password [post].
func (h *handler) forgotPassword(c *echo.Context) error {
	ctx := c.Request().Context()
	var req ForgotPasswordRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	user, err := h.service.repo.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return apiError(err)
	}
	if !user.Verified {
		return echo.NewHTTPError(http.StatusBadRequest, "email not verified")
	}

	if err := h.service.SendForgotPasswordMail(ctx, user); err != nil {
		return apiError(err)
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "email successfully sent."})
}

// changePassword godoc
// @Summary      Change user password
// @Description  Changes the authentificated user's password after verifying the old password
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Param        request body auth.ChangePasswordRequest true "Old and new passwords"
// @Success      200 {object} map[string]string "password successfully changed."
// @Failure      400 {object} map[string]string "invalid request body, validation error, or incorrect old password"
// @Failure      401 {object} map[string]string "unauthorized"
// @Failure      404 {object} map[string]string "found no corresponding user"
// @Failure      500 {object} map[string]string "invalid session user id or internal server error"
// @Router       /api/auth/change-password [post].
func (h *handler) changePassword(c *echo.Context) error {
	ctx := c.Request().Context()
	if !h.sessionManager.Exists(ctx, "user_id") {
		return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized")
	}
	userIDStr := h.sessionManager.GetString(ctx, "user_id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized")
	}
	var req ChangePasswordRequest
	if err = c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if err = h.validator.Validate(&req); err != nil {
		return err
	}
	user, err := h.service.repo.GetUserByID(ctx, userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "found no corresponding user")
	}
	if err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.OldPassword)); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid password")
	}
	err = h.service.ChangeUserPassword(ctx, userID, req.NewPassword)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "password successfully changed."})
}

// confirmEmailVerification godoc
// @Summary      Confirm email verification
// @Description  Validates the user's email address using the verification code sent by email
// @Tags         Verification
// @Accept       json
// @Produce      json
// @Param        request body auth.MailVerificationRequest true "Verification code"
// @Success      200 {object} map[string]string "user email successfully validated"
// @Failure      400 {object} map[string]string "invalid request body or verification code"
// @Failure      401 {object} map[string]string "unauthorized"
// @Failure      500 {object} map[string]string "invalid session user id or internal server error"
// @Router       /api/auth/verify-email/confirm [post].
func (h *handler) confirmEmailVerification(c *echo.Context) error {
	ctx := c.Request().Context()
	var req MailVerificationRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	userIDStr := h.sessionManager.GetString(ctx, "user_id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "invalid session user id")
	}
	if err = h.service.CheckVerificationEmail(ctx, userID, req.Code); err != nil {
		return apiError(err)
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "user email successfully validated"})
}

// requestEmailVerification godoc
// @Summary      Request email verification
// @Description  Sends a new verification email to the authenticated user if their email is not verified yet
// @Tags         Verification
// @Produce      json
// @Success      200 {object} map[string]string "email verification sent"
// @Failure      400 {object} map[string]string "email already verified"
// @Failure      401 {object} map[string]string "unauthorized"
// @Failure      500 {object} map[string]string "invalid session user id or internal server error"
// @Router       /api/auth/verify-email/request [post].
func (h *handler) requestEmailVerification(c *echo.Context) error {
	ctx := c.Request().Context()
	userIDStr := h.sessionManager.GetString(ctx, "user_id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "invalid session user id")
	}
	user, err := h.service.GetUserByID(ctx, userID)
	if err != nil {
		return apiError(err)
	}

	if user.Verified {
		return echo.NewHTTPError(http.StatusBadRequest, "email already verified")
	}

	if err := h.service.SendVerificationEmail(ctx, userID, user.Email); err != nil {
		return apiError(err)
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "email verification sent"})
}

// signup godoc
// @Summary      User registration
// @Description  Registers a new user account, triggers verification email, and returns user profile
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Param        request body auth.SignupRequest true "Registration credentials"
// @Success      201 {object} auth.UserResponse
// @Failure      400 {object} map[string]string "invalid request body or validation error"
// @Failure      409 {object} map[string]string "username or email already taken"
// @Failure      500 {object} map[string]string "internal server error"
// @Router       /api/auth/signup [post].
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

// login godoc
// @Summary      User login
// @Description  Authenticates user credentials and initializes a new session
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Param        credentials body auth.LoginRequest true "Login credentials"
// @Success      200 {object} map[string]string "logged in successfully"
// @Failure      400 {object} map[string]string "already logged in, invalid request body, or validation error"
// @Failure      401 {object} map[string]string "invalid email or password"
// @Failure      500 {object} map[string]string "failed to renew session or internal server error"
// @Router       /api/auth/login [post].
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

// logout godoc
// @Summary      User logout
// @Description  Destroys the current user session and renews session token
// @Tags         Auth
// @Produce      json
// @Success      200 {object} map[string]string "logged out successfully"
// @Failure      400 {object} map[string]string "not logged in"
// @Failure      500 {object} map[string]string "failed to renew session"
// @Router       /api/auth/logout [post].
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

// me godoc
// @Summary      Get current user profile
// @Description  Retrieves authenticated user profile details from session
// @Tags         User
// @Produce      json
// @Success      200 {object} auth.UserResponse
// @Failure      401 {object} map[string]string "unauthorized"
// @Failure      500 {object} map[string]string "internal server error"
// @Router       /api/auth/me [get].
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
