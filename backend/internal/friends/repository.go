package friends

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

var (
	ErrNotFound                    = errors.New("user not found")
	ErrRequestNotFound             = errors.New("friend request not found")
	ErrFriendRelationNotFound      = errors.New("friend not found")
	ErrSessionNotFound             = errors.New("session not found")
	ErrFriendRequestAlreadyExists  = errors.New("request already sent")
	ErrFriendRelationAlreadyExists = errors.New("already friends")
)

type Repository interface {
	CreateFriendRelation(ctx context.Context, userID uuid.UUID, friendID uuid.UUID) error
	CreateFriendRequest(ctx context.Context, senderID uuid.UUID, receiverID uuid.UUID) error
	DeleteFriendRequest(ctx context.Context, senderID, receiverID uuid.UUID) error
	DeleteFriendRelation(ctx context.Context, senderID, receiverID uuid.UUID) error
	AreFriend(ctx context.Context, userID uuid.UUID, friendID uuid.UUID) (bool, error)

	GetFriendsList(ctx context.Context, userID uuid.UUID) (FriendRelationListResponse, error)
	GetFriendRequest(ctx context.Context, senderID uuid.UUID, receiverID uuid.UUID) (FriendRequestResponse, error)
	GetPendingFriendRequests(ctx context.Context, receiverID uuid.UUID) (FriendRequestsListResponse, error)
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
		return err
	}

	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrFriendRequestAlreadyExists
	}

	return nil
}

func (r *bunRepository) DeleteFriendRequest(ctx context.Context, senderID, receiverID uuid.UUID) error {
	res, err := r.db.NewDelete().
		Model((*FriendRequests)(nil)).
		Where("sender_id = ? AND receiver_id = ?", senderID, receiverID).
		Exec(ctx)
	if err != nil {
		return err
	}

	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrRequestNotFound
	}

	return nil
}

func (r *bunRepository) DeleteFriendRelation(ctx context.Context, userID, friendID uuid.UUID) error {
	res, err := r.db.NewDelete().
		Model((*FriendRelations)(nil)).
		Where("(user_id = ? AND friend_id = ?) OR (friend_id = ? AND user_id = ?)", userID, friendID, userID, friendID).
		Exec(ctx)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrFriendRelationNotFound
	}
	return nil
}

func (r *bunRepository) GetFriendRequest(ctx context.Context, senderID, receiverID uuid.UUID) (FriendRequestResponse, error) {
	var req FriendRequestResponse

	err := r.db.NewSelect().
		TableExpr("friend_requests AS frq").
		ColumnExpr("frq.sender_id AS sender_id").
		ColumnExpr("u.username AS username").
		ColumnExpr("frq.created_at AS created_at").
		Join("JOIN users AS u ON u.id = frq.sender_id").
		Where("frq.sender_id = ? AND frq.receiver_id = ?", senderID, receiverID).
		Scan(ctx, &req)
	if err != nil {
		return FriendRequestResponse{}, err
	}

	return req, nil
}

func (r *bunRepository) GetFriendsList(ctx context.Context, userID uuid.UUID) (FriendRelationListResponse, error) {
	var friends []FriendRelationResponse

	err := r.db.NewSelect().
		TableExpr("friend_relations AS fr").
		ColumnExpr("CASE WHEN fr.user_id = ?0 THEN fr.friend_id ELSE fr.user_id END AS friend_id", userID).
		ColumnExpr("u.username AS username").
		Join("JOIN users AS u ON u.id = CASE WHEN fr.user_id = ?0 THEN fr.friend_id ELSE fr.user_id END", userID).
		Where("fr.user_id = ?0 OR fr.friend_id = ?0", userID).
		Scan(ctx, &friends)
	if err != nil {
		return FriendRelationListResponse{}, err
	}

	if friends == nil {
		friends = []FriendRelationResponse{}
	}

	return FriendRelationListResponse{
		Requests: friends,
	}, nil
}

func (r *bunRepository) GetPendingFriendRequests(ctx context.Context, receiverID uuid.UUID) (FriendRequestsListResponse, error) {
	var requests []FriendRequestResponse

	err := r.db.NewSelect().
		TableExpr("friend_requests AS frq").
		ColumnExpr("frq.sender_id AS sender_id").
		ColumnExpr("u.username AS username").
		ColumnExpr("frq.created_at AS created_at").
		Join("JOIN users AS u ON u.id = frq.sender_id").
		Where("frq.receiver_id = ?", receiverID).
		Scan(ctx, &requests)
	if err != nil {
		return FriendRequestsListResponse{}, err
	}
	if requests == nil {
		requests = []FriendRequestResponse{}
	}
	return FriendRequestsListResponse{
		Requests: requests,
	}, nil
}

func (r *bunRepository) CreateFriendRelation(ctx context.Context, userID uuid.UUID, friendID uuid.UUID) error {
	req := &FriendRelations{
		UserID:   userID,
		FriendID: friendID,
	}

	_, err := r.db.NewInsert().
		Model(req).
		Where("NOT EXISTS (?)",
			r.db.NewSelect().
				Table("friend_requests").
				Where("(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
					userID, friendID, friendID, userID),
		).
		Exec(ctx)

	return err
}

func (r *bunRepository) AreFriend(ctx context.Context, userID, friendID uuid.UUID) (bool, error) {
	exists, err := r.db.NewSelect().
		TableExpr("friend_relations AS fr").
		Where("(fr.user_id = ?0 AND fr.friend_id = ?1) OR (fr.user_id = ?1 AND fr.friend_id = ?0)", userID, friendID).
		Exists(ctx)
	if err != nil {
		return false, err
	}

	return exists, nil
}
