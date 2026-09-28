package auth

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

//nolint:govet // Field order follows the database column order.
type User struct {
	bun.BaseModel `bun:"table:users,alias:u"`

	ID           uuid.UUID `bun:",type:uuid,pk,default:uuidv7()"`
	Username     string    `bun:",unique,nullzero,notnull"`
	Email        string    `bun:",unique,nullzero,notnull"`
	PasswordHash string    `bun:",nullzero,notnull"`
	CreatedAt    time.Time `bun:",nullzero,notnull,default:current_timestamp"`
	UpdatedAt    time.Time `bun:",nullzero,notnull,default:current_timestamp"`
}

type Session struct {
	bun.BaseModel `bun:"table:sessions,alias:s"`

	ID        string    `bun:"id,pk"`
	UserID    uuid.UUID `bun:"user_id,notnull,type:uuid"`
	ExpiresAt time.Time `bun:"expires_at,notnull"`
	CreatedAt time.Time `bun:"created_at,nullzero,notnull,default:current_timestamp"`

	User *User `bun:"rel:belongs-to,join:user_id=id"`
}

var _ bun.BeforeUpdateHook = (*User)(nil)

func (t *User) BeforeUpdate(_ context.Context, query *bun.UpdateQuery) error {
	query.Set("updated_at = current_timestamp")
	return nil
}
