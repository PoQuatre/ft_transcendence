package simulation

import (
	"math"

	box2d "github.com/oliverbestmann/box2d-go/v3"
)

func (w *World) updateResources() {
	resources := w.resourceFilter.Query()
	for resources.Next() {
		_, body, hp, r := resources.Get()
		if hp.current == 0 && w.Tick >= r.respawn {
			w.respawnResource(body, hp)
		}
		if hp.current > 0 && body.body.IsEnabled() != 0 {
			velocity := body.body.GetLinearVelocity()
			speed := math.Hypot(float64(velocity.X), float64(velocity.Y))
			if speed < 0.2 {
				if speed < 0.001 {
					angle := float64(body.body.GetRotation().Angle())
					velocity = box2d.Vec2{X: float32(math.Cos(angle) * 0.2), Y: float32(math.Sin(angle) * 0.2)}
				} else {
					velocity.X *= float32(0.2 / speed)
					velocity.Y *= float32(0.2 / speed)
				}
				body.body.SetLinearVelocity(velocity)
			}
		}
	}
}

func (w *World) respawnResource(body *rigidBody, hp *health) {
	// shortcut: distance checks approximate shapes, upgrade to overlap queries if spawn fidelity matters.
	for range 64 {
		pos := box2d.Vec2{X: w.rng.Float32()*90 - 45, Y: w.rng.Float32()*90 - 45}
		free := true
		resources := w.resourceFilter.Query()
		for resources.Next() {
			_, other, otherHealth, _ := resources.Get()
			if otherHealth.current == 0 {
				continue
			}
			p := other.body.GetPosition()
			if math.Hypot(float64(p.X-pos.X), float64(p.Y-pos.Y)) < 3.5 {
				free = false
				resources.Close()
				break
			}
		}
		if free {
			players := w.playerFilter.Query()
			for players.Next() {
				_, other, _, _ := players.Get()
				p := other.body.GetPosition()
				if math.Hypot(float64(p.X-pos.X), float64(p.Y-pos.Y)) < 3.5 {
					free = false
					players.Close()
					break
				}
			}
		}
		if !free {
			continue
		}
		body.body.SetTransform(pos, rotation(w.rng.Float32()*2*math.Pi))
		body.body.Enable()
		w.setResourceMotion(body.body)
		hp.current = 100
		return
	}
}

func (w *World) setResourceMotion(body box2d.Body) {
	angle := w.rng.Float64() * 2 * math.Pi
	body.SetLinearVelocity(box2d.Vec2{X: float32(math.Cos(angle) * 0.2), Y: float32(math.Sin(angle) * 0.2)})
	spin := float32(0.08 + w.rng.Float64()*0.12)
	if w.rng.IntN(2) == 0 {
		spin = -spin
	}
	body.SetAngularVelocity(spin)
}
