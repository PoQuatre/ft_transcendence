package webrtc

import (
	"log/slog"
	"math"
	"time"

	"github.com/PoQuatre/ft_transcendence/backend/internal/game/protocol"
	wire "github.com/PoQuatre/ft_transcendence/backend/internal/game/protocol/generated"
	"github.com/PoQuatre/ft_transcendence/backend/internal/game/simulation"
	flatbuffers "github.com/google/flatbuffers/go"
	pion "github.com/pion/webrtc/v4"
)

func (s *Server) simulate() {
	ticker := time.NewTicker(time.Second / simulation.TickRate)
	defer ticker.Stop()
	for {
		select {
		case <-s.done:
			return
		case <-ticker.C:
			s.mu.Lock()
			for _, room := range s.lobbies {
				room.world.Step()
				if room.world.Tick%3 == 0 {
					states := room.world.States()
					for _, p := range room.players {
						if p.stateChannel == nil || p.stateChannel.ReadyState() != pion.DataChannelStateOpen || p.stateChannel.BufferedAmount() > 256*1024 {
							continue
						}
						if err := p.stateChannel.Send(snapshot(room.world.Tick, p, states)); err != nil {
							slog.Debug("send world state", "error", err)
						}
					}
				}
			}
			s.mu.Unlock()
		}
	}
}

func (s *Server) input(peer *pion.PeerConnection, message pion.DataChannelMessage) {
	if message.IsString || len(message.Data) > protocol.MaxPayloadBytes {
		return
	}
	// FlatBuffers Go accessors panic on malformed input; isolate the peer.
	defer func() {
		if recover() != nil {
			_ = peer.Close()
		}
	}()
	frame, ok := protocol.ParseMessage(protocol.ChannelState, message.Data)
	if !ok || frame.PacketID != byte(wire.StatePacketIdPlayerInput) {
		return
	}
	packet := wire.GetRootAsPlayerInput(frame.Payload, 0)
	var last wire.InputFrame
	index := packet.FramesLength() - 1
	if !packet.Frames(&last, index) {
		return
	}
	in := simulation.Input{ID: packet.FirstInputId() + uint32(index), X: last.MovementX(), Y: last.MovementY(), Aim: last.AimAngle(), Buttons: uint8(last.Buttons())}
	s.mu.Lock()
	defer s.mu.Unlock()
	p := s.players[peer]
	if p != nil && p.lobby != nil && p.generation == frame.SessionGeneration {
		p.lobby.world.SetInput(p.entityID, in)
	}
}

func snapshot(tick uint32, p *player, states []simulation.State) []byte {
	b := flatbuffers.NewBuilder(512)
	offsets := make([]flatbuffers.UOffsetT, 0, len(states))
	var ack uint32
	for _, state := range states {
		if state.ID == p.entityID {
			ack = state.LastInput
		}
		wire.EntityStateStart(b)
		wire.EntityStateAddId(b, state.ID)
		wire.EntityStateAddKind(b, wire.EntityKind(state.Kind))
		wire.EntityStateAddPosition(b, wire.CreateVec2(b, quantize(state.X), quantize(state.Y)))
		wire.EntityStateAddVelocity(b, wire.CreateVec2(b, quantize(state.VX), quantize(state.VY)))
		wire.EntityStateAddAimAngle(b, state.Aim)
		wire.EntityStateAddHealth(b, state.Health)
		rotation := math.Mod(float64(state.Rotation), 2*math.Pi)
		if rotation < 0 {
			rotation += 2 * math.Pi
		}
		wire.EntityStateAddRotation(b, uint16(uint32(math.Round(rotation*65536/(2*math.Pi)))&0xffff))
		if state.Square {
			wire.EntityStateAddResourceShape(b, wire.ResourceShapeSquare)
		}
		offsets = append(offsets, wire.EntityStateEnd(b))
	}
	wire.WorldDeltaStartUpsertsVector(b, len(offsets))
	for i := len(offsets) - 1; i >= 0; i-- {
		b.PrependUOffsetT(offsets[i])
	}
	upserts := b.EndVector(len(offsets))
	wire.WorldDeltaStart(b)
	wire.WorldDeltaAddSnapshotId(b, tick)
	wire.WorldDeltaAddServerTick(b, tick)
	wire.WorldDeltaAddLastProcessedInputId(b, ack)
	wire.WorldDeltaAddUpserts(b, upserts)
	wire.WorldDeltaAddLocalEntityId(b, p.entityID)
	wire.WorldDeltaAddFullState(b, true)
	wire.FinishWorldDeltaBuffer(b, wire.WorldDeltaEnd(b))
	return append([]byte{byte(wire.StatePacketIdWorldDelta), p.generation}, b.FinishedBytes()...)
}

func quantize(v float32) int16 { return int16(math.Round(float64(v * 100))) }
