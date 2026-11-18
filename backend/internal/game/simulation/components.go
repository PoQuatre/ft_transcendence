package simulation

import box2d "github.com/oliverbestmann/box2d-go/v3"

type networkID struct{ value uint32 }

type rigidBody struct {
	body  box2d.Body
	shape box2d.Shape
}

type health struct{ current uint16 }

type playerInput struct {
	input        Input
	dashInput    Input
	inputTick    uint32
	processedID  uint32
	processedAim uint16
	fireAim      uint16
	hasInput     bool
	dashPending  bool
	firePending  bool
}

type movement struct {
	spawn        box2d.Vec2
	lastDash     uint32
	dashUntil    uint32
	dashX, dashY float32
	dashed       bool
}

type weapon struct {
	lastFire uint32
	fired    bool
}

type resource struct {
	respawn uint32
	square  bool
}

type projectileMotion struct {
	x, y, vx, vy float32
}

type projectile struct {
	expires uint32
	owner   uint32
	aim     uint16
}

type projectileSpawn struct {
	id     networkID
	motion projectileMotion
	shot   projectile
}
