package simulation

import (
	"math"

	box2d "github.com/oliverbestmann/box2d-go/v3"
)

func (w *World) updateMovement() {
	players := w.movementFilter.Query()
	for players.Next() {
		body, input, dash := players.Get()
		x, y := float64(input.input.X)/127, float64(input.input.Y)/127
		if n := math.Hypot(x, y); n > 1 {
			x, y = x/n, y/n
		}
		// shortcut: stop after half a second without input, upgrade to a queued input timeline for reconciliation.
		active := input.hasInput && w.Tick-input.inputTick <= TickRate/2
		if active {
			// This ACK identifies the latest sampled input, not a per-frame timeline.
			input.processedID = input.input.ID
			input.processedAim = input.input.Aim
		} else {
			x, y = 0, 0
		}
		dashX, dashY := float64(input.dashInput.X)/127, float64(input.dashInput.Y)/127
		if n := math.Hypot(dashX, dashY); n > 1 {
			dashX, dashY = dashX/n, dashY/n
		}
		if active && input.dashPending && (dashX != 0 || dashY != 0) && (!dash.dashed || w.Tick-dash.lastDash >= TickRate*2) {
			dash.dashX, dash.dashY = float32(dashX*30), float32(dashY*30)
			dash.dashUntil, dash.lastDash, dash.dashed = w.Tick+9, w.Tick, true
		}
		input.dashPending = false
		velocity := box2d.Vec2{X: float32(x * 10), Y: float32(y * 10)}
		if w.Tick < dash.dashUntil {
			velocity = box2d.Vec2{X: dash.dashX, Y: dash.dashY}
		}
		body.body.SetLinearVelocity(velocity)
	}
}

func (w *World) updateWeapons() {
	spawns := w.spawns[:0]
	// Contested projectile slots follow Ark's query order, not a stable priority.
	players := w.weaponFilter.Query()
	for players.Next() {
		id, body, input, gun := players.Get()
		active := input.hasInput && w.Tick-input.inputTick <= TickRate/2
		if active && (input.input.Buttons&Fire != 0 || input.firePending) && w.projectileCount+len(spawns) < MaxProjectiles && (!gun.fired || w.Tick-gun.lastFire >= TickRate/3) {
			aim := input.input.Aim
			if input.firePending {
				aim = input.fireAim
			}
			angle := float64(aim) * 2 * math.Pi / 65536
			dx, dy := float32(math.Cos(angle)), float32(math.Sin(angle))
			pos := body.body.GetPosition()
			w.nextID++
			spawns = append(spawns, projectileSpawn{
				id:     networkID{w.nextID},
				motion: projectileMotion{x: pos.X + dx*1.2, y: pos.Y + dy*1.2, vx: dx * 25, vy: dy * 25},
				shot:   projectile{aim: aim, expires: w.Tick + TickRate*2, owner: id.value},
			})
			gun.lastFire, gun.fired = w.Tick, true
		}
		input.firePending = false
	}
	for i := range spawns {
		w.spawnProjectile(&spawns[i])
	}
	w.spawns = spawns
}
