package friends

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type FriendRelations struct {
	bun.BaseModel `bun:"table:friend_relations,alias:fr"`

	UserID   uuid.UUID `bun:",type:uuid,pk,notnull"`
	FriendID uuid.UUID `bun:",type:uuid,pk,notnull"`
}

//nolint:govet // Field order follows the database column order.
type FriendRequests struct {
	bun.BaseModel `bun:"table:friend_requests,alias:frq"`

	SenderID   uuid.UUID `bun:",type:uuid,pk,notnull"`
	ReceiverID uuid.UUID `bun:",type:uuid,pk,notnull"`
	CreatedAt  time.Time `bun:",notnull,default:current_timestamp"`
}
