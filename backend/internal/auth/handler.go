// Package auth owns the /auth endpoint set and its handler, service and repository layers.
package auth

import (
	"errors"
	"net/http"
	"time"

	"github.com/alexedwards/scs/v2"
	"github.com/labstack/echo/v5"

	"github.com/PoQuatre/ft_transcendence/backend/internal/helpers"
)

type handler struct {
	service        *Service
	validator      *helpers.CustomValidator
	sessionManager *scs.SessionManager
	onLogout       func(string)
}

const LogoutPath = "/logout"

func RegisterRoutes(group *echo.Group, service *Service, sessionManager *scs.SessionManager, val *helpers.CustomValidator, onLogout func(string)) {
	h := handler{
		service:        service,
		validator:      val,
		sessionManager: sessionManager,
		onLogout:       onLogout,
	}

	group.POST("/signup", h.signup)
	group.POST("/login", h.login, Middleware(sessionManager, service, AnonymousAllowed))
	group.POST(LogoutPath, h.logout, Middleware(sessionManager, service, AnonymousAllowed))
	group.POST("/verify-email/request", h.requestEmailVerification, Middleware(sessionManager, service, AuthenticatedUser))
	group.POST("/verify-email/confirm", h.confirmEmailVerification, Middleware(sessionManager, service, AuthenticatedUser))
	group.POST("/change-password", h.changePassword, Middleware(sessionManager, service, AuthenticatedUser))

	group.POST("/forgot-password", h.forgotPassword) // Sends the mail with the link
	group.POST("/reset-password", h.resetPassword)   // Sent by the link in the mail

	group.GET("/me", h.me, APIKeyMiddleware(sessionManager, service, AuthenticatedUser))
	group.DELETE("/me", h.deleteAccount, Middleware(sessionManager, service, AuthenticatedUser))
	group.PATCH("/me", h.changeEmailAndUsername, Middleware(sessionManager, service, AuthenticatedUser))
	group.GET("/me/export", h.exportData, Middleware(sessionManager, service, AuthenticatedUser))

	group.GET("/api-key", h.getAPIKey, Middleware(sessionManager, service, VerifiedUser))
	group.POST("/api-key", h.createAPIKey, Middleware(sessionManager, service, VerifiedUser))
	group.DELETE("/api-key", h.deleteAPIKey, Middleware(sessionManager, service, VerifiedUser))
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
// @Description  Sends a password reset email with a magic link if the account exists
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
	user, err := h.service.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return apiError(err)
	}

	if err := h.service.SendForgotPasswordMail(ctx, user); err != nil {
		return apiError(err)
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "email successfully sent."})
}

// changePassword godoc
// @Summary      Change user password
// @Description  Requires the session cookie from login. Changes the user's password after verifying the old password.
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
	userID, _ := UserID(ctx)
	var err error
	var req ChangePasswordRequest
	if err = c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if err = h.validator.Validate(&req); err != nil {
		return apiError(err)
	}
	err = h.service.ChangeUserPassword(ctx, userID, req.OldPassword, req.NewPassword)
	if err != nil {
		return apiError(err)
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "password successfully changed."})
}

// confirmEmailVerification godoc
// @Summary      Confirm email verification
// @Description  Requires the session cookie from login. Validates the user's email using the verification code sent by email.
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
	userID, _ := UserID(ctx)
	if err := h.service.CheckVerificationEmail(ctx, userID, req.Code); err != nil {
		return apiError(err)
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "user email successfully validated"})
}

// requestEmailVerification godoc
// @Summary      Request email verification
// @Description  Requires the session cookie from login. Sends a new verification email if the user's email is not verified yet.
// @Tags         Verification
// @Produce      json
// @Success      200 {object} map[string]string "email verification sent"
// @Failure      400 {object} map[string]string "email already verified"
// @Failure      401 {object} map[string]string "unauthorized or invalid session user id"
// @Failure      500 {object} map[string]string "internal server error"
// @Router       /api/auth/verify-email/request [post].
func (h *handler) requestEmailVerification(c *echo.Context) error {
	ctx := c.Request().Context()
	userID, _ := UserID(ctx)
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
// @Description  Authenticates user credentials and sets a session cookie for authenticated requests.
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
	if _, ok := UserID(c.Request().Context()); ok {
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

	lifetime := 24 * time.Hour
	if req.StaySignedIn {
		lifetime = 90 * 24 * time.Hour
	}
	h.sessionManager.RememberMe(c.Request().Context(), req.StaySignedIn)
	h.sessionManager.SetDeadline(c.Request().Context(), time.Now().Add(lifetime))
	h.sessionManager.Put(c.Request().Context(), "stay_signed_in", req.StaySignedIn)
	h.sessionManager.Put(c.Request().Context(), "last_activity", time.Now().UnixNano())
	h.sessionManager.Put(c.Request().Context(), "user_id", userResp.ID)

	return c.JSON(http.StatusOK, map[string]any{"message": "logged in successfully"})
}

// logout godoc
// @Summary      User logout
// @Description  Requires the session cookie from login. Destroys the current user session.
// @Tags         Auth
// @Produce      json
// @Success      200 {object} map[string]string "logged out successfully"
// @Failure      400 {object} map[string]string "not logged in"
// @Failure      500 {object} map[string]string "failed to destroy session"
// @Router       /api/auth/logout [post].
func (h *handler) logout(c *echo.Context) error {
	ctx := c.Request().Context()
	userID, ok := UserID(ctx)
	if !ok {
		return echo.NewHTTPError(http.StatusBadRequest, "not logged in")
	}

	if err := h.sessionManager.Destroy(ctx); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to destroy session")
	}
	if h.onLogout != nil {
		h.onLogout(userID.String())
	}

	return c.JSON(http.StatusOK, map[string]any{"message": "logged out successfully"})
}

// me godoc
// @Summary      Get current user profile
// @Description  Accepts the login session cookie or X-API-Key. A supplied key takes precedence; invalid keys never fall back to the session.
// @Description  Rolling limits: 60 API-key attempts per IP and 60 authenticated attempts per key per minute. The IP limit applies before authentication, including valid keys. Limits are in memory and reset on backend restart.
// @Tags         User
// @Produce      json
// @Security     SessionCookie
// @Security     APIKeyAuth
// @Success      200 {object} auth.UserResponse
// @Failure      401 {object} map[string]string "unauthorized"
// @Failure      429 {object} map[string]string "API key rate limit exceeded"
// @Failure      500 {object} map[string]string "internal server error"
// @Router       /api/auth/me [get].
func (h *handler) me(c *echo.Context) error {
	userID, _ := UserID(c.Request().Context())
	userResp, err := h.service.GetUserByID(c.Request().Context(), userID)
	if err != nil {
		return apiError(err)
	}

	return c.JSON(http.StatusOK, userResp)
}

// deleteAccount godoc
// @Summary      Delete your account data
// @Description  Requires the session cookie from login. Delete User's data.
// @Tags         User
// @Accept       json
// @Produce      json
// @Param        credentials body auth.DeleteAccountRequest true "password"
// @Success      200 {object} map[string]string "successfully deleted account."
// @Failure      400 {object} map[string]string "invalid password"
// @Failure      400 {object} map[string]string "invalid request body"
// @Failure      401 {object} map[string]string "unauthorized"
// @Failure      500 {object} map[string]string "internal server error"
// @Router       /api/auth/me [delete].
func (h *handler) deleteAccount(c *echo.Context) error {
	ctx := c.Request().Context()
	userID, _ := UserID(ctx)
	var err error
	var req DeleteAccountRequest
	if err = c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if err = h.validator.Validate(&req); err != nil {
		return apiError(err)
	}
	err = h.service.DeleteAccount(ctx, userID, req.Password)
	if err != nil {
		return apiError(err)
	}

	h.sessionManager.Remove(c.Request().Context(), "user_id")
	return c.JSON(http.StatusNoContent, map[string]any{"message": "successfully deleted account."})
}

// changeEmailAndUsername godoc
// @Summary      Change profile
// @Description  Requires the session cookie from login. Change User's mail and/or password.
// @Tags         User
// @Accept       json
// @Produce      json
// @Param        credentials body auth.PatchProfileRequest true "email and username"
// @Success      200 {object} map[string]string "successfully updated profile."
// @Failure      400 {object} map[string]string "invalid request body"
// @Failure      401 {object} map[string]string "unauthorized"
// @Failure      409 {object} map[string]string "email or username already used"
// @Failure      500 {object} map[string]string "internal server error"
// @Router       /api/auth/me [patch].
func (h *handler) changeEmailAndUsername(c *echo.Context) error {
	ctx := c.Request().Context()
	userID, _ := UserID(ctx)
	var req PatchProfileRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if err := h.validator.Validate(&req); err != nil {
		return apiError(err)
	}
	if err := h.service.UpdateProfile(ctx, userID, req.Email, req.Username); err != nil {
		return apiError(err)
	}
	return c.JSON(http.StatusNoContent, map[string]any{"message": "successfully updated profile."})
}

// exportData    godoc
// @Summary      Export your account data
// @Description  Requires the session cookie from login. Export User's data.
// @Tags         User
// @Produce      json
// @Success      200 {object} auth.DataExport
// @Failure      401 {object} map[string]string "unauthorized"
// @Failure      500 {object} map[string]string "internal server error"
// @Router       /api/auth/me/export [get].
func (h *handler) exportData(c *echo.Context) error {
	ctx := c.Request().Context()
	userID, _ := UserID(ctx)
	dataResponse, err := h.service.GetDataFromUser(ctx, userID)
	if err != nil {
		return apiError(err)
	}
	return c.JSON(http.StatusOK, dataResponse)
}
