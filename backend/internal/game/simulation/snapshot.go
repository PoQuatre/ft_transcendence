package simulation

func (w *World) States() []State {
	return w.AppendStates(make([]State, 0, len(w.byNetworkID)))
}

// AppendStates appends a snapshot to dst; the caller owns the returned slice.
func (w *World) AppendStates(dst []State) []State {
	physicsMu.Lock()
	defer physicsMu.Unlock()
	players := w.playerFilter.Query()
	for players.Next() {
		id, body, hp, input := players.Get()
		pos, vel := body.body.GetPosition(), body.body.GetLinearVelocity()
		dst = append(dst, State{ID: id.value, X: pos.X, Y: pos.Y, VX: vel.X, VY: vel.Y, Aim: input.processedAim, LastInput: input.processedID, Kind: TankKind, Health: hp.current})
	}
	resources := w.resourceFilter.Query()
	for resources.Next() {
		id, body, hp, r := resources.Get()
		if hp.current == 0 {
			continue
		}
		pos, vel := body.body.GetPosition(), body.body.GetLinearVelocity()
		dst = append(dst, State{ID: id.value, X: pos.X, Y: pos.Y, VX: vel.X, VY: vel.Y, Kind: ResourceKind, Health: hp.current, Rotation: body.body.GetRotation().Angle(), Square: r.square})
	}
	projectiles := w.projectileFilter.Query()
	for projectiles.Next() {
		id, motion, p := projectiles.Get()
		dst = append(dst, State{ID: id.value, X: motion.x, Y: motion.y, VX: motion.vx, VY: motion.vy, Aim: p.aim, Kind: ProjectileKind})
	}
	return dst
}
