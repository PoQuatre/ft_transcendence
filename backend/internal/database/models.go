package database

import (
	"time"

	"github.com/uptrace/bun"

	"github.com/PoQuatre/ft_transcendence/backend/internal/auth"
	"github.com/PoQuatre/ft_transcendence/backend/internal/friends"
)

type session struct {
	bun.BaseModel `bun:"table:sessions"`
	Expiry        time.Time `bun:"expiry,notnull"`
	Token         string    `bun:"token,pk,type:text"`
	Data          []byte    `bun:"data,notnull"`
}

func Models() []any {
	return []any{
		(*auth.NewMailVerify)(nil),
		(*auth.APIKey)(nil),
		(*auth.User)(nil),
		(*auth.UserVerify)(nil),
		(*auth.PasswordResetToken)(nil),
		(*friends.FriendRelations)(nil),
		(*friends.FriendRequests)(nil),
		(*friends.FriendMessage)(nil),
		(*session)(nil),
	}
}
