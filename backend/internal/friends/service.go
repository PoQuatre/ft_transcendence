package friends

import (
	"context"
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"

	"github.com/PoQuatre/ft_transcendence/backend/internal/auth"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) SendFriendRequest(ctx context.Context, userID, receiverID uuid.UUID) error {
	err := s.repo.CreateFriendRequest(ctx, userID, receiverID)
	if err != nil {
		return err
	}
	// Potentially send a notification in some way ?
	return nil
}

func (s *Service) AddFriend(ctx context.Context, userID, senderID uuid.UUID) error {
	_, err := s.repo.GetFriendRequest(ctx, senderID, userID)
	if err != nil {
		return ErrRequestNotFound
	}
	err = s.repo.CreateFriendRelation(ctx, userID, senderID)
	if err != nil {
		return err
	}
	err = s.repo.DeleteFriendRequest(ctx, senderID, userID)
	return err
}

func (s *Service) Unfriend(ctx context.Context, userID, friendID uuid.UUID) error {
	exists, err := s.repo.AreFriend(ctx, userID, friendID)
	if err != nil {
		return err
	}
	if !exists {
		return echo.NewHTTPError(http.StatusUnauthorized, "user not in your friends list")
	}
	err = s.repo.DeleteFriendRelation(ctx, userID, friendID)
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) CanAccessFriendStuffes(c *echo.Context, authService *auth.Service, userIDStr string) (bool, uuid.UUID, error) {
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return false, userID, echo.NewHTTPError(http.StatusUnauthorized, "unauthorized")
	}
	user, err := authService.GetUserByID(c.Request().Context(), userID)
	if err != nil {
		return false, userID, err
	}
	if !user.Verified {
		return false, userID, echo.NewHTTPError(http.StatusForbidden, "you need to verify your mail")
	}
	return true, userID, nil
}

func (s *Service) GetPendingFriendRequests(ctx context.Context, userID uuid.UUID, page int) (FriendRequestsListResponse, error) {
	return s.repo.GetPendingFriendRequests(ctx, userID, page)
}

func (s *Service) GetFriendsList(ctx context.Context, userID uuid.UUID, page int) (FriendRelationListResponse, error) {
	return s.repo.GetFriendsList(ctx, userID, page)
}

func (s *Service) DeleteFriendRequest(ctx context.Context, senderID, receiverID uuid.UUID) error {
	return s.repo.DeleteFriendRequest(ctx, senderID, receiverID)
}
