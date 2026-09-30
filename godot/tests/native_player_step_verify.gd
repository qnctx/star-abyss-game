extends SceneTree

# The physical capsule performs the visible jab step; a wall may stop it.
const SLOT := "user://star_abyss_native_player_step_verify.json"

class AttackClock extends Node:
	var player: NativePlayer
	var active := false
	var frames := 0
	var elapsed := 0.0
	var min_delta := INF
	var max_delta := 0.0

	func _physics_process(delta: float) -> void:
		frames += 1
		elapsed += delta
		min_delta = minf(min_delta, delta)
		max_delta = maxf(max_delta, delta)
		if active and player != null:
			player._step_ground(delta, Vector2.ZERO, false, false)
			player._update_visual(delta)


var clock: AttackClock
var checks: Array[Dictionary] = []
var failures: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _check(name: String, passed: bool, detail: String = "") -> void:
	checks.append({"name": name, "pass": passed, "detail": detail})
	if not passed:
		failures.append(name + ": " + detail)


func _frames(count: int) -> void:
	var until := clock.frames + count
	while clock.frames < until:
		await physics_frame
	await process_frame


func _run() -> void:
	var game := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = SLOT
	root.add_child(game)
	await physics_frame
	await physics_frame
	game.set_physics_process(false)
	game.beast.set_physics_process(false)
	var player := game.player
	player.set_physics_process(false)
	clock = AttackClock.new()
	clock.player = player
	root.add_child(clock)

	player.teleport_to_ground(100.0, 100.0)
	player.rotation.y = 0.0
	var start := player.global_position
	var contact := player.play_attack(0)
	clock.active = true
	await _frames(12)
	clock.active = false
	var open_step := start.z - player.global_position.z
	_check("jab steps even on a miss without target suction", contact > 0.0 and open_step >= 0.16 and open_step <= 0.23, "step=" + str(open_step))

	var wall := StaticBody3D.new()
	wall.collision_layer = 1
	wall.collision_mask = 0
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(8.0, 3.0, 0.1)
	shape.shape = box
	wall.add_child(shape)
	game.add_child(wall)
	wall.global_position = Vector3(0.0, 1.2, 189.45)
	await _frames(2)
	player.teleport_to_ground(0.0, 190.0)
	player.rotation.y = 0.0
	player.play_attack(0)
	clock.active = true
	await _frames(12)
	clock.active = false
	var wall_step := 190.0 - player.global_position.z
	var query := PhysicsShapeQueryParameters3D.new()
	query.shape = (player.get_node("CollisionShape3D") as CollisionShape3D).shape
	query.transform = (player.get_node("CollisionShape3D") as CollisionShape3D).global_transform
	query.collision_mask = 1
	query.exclude = [player.get_rid()]
	var wall_overlap := false
	for hit in player.get_world_3d().direct_space_state.intersect_shape(query, 10):
		wall_overlap = wall_overlap or hit["collider"] == wall
	_check("jab step is stopped by a real wall", wall_step >= 0.0 and wall_step < 0.12 and not wall_overlap, "step=" + str(wall_step) + " overlap=" + str(wall_overlap))
	_check("uses engine physics callback delta", clock.min_delta > 0.0 and clock.max_delta < 0.05, "delta=" + str(clock.min_delta) + ".." + str(clock.max_delta) + " frames=" + str(clock.frames))

	var timing := {"frames": clock.frames, "elapsed_delta": clock.elapsed, "min_delta": clock.min_delta, "max_delta": clock.max_delta}
	clock.queue_free()
	game.initialized = false
	game.queue_free()
	await process_frame
	if FileAccess.file_exists(SLOT):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SLOT))
	print("NATIVE_PLAYER_STEP_JSON=" + JSON.stringify({"total": checks.size(), "passed": checks.size() - failures.size(), "failures": failures, "checks": checks, "timing": timing}))
	quit(0 if failures.is_empty() else 1)
