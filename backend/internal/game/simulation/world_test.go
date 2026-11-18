package simulation

import (
	"math"
	"math/rand/v2"
	"sync"
	"testing"

	box2d "github.com/oliverbestmann/box2d-go/v3"
)

func TestConcurrentWorlds(t *testing.T) {
	var wg sync.WaitGroup
	for range 4 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			w := New()
			if w == nil {
				t.Error("could not create world")
				return
			}
			defer w.Close()
			id := w.AddPlayer()
			w.SetInput(id, Input{ID: 1, X: 127, Buttons: Fire})
			for range 20 {
				w.Step()
				w.States()
			}
			w.RemovePlayer(id)
		}()
	}
	wg.Wait()
}

func isolateResource(w *World) uint32 {
	keep := uint32(1)
	for id, entity := range w.byNetworkID {
		if !w.resources.HasAll(entity) {
			continue
		}
		if keep == id {
			continue
		}
		w.bodies.Get(entity).body.Disable()
	}
	return keep
}

func disableResources(w *World) {
	for _, entity := range w.byNetworkID {
		if w.resources.HasAll(entity) {
			w.bodies.Get(entity).body.Disable()
		}
	}
}

func TestMovementInputOrderAndRemoval(t *testing.T) {
	w := New()
	defer w.Close()
	disableResources(w)
	id := w.AddPlayer()
	if !w.SetInput(id, Input{ID: 2, X: 127}) || w.SetInput(id, Input{ID: 1, X: -127}) {
		t.Fatal("input ordering")
	}
	before := stateByID(t, w, id).X
	for range 10 {
		w.Step()
	}
	if stateByID(t, w, id).X <= before {
		t.Fatal("player did not move")
	}
	for range TickRate {
		w.Step()
	}
	if stateByID(t, w, id).VX != 0 {
		t.Fatal("stale input did not stop")
	}
	w.RemovePlayer(id)
	if len(w.States()) != 20 || w.SetInput(id, Input{}) {
		t.Fatal("removed player remains")
	}
}

func stateByID(t *testing.T, w *World, id uint32) State {
	t.Helper()
	for _, state := range w.States() {
		if state.ID == id {
			return state
		}
	}
	t.Fatalf("missing entity %d", id)
	return State{}
}

func TestInputBatchEdgesAndProcessedAcknowledgement(t *testing.T) {
	w := New()
	defer w.Close()
	disableResources(w)
	id := w.AddPlayer()
	w.SetInput(id, Input{ID: 10, X: 127})
	w.SetInput(id, Input{ID: 11, X: 127, Buttons: Dash})
	w.SetInput(id, Input{ID: 12, X: 127})
	if got := stateByID(t, w, id).LastInput; got != 0 {
		t.Fatalf("ACK before step = %d, want 0", got)
	}
	w.Step()
	state := stateByID(t, w, id)
	if state.LastInput != 12 || state.VX < 20 {
		t.Fatalf("sampled ACK/dash = %d/%f, want 12/dash", state.LastInput, state.VX)
	}
	w.SetInput(id, Input{ID: 13, X: 127})
	if got := stateByID(t, w, id).LastInput; got != 12 {
		t.Fatalf("ACK before next step = %d, want 12", got)
	}
}

func TestSnapshotDoesNotExposeUnprocessedAim(t *testing.T) {
	w := New()
	defer w.Close()
	id := w.AddPlayer()
	w.SetInput(id, Input{ID: 1, Aim: 1234})
	if got := stateByID(t, w, id).Aim; got != 0 {
		t.Fatalf("aim before step = %d, want 0", got)
	}
	w.Step()
	if got := stateByID(t, w, id).Aim; got != 1234 {
		t.Fatalf("aim after step = %d, want 1234", got)
	}
}

func TestRepeatedPlayerLifecycleCleansProjectiles(t *testing.T) {
	w := NewWithSeed(42)
	defer w.Close()
	for range MaxProjectiles + 1 {
		id := w.AddPlayer()
		w.SetInput(id, Input{ID: 1, Buttons: Fire})
		w.Step()
		shots := 0
		for _, state := range w.States() {
			if state.Kind == ProjectileKind {
				shots++
			}
		}
		if shots != 1 {
			t.Fatalf("got %d projectiles before removal, want 1", shots)
		}
		w.RemovePlayer(id)
		for _, state := range w.States() {
			if state.Kind != ResourceKind {
				t.Fatalf("state remains after player removal: %+v", state)
			}
		}
	}
}

func TestRemovingPlayerPreservesOtherPlayersProjectile(t *testing.T) {
	w := NewWithSeed(42)
	defer w.Close()
	first, second := w.AddPlayer(), w.AddPlayer()
	w.SetInput(first, Input{ID: 1, Aim: 32768, Buttons: Fire})
	w.SetInput(second, Input{ID: 1, Buttons: Fire})
	w.Step()
	var shot uint32
	for _, state := range w.States() {
		if state.Kind == ProjectileKind && state.Aim == 0 {
			shot = state.ID
		}
	}
	if shot == 0 {
		t.Fatal("second player's projectile missing")
	}
	w.RemovePlayer(first)
	w.RemovePlayer(shot)
	if w.SetInput(shot, Input{ID: 1}) {
		t.Fatal("projectile accepted player input")
	}
	if stateByID(t, w, shot).Kind != ProjectileKind {
		t.Fatal("second player's projectile was removed")
	}
}

func TestRemovingNonPlayerDoesNotAffectResources(t *testing.T) {
	w := NewWithSeed(42)
	defer w.Close()
	before := stateByID(t, w, 1)
	w.RemovePlayer(before.ID)
	if w.SetInput(before.ID, Input{ID: 1, Buttons: Fire}) {
		t.Fatal("resource accepted player input")
	}
	if got := stateByID(t, w, before.ID); got != before {
		t.Fatalf("resource changed after player removal: %+v", got)
	}
}

func TestProjectileCapReleasesSlotsOnPlayerDeparture(t *testing.T) {
	w := NewWithSeed(42)
	defer w.Close()
	owner, first, second := w.AddPlayer(), w.AddPlayer(), w.AddPlayer()
	// Fill all but one slot with long-lived shots belonging to the departing player.
	for range MaxProjectiles - 1 {
		w.nextID++
		w.spawnProjectile(&projectileSpawn{
			id:     networkID{w.nextID},
			motion: projectileMotion{y: 20, vx: 0.01},
			shot:   projectile{owner: owner, expires: 100},
		})
	}
	w.SetInput(first, Input{ID: 1, Aim: 32768, Buttons: Fire})
	w.SetInput(second, Input{ID: 1, Buttons: Fire})
	w.Step()
	countShots := func() int {
		count := 0
		for _, state := range w.States() {
			if state.Kind == ProjectileKind {
				count++
			}
		}
		return count
	}
	if got := countShots(); got != MaxProjectiles {
		t.Fatalf("shots at cap = %d, want %d", got, MaxProjectiles)
	}
	w.RemovePlayer(owner)
	if got := countShots(); got != 1 {
		t.Fatalf("shots after departure = %d, want 1", got)
	}
	w.Step()
	if got := countShots(); got != 2 {
		t.Fatalf("shots after slot release = %d, want 2", got)
	}
}

func TestSeededInitializationAndClose(t *testing.T) {
	a, b := NewWithSeed(42), NewWithSeed(42)
	defer b.Close()
	for id := uint32(1); id <= 20; id++ {
		if got, want := stateByID(t, a, id), stateByID(t, b, id); got != want {
			t.Fatalf("resource %d differs: %+v != %+v", id, got, want)
		}
	}
	a.Close()
	a.Close()
}

func TestInputSequenceWraparound(t *testing.T) {
	w := New()
	defer w.Close()
	id := w.AddPlayer()
	if !w.SetInput(id, Input{ID: ^uint32(0)}) || !w.SetInput(id, Input{ID: 0}) ||
		w.SetInput(id, Input{ID: ^uint32(0)}) || w.SetInput(id, Input{ID: 0}) {
		t.Fatal("input wraparound, duplicate or stale handling is incorrect")
	}
}

func TestBriefFirePressBetweenTicks(t *testing.T) {
	w := New()
	defer w.Close()
	disableResources(w)
	id := w.AddPlayer()
	w.SetInput(id, Input{ID: 1, Buttons: Fire})
	w.SetInput(id, Input{ID: 2, Aim: 32768})
	w.Step()
	if w.projectileCount != 1 {
		t.Fatal("fire press between ticks was lost")
	}
	for _, state := range w.States() {
		if state.Kind == ProjectileKind && state.Aim != 0 {
			t.Fatal("buffered shot did not retain press aim")
		}
	}
}

func TestDashPreservesPressDirection(t *testing.T) {
	w := New()
	defer w.Close()
	disableResources(w)
	id := w.AddPlayer()
	w.SetInput(id, Input{ID: 1, X: 127, Buttons: Dash})
	w.SetInput(id, Input{ID: 2})
	w.Step()
	if got := stateByID(t, w, id).VX; got < 20 {
		t.Fatalf("dash velocity = %f, want press direction", got)
	}
}

func TestFireDashAndResources(t *testing.T) {
	w := New()
	defer w.Close()
	disableResources(w)
	id := w.AddPlayer()
	if len(w.States()) != 21 {
		t.Fatal("resources did not spawn")
	}
	w.SetInput(id, Input{ID: 1, X: 127, Buttons: Fire | Dash})
	w.Step()
	if stateByID(t, w, id).VX < 20 {
		t.Fatal("dash did not accelerate player")
	}
	if w.projectileCount != 1 {
		t.Fatal("first shot missing")
	}
	for i := 2; i <= 15; i++ {
		w.SetInput(id, Input{ID: uint32(i), X: 127, Buttons: Fire | Dash})
		w.Step()
	}
	if w.projectileCount != 1 {
		t.Fatal("fire cooldown not enforced")
	}
	if stateByID(t, w, id).VX > 15 {
		t.Fatal("held dash repeated")
	}
	for i := 16; i <= 22; i++ {
		w.SetInput(id, Input{ID: uint32(i), Buttons: Fire | Dash})
		w.Step()
	}
	if w.projectileCount != 2 {
		t.Fatal("held fire did not repeat")
	}
}

func TestProjectileDamagesAndResourceRespawns(t *testing.T) {
	w := New()
	defer w.Close()
	resourceID := isolateResource(w)
	id := w.AddPlayer()
	r := w.bodies.Get(w.byNetworkID[resourceID]).body
	r.SetTransform(box2d.Vec2{X: 0, Y: -11}, box2d.Rot{C: 1})
	r.SetLinearVelocity(box2d.Vec2{})
	p := w.bodies.Get(w.byNetworkID[id])
	p.body.SetTransform(box2d.Vec2{X: -5, Y: -11}, box2d.Rot{C: 1})
	w.SetInput(id, Input{ID: 1, Buttons: Fire})
	for range 15 {
		w.Step()
	}
	if stateByID(t, w, resourceID).Health != 75 || r.GetLinearVelocity().X < 0.5 {
		t.Fatal("bullet did not damage and push resource")
	}
	for range 3 {
		w.damageEntity(w.byNetworkID[resourceID])
	}
	deathPosition := r.GetPosition()
	if r.IsEnabled() != 0 {
		t.Fatal("resource was not disabled")
	}
	for range TickRate * 10 {
		w.Step()
	}
	if stateByID(t, w, resourceID).Health != 100 {
		t.Fatal("resource did not respawn")
	}
	if r.GetPosition() == deathPosition || math.Abs(float64(r.GetAngularVelocity())) < 0.07 {
		t.Fatal("resource did not respawn at a new location with spin")
	}
	// The same network identity and shape must accept hits after reuse.
	r.SetTransform(box2d.Vec2{X: 0, Y: -11}, box2d.Rot{C: 1})
	r.SetLinearVelocity(box2d.Vec2{})
	w.bodies.Get(w.byNetworkID[id]).body.SetTransform(box2d.Vec2{X: -5, Y: -11}, box2d.Rot{C: 1})
	w.SetInput(id, Input{ID: 2, Buttons: Fire})
	for range 15 {
		w.Step()
	}
	if got := stateByID(t, w, resourceID).Health; got != 75 {
		t.Fatalf("respawned resource health after hit = %d, want 75", got)
	}
}

func TestDestroyedResourceDoesNotBlockLaterProjectile(t *testing.T) {
	w := NewWithSeed(42)
	defer w.Close()
	resourceID := isolateResource(w)
	owner := w.AddPlayer()
	body := w.bodies.Get(w.byNetworkID[resourceID]).body
	body.SetTransform(box2d.Vec2{X: 0, Y: -11}, box2d.Rot{C: 1})
	body.SetLinearVelocity(box2d.Vec2{})
	for range 3 {
		w.damageEntity(w.byNetworkID[resourceID])
	}
	var lastShot uint32
	for range 2 {
		w.nextID++
		lastShot = w.nextID
		w.spawnProjectile(&projectileSpawn{
			id:     networkID{w.nextID},
			motion: projectileMotion{x: -3, y: -11, vx: 240},
			shot:   projectile{owner: owner, expires: 10},
		})
	}
	w.Step()
	for _, state := range w.States() {
		if state.ID == resourceID {
			t.Fatal("destroyed resource remains visible")
		}
	}
	if got := stateByID(t, w, lastShot); got.X < 0 {
		t.Fatalf("later shot was blocked by destroyed resource: %+v", got)
	}
}

func TestResourceRespawnRetriesAfterBlockedAttempts(t *testing.T) {
	w := NewWithSeed(42)
	defer w.Close()
	resourceID := uint32(1)
	for range 4 {
		w.damageEntity(w.byNetworkID[resourceID])
	}
	// Block each candidate from a known RNG sequence with a stationary player.
	const seed = 123
	positions := rand.New(rand.NewPCG(seed, seed))
	blockers := make([]uint32, 0, 64)
	for range 64 {
		pos := box2d.Vec2{X: positions.Float32()*90 - 45, Y: positions.Float32()*90 - 45}
		id := w.AddPlayer()
		body := w.bodies.Get(w.byNetworkID[id]).body
		body.SetTransform(pos, box2d.Rot{C: 1})
		body.SetType(box2d.StaticBody)
		blockers = append(blockers, id)
	}
	w.rng = rand.New(rand.NewPCG(seed, seed))
	w.Tick = TickRate*10 - 1
	w.Step()
	for _, state := range w.States() {
		if state.ID == resourceID {
			t.Fatal("resource respawned despite all candidates being blocked")
		}
	}
	// Only the final candidate is freed; the next tick must reach attempt 64.
	w.RemovePlayer(blockers[len(blockers)-1])
	w.rng = rand.New(rand.NewPCG(seed, seed))
	w.Step()
	if got := stateByID(t, w, resourceID).Health; got != 100 {
		t.Fatalf("resource health after retry = %d, want 100", got)
	}
}

func TestProjectileDamagesOtherPlayer(t *testing.T) {
	w := New()
	defer w.Close()
	disableResources(w)
	shooter, target := w.AddPlayer(), w.AddPlayer()
	w.bodies.Get(w.byNetworkID[shooter]).body.SetTransform(box2d.Vec2{X: -10, Y: 0}, box2d.Rot{C: 1})
	w.bodies.Get(w.byNetworkID[target]).body.SetTransform(box2d.Vec2{X: -5, Y: 0}, box2d.Rot{C: 1})
	w.SetInput(shooter, Input{ID: 1, Buttons: Fire})
	for range 15 {
		w.Step()
	}
	if got := stateByID(t, w, target).Health; got != 75 {
		t.Fatalf("target health = %d, want 75", got)
	}
	if got := stateByID(t, w, shooter).Health; got != 100 {
		t.Fatalf("shooter health = %d, want 100", got)
	}
}

func TestPlayerDamageRespawnsAtSpawn(t *testing.T) {
	w := NewWithSeed(42)
	defer w.Close()
	id := w.AddPlayer()
	entity := w.byNetworkID[id]
	body := w.bodies.Get(entity).body
	spawn := body.GetPosition()
	body.SetTransform(box2d.Vec2{X: 12, Y: 12}, box2d.Rot{C: 1})
	velocity := box2d.Vec2{X: 3, Y: 4}
	body.SetLinearVelocity(velocity)
	for range 4 {
		w.damageEntity(entity)
	}
	if got := w.healths.Get(entity).current; got != 100 {
		t.Fatalf("respawn health = %d, want 100", got)
	}
	if body.GetPosition() != spawn || body.GetLinearVelocity() != velocity {
		t.Fatal("respawn did not restore position and preserve velocity")
	}
}

func TestProjectileSkipsOwnerAndHitsTargetBehind(t *testing.T) {
	w := New()
	defer w.Close()
	disableResources(w)
	owner, target := w.AddPlayer(), w.AddPlayer()
	w.bodies.Get(w.byNetworkID[owner]).body.SetTransform(box2d.Vec2{}, box2d.Rot{C: 1})
	w.bodies.Get(w.byNetworkID[target]).body.SetTransform(box2d.Vec2{X: 4}, box2d.Rot{C: 1})
	w.nextID++
	w.spawnProjectile(&projectileSpawn{id: networkID{w.nextID}, motion: projectileMotion{x: -2, vx: 420}, shot: projectile{owner: owner, expires: 10}})
	w.Step()
	if got := stateByID(t, w, target).Health; got != 75 {
		t.Fatalf("target health = %d, want 75", got)
	}
	if got := stateByID(t, w, owner).Health; got != 100 {
		t.Fatalf("owner health = %d, want 100", got)
	}
}

func TestProjectileWallAndExpiry(t *testing.T) {
	w := New()
	defer w.Close()
	disableResources(w)
	owner := w.AddPlayer()
	w.nextID++
	w.spawnProjectile(&projectileSpawn{id: networkID{w.nextID}, motion: projectileMotion{x: 49, vx: 120}, shot: projectile{owner: owner, expires: 10}})
	w.Step()
	if w.projectileCount != 0 {
		t.Fatal("wall did not block projectile")
	}
	w.nextID++
	w.spawnProjectile(&projectileSpawn{id: networkID{w.nextID}, motion: projectileMotion{x: 0, y: 20, vx: 1}, shot: projectile{owner: owner, expires: w.Tick + 1}})
	w.Step()
	if w.projectileCount != 0 {
		t.Fatal("projectile did not expire")
	}
}

func TestProjectileHitsNearestEligibleTarget(t *testing.T) {
	w := New()
	defer w.Close()
	disableResources(w)
	owner, near, far := w.AddPlayer(), w.AddPlayer(), w.AddPlayer()
	w.bodies.Get(w.byNetworkID[owner]).body.SetTransform(box2d.Vec2{X: -10}, box2d.Rot{C: 1})
	w.bodies.Get(w.byNetworkID[near]).body.SetTransform(box2d.Vec2{X: 0}, box2d.Rot{C: 1})
	w.bodies.Get(w.byNetworkID[far]).body.SetTransform(box2d.Vec2{X: 4}, box2d.Rot{C: 1})
	w.nextID++
	w.spawnProjectile(&projectileSpawn{id: networkID{w.nextID}, motion: projectileMotion{x: -3, vx: 600}, shot: projectile{owner: owner, expires: 10}})
	w.Step()
	if stateByID(t, w, near).Health != 75 || stateByID(t, w, far).Health != 100 {
		t.Fatal("projectile did not hit nearest target")
	}
}

func TestResourcesSpawnAndDrift(t *testing.T) {
	w := New()
	defer w.Close()
	playerID := w.AddPlayer()
	playerMass := w.bodies.Get(w.byNetworkID[playerID]).body.GetMass()
	squares := 0
	for _, entity := range w.byNetworkID {
		if !w.resources.HasAll(entity) {
			continue
		}
		r := w.bodies.Get(entity).body
		if r.GetMass() < playerMass*2.99 {
			t.Fatal("resource is not heavier than a player")
		}
		if w.resourceData.Get(entity).square {
			squares++
		}
		v := r.GetLinearVelocity()
		if math.Hypot(float64(v.X), float64(v.Y)) < 0.19 || math.Abs(float64(r.GetAngularVelocity())) < 0.07 {
			t.Fatal("resource lacks initial motion")
		}
	}
	if squares != 10 {
		t.Fatalf("got %d squares", squares)
	}
	first := uint32(1)
	w.bodies.Get(w.byNetworkID[first]).body.SetLinearVelocity(box2d.Vec2{})
	w.Step()
	initial := stateByID(t, w, first)
	if math.Hypot(float64(initial.VX), float64(initial.VY)) < 0.19 {
		t.Fatal("minimum drift was not restored")
	}
	before := stateByID(t, w, first)
	for range 30 {
		w.Step()
	}
	after := stateByID(t, w, first)
	if before.X == after.X && before.Y == after.Y {
		t.Fatal("resource did not drift")
	}
	if before.Rotation == after.Rotation {
		t.Fatal("resource did not rotate")
	}
}

func TestPlayerPushesResource(t *testing.T) {
	w := New()
	defer w.Close()
	rid := isolateResource(w)
	r := w.bodies.Get(w.byNetworkID[rid]).body
	r.SetTransform(box2d.Vec2{X: 0, Y: 0}, box2d.Rot{C: 1})
	r.SetLinearVelocity(box2d.Vec2{})
	id := w.AddPlayer()
	w.bodies.Get(w.byNetworkID[id]).body.SetTransform(box2d.Vec2{X: -4, Y: 0}, box2d.Rot{C: 1})
	w.SetInput(id, Input{ID: 1, X: 127})
	for range 25 {
		w.Step()
	}
	if r.GetPosition().X < 0.5 {
		t.Fatal("player did not push resource")
	}
}
