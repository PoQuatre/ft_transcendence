package friends

import (
	"errors"
	"net/http"

	"github.com/alexedwards/scs/v2"
	"github.com/labstack/echo/v5"

	"github.com/PoQuatre/ft_transcendence/backend/internal/auth"
)

type handler struct {
	service     *Service
	authService *auth.Service
}

func RegisterRoutes(group *echo.Group, service *Service, sessionManager *scs.SessionManager, authService *auth.Service) {
	h := handler{
		service:     service,
		authService: authService,
	}

	group.Use(auth.Middleware(sessionManager, authService, auth.VerifiedUser))

	group.POST("/requests/send", h.sendRequest)
	group.POST("/requests/accept", h.acceptRequest)
	group.POST("/requests/decline", h.declineRequest)
	group.POST("/unfriend", h.unfriendFriend)
	group.GET("/requests/list", h.getFriendRequestsList)
	group.GET("/list", h.getFriendsList)

	group.POST("/chat/send-message", h.sendMessage)
	group.GET("/chat/get-messages", h.getMessages)
}

func apiError(err error) error {
	switch {
	case errors.Is(err, auth.ErrNotFound),
		errors.Is(err, ErrFriendRelationNotFound),
		errors.Is(err, ErrRequestNotFound):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case errors.Is(err, auth.ErrInvalidCredentials):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case errors.Is(err, auth.ErrAlreadyExists),
		errors.Is(err, ErrFriendRelationAlreadyExists),
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
// @Failure      403 {object} map[string]string "you need to verify your email"
// @Router       /api/friends/requests/send [post].
func (h *handler) sendRequest(c *echo.Context) error {
	ctx := c.Request().Context()
	userID, _ := auth.UserID(ctx)
	var err error
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

// acceptRequest godoc
// @Summary      Accept Requests
// @Description  Requires the session cookie from login. Accepts a friend request from a specified user
// @Tags         Friends
// @Accept       json
// @Produce      json
// @Param        request body friends.HandleFriendRequestRequest true "Sender ID"
// @Success      200 {object} map[string]string "request successfully accepted."
// @Failure      400 {object} map[string]string "invalid request body"
// @Failure      401 {object} map[string]string "unauthorized"
// @Failure      403 {object} map[string]string "you need to verify your email"
// @Router       /api/friends/requests/accept [post].
func (h *handler) acceptRequest(c *echo.Context) error {
	ctx := c.Request().Context()
	userID, _ := auth.UserID(ctx)
	var err error

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

// declineRequest godoc
// @Summary      Decline Requests
// @Description  Requires the session cookie from login. Declines a friend request from a specified user
// @Tags         Friends
// @Accept       json
// @Produce      json
// @Param        request body friends.HandleFriendRequestRequest true "Sender ID"
// @Success      200 {object} map[string]string "request successfully declined."
// @Failure      400 {object} map[string]string "invalid request body"
// @Failure      401 {object} map[string]string "unauthorized"
// @Failure      403 {object} map[string]string "you need to verify your email"
// @Router       /api/friends/requests/decline [post].
func (h *handler) declineRequest(c *echo.Context) error {
	ctx := c.Request().Context()
	userID, _ := auth.UserID(ctx)
	var err error

	var req HandleFriendRequestRequest
	if err = c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	err = h.service.DeleteFriendRequest(ctx, req.SenderID, userID)
	if err != nil {
		return apiError(err)
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "request successfully declined."})
}

// getFriendRequestsList godoc
// @Summary      List Requests
// @Description  Requires the session cookie from login. Lists the friend requests
// @Tags         Friends
// @Produce      json
// @Param        request query GetListPageRequest false "Page index"
// @Success      200 {object} friends.FriendRequestsListResponse
// @Failure      401 {object} map[string]string "unauthorized"
// @Failure      403 {object} map[string]string "you need to verify your email"
// @Router       /api/friends/requests/list [get].
func (h *handler) getFriendRequestsList(c *echo.Context) error {
	ctx := c.Request().Context()
	userID, _ := auth.UserID(ctx)
	var err error

	var req GetListPageRequest
	if err = c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	friendRequestList, err := h.service.GetPendingFriendRequests(ctx, userID, req.Page)
	if err != nil {
		return apiError(err)
	}
	return c.JSON(http.StatusOK, friendRequestList)
}

// getFriendsList godoc
// @Summary      List Friends
// @Description  Requires the session cookie from login. Lists the friends
// @Tags         Friends
// @Produce      json
// @Param        request query GetListPageRequest false "Page index"
// @Success      200 {object} friends.FriendRelationListResponse
// @Failure      401 {object} map[string]string "unauthorized"
// @Failure      403 {object} map[string]string "you need to verify your email"
// @Router       /api/friends/list [get].
func (h *handler) getFriendsList(c *echo.Context) error {
	ctx := c.Request().Context()
	userID, _ := auth.UserID(ctx)
	var err error

	var req GetListPageRequest
	if err = c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	friendsList, err := h.service.GetFriendsList(ctx, userID, req.Page)
	if err != nil {
		return apiError(err)
	}
	return c.JSON(http.StatusOK, friendsList)
}

// unfriendFriend godoc
// @Summary      Unfriend User
// @Description  Requires the session cookie from login. Unfriends a specified user
// @Tags         Friends
// @Accept       json
// @Produce      json
// @Param        request body friends.UnfriendRequest true "Friend ID"
// @Success      200 {object} map[string]string "successfully unfriended."
// @Failure      400 {object} map[string]string "invalid request body"
// @Failure      401 {object} map[string]string "unauthorized"
// @Failure      403 {object} map[string]string "you need to verify your email"
// @Router       /api/friends/unfriend [post].
func (h *handler) unfriendFriend(c *echo.Context) error {
	ctx := c.Request().Context()
	userID, _ := auth.UserID(ctx)
	var err error

	var req UnfriendRequest
	if err = c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	err = h.service.Unfriend(ctx, userID, req.FriendID)
	if err != nil {
		return apiError(err)
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "successfully unfriended."})
}

// sendMessage godoc
// @Summary      Send Message to a friend user
// @Description  Requires the session cookie from login. Sends a message to a specified user if they are friends
// @Tags         Friends
// @Accept       json
// @Produce      json
// @Param        request body friends.SendMessageRequest true "Friend ID and Message"
// @Success      200 {object} map[string]string "successfully sent message."
// @Failure      400 {object} map[string]string "invalid request body"
// @Failure      401 {object} map[string]string "unauthorized"
// @Failure      403 {object} map[string]string "you need to verify your email"
// @Router       /api/friends/chat/send-message [post].
func (h *handler) sendMessage(c *echo.Context) error {
	ctx := c.Request().Context()
	userID, _ := auth.UserID(ctx)
	var err error

	var req SendMessageRequest
	if err = c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	err = h.service.SendMessageToFriend(ctx, userID, req.FriendID, req.Message)
	if err != nil {
		return apiError(err)
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "successfully sent message."})
}

// getMessages godoc
// @Summary      List Messages with a friend user
// @Description  Requires the session cookie from login. Lists the messages with a specified user if they are friends
// @Tags         Friends
// @Produce      json
// @Param        request query friends.GetMessagesRequest false "Friend ID"
// @Success      200 {object} friends.MessagesListResponse
// @Failure      400 {object} map[string]string "invalid request body"
// @Failure      401 {object} map[string]string "unauthorized"
// @Failure      403 {object} map[string]string "you need to verify your email"
// @Router       /api/friends/chat/get-messages [get].
func (h *handler) getMessages(c *echo.Context) error {
	ctx := c.Request().Context()
	userID, _ := auth.UserID(ctx)
	var err error

	var req GetMessagesRequest
	if err = c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	messages, err := h.service.GetMessagesFromFriend(ctx, userID, req.FriendID)
	if err != nil {
		return apiError(err)
	}
	return c.JSON(http.StatusOK, messages)
}
