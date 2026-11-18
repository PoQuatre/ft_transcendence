package simulation

import (
	"github.com/mlange-42/ark/ecs"
	box2d "github.com/oliverbestmann/box2d-go/v3"
)

func (w *World) damageEntity(entity ecs.Entity) {
	isResource := w.resources.HasAll(entity)
	if !isResource && !w.players.HasAll(entity) {
		return
	}
	hp := w.healths.Get(entity)
	if isResource && hp.current == 0 {
		return
	}
	switch {
	case hp.current > 25:
		hp.current -= 25
	case isResource:
		hp.current = 0
		w.resourceData.Get(entity).respawn = w.Tick + TickRate*10
		w.bodies.Get(entity).body.Disable()
	default:
		hp.current = 100
		// Respawn preserves velocity, cooldowns, dash and input as before.
		w.bodies.Get(entity).body.SetTransform(w.movements.Get(entity).spawn, box2d.Rot{C: 1})
	}
}
