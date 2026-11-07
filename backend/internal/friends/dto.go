// Package friends handles everything friendslist related.
package friends

import (
	"time"

	"github.com/google/uuid"
)

// FriendRequest : The username has to be the username of the player you wanna add as a friend.
// POST /api/friends/requests/send
type FriendRequestRequest struct {
	Username string `json:"username" example:"johndoe"`
}

// GET /api/friends/requests/list (elements in the list)
type FriendRequestResponse struct {
	SenderID  uuid.UUID `json:"sender_id" example:"018f4e2a-7b3c-7890-a1b2-c3d4e5f6a7b8"`
	Username  string    `json:"username"  example:"johndoe"`
	CreatedAt time.Time `json:"created_at"`
}

// GET /api/friends/requests/list (list wrapper)
type FriendRequestsListResponse struct {
	Requests []FriendRequestResponse `json:"requests"`
}

// POST /api/friends/requests/accept (or decline)
type HandleFriendRequestRequest struct {
	SenderID uuid.UUID `json:"sender_id"`
}

// GET /api/friends/list (elements in the list)
type FriendRelationResponse struct {
	FriendID uuid.UUID `json:"friend_id" example:"018f4e2a-7b3c-7890-a1b2-c3d4e5f6a7b8"`
	Username string    `json:"username"  example:"johndoe"`
}

// GET /api/friends/list (list wrapper)
type FriendRelationListResponse struct {
	Requests []FriendRelationResponse `json:"relations"`
}
