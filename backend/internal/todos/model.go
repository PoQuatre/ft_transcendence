// Package todos owns the /todos endpoint set and its handler, service and repository layers.
package todos

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

//nolint:govet // Field order follows the database column order.
type Todo struct {
	bun.BaseModel `bun:"table:todos"`

	ID        uuid.UUID `bun:",type:uuid,pk,default:uuidv7()"`
	Title     string    `bun:",nullzero,notnull"`
	Completed bool      `bun:",notnull,default:false"`
	CreatedAt time.Time `bun:",nullzero,notnull,default:current_timestamp"`
	UpdatedAt time.Time `bun:",nullzero,notnull,default:current_timestamp"`
}

var _ bun.BeforeUpdateHook = (*Todo)(nil)

func (t *Todo) BeforeUpdate(_ context.Context, query *bun.UpdateQuery) error {
	query.Set("updated_at = current_timestamp")
	return nil
}
