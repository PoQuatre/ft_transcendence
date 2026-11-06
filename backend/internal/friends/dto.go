// Package friends handles everything friendslist related.
package friends

// FriendRequest : The username has to be the username of the player you wanna add as a friend.
// POST /api/friends/requests/send
type FriendRequestRequest struct {
	Username string `json:"username" example:"johndoe"`
}
