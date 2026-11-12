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
	ErrFriendRequestAlreadyExists  = errors.New("request already exists")
	ErrFriendRelationAlreadyExists = errors.New("already friends")

	pageSize = 25
)

type Repository interface {
	CreateFriendRelation(ctx context.Context, userID, friendID uuid.UUID) error
	CreateFriendRequest(ctx context.Context, senderID, receiverID uuid.UUID) error
	DeleteFriendRequest(ctx context.Context, senderID, receiverID uuid.UUID) error
	DeleteFriendRelation(ctx context.Context, senderID, receiverID uuid.UUID) error
	AreFriend(ctx context.Context, userID, friendID uuid.UUID) (bool, error)

	GetFriendsList(ctx context.Context, userID uuid.UUID, page int) (FriendRelationListResponse, error)
	GetFriendRequest(ctx context.Context, senderID, receiverID uuid.UUID) (FriendRequestResponse, error)
	GetPendingFriendRequests(ctx context.Context, receiverID uuid.UUID, page int) (FriendRequestsListResponse, error)
}

type bunRepository struct {
	db *bun.DB
}

func NewRepository(db *bun.DB) Repository {
	return &bunRepository{db: db}
}

func (r *bunRepository) CreateFriendRequest(ctx context.Context, senderID, receiverID uuid.UUID) error {
	alreadyExists, err := r.db.NewSelect().
		Table("friend_requests").
		Where("(sender_id = ?0 AND receiver_id = ?1) OR (sender_id = ?1 AND receiver_id = ?0)", senderID, receiverID).
		Exists(ctx)
	if err != nil {
		return err
	}
	if alreadyExists {
		return ErrFriendRequestAlreadyExists
	}
	alreadyFriends, err := r.db.NewSelect().
		Table("friend_relations").
		Where("(user_id = ?0 AND friend_id = ?1) OR (user_id = ?1 AND friend_id = ?0)", senderID, receiverID).
		Exists(ctx)
	if err != nil {
		return err
	}
	if alreadyFriends {
		return ErrFriendRelationAlreadyExists
	}

	req := &FriendRequests{
		SenderID:   senderID,
		ReceiverID: receiverID,
	}

	_, err = r.db.NewInsert().
		Model(req).
		Exec(ctx)

	return err
}

func (r *bunRepository) DeleteFriendRequest(ctx context.Context, senderID, receiverID uuid.UUID) error {
	res, err := r.db.NewDelete().
		Table("friend_requests").
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
		Table("friend_relations").
		Where("(user_id = ?0 AND friend_id = ?1) OR (user_id = ?1 AND friend_id = ?0)", userID, friendID).
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
		ColumnExpr("users.username AS username").
		ColumnExpr("frq.created_at AS created_at").
		Join("JOIN users ON users.id = frq.sender_id").
		Where("frq.sender_id = ? AND frq.receiver_id = ?", senderID, receiverID).
		Scan(ctx, &req)
	if err != nil {
		return FriendRequestResponse{}, err
	}

	return req, nil
}

func (r *bunRepository) GetFriendsList(ctx context.Context, userID uuid.UUID, page int) (FriendRelationListResponse, error) {
	var friends []FriendRelationResponse

	subSelect := r.db.NewSelect().
		Table("friend_relations").
		ColumnExpr("CASE WHEN user_id = ? THEN friend_id ELSE user_id END AS target_friend_id", userID).
		Where("user_id = ?0 OR friend_id = ?0", userID)

	err := r.db.NewSelect().
		TableExpr("(?) AS friends_list", subSelect).
		ColumnExpr("friends_list.target_friend_id AS friend_id").
		ColumnExpr("users.username AS username").
		Join("JOIN users ON users.id = friends_list.target_friend_id").
		Limit(pageSize).
		Offset(page*pageSize-pageSize).
		Scan(ctx, &friends)
	if err != nil {
		return FriendRelationListResponse{}, err
	}
	nb, err := r.db.NewSelect().
		TableExpr("(?) AS friends_list", subSelect).
		Count(ctx)
	if err != nil {
		return FriendRelationListResponse{}, err
	}
	if friends == nil {
		friends = []FriendRelationResponse{}
	}

	return FriendRelationListResponse{
		Requests:    friends,
		TotalPages:  (nb + pageSize - 1) / pageSize,
		CurrentPage: page,
	}, nil
}

func (r *bunRepository) GetPendingFriendRequests(ctx context.Context, receiverID uuid.UUID, page int) (FriendRequestsListResponse, error) {
	var requests []FriendRequestResponse

	err := r.db.NewSelect().
		Table("friend_requests").
		ColumnExpr("friend_requests.sender_id AS sender_id").
		ColumnExpr("users.username AS username").
		ColumnExpr("friend_requests.created_at AS created_at").
		Join("JOIN users ON users.id = friend_requests.sender_id").
		Where("friend_requests.receiver_id = ?", receiverID).
		Limit(pageSize).
		Offset(page*pageSize-pageSize).
		Scan(ctx, &requests)
	if err != nil {
		return FriendRequestsListResponse{}, err
	}
	nb, err := r.db.NewSelect().
		Table("friend_requests").
		Where("friend_requests.receiver_id = ?", receiverID).
		Count(ctx)
	if err != nil {
		return FriendRequestsListResponse{}, err
	}
	if requests == nil {
		requests = []FriendRequestResponse{}
	}
	return FriendRequestsListResponse{
		Requests:    requests,
		TotalPages:  (nb + pageSize - 1) / pageSize,
		CurrentPage: page,
	}, nil
}

func (r *bunRepository) CreateFriendRelation(ctx context.Context, userID, friendID uuid.UUID) error {
	req := &FriendRelations{
		UserID:   userID,
		FriendID: friendID,
	}
	areFriends, err := r.AreFriend(ctx, userID, friendID)
	if err != nil {
		return err
	}
	if areFriends {
		return ErrFriendRelationAlreadyExists
	}

	_, err = r.db.NewInsert().
		Model(req).
		Exec(ctx)
	return err
}

func (r *bunRepository) AreFriend(ctx context.Context, userID, friendID uuid.UUID) (bool, error) {
	exists, err := r.db.NewSelect().
		Table("friend_relations").
		Where("(user_id = ?0 AND friend_id = ?1) OR (user_id = ?1 AND friend_id = ?0)",
			userID, friendID).
		Exists(ctx)
	if err != nil {
		return false, err
	}

	return exists, nil
}
