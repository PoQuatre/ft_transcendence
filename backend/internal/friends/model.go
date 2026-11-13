package friends

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type FriendRelations struct {
	bun.BaseModel `bun:"table:friend_relations,alias:fr"`

	ID       int64     `bun:",pk,autoincrement"`
	UserID   uuid.UUID `bun:",type:uuid,notnull"`
	FriendID uuid.UUID `bun:",type:uuid,notnull"`
}

//nolint:govet // Field order follows the database column order.
type FriendRequests struct {
	bun.BaseModel `bun:"table:friend_requests,alias:frq"`

	ID         int64     `bun:",pk,autoincrement"`
	SenderID   uuid.UUID `bun:",type:uuid,notnull"`
	ReceiverID uuid.UUID `bun:",type:uuid,notnull"`
	CreatedAt  time.Time `bun:",notnull,default:current_timestamp"`
}

//nolint:govet // Field order follows the database column order.
type FriendMessage struct {
	bun.BaseModel `bun:"table:friend_message,alias:fm"`

	ID         int64     `bun:",pk,autoincrement"`
	SenderID   uuid.UUID `bun:",type:uuid,notnull"`
	ReceiverID uuid.UUID `bun:",type:uuid,notnull"`
	Content    string    `bun:",notnull"`
	CreatedAt  time.Time `bun:",notnull,default:current_timestamp"`
}
