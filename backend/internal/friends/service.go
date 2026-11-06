package friends

import (
	"context"

	"github.com/google/uuid"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) SendFriendRequest(ctx context.Context, userID uuid.UUID, receiverID uuid.UUID) error {
	err := s.repo.CreateFriendRequest(ctx, userID, receiverID)
	if err != nil {
		return err
	}
	// Potentially send a notification in some way ?
	return nil
}

func (s *Service) AddFriend(ctx context.Context, userID uuid.UUID, senderID uuid.UUID) error {
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
