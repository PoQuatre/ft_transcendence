// Package friends handles everything friendslist related.
package friends

import (
	"time"

	"github.com/google/uuid"
)

// FriendRequestRequest : POST /api/friends/requests/send.
type FriendRequestRequest struct {
	Username string `json:"username" example:"johndoe"`
}

// FriendRequestResponse : GET /api/friends/requests/list (elements in the list).
type FriendRequestResponse struct {
	CreatedAt time.Time `json:"created_at"`
	Username  string    `json:"username"  example:"johndoe"`
	SenderID  uuid.UUID `json:"sender_id" example:"018f4e2a-7b3c-7890-a1b2-c3d4e5f6a7b8"`
}

// FriendRequestsListResponse : GET /api/friends/requests/list (list wrapper).
type FriendRequestsListResponse struct {
	Requests []FriendRequestResponse `json:"requests"`
}

// HandleFriendRequestRequest : POST /api/friends/requests/accept or POST /api/friends/requests/decline.
type HandleFriendRequestRequest struct {
	SenderID uuid.UUID `json:"sender_id" example:"018f4e2a-7b3c-7890-a1b2-c3d4e5f6a7b8"`
}

// FriendRelationResponse : GET /api/friends/list (elements in the list).
type FriendRelationResponse struct {
	Username string    `json:"username"  example:"johndoe"`
	FriendID uuid.UUID `json:"friend_id" example:"018f4e2a-7b3c-7890-a1b2-c3d4e5f6a7b8"`
}

// FriendRelationListResponse : GET /api/friends/list (list wrapper).
type FriendRelationListResponse struct {
	Requests []FriendRelationResponse `json:"relations"`
}

// UnfriendRequest : POST /api/friends/unfriend.
type UnfriendRequest struct {
	FriendID uuid.UUID `json:"friend_id" example:"018f4e2a-7b3c-7890-a1b2-c3d4e5f6a7b8"`
}
