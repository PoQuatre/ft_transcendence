package chat

import (
	"encoding/json"

	"github.com/google/uuid"
)

type SignalMessage struct {
	Type     string          `json:"type"`
	Payload  json.RawMessage `json:"payload"`
	SenderID uuid.UUID       `json:"sender_id"`
	TargetID uuid.UUID       `json:"target_id"`
}
