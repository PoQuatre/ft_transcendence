package friends

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

var (
	ErrNotFound                   = errors.New("user not found")
	ErrSessionNotFound            = errors.New("session not found")
	ErrFriendRequestAlreadyExists = errors.New("request already sent")
)

type Repository interface {
	CreateFriendRequest(ctx context.Context, senderID uuid.UUID, receiverID uuid.UUID) error
}

type bunRepository struct {
	db *bun.DB
}

func NewRepository(db *bun.DB) Repository {
	return &bunRepository{db: db}
}

func (r *bunRepository) CreateFriendRequest(ctx context.Context, senderID, receiverID uuid.UUID) error {
	noPendingRequest := r.db.NewSelect().
		Table("friend_requests").
		Where("(sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)",
			senderID, receiverID, receiverID, senderID)

	noFriendship := r.db.NewSelect().
		Table("friend_relations").
		Where("(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
			senderID, receiverID, receiverID, senderID)

	selectQuery := r.db.NewSelect().
		ColumnExpr("?::uuid AS sender_id", senderID).
		ColumnExpr("?::uuid AS receiver_id", receiverID).
		Where("NOT EXISTS (?)", noPendingRequest).
		Where("NOT EXISTS (?)", noFriendship)

	res, err := r.db.NewInsert().
		Table("friend_requests").
		With("src", selectQuery).
		TableExpr("src").
		Exec(ctx)
	if err != nil {
		fmt.Print("Hi")
		return err
	}

	rows, err := res.RowsAffected()
	if err != nil {
		fmt.Print("Hello")
		return err
	}
	if rows == 0 {
		fmt.Print("Helloooooo")
		return ErrFriendRequestAlreadyExists
	}

	return nil
}
