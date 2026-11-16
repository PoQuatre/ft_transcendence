package database

import (
	"github.com/PoQuatre/ft_transcendence/backend/internal/auth"
	"github.com/PoQuatre/ft_transcendence/backend/internal/friends"
)

func Models() []any {
	return []any{
		(*auth.User)(nil),
		(*auth.UserVerify)(nil),
		(*auth.PasswordResetToken)(nil),
		(*friends.FriendRelations)(nil),
		(*friends.FriendRequests)(nil),
		(*friends.FriendMessage)(nil),
	}
}
