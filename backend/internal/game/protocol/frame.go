// Package protocol validates framed arena protocol messages.
package protocol

import wire "github.com/PoQuatre/ft_transcendence/backend/internal/game/protocol/generated"

const (
	MaxPayloadBytes = 1024
	MaxInputFrames  = 12
)

type Channel uint8

const (
	ChannelControl Channel = iota
	ChannelEvent
	ChannelState
	ChannelSync
)

type Frame struct {
	Payload           []byte
	Channel           Channel
	PacketID          byte
	SessionGeneration byte
}

// ParseMessage parses a data-channel message. It panics when the FlatBuffers
// payload is malformed; callers are responsible for recovering and closing
// the offending client.
func ParseMessage(channel Channel, message []byte) (Frame, bool) {
	headerSize := 2
	if channel == ChannelControl {
		headerSize = 1
	}
	if len(message) < headerSize {
		return Frame{}, false
	}

	frame := Frame{
		Channel:  channel,
		PacketID: message[0],
		Payload:  message[headerSize:],
	}
	if channel != ChannelControl {
		frame.SessionGeneration = message[1]
	}

	if len(frame.Payload) > MaxPayloadBytes || !validatePayload(frame) {
		return Frame{}, false
	}
	return frame, true
}

func validatePayload(frame Frame) bool {
	switch frame.Channel {
	case ChannelControl:
		return validateControlPayload(frame.PacketID, frame.Payload)
	case ChannelEvent:
		return validateEventPayload(frame.PacketID, frame.Payload)
	case ChannelState:
		return validateStatePayload(frame.PacketID, frame.Payload)
	case ChannelSync:
		return validateSyncPayload(frame.PacketID, frame.Payload)

	default:
		return false
	}
}

func validateControlPayload(packetID byte, payload []byte) bool {
	switch wire.ControlPacketId(packetID) {
	case wire.ControlPacketIdClientHello,
		wire.ControlPacketIdServerHello,
		wire.ControlPacketIdPing,
		wire.ControlPacketIdPong:
		return true

	case wire.ControlPacketIdServerDisconnect:
		reason := wire.GetRootAsServerDisconnect(payload, 0).Reason()
		return reason >= wire.DisconnectReasonUnknown && reason <= wire.DisconnectReasonUnsupportedVersion

	default:
		return false
	}
}

func validateEventPayload(packetID byte, payload []byte) bool {
	switch wire.EventPacketId(packetID) {
	case wire.EventPacketIdWorldReady:
		return true

	case wire.EventPacketIdWorldResyncRequest:
		reason := wire.GetRootAsWorldResyncRequest(payload, 0).Reason()
		return reason >= wire.ResyncReasonUnknown && reason <= wire.ResyncReasonDevModeReload

	default:
		return false
	}
}

func validateStatePayload(packetID byte, payload []byte) bool {
	switch wire.StatePacketId(packetID) {
	case wire.StatePacketIdPlayerInput:
		frames := wire.GetRootAsPlayerInput(payload, 0).FramesLength()
		return frames > 0 && frames <= MaxInputFrames

	case wire.StatePacketIdWorldDelta:
		delta := wire.GetRootAsWorldDelta(payload, 0)
		for index := range delta.UpsertsLength() {
			var entity wire.EntityState
			if !delta.Upserts(&entity, index) || !validateEntity(&entity) {
				return false
			}
		}
		return true

	default:
		return false
	}
}

func validateSyncPayload(packetID byte, payload []byte) bool {
	switch wire.SyncPacketId(packetID) {
	case wire.SyncPacketIdWorldSnapshotChunk:
		chunk := wire.GetRootAsWorldSnapshotChunk(payload, 0)
		if chunk.ChunkCount() == 0 || chunk.ChunkIndex() >= chunk.ChunkCount() {
			return false
		}
		for index := range chunk.EntitiesLength() {
			var entity wire.EntityState
			if !chunk.Entities(&entity, index) || !validateEntity(&entity) {
				return false
			}
		}
		return true

	default:
		return false
	}
}

func validateEntity(entity *wire.EntityState) bool {
	switch entity.Kind() {
	case wire.EntityKindTank, wire.EntityKindProjectile, wire.EntityKindResource:
		return entity.Position(nil) != nil && entity.Velocity(nil) != nil

	default:
		return false
	}
}
