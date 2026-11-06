package friends

import (
	"errors"
	"net/http"

	"github.com/PoQuatre/ft_transcendence/backend/internal/auth"
	"github.com/alexedwards/scs/v2"
	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
)

type handler struct {
	service        Service
	authService    auth.Service
	sessionManager *scs.SessionManager
}

func RegisterRoutes(group *echo.Group, service Service, sessionManager *scs.SessionManager, authService auth.Service) {
	h := handler{
		service:        service,
		authService:    authService,
		sessionManager: sessionManager,
	}

	group.POST("/requests/send", h.sendRequest)
	group.POST("/requests/accept", h.acceptRequest)
	group.POST("/requests/decline", h.declineRequest)
	group.GET("/requests/list", h.getFriendRequestsList)
	// group.GET("/list", h.getFriendsList)
}

func apiError(err error) error {
	switch {
	case errors.Is(err, auth.ErrNotFound),
		errors.Is(err, ErrRequestNotFound):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case errors.Is(err, auth.ErrInvalidCredentials):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case errors.Is(err, auth.ErrAlreadyExists),
		errors.Is(err, ErrFriendRequestAlreadyExists):
		return echo.NewHTTPError(http.StatusConflict, err.Error())
	default:
		return err
	}
}

// sendRequest godoc
// @Summary      Friend request
// @Description  Requires the session cookie from login. Sends a request to the specified user.
// @Tags         Friends
// @Accept       json
// @Produce      json
// @Param        request body friends.FriendRequestRequest true "Receiver username"
// @Success      200 {object} map[string]string "request successfully sent"
// @Failure      400 {object} map[string]string "invalid request body"
// @Failure      401 {object} map[string]string "unauthorized"
// @Router       /api/friends/requests/send [post].
func (h *handler) sendRequest(c *echo.Context) error {
	ctx := c.Request().Context()
	userIDStr := h.sessionManager.GetString(ctx, "user_id")
	if userIDStr == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized")
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized")
	}

	var req FriendRequestRequest
	if err = c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	receiver, err := h.authService.GetUserByUsername(ctx, req.Username)
	if err != nil {
		return apiError(err)
	}
	if receiver.ID == userID {
		return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized")
	}
	err = h.service.SendFriendRequest(ctx, userID, receiver.ID)
	if err != nil {
		return apiError(err)
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "request successfully sent."})
}

func (h *handler) acceptRequest(c *echo.Context) error {
	ctx := c.Request().Context()
	userIDStr := h.sessionManager.GetString(ctx, "user_id")
	if userIDStr == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized")
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized")
	}
	var req HandleFriendRequestRequest
	if err = c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	err = h.service.AddFriend(ctx, userID, req.SenderID)
	if err != nil {
		return apiError(err)
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "request successfully accepted."})
}

func (h *handler) declineRequest(c *echo.Context) error {
	ctx := c.Request().Context()
	userIDStr := h.sessionManager.GetString(ctx, "user_id")
	if userIDStr == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized")
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized")
	}
	var req HandleFriendRequestRequest
	if err = c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	err = h.service.repo.DeleteFriendRequest(ctx, req.SenderID, userID)
	if err != nil {
		return apiError(err)
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "request successfully declined."})
}

func (h *handler) getFriendRequestsList(c *echo.Context) error {
	ctx := c.Request().Context()
	userIDStr := h.sessionManager.GetString(ctx, "user_id")
	if userIDStr == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized")
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized")
	}
	friendRequestList, err := h.service.repo.GetPendingFriendRequests(ctx, userID)
	if err != nil {
		return apiError(err)
	}
	return c.JSON(http.StatusOK, friendRequestList)
}
