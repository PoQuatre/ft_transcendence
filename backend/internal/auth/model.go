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

var _ bun.BeforeUpdateHook = (*User)(nil)

func (t *User) BeforeUpdate(_ context.Context, query *bun.UpdateQuery) error {
	query.Set("updated_at = current_timestamp")
	return nil
}
