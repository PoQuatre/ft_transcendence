// Package simulation owns the authoritative physics state for one lobby.
// Callers must serialize access to a World.
package simulation

import (
	"math"
	"math/rand/v2"

	box2d "github.com/Advik-B/box2d-go"
	"github.com/mlange-42/ark/ecs"
)

const TickRate = 60

// shortcut: cap projectiles to bound full snapshots; upgrade to chunked state updates for larger matches.
const MaxProjectiles = 48

const (
	TankKind uint8 = iota + 1
	ProjectileKind
	ResourceKind
)

const (
	Fire uint8 = 1 << iota
	Dash
)

type Input struct {
	ID      uint32
	X, Y    int8
	Aim     uint16
	Buttons uint8
}

type State struct {
	ID        uint32
	X, Y      float32
	VX, VY    float32
	Aim       uint16
	LastInput uint32
	Kind      uint8
	Health    uint16
	Rotation  float32
	Square    bool
}

type player struct {
	body          box2d.BodyId
	shape         box2d.ShapeId
	input         Input
	inputTick     uint32
	hasInput      bool
	health        uint16
	spawn         box2d.Vec2
	lastFire      uint32
	lastDash      uint32
	dashUntil     uint32
	dashX, dashY  float32
	dashPending   bool
	fired, dashed bool
}

type resource struct {
	body    box2d.BodyId
	health  uint16
	respawn uint32
	square  bool
}

type projectile struct {
	x, y, vx, vy float32
	aim          uint16
	expires      uint32
	owner        uint32
}

type World struct {
	ecs                *ecs.World
	players            *ecs.Map1[player]
	entities           map[uint32]ecs.Entity
	resources          *ecs.Map1[resource]
	resourceEntities   map[uint32]ecs.Entity
	projectiles        *ecs.Map1[projectile]
	projectileEntities map[uint32]ecs.Entity
	shapes             map[box2d.ShapeId]uint32
	physics            box2d.WorldId
	nextID             uint32
	Tick               uint32
}

func New() *World {
	e := ecs.NewWorld()
	def := box2d.DefaultWorldDef()
	def.Gravity = box2d.Vec2{}
	w := &World{
		ecs:                e,
		players:            ecs.NewMap1[player](e),
		entities:           make(map[uint32]ecs.Entity),
		resources:          ecs.NewMap1[resource](e),
		resourceEntities:   make(map[uint32]ecs.Entity),
		projectiles:        ecs.NewMap1[projectile](e),
		projectileEntities: make(map[uint32]ecs.Entity),
		shapes:             make(map[box2d.ShapeId]uint32),
		physics:            box2d.CreateWorld(&def),
	}
	if !w.physics.IsValid() {
		return nil
	}
	// Box2D uses metres; the visible arena spans -50 to 50 metres.
	for _, wall := range []struct{ x, y, hx, hy float32 }{{0, -51, 51, 1}, {0, 51, 51, 1}, {-51, 0, 1, 51}, {51, 0, 1, 51}} {
		bodyDef := box2d.DefaultBodyDef()
		bodyDef.Position = box2d.Vec2{X: wall.x, Y: wall.y}
		body := w.physics.CreateBody(&bodyDef)
		shape := box2d.MakeBox(wall.hx, wall.hy)
		shapeDef := box2d.DefaultShapeDef()
		body.CreatePolygonShape(&shapeDef, &shape)
	}
	for _, cell := range rand.Perm(100) {
		x := float32(cell%10*9-40) + rand.Float32()*4 - 2
		y := float32(cell/10*9-40) + rand.Float32()*4 - 2
		if x > -14 && x < 14 && y > -5 && y < 5 {
			continue
		}
		w.nextID++
		def := box2d.DefaultBodyDef()
		def.Type = box2d.DynamicBody
		def.Position = box2d.Vec2{X: x, Y: y}
		def.Angle = rand.Float32() * 2 * math.Pi
		body := w.physics.CreateBody(&def)
		body.SetLinearDamping(0.4)
		angle := rand.Float64() * 2 * math.Pi
		body.SetLinearVelocity(box2d.Vec2{X: float32(math.Cos(angle) * 0.2), Y: float32(math.Sin(angle) * 0.2)})
		spin := float32(0.08 + rand.Float64()*0.12)
		if rand.IntN(2) == 0 {
			spin = -spin
		}
		body.SetAngularVelocity(spin)
		shapeDef := box2d.DefaultShapeDef()
		shapeDef.Density *= 3
		shapeDef.Restitution = 0.4
		square := w.nextID%2 == 0
		var shapeID box2d.ShapeId
		if square {
			shape := box2d.MakeBox(1, 1)
			shapeID = body.CreatePolygonShape(&shapeDef, &shape)
		} else {
			shape := box2d.MakeCircle(box2d.Vec2{}, 1)
			shapeID = body.CreateCircleShape(&shapeDef, &shape)
		}
		w.shapes[shapeID] = w.nextID
		w.resourceEntities[w.nextID] = w.resources.NewEntity(&resource{body: body, health: 100, square: square})
		if len(w.resourceEntities) == 20 {
			break
		}
	}
	return w
}

func (w *World) Close() { box2d.DestroyWorld(w.physics) }

func (w *World) AddPlayer() uint32 {
	w.nextID++
	def := box2d.DefaultBodyDef()
	def.Type = box2d.DynamicBody
	def.Position = box2d.Vec2{X: float32(len(w.entities)%8)*3 - 10}
	body := w.physics.CreateBody(&def)
	shape := box2d.MakeCircle(box2d.Vec2{}, 1)
	shapeDef := box2d.DefaultShapeDef()
	shapeID := body.CreateCircleShape(&shapeDef, &shape)
	w.shapes[shapeID] = w.nextID
	w.entities[w.nextID] = w.players.NewEntity(&player{body: body, shape: shapeID, health: 100, spawn: def.Position})
	return w.nextID
}

func (w *World) RemovePlayer(id uint32) {
	entity, ok := w.entities[id]
	if !ok {
		return
	}
	p := w.players.Get(entity)
	delete(w.shapes, p.shape)
	box2d.DestroyBody(p.body)
	w.ecs.RemoveEntity(entity)
	delete(w.entities, id)
	for projectileID, entity := range w.projectileEntities {
		if w.projectiles.Get(entity).owner == id {
			w.ecs.RemoveEntity(entity)
			delete(w.projectileEntities, projectileID)
		}
	}
}

// SetInput accepts only newer input, including across uint32 wraparound.
func (w *World) SetInput(id uint32, input Input) bool {
	entity, ok := w.entities[id]
	if !ok {
		return false
	}
	p := w.players.Get(entity)
	if p.hasInput && int32(input.ID-p.input.ID) <= 0 {
		return false
	}
	if input.Buttons&Dash != 0 && p.input.Buttons&Dash == 0 {
		p.dashPending = true
	}
	p.input, p.inputTick, p.hasInput = input, w.Tick, true
	return true
}

func (w *World) Step() {
	w.Tick++
	for id, entity := range w.entities {
		p := w.players.Get(entity)
		x, y := float64(p.input.X)/127, float64(p.input.Y)/127
		if n := math.Hypot(x, y); n > 1 {
			x, y = x/n, y/n
		}
		// shortcut: stop after half a second without input, upgrade to a queued input timeline for reconciliation.
		active := p.hasInput && w.Tick-p.inputTick <= TickRate/2
		if !active {
			x, y = 0, 0
		}
		if active && p.dashPending && (x != 0 || y != 0) && (!p.dashed || w.Tick-p.lastDash >= TickRate*2) {
			p.dashX, p.dashY = float32(x*30), float32(y*30)
			p.dashUntil, p.lastDash, p.dashed = w.Tick+9, w.Tick, true
		}
		p.dashPending = false
		velocity := box2d.Vec2{X: float32(x * 10), Y: float32(y * 10)}
		if w.Tick < p.dashUntil {
			velocity = box2d.Vec2{X: p.dashX, Y: p.dashY}
		}
		p.body.SetLinearVelocity(velocity)
		if active && p.input.Buttons&Fire != 0 && len(w.projectileEntities) < MaxProjectiles && (!p.fired || w.Tick-p.lastFire >= TickRate/3) {
			angle := float64(p.input.Aim) * 2 * math.Pi / 65536
			dx, dy := float32(math.Cos(angle)), float32(math.Sin(angle))
			pos := p.body.GetPosition()
			w.nextID++
			w.projectileEntities[w.nextID] = w.projectiles.NewEntity(&projectile{x: pos.X + dx*1.2, y: pos.Y + dy*1.2, vx: dx * 25, vy: dy * 25, aim: p.input.Aim, expires: w.Tick + TickRate*2, owner: id})
			p.lastFire, p.fired = w.Tick, true
		}
	}
	w.physics.Step(1.0/TickRate, 4)
	for id, entity := range w.projectileEntities {
		p := w.projectiles.Get(entity)
		move := box2d.Vec2{X: p.vx / TickRate, Y: p.vy / TickRate}
		hit := w.physics.CastRayClosest(box2d.Vec2{X: p.x, Y: p.y}, move, box2d.QueryFilter{CategoryBits: ^uint64(0), MaskBits: ^uint64(0)})
		if hit.Hit && w.shapes[hit.ShapeId] == p.owner {
			hit.Hit = false
		}
		if hit.Hit || w.Tick >= p.expires {
			if target, ok := w.shapes[hit.ShapeId]; ok && hit.Hit {
				if resourceEntity, ok := w.resourceEntities[target]; ok {
					w.resources.Get(resourceEntity).body.ApplyLinearImpulse(box2d.Vec2{X: p.vx * 0.5, Y: p.vy * 0.5}, hit.Point, true)
				}
				w.damage(target)
			}
			w.ecs.RemoveEntity(entity)
			delete(w.projectileEntities, id)
		} else {
			p.x += move.X
			p.y += move.Y
		}
	}
	for _, entity := range w.resourceEntities {
		r := w.resources.Get(entity)
		if r.health == 0 && w.Tick >= r.respawn {
			w.respawnResource(r)
		}
		if r.health > 0 && r.body.IsEnabled() {
			velocity := r.body.GetLinearVelocity()
			speed := math.Hypot(float64(velocity.X), float64(velocity.Y))
			if speed < 0.2 {
				if speed < 0.001 {
					angle := float64(r.body.GetAngle())
					velocity = box2d.Vec2{X: float32(math.Cos(angle) * 0.2), Y: float32(math.Sin(angle) * 0.2)}
				} else {
					velocity.X *= float32(0.2 / speed)
					velocity.Y *= float32(0.2 / speed)
				}
				r.body.SetLinearVelocity(velocity)
			}
		}
	}
}

func (w *World) respawnResource(r *resource) {
	for range 64 {
		pos := box2d.Vec2{X: rand.Float32()*90 - 45, Y: rand.Float32()*90 - 45}
		free := true
		for _, entity := range w.resourceEntities {
			other := w.resources.Get(entity)
			if other.health == 0 {
				continue
			}
			p := other.body.GetPosition()
			if math.Hypot(float64(p.X-pos.X), float64(p.Y-pos.Y)) < 3.5 {
				free = false
				break
			}
		}
		if free {
			for _, entity := range w.entities {
				p := w.players.Get(entity).body.GetPosition()
				if math.Hypot(float64(p.X-pos.X), float64(p.Y-pos.Y)) < 3.5 {
					free = false
					break
				}
			}
		}
		if !free {
			continue
		}
		r.body.SetTransform(pos, rand.Float32()*2*math.Pi)
		r.body.Enable()
		direction := rand.Float64() * 2 * math.Pi
		r.body.SetLinearVelocity(box2d.Vec2{X: float32(math.Cos(direction) * 0.2), Y: float32(math.Sin(direction) * 0.2)})
		spin := float32(0.08 + rand.Float64()*0.12)
		if rand.IntN(2) == 0 {
			spin = -spin
		}
		r.body.SetAngularVelocity(spin)
		r.health = 100
		return
	}
}

func (w *World) damage(id uint32) {
	if entity, ok := w.resourceEntities[id]; ok {
		r := w.resources.Get(entity)
		if r.health <= 25 {
			r.health = 0
			r.respawn = w.Tick + TickRate*10
			r.body.Disable()
		} else {
			r.health -= 25
		}
	} else if entity, ok := w.entities[id]; ok {
		p := w.players.Get(entity)
		if p.health <= 25 {
			p.health = 100
			p.body.SetTransform(p.spawn, 0)
		} else {
			p.health -= 25
		}
	}
}

func (w *World) States() []State {
	states := make([]State, 0, len(w.entities)+len(w.resourceEntities)+len(w.projectileEntities))
	for id, entity := range w.entities {
		p := w.players.Get(entity)
		pos, vel := p.body.GetPosition(), p.body.GetLinearVelocity()
		states = append(states, State{ID: id, X: pos.X, Y: pos.Y, VX: vel.X, VY: vel.Y, Aim: p.input.Aim, LastInput: p.input.ID, Kind: TankKind, Health: p.health})
	}
	for id, entity := range w.resourceEntities {
		r := w.resources.Get(entity)
		if r.health == 0 {
			continue
		}
		pos, vel := r.body.GetPosition(), r.body.GetLinearVelocity()
		states = append(states, State{ID: id, X: pos.X, Y: pos.Y, VX: vel.X, VY: vel.Y, Kind: ResourceKind, Health: r.health, Rotation: r.body.GetAngle(), Square: r.square})
	}
	for id, entity := range w.projectileEntities {
		p := w.projectiles.Get(entity)
		states = append(states, State{ID: id, X: p.x, Y: p.y, VX: p.vx, VY: p.vy, Aim: p.aim, Kind: ProjectileKind})
	}
	return states
}
