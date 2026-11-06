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
