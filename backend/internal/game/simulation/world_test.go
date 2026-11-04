package simulation

import (
	"math"
	"testing"

	box2d "github.com/Advik-B/box2d-go"
)

func isolateResource(w *World) uint32 {
	var keep uint32
	for id, entity := range w.resourceEntities {
		if keep == 0 {
			keep = id
			continue
		}
		w.resources.Get(entity).body.Disable()
	}
	return keep
}

func disableResources(w *World) {
	for _, entity := range w.resourceEntities {
		w.resources.Get(entity).body.Disable()
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
	if len(w.projectileEntities) != 1 {
		t.Fatal("first shot missing")
	}
	for i := 2; i <= 15; i++ {
		w.SetInput(id, Input{ID: uint32(i), X: 127, Buttons: Fire | Dash})
		w.Step()
	}
	if len(w.projectileEntities) != 1 {
		t.Fatal("fire cooldown not enforced")
	}
	if stateByID(t, w, id).VX > 15 {
		t.Fatal("held dash repeated")
	}
	for i := 16; i <= 22; i++ {
		w.SetInput(id, Input{ID: uint32(i), Buttons: Fire | Dash})
		w.Step()
	}
	if len(w.projectileEntities) != 2 {
		t.Fatal("held fire did not repeat")
	}
}

func TestProjectileDamagesAndResourceRespawns(t *testing.T) {
	w := New()
	defer w.Close()
	resourceID := isolateResource(w)
	id := w.AddPlayer()
	r := w.resources.Get(w.resourceEntities[resourceID])
	r.body.SetTransform(box2d.Vec2{X: 0, Y: -11}, 0)
	r.body.SetLinearVelocity(box2d.Vec2{})
	p := w.players.Get(w.entities[id])
	p.body.SetTransform(box2d.Vec2{X: -5, Y: -11}, 0)
	w.SetInput(id, Input{ID: 1, Buttons: Fire})
	for range 15 {
		w.Step()
	}
	if r.health != 75 || r.body.GetLinearVelocity().X < 0.5 {
		t.Fatal("bullet did not damage and push resource")
	}
	for range 3 {
		w.damage(resourceID)
	}
	deathPosition := r.body.GetPosition()
	if r.health != 0 {
		t.Fatalf("resource health = %d, want destroyed", r.health)
	}
	for range TickRate * 10 {
		w.Step()
	}
	if r.health != 100 {
		t.Fatal("resource did not respawn")
	}
	if r.body.GetPosition() == deathPosition || math.Abs(float64(r.body.GetAngularVelocity())) < 0.07 {
		t.Fatal("resource did not respawn at a new location with spin")
	}
}

func TestProjectileDamagesOtherPlayer(t *testing.T) {
	w := New()
	defer w.Close()
	disableResources(w)
	shooter, target := w.AddPlayer(), w.AddPlayer()
	w.players.Get(w.entities[shooter]).body.SetTransform(box2d.Vec2{X: -10, Y: 0}, 0)
	w.players.Get(w.entities[target]).body.SetTransform(box2d.Vec2{X: -5, Y: 0}, 0)
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

func TestResourcesSpawnAndDrift(t *testing.T) {
	w := New()
	defer w.Close()
	playerID := w.AddPlayer()
	playerMass := w.players.Get(w.entities[playerID]).body.GetMass()
	squares := 0
	for _, entity := range w.resourceEntities {
		r := w.resources.Get(entity)
		if r.body.GetMass() < playerMass*2.99 {
			t.Fatal("resource is not heavier than a player")
		}
		if r.square {
			squares++
		}
		v := r.body.GetLinearVelocity()
		if math.Hypot(float64(v.X), float64(v.Y)) < 0.19 || math.Abs(float64(r.body.GetAngularVelocity())) < 0.07 {
			t.Fatal("resource lacks initial motion")
		}
	}
	if squares != 10 {
		t.Fatalf("got %d squares", squares)
	}
	var first uint32
	for id := range w.resourceEntities {
		first = id
		break
	}
	w.resources.Get(w.resourceEntities[first]).body.SetLinearVelocity(box2d.Vec2{})
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
	r := w.resources.Get(w.resourceEntities[rid])
	r.body.SetTransform(box2d.Vec2{X: 0, Y: 0}, 0)
	r.body.SetLinearVelocity(box2d.Vec2{})
	id := w.AddPlayer()
	w.players.Get(w.entities[id]).body.SetTransform(box2d.Vec2{X: -4, Y: 0}, 0)
	w.SetInput(id, Input{ID: 1, X: 127})
	for range 25 {
		w.Step()
	}
	if r.body.GetPosition().X < 0.5 {
		t.Fatal("player did not push resource")
	}
}
