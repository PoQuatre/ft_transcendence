package webrtc

import (
	"encoding/json"
	"math"
	"testing"
	"time"

	flatbuffers "github.com/google/flatbuffers/go"
	pion "github.com/pion/webrtc/v4"

	"github.com/PoQuatre/ft_transcendence/backend/internal/game/protocol"
	wire "github.com/PoQuatre/ft_transcendence/backend/internal/game/protocol/generated"
	"github.com/PoQuatre/ft_transcendence/backend/internal/game/simulation"
)

func TestQuickPlayReceivesWorldState(t *testing.T) {
	server, err := New(0, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if closeErr := server.Close(); closeErr != nil {
			t.Error(closeErr)
		}
	})
	client, err := pion.NewPeerConnection(pion.Configuration{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if closeErr := client.Close(); closeErr != nil {
			t.Error(closeErr)
		}
	})
	control, err := client.CreateDataChannel("control", nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, channelErr := client.CreateDataChannel("event", nil); channelErr != nil {
		t.Fatal(channelErr)
	}
	ordered, retries := false, uint16(0)
	state, err := client.CreateDataChannel("state", &pion.DataChannelInit{Ordered: &ordered, MaxRetransmits: &retries})
	if err != nil {
		t.Fatal(err)
	}
	if _, channelErr := client.CreateDataChannel("sync", &pion.DataChannelInit{Ordered: &ordered}); channelErr != nil {
		t.Fatal(channelErr)
	}
	packets := make(chan []byte, 1)
	controlMessages := make(chan pion.DataChannelMessage, 3)
	control.OnMessage(func(message pion.DataChannelMessage) {
		controlMessages <- message
	})
	state.OnMessage(func(message pion.DataChannelMessage) {
		select {
		case packets <- message.Data:
		default:
		}
	})
	control.OnOpen(func() {
		if sendErr := control.Send([]byte(`{"type":"QuickPlayRequest"}`)); sendErr != nil {
			t.Error(sendErr)
		}
		if sendErr := control.SendText(`{`); sendErr != nil {
			t.Error(sendErr)
		}
		if sendErr := control.SendText(`{"type":"QuickPlayRequest"}`); sendErr != nil {
			t.Error(sendErr)
		}
	})
	offer, err := client.CreateOffer(nil)
	if err != nil {
		t.Fatal(err)
	}
	gathered := pion.GatheringCompletePromise(client)
	if setErr := client.SetLocalDescription(offer); setErr != nil {
		t.Fatal(setErr)
	}
	<-gathered
	answer, err := server.answer(t.Context(), *client.LocalDescription(), Identity{})
	if err != nil {
		t.Fatal(err)
	}
	if err := client.SetRemoteDescription(*answer); err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"Error", "Error", "LobbyState"} {
		select {
		case message := <-controlMessages:
			var body struct {
				Type string `json:"type"`
			}
			if !message.IsString || json.Unmarshal(message.Data, &body) != nil || body.Type != want {
				t.Fatalf("control message = %q (text=%t), want JSON %s", message.Data, message.IsString, want)
			}
		case <-time.After(5 * time.Second):
			t.Fatalf("no control response for %s", want)
		}
	}
	select {
	case packet := <-packets:
		frame, ok := protocol.ParseMessage(protocol.ChannelState, packet)
		if !ok || frame.PacketID != byte(wire.StatePacketIdWorldDelta) {
			t.Fatal("invalid world state")
		}
		delta := wire.GetRootAsWorldDelta(frame.Payload, 0)
		if !delta.FullState() || delta.LocalEntityId() == 0 || delta.UpsertsLength() != 21 {
			t.Fatal("missing local player")
		}
		b := flatbuffers.NewBuilder(64)
		wire.PlayerInputStartFramesVector(b, 1)
		wire.CreateInputFrame(b, 0, 0, 0, wire.InputButtonsFire)
		frames := b.EndVector(1)
		wire.PlayerInputStart(b)
		wire.PlayerInputAddFirstInputId(b, 1)
		wire.PlayerInputAddFrames(b, frames)
		wire.FinishPlayerInputBuffer(b, wire.PlayerInputEnd(b))
		if err := state.Send(append([]byte{byte(wire.StatePacketIdPlayerInput), frame.SessionGeneration}, b.FinishedBytes()...)); err != nil {
			t.Fatal(err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("quick play received no world state")
	}
	timeout := time.After(5 * time.Second)
	for {
		select {
		case packet := <-packets:
			frame, ok := protocol.ParseMessage(protocol.ChannelState, packet)
			if !ok {
				t.Fatal("invalid world state after firing")
			}
			delta := wire.GetRootAsWorldDelta(frame.Payload, 0)
			for i := range delta.UpsertsLength() {
				var entity wire.EntityState
				if delta.Upserts(&entity, i) && entity.Kind() == wire.EntityKindProjectile {
					return
				}
			}
		case <-timeout:
			t.Fatal("shot was not replicated")
		}
	}
}

func TestSnapshotIsSelfContainedAndIdentifiesRecipient(t *testing.T) {
	w := simulation.New()
	defer w.Close()
	a, b := w.AddPlayer(), w.AddPlayer()
	w.SetInput(a, simulation.Input{ID: 7, X: 127})
	w.Step()
	packet := snapshot(w.Tick, &player{entityID: a, generation: 4}, w.States())
	frame, ok := protocol.ParseMessage(protocol.ChannelState, packet)
	if !ok || frame.SessionGeneration != 4 {
		t.Fatal("invalid snapshot frame")
	}
	delta := wire.GetRootAsWorldDelta(frame.Payload, 0)
	if !delta.FullState() || delta.LocalEntityId() != a || delta.LastProcessedInputId() != 7 || delta.UpsertsLength() != 22 {
		t.Fatal("invalid snapshot contents")
	}
	w.RemovePlayer(b)
	frame, ok = protocol.ParseMessage(protocol.ChannelState, snapshot(w.Tick+1, &player{entityID: a}, w.States()))
	if !ok || wire.GetRootAsWorldDelta(frame.Payload, 0).UpsertsLength() != 21 {
		t.Fatal("removed player remains")
	}
}

func TestFullLobbySnapshotFitsTransport(t *testing.T) {
	w := simulation.New()
	defer w.Close()
	var id uint32
	for range 8 {
		id = w.AddPlayer()
	}
	for tick := range 120 {
		for _, state := range w.States() {
			if state.Kind == simulation.TankKind {
				w.SetInput(state.ID, simulation.Input{ID: uint32(tick + 1), Buttons: simulation.Fire, Aim: 16384})
			}
		}
		w.Step()
	}
	packet := snapshot(1, &player{entityID: id, generation: 1}, w.States())
	if len(packet) > 8192 {
		t.Fatalf("snapshot exceeds bridge limit: %d", len(packet))
	}
	if _, ok := protocol.ParseMessage(protocol.ChannelState, packet); !ok {
		t.Fatal("invalid full lobby snapshot")
	}
}

func TestMaximumSnapshotFitsTransport(t *testing.T) {
	states := make([]simulation.State, 8+20+simulation.MaxProjectiles)
	for i := range states {
		states[i] = simulation.State{ID: uint32(i + 1), Kind: simulation.ResourceKind, X: 25, Y: -25, VX: 20, VY: -10, Aim: 30000, Health: 100, Rotation: 1.5, Square: true}
	}
	packet := snapshot(1, &player{entityID: 1}, states)
	if len(packet) > 8192 {
		t.Fatalf("maximum snapshot is %d bytes", len(packet))
	}
	if _, ok := protocol.ParseMessage(protocol.ChannelState, packet); !ok {
		t.Fatal("maximum snapshot rejected")
	}
}

func TestSnapshotCarriesResourceShapeAndMotion(t *testing.T) {
	states := []simulation.State{{ID: 1, Kind: simulation.ResourceKind, X: 2, VX: 0.25, Rotation: float32(math.Pi / 2), Square: true}}
	frame, ok := protocol.ParseMessage(protocol.ChannelState, snapshot(1, &player{}, states))
	if !ok {
		t.Fatal("invalid snapshot")
	}
	var entity wire.EntityState
	if !wire.GetRootAsWorldDelta(frame.Payload, 0).Upserts(&entity, 0) || entity.ResourceShape() != wire.ResourceShapeSquare || entity.Rotation() != 16384 || entity.Velocity(nil).X() != 25 {
		t.Fatal("resource shape or motion not serialized")
	}
	if !entity.MutateResourceShape(wire.ResourceShape(99)) {
		t.Fatal("cannot modify resource shape")
	}
	if _, ok := protocol.ParseMessage(protocol.ChannelState, append([]byte{byte(wire.StatePacketIdWorldDelta), 0}, frame.Payload...)); ok {
		t.Fatal("invalid resource shape accepted")
	}
}

func TestQuantizeClampsOutOfRange(t *testing.T) {
	if quantize(500) != math.MaxInt16 || quantize(-500) != math.MinInt16 || quantize(1.25) != 125 {
		t.Fatal("quantization did not preserve scale and clamp")
	}
}

func TestInputRequiresCurrentLobbyGeneration(t *testing.T) {
	s, err := New(0, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if closeErr := s.Close(); closeErr != nil {
			t.Error(closeErr)
		}
	})
	peer, err := s.api.NewPeerConnection(pion.Configuration{})
	if err != nil {
		t.Fatal(err)
	}
	p, err := newPlayer(Identity{})
	if err != nil {
		t.Fatal(err)
	}
	if err := s.managePlayer(peer, nil, p); err != nil {
		t.Fatal(err)
	}
	s.control(peer, nil, pion.DataChannelMessage{IsString: true, Data: []byte(`{"type":"QuickPlayRequest"}`)})
	b := flatbuffers.NewBuilder(64)
	wire.PlayerInputStartFramesVector(b, 1)
	wire.CreateInputFrame(b, 127, 0, 0, 0)
	frames := b.EndVector(1)
	wire.PlayerInputStart(b)
	wire.PlayerInputAddFirstInputId(b, 5)
	wire.PlayerInputAddFrames(b, frames)
	wire.FinishPlayerInputBuffer(b, wire.PlayerInputEnd(b))
	message := append([]byte{byte(wire.StatePacketIdPlayerInput), p.generation - 1}, b.FinishedBytes()...)
	s.input(peer, pion.DataChannelMessage{Data: message})
	s.mu.Lock()
	if playerInputID(p) != 0 {
		t.Fatal("accepted old generation")
	}
	s.mu.Unlock()
	message[1] = p.generation
	s.input(peer, pion.DataChannelMessage{Data: message})
	s.mu.Lock()
	p.lobby.world.Step()
	if playerInputID(p) != 5 {
		t.Fatal("ignored current generation")
	}
	s.mu.Unlock()
}

func TestInputProcessesBatchDashEdge(t *testing.T) {
	w := simulation.NewWithSeed(42)
	defer w.Close()
	peer := &pion.PeerConnection{}
	p := &player{lobby: &lobby{world: w}, entityID: w.AddPlayer(), generation: 1}
	s := &Server{players: map[*pion.PeerConnection]*player{peer: p}}
	b := flatbuffers.NewBuilder(64)
	wire.PlayerInputStartFramesVector(b, 3)
	wire.CreateInputFrame(b, 127, 0, 0, 0)
	wire.CreateInputFrame(b, 127, 0, 0, wire.InputButtonsDash)
	wire.CreateInputFrame(b, 127, 0, 0, 0)
	frames := b.EndVector(3)
	wire.PlayerInputStart(b)
	wire.PlayerInputAddFirstInputId(b, 10)
	wire.PlayerInputAddFrames(b, frames)
	wire.FinishPlayerInputBuffer(b, wire.PlayerInputEnd(b))
	message := pion.DataChannelMessage{Data: append([]byte{byte(wire.StatePacketIdPlayerInput), 1}, b.FinishedBytes()...)}
	s.input(peer, message)
	if got := playerInputID(p); got != 0 {
		t.Fatalf("ACK before tick = %d, want 0", got)
	}
	w.Step()
	for _, state := range w.States() {
		if state.ID == p.entityID && (state.LastInput != 12 || state.VX < 20) {
			t.Fatalf("ACK/dash = %d/%f, want 12/dash", state.LastInput, state.VX)
		}
	}
}

func playerInputID(p *player) uint32 {
	for _, state := range p.lobby.world.States() {
		if state.ID == p.entityID {
			return state.LastInput
		}
	}
	return 0
}
