package simulation

import (
	"github.com/mlange-42/ark/ecs"
	box2d "github.com/oliverbestmann/box2d-go/v3"
)

func (w *World) spawnProjectile(p *projectileSpawn) {
	w.byNetworkID[p.id.value] = w.projectiles.NewEntity(&p.id, &p.motion, &p.shot)
	w.projectileCount++
}

func (w *World) updateProjectiles() {
	removals := w.removals[:0]
	projectiles := w.projectileFilter.Query()
	for projectiles.Next() {
		id, motion, p := projectiles.Get()
		move := box2d.Vec2{X: motion.vx / TickRate, Y: motion.vy / TickRate}
		var hitShape box2d.ShapeId
		var hitPoint box2d.Vec2
		hit := false
		// Shots spawn before the physics step, then raycast against post-step shapes.
		w.physics.CastRay(box2d.Vec2{X: motion.x, Y: motion.y}, move, box2d.QueryFilter{CategoryBits: ^uint64(0), MaskBits: ^uint64(0)}, func(shape box2d.Shape, point box2d.Pos, _ box2d.Vec2, fraction float32) float32 {
			if entity, ok := w.shapes[shape.Id]; ok && entity == w.byNetworkID[p.owner] {
				return -1
			}
			hit, hitShape, hitPoint = true, shape.Id, point
			return fraction
		})
		if hit || w.Tick >= p.expires {
			if target, ok := w.shapes[hitShape]; ok && hit {
				w.applyProjectileHit(target, hitPoint, motion)
			}
			removals = append(removals, id.value)
		} else {
			motion.x += move.X
			motion.y += move.Y
		}
	}
	w.removeProjectiles(removals)
	w.removals = removals
}

// Resolve each hit immediately so a destroyed resource cannot block later shots.
func (w *World) applyProjectileHit(target ecs.Entity, point box2d.Vec2, motion *projectileMotion) {
	if w.resources.HasAll(target) {
		w.bodies.Get(target).body.ApplyLinearImpulse(box2d.Vec2{X: motion.vx * 0.5, Y: motion.vy * 0.5}, point, 1)
	}
	w.damageEntity(target)
}

func (w *World) removeProjectiles(ids []uint32) {
	for _, id := range ids {
		w.ecs.RemoveEntity(w.byNetworkID[id])
		delete(w.byNetworkID, id)
		w.projectileCount--
	}
}
