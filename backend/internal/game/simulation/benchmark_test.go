package simulation

import "testing"

func BenchmarkWorld(b *testing.B) {
	for _, firing := range []bool{false, true} {
		name := "idle"
		if firing {
			name = "firing"
		}
		b.Run(name, func(b *testing.B) {
			w := New()
			defer w.Close()
			var ids [8]uint32
			for i := range ids {
				ids[i] = w.AddPlayer()
			}
			b.ReportAllocs()
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				for _, id := range ids {
					in := Input{ID: uint32(i + 1), X: 127}
					if firing {
						in.Buttons = Fire
					}
					w.SetInput(id, in)
				}
				w.Step()
			}
		})
	}
	b.Run("states", func(b *testing.B) {
		w := New()
		defer w.Close()
		for range 8 {
			w.AddPlayer()
		}
		b.ReportAllocs()
		b.ResetTimer()
		for range b.N {
			w.States()
		}
	})
	b.Run("states-reuse", func(b *testing.B) {
		w := New()
		defer w.Close()
		for range 8 {
			w.AddPlayer()
		}
		states := make([]State, 0, 8+20+MaxProjectiles)
		b.ReportAllocs()
		b.ResetTimer()
		for range b.N {
			states = w.AppendStates(states[:0])
		}
	})
}
