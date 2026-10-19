package auth

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

//nolint:govet // Field order follows the database column order.
type UserVerify struct {
	bun.BaseModel `bun:"table:user_verifications,alias:uv"`

	UserID uuid.UUID `bun:",type:uuid,pk"`
	Code   string    `bun:",notnull"`
	EndsAt time.Time `bun:",nullzero,notnull"`
}

var _ bun.BeforeAppendModelHook = (*UserVerify)(nil)

func (u *UserVerify) BeforeAppendModel(_ context.Context, query bun.Query) error {
	if _, ok := query.(*bun.InsertQuery); ok && u.EndsAt.IsZero() {
		u.EndsAt = time.Now().Add(10 * time.Minute)
	}
	return nil
}

//nolint:govet // Field order follows the database column order.
type User struct {
	bun.BaseModel `bun:"table:users,alias:u"`

	ID           uuid.UUID `bun:",type:uuid,pk,default:uuidv7()"`
	Username     string    `bun:",unique,nullzero,notnull"`
	Email        string    `bun:",unique,nullzero,notnull"`
	PasswordHash string    `bun:",nullzero,notnull"`
	CreatedAt    time.Time `bun:",nullzero,notnull,default:current_timestamp"`
	UpdatedAt    time.Time `bun:",nullzero,notnull,default:current_timestamp"`
	Verified     bool      `bun:",notnull,default:false"`
}

var _ bun.BeforeUpdateHook = (*User)(nil)

func (t *User) BeforeUpdate(_ context.Context, query *bun.UpdateQuery) error {
	query.Set("updated_at = current_timestamp")
	return nil
}
