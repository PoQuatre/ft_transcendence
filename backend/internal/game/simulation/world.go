// Package simulation owns the authoritative physics state for one lobby.
// Callers must serialize access to a World.
package simulation

import (
	"math"
	"math/rand/v2"
	"sync"

	"github.com/mlange-42/ark/ecs"
	box2d "github.com/oliverbestmann/box2d-go/v3"
)

// Box2D shares internal state across worlds and is not safe for concurrent calls.
var physicsMu sync.Mutex

func rotation(angle float32) box2d.Rot {
	c := box2d.ComputeCosSin(angle)
	return box2d.Rot{C: c.Cosine, S: c.Sine}
}

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
	LastInput uint32
	Rotation  float32
	Aim       uint16
	Health    uint16
	Kind      uint8
	Square    bool
}

type World struct {
	ecs              *ecs.World
	players          *ecs.Map6[networkID, rigidBody, health, playerInput, movement, weapon]
	byNetworkID      map[uint32]ecs.Entity
	resources        *ecs.Map4[networkID, rigidBody, health, resource]
	projectiles      *ecs.Map3[networkID, projectileMotion, projectile]
	bodies           *ecs.Map1[rigidBody]
	healths          *ecs.Map1[health]
	inputs           *ecs.Map1[playerInput]
	movements        *ecs.Map1[movement]
	resourceData     *ecs.Map1[resource]
	movementFilter   *ecs.Filter3[rigidBody, playerInput, movement]
	weaponFilter     *ecs.Filter4[networkID, rigidBody, playerInput, weapon]
	playerFilter     *ecs.Filter4[networkID, rigidBody, health, playerInput]
	resourceFilter   *ecs.Filter4[networkID, rigidBody, health, resource]
	projectileFilter *ecs.Filter3[networkID, projectileMotion, projectile]
	shapes           map[box2d.ShapeId]ecs.Entity
	rng              *rand.Rand
	spawns           []projectileSpawn
	removals         []uint32
	playerCount      int
	projectileCount  int
	physics          box2d.World
	nextID           uint32
	Tick             uint32
	closed           bool
}

func New() *World {
	// #nosec G404 -- gameplay randomness is not security-sensitive.
	return newWorld(rand.New(rand.NewPCG(rand.Uint64(), rand.Uint64())))
}

// NewWithSeed makes random choices repeatable when gameplay ordering is the same.
func NewWithSeed(seed uint64) *World {
	// #nosec G404 -- deterministic gameplay is needed for reproducible simulations.
	return newWorld(rand.New(rand.NewPCG(seed, seed)))
}

func newWorld(rng *rand.Rand) *World {
	physicsMu.Lock()
	defer physicsMu.Unlock()
	e := ecs.NewWorld()
	def := box2d.DefaultWorldDef()
	def.Gravity = box2d.Vec2{}
	w := &World{
		ecs:              e,
		players:          ecs.NewMap6[networkID, rigidBody, health, playerInput, movement, weapon](e),
		byNetworkID:      make(map[uint32]ecs.Entity),
		resources:        ecs.NewMap4[networkID, rigidBody, health, resource](e),
		projectiles:      ecs.NewMap3[networkID, projectileMotion, projectile](e),
		bodies:           ecs.NewMap1[rigidBody](e),
		healths:          ecs.NewMap1[health](e),
		inputs:           ecs.NewMap1[playerInput](e),
		movements:        ecs.NewMap1[movement](e),
		resourceData:     ecs.NewMap1[resource](e),
		movementFilter:   ecs.NewFilter3[rigidBody, playerInput, movement](e),
		weaponFilter:     ecs.NewFilter4[networkID, rigidBody, playerInput, weapon](e),
		playerFilter:     ecs.NewFilter4[networkID, rigidBody, health, playerInput](e),
		resourceFilter:   ecs.NewFilter4[networkID, rigidBody, health, resource](e),
		projectileFilter: ecs.NewFilter3[networkID, projectileMotion, projectile](e),
		shapes:           make(map[box2d.ShapeId]ecs.Entity),
		physics:          box2d.CreateWorld(def),
		rng:              rng,
	}
	if w.physics.IsValid() == 0 {
		return nil
	}
	// Box2D uses metres; the visible arena spans -50 to 50 metres.
	for _, wall := range []struct{ x, y, hx, hy float32 }{{0, -51, 51, 1}, {0, 51, 51, 1}, {-51, 0, 1, 51}, {51, 0, 1, 51}} {
		bodyDef := box2d.DefaultBodyDef()
		bodyDef.Position = box2d.Vec2{X: wall.x, Y: wall.y}
		body := w.physics.CreateBody(bodyDef)
		shape := box2d.MakeBox(wall.hx, wall.hy)
		shapeDef := box2d.DefaultShapeDef()
		body.CreatePolygonShape(shapeDef, shape)
	}
	for _, cell := range w.rng.Perm(100) {
		x := float32(cell%10*9-40) + w.rng.Float32()*4 - 2
		y := float32(cell/10*9-40) + w.rng.Float32()*4 - 2
		if x > -14 && x < 14 && y > -5 && y < 5 {
			continue
		}
		w.nextID++
		def := box2d.DefaultBodyDef()
		def.Type1 = box2d.DynamicBody
		def.Position = box2d.Vec2{X: x, Y: y}
		def.Rotation = rotation(w.rng.Float32() * 2 * math.Pi)
		body := w.physics.CreateBody(def)
		body.SetLinearDamping(0.4)
		w.setResourceMotion(body)
		shapeDef := box2d.DefaultShapeDef()
		shapeDef.Density *= 3
		shapeDef.Material.Restitution = 0.4
		square := w.nextID%2 == 0
		var shapeID box2d.Shape
		if square {
			shape := box2d.MakeBox(1, 1)
			shapeID = body.CreatePolygonShape(shapeDef, shape)
		} else {
			shape := box2d.Circle{Radius: 1}
			shapeID = body.CreateCircleShape(shapeDef, shape)
		}
		entity := w.resources.NewEntity(&networkID{w.nextID}, &rigidBody{body, shapeID}, &health{100}, &resource{square: square})
		w.byNetworkID[w.nextID], w.shapes[shapeID.Id] = entity, entity
		if w.nextID == 20 {
			break
		}
	}
	return w
}

func (w *World) Close() {
	physicsMu.Lock()
	defer physicsMu.Unlock()
	if w.closed {
		return
	}
	w.physics.DestroyWorld()
	w.closed = true
}

func (w *World) AddPlayer() uint32 {
	physicsMu.Lock()
	defer physicsMu.Unlock()
	w.nextID++
	def := box2d.DefaultBodyDef()
	def.Type1 = box2d.DynamicBody
	def.Position = box2d.Vec2{X: float32(w.playerCount%8)*3 - 10}
	body := w.physics.CreateBody(def)
	shape := box2d.Circle{Radius: 1}
	shapeDef := box2d.DefaultShapeDef()
	shapeID := body.CreateCircleShape(shapeDef, shape)
	entity := w.players.NewEntity(&networkID{w.nextID}, &rigidBody{body, shapeID}, &health{100}, &playerInput{}, &movement{spawn: def.Position}, &weapon{})
	w.byNetworkID[w.nextID], w.shapes[shapeID.Id] = entity, entity
	w.playerCount++
	return w.nextID
}

func (w *World) RemovePlayer(id uint32) {
	physicsMu.Lock()
	defer physicsMu.Unlock()
	entity, ok := w.byNetworkID[id]
	if !ok || !w.players.HasAll(entity) {
		return
	}
	p := w.bodies.Get(entity)
	delete(w.shapes, p.shape.Id)
	p.body.DestroyBody()
	w.ecs.RemoveEntity(entity)
	delete(w.byNetworkID, id)
	w.playerCount--
	removals := w.removals[:0]
	projectiles := w.projectileFilter.Query()
	for projectiles.Next() {
		netID, _, p := projectiles.Get()
		if p.owner == id {
			removals = append(removals, netID.value)
		}
	}
	w.removeProjectiles(removals)
	w.removals = removals
}

// SetInput accepts newer input within the forward half of the uint32 sequence space.
// Presses between ticks coalesce into the first pending action per button.
func (w *World) SetInput(id uint32, input Input) bool {
	entity, ok := w.byNetworkID[id]
	if !ok || !w.players.HasAll(entity) {
		return false
	}
	p := w.inputs.Get(entity)
	// #nosec G115 -- signed wraparound implements sequence-number ordering.
	if p.hasInput && int32(input.ID-p.input.ID) <= 0 {
		return false
	}
	if input.Buttons&Dash != 0 && p.input.Buttons&Dash == 0 && !p.dashPending {
		p.dashPending = true
		p.dashInput = input
	}
	if input.Buttons&Fire != 0 && p.input.Buttons&Fire == 0 && !p.firePending {
		p.firePending = true
		p.fireAim = input.Aim
	}
	p.input, p.inputTick, p.hasInput = input, w.Tick, true
	return true
}

func (w *World) Step() {
	physicsMu.Lock()
	defer physicsMu.Unlock()
	w.Tick++
	w.updateMovement()
	w.updateWeapons()
	w.physics.Step(1.0/TickRate, 4)
	w.updateProjectiles()
	w.updateResources()
}
