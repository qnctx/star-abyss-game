extends SceneTree
## State-machine contract tests only. Fakes do not certify terrain, capsule
## collision, skin animation, GPU performance, or the playable integrated loop.
const BLINK = preload("res://scripts/native_surface_blink.gd")

class Motion:
	extends Node
	var names := {"air_cast_martial_blink": true, "cast_martial_blink": true,
		"cast_martial_arrival": true, "air_cast_martial_arrival": true}

class TestPlayer:
	extends Node3D
	var realm := 8
	var health := 100.0
	var energy := 100.0
	var flight_active := true
	var guarding := false
	var _hurt_time := 0.0
	var _cast_active := false
	var _cast_elapsed := 0.0
	var combat_serial := 0
	var combat_action_id := ""
	var _r2: Node
	var duration := 0.0
	var accepts_destination := true
	var commits := 0
	var actions: Array[String] = []

	func play_combat_action(profile: Dictionary) -> bool:
		if _cast_active or guarding or _hurt_time > 0.0:
			return false
		_cast_active = true
		_cast_elapsed = 0.0
		duration = float(profile.duration)
		combat_action_id = String(profile.action)
		combat_serial += 1
		actions.append(combat_action_id)
		return true

	func cancel_combat_action() -> void:
		combat_serial += 1
		_cast_active = false
		combat_action_id = ""

	func blink_to_prepared_surface(target: Vector3, ticket: Dictionary) -> bool:
		if not accepts_destination or ticket.get("id", -1) != 1:
			return false
		global_position = target
		flight_active = false
		commits += 1
		cancel_combat_action()
		return true

	func advance_motion(dt: float) -> void:
		if _cast_active:
			_cast_elapsed += dt
			if _cast_elapsed >= duration:
				_cast_active = false
				combat_action_id = ""

class TestWorld:
	extends Node3D
	var planet_enabled := true
	var origin_revision := 0
	var landing_ready := true
	var clear := true
	var target := Vector3(0, 0.8, 0)
	var water_depth := 0.0
	var target_agl := 0.8
	var released := 0
	var prepares := 0
	var stream_updates := 0
	var ticket: Variant = {"id": 1, "cast_id": ""}
	var prepared_cast_ids: Array[String] = []
	var cancelled_tokens: Array[Dictionary] = []

	func up_at(_at: Vector3) -> Vector3:
		return Vector3.UP

	func prepare_surface_landing(_origin: Vector3, _distance: float, cast_id := "") -> Dictionary:
		prepares += 1
		prepared_cast_ids.append(cast_id)
		if cast_id.is_empty():
			return {"ready": true, "clear": false, "reason": "missing_cast_id"}
		if not landing_ready:
			return {"ready": false, "clear": false, "reason": "streaming"}
		if ticket is Dictionary:
			ticket["cast_id"] = cast_id
		return {"ready": landing_ready, "clear": clear, "target": target,
			"normal": Vector3.UP, "reason": "", "ticket": ticket}

	func surface_at(_point: Vector3) -> Dictionary:
		return {"ready": landing_ready, "water_depth": water_depth, "agl": target_agl}

	func cancel_surface_landing(token: Dictionary = {}) -> void:
		released += 1
		cancelled_tokens.append(token.duplicate(true))

	func update_stream(_at: Vector3) -> void:
		stream_updates += 1

var subject: Node
var player: TestPlayer
var world: TestWorld
var events: Array[Dictionary] = []
var failed: Array[String] = []
var checks := 0


func _initialize() -> void:
	call_deferred("_run")


func _reset() -> void:
	if is_instance_valid(subject):
		subject.free()
		player.free()
		world.free()
	world = TestWorld.new()
	player = TestPlayer.new()
	root.add_child(world)
	root.add_child(player)
	player.global_position = Vector3(0, 50000, 0)
	player._r2 = Motion.new()
	player.add_child(player._r2)
	var pivot := Node3D.new()
	pivot.name = "CameraPivot"
	player.add_child(pivot)
	var camera := Camera3D.new()
	camera.name = "Camera3D"
	pivot.add_child(camera)
	pivot.rotation.x = -1.20
	subject = BLINK.new()
	root.add_child(subject)
	subject.setup(null, world, player)
	events.clear()
	subject.resolved.connect(func(result: Dictionary): events.append(result))


func _advance(seconds: float) -> void:
	var remaining := seconds
	while remaining > 0.000001:
		var dt := minf(0.01, remaining)
		player.advance_motion(dt)
		subject.advance(dt)
		remaining -= dt


func _check(condition: bool, label: String) -> void:
	checks += 1
	print("PASS: " if condition else "FAIL: ", label)
	if not condition:
		failed.append(label)


func _free_cancelled(label: String) -> void:
	_check(not subject.is_pending() and player.commits == 0 and player.energy == 100.0 and subject.cooldown_remaining == 0.0, label)
	_check(world.released == 1, label + " releases owned route once")


func _run() -> void:
	_reset()
	player.realm = 7
	_check(not subject.try_start().get("pending", false) and world.prepares == 0, "R7 cannot prepare R8 skill")
	_reset()
	player.energy = 24.0
	_check(not subject.try_start().get("pending", false) and world.prepares == 0, "insufficient energy rejects before streaming")
	_reset()
	player.get_node("CameraPivot").rotation.x = 0.0
	_check(not subject.try_start().get("pending", false) and world.prepares == 0, "look away from planet cannot prepare radial return")
	_reset()
	world.landing_ready = false
	_check(subject.try_start().get("pending", false), "unready collider stays pending")
	_advance(0.50)
	_check(player.actions.is_empty() and player.commits == 0 and player.energy == 100.0, "waiting does not animate release, teleport, or spend")
	_check(world.prepares <= 7, "stream preparation is throttled during wait")
	player.global_position.x += 1.0
	_advance(0.02)
	_free_cancelled("movement cancels unready route without spending")
	_check(not String(world.cancelled_tokens[0].get("cast_id", "")).is_empty() and not world.cancelled_tokens[0].has("id"), "unready cancellation carries only its owning cast id")
	_reset()
	subject.try_start()
	_advance(0.79)
	_check(player.commits == 0 and player.energy == 100.0, "authored source action must complete before commit")
	_advance(0.02)
	_check(player.commits == 1 and player.energy == 75.0, "R8 commits once and spends 25 percent after acceptance")
	_check(player.actions == ["cast_martial_blink", "cast_martial_arrival"], "source and arrival use independent authored clips")
	_check(events.size() == 1 and events[0].get("ok", false), "successful attempt resolves once")
	_check(world.prepares == 2 and world.released == 1 and world.stream_updates == 1, "commit rechecks and hands off prepared route")
	_check(world.prepared_cast_ids.size() == 2 and not world.prepared_cast_ids[0].is_empty() and world.prepared_cast_ids[0] == world.prepared_cast_ids[1], "one nonempty cast id owns preparation and commit")
	_check(world.cancelled_tokens[0].get("id", -1) == 1, "ready route cancellation passes its issued Dictionary ticket")
	_advance(1.0)
	_check(player.commits == 1 and player.energy == 75.0, "later frames cannot repeat committed teleport or cost")
	var saved: Dictionary = subject.snapshot()
	_check(not saved.has("current") and not saved.has("origin"), "save contains no pending scene destination")
	subject.restore(saved)
	_check(is_equal_approx(subject.cooldown_remaining, float(saved.cooldown_remaining)), "save restores remaining cooldown without wall time")
	subject.advance(0.25)
	_check(is_equal_approx(subject.cooldown_remaining, float(saved.cooldown_remaining) - 0.25), "cooldown consumes supplied game dt exactly")
	subject.restore({"cooldown_remaining": "invalid", "serial": INF})
	_check(subject.cooldown_remaining == 0.0 and subject.serial == 0, "malformed save numbers fail safely")
	_reset()
	player.realm = 9
	player.global_position.y = 179000.0
	subject.try_start()
	_advance(0.81)
	_check(player.commits == 1 and player.energy == 65.0 and subject.cooldown_remaining > 24.9, "R9 range and 35 percent / 25 second rule")
	_reset()
	player.global_position.y = 75001.0
	_check(not subject.try_start().get("pending", false) and player.commits == 0 and player.energy == 100.0, "R8 cannot exceed its finite 75 km range")
	_reset()
	world.water_depth = 1.0
	_check(not subject.try_start().get("pending", false) and player.energy == 100.0, "water target cannot start source action")
	_reset()
	world.target = Vector3(1, 0, 0)
	_check(not subject.try_start().get("pending", false), "off-radial result is rejected")
	_reset()
	world.clear = false
	_check(not subject.try_start().get("pending", false) and player.actions.is_empty(), "empty blocker reason still fails closed")
	_reset()
	world.ticket = null
	_check(not subject.try_start().get("pending", false) and player.actions.is_empty(), "missing world ticket cannot start source action")
	_reset()
	world.target_agl = 0.1
	_check(not subject.try_start().get("pending", false), "unsafe low endpoint cannot replace the prepared hover target")
	_reset()
	subject.try_start()
	subject.advance(1.0)
	_check(subject.is_pending() and player.commits == 0, "frozen animation clock cannot be replaced by elapsed game time")
	_reset()
	subject.try_start()
	world.landing_ready = false
	_advance(0.81)
	_free_cancelled("lost collider readiness before commit cancels freely")
	_reset()
	subject.try_start()
	world.clear = false
	_advance(0.81)
	_free_cancelled("new obstruction before commit cancels freely")
	_reset()
	subject.try_start()
	player.accepts_destination = false
	_advance(0.81)
	_free_cancelled("Player capsule rejection cannot spend or start cooldown")
	_reset()
	subject.try_start()
	player.health -= 1.0
	_advance(0.01)
	_free_cancelled("damage cancels even when transient hurt timer is already clear")
	_reset()
	subject.try_start()
	player.get_node("CameraPivot").rotation.x = -0.70
	_advance(0.01)
	_free_cancelled("aim changes cancel source action")
	_reset()
	subject.try_start()
	world.origin_revision += 1
	_advance(0.01)
	_free_cancelled("origin rebase cannot reuse old prepared coordinates")
	_reset()
	subject.try_start()
	player.cancel_combat_action()
	_advance(0.01)
	_free_cancelled("external interruption cancels source action")
	_reset()
	subject.try_start()
	player.energy = 24.0
	_advance(0.01)
	_check(not subject.is_pending() and player.commits == 0 and player.energy == 24.0 and subject.cooldown_remaining == 0.0, "energy lost during preparation cannot be overspent at commit")
	_reset()
	subject.try_start()
	world.target.y += 0.2
	_advance(0.81)
	_free_cancelled("changed prepared surface cannot silently choose a new endpoint")
	_reset()
	subject.try_start()
	subject._focus_lost()
	_free_cancelled("window focus loss cancels freely")
	_reset()
	subject.try_start()
	subject.cancel()
	subject.cancel()
	_check(events.size() == 1 and world.released == 1, "repeated cancel is idempotent")
	var first_cast_id := world.prepared_cast_ids[0]
	subject.try_start()
	_check(world.prepared_cast_ids[-1] != first_cast_id, "next attempt receives a fresh cast id")
	subject.cancel()
	_reset()
	world.landing_ready = false
	subject.try_start()
	_advance(12.1)
	_free_cancelled("loading timeout releases route without cost")
	_reset()
	subject.try_start()
	subject.restore({"cooldown_remaining": 15.0})
	_check(not subject.is_pending() and player.commits == 0 and subject.cooldown_remaining == 15.0, "restore discards in-flight attempt and retains only cooldown")
	print("SURFACE_BLINK_CONTRACT ", JSON.stringify({"checks": checks, "failed": failed,
		"scope": "Contract fakes only; real physics and visual acceptance still required."}))
	subject.free()
	player.free()
	world.free()
	quit(0 if failed.is_empty() else 1)
