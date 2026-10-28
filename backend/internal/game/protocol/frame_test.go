package protocol

import (
	"testing"

	flatbuffers "github.com/google/flatbuffers/go"

	wire "github.com/PoQuatre/ft_transcendence/backend/internal/game/protocol/generated"
)

func TestParseMessage(t *testing.T) {
	tests := []struct {
		name    string
		channel Channel
		message []byte
		want    bool
	}{
		{
			name:    "control client hello",
			channel: ChannelControl,
			message: append([]byte{byte(wire.ControlPacketIdClientHello)}, clientHelloPayload()...),
			want:    true,
		},
		{
			name:    "invalid control disconnect reason",
			channel: ChannelControl,
			message: append([]byte{byte(wire.ControlPacketIdServerDisconnect)}, disconnectPayload(wire.DisconnectReason(3))...),
			want:    false,
		},
		{
			name:    "valid control disconnect reason",
			channel: ChannelControl,
			message: append([]byte{byte(wire.ControlPacketIdServerDisconnect)}, disconnectPayload(wire.DisconnectReasonProtocolError)...),
			want:    true,
		},
		{
			name:    "unknown control packet",
			channel: ChannelControl,
			message: []byte{0xff},
			want:    false,
		},
		{
			name:    "event world ready",
			channel: ChannelEvent,
			message: append([]byte{byte(wire.EventPacketIdWorldReady), 7}, worldReadyPayload()...),
			want:    true,
		},
		{
			name:    "invalid resync reason",
			channel: ChannelEvent,
			message: append([]byte{byte(wire.EventPacketIdWorldResyncRequest), 7}, resyncPayload(wire.ResyncReason(4))...),
			want:    false,
		},
		{
			name:    "empty player input",
			channel: ChannelState,
			message: append([]byte{byte(wire.StatePacketIdPlayerInput), 7}, playerInputPayload(0)...),
			want:    false,
		},
		{
			name:    "player input within frame limit",
			channel: ChannelState,
			message: append([]byte{byte(wire.StatePacketIdPlayerInput), 7}, playerInputPayload(1)...),
			want:    true,
		},
		{
			name:    "snapshot chunk index outside count",
			channel: ChannelSync,
			message: append([]byte{byte(wire.SyncPacketIdWorldSnapshotChunk), 7}, snapshotChunkPayload(1, 1)...),
			want:    false,
		},
		{
			name:    "snapshot chunk with valid index",
			channel: ChannelSync,
			message: append([]byte{byte(wire.SyncPacketIdWorldSnapshotChunk), 7}, snapshotChunkPayload(0, 1)...),
			want:    true,
		},
		{
			name:    "world delta invalid entity kind",
			channel: ChannelState,
			message: append([]byte{byte(wire.StatePacketIdWorldDelta), 7}, worldDeltaPayload(wire.EntityKindUnknown)...),
			want:    false,
		},
		{
			name:    "world delta valid entity",
			channel: ChannelState,
			message: append([]byte{byte(wire.StatePacketIdWorldDelta), 7}, worldDeltaPayload(wire.EntityKindTank)...),
			want:    true,
		},
		{
			name:    "payload too large",
			channel: ChannelEvent,
			message: append([]byte{byte(wire.EventPacketIdWorldReady), 7}, make([]byte, MaxPayloadBytes+1)...),
			want:    false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			frame, ok := ParseMessage(test.channel, test.message)
			if ok != test.want {
				t.Fatalf("ParseMessage() ok = %t, want %t", ok, test.want)
			}
			if ok && frame.Channel != test.channel {
				t.Errorf("ParseMessage() channel = %q, want %q", frame.Channel, test.channel)
			}
		})
	}
}

func TestParseMessagePanicsForMalformedPayload(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Fatal("ParseMessage() did not panic for malformed FlatBuffers data")
		}
	}()

	ParseMessage(ChannelEvent, []byte{byte(wire.EventPacketIdWorldResyncRequest), 0})
}

func clientHelloPayload() []byte {
	builder := flatbuffers.NewBuilder(0)
	wire.ClientHelloStart(builder)
	wire.ClientHelloAddProtocolVersion(builder, 1)
	builder.Finish(wire.ClientHelloEnd(builder))
	return builder.FinishedBytes()
}

func disconnectPayload(reason wire.DisconnectReason) []byte {
	builder := flatbuffers.NewBuilder(0)
	wire.ServerDisconnectStart(builder)
	wire.ServerDisconnectAddReason(builder, reason)
	builder.Finish(wire.ServerDisconnectEnd(builder))
	return builder.FinishedBytes()
}

func worldReadyPayload() []byte {
	builder := flatbuffers.NewBuilder(0)
	wire.WorldReadyStart(builder)
	builder.Finish(wire.WorldReadyEnd(builder))
	return builder.FinishedBytes()
}

func resyncPayload(reason wire.ResyncReason) []byte {
	builder := flatbuffers.NewBuilder(0)
	wire.WorldResyncRequestStart(builder)
	wire.WorldResyncRequestAddReason(builder, reason)
	builder.Finish(wire.WorldResyncRequestEnd(builder))
	return builder.FinishedBytes()
}

func playerInputPayload(frameCount int) []byte {
	builder := flatbuffers.NewBuilder(0)
	wire.PlayerInputStartFramesVector(builder, frameCount)
	for range frameCount {
		wire.CreateInputFrame(builder, 0, 0, 0, 0)
	}
	frames := builder.EndVector(frameCount)
	wire.PlayerInputStart(builder)
	wire.PlayerInputAddFrames(builder, frames)
	builder.Finish(wire.PlayerInputEnd(builder))
	return builder.FinishedBytes()
}

func snapshotChunkPayload(index, count uint16) []byte {
	builder := flatbuffers.NewBuilder(0)
	wire.WorldSnapshotChunkStart(builder)
	wire.WorldSnapshotChunkAddChunkIndex(builder, index)
	wire.WorldSnapshotChunkAddChunkCount(builder, count)
	builder.Finish(wire.WorldSnapshotChunkEnd(builder))
	return builder.FinishedBytes()
}

func worldDeltaPayload(kind wire.EntityKind) []byte {
	builder := flatbuffers.NewBuilder(0)
	wire.EntityStateStart(builder)
	wire.EntityStateAddVelocity(builder, wire.CreateVec2(builder, 0, 0))
	wire.EntityStateAddPosition(builder, wire.CreateVec2(builder, 0, 0))
	wire.EntityStateAddKind(builder, kind)
	entity := wire.EntityStateEnd(builder)
	wire.WorldDeltaStartUpsertsVector(builder, 1)
	builder.PrependUOffsetT(entity)
	upserts := builder.EndVector(1)
	wire.WorldDeltaStart(builder)
	wire.WorldDeltaAddUpserts(builder, upserts)
	builder.Finish(wire.WorldDeltaEnd(builder))
	return builder.FinishedBytes()
}
