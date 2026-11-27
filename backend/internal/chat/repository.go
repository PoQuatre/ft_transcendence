package chat

import (
	"context"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type Repository interface {
	AreFriend(ctx context.Context, userID, friendID uuid.UUID) (bool, error)
}

type bunRepository struct {
	db *bun.DB
}

func NewRepository(db *bun.DB) Repository {
	return &bunRepository{db: db}
}

func (r *bunRepository) AreFriend(ctx context.Context, userID, friendID uuid.UUID) (bool, error) {
	exists, err := r.db.NewSelect().
		Table("friend_relations").
		Where("(user_id = ?0 AND friend_id = ?1) OR (user_id = ?1 AND friend_id = ?0)", userID, friendID).
		Exists(ctx)
	if err != nil {
		return false, err
	}
	return exists, nil
}
