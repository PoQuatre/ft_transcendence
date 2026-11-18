package webrtc

import (
	"testing"

	"github.com/PoQuatre/ft_transcendence/backend/internal/game/simulation"
)

func BenchmarkSnapshot(b *testing.B) {
	states := make([]simulation.State, 8+20+simulation.MaxProjectiles)
	for i := range states {
		states[i] = simulation.State{ID: uint32(i + 1), Kind: simulation.ResourceKind, X: 25, Y: -25, VX: 20, VY: -10, Aim: 30000, Health: 100, Rotation: 1.5, Square: true}
	}
	p := &player{entityID: 1}
	b.ReportAllocs()
	for range b.N {
		snapshot(1, p, states)
	}
}
