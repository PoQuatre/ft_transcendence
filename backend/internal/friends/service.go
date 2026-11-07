package friends

import (
	"context"
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
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
