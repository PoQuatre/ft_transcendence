package chat

import (
	"encoding/json"

	"github.com/google/uuid"
)

// SignalMessage représente l'enveloppe JSON échangée sur le WebSocket de signaling WebRTC.
type SignalMessage struct {
	Payload  json.RawMessage `json:"payload"`   // SDP ou ICE candidate brut
	Type     string          `json:"type"`      // "offer", "answer", "ice-candidate"
	SenderID uuid.UUID       `json:"sender_id"` // Émetteur (injecté par le serveur via la session)
	TargetID uuid.UUID       `json:"target_id"` // Destinataire du signal
}
