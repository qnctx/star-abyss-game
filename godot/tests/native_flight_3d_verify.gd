extends SceneTree

# Runs the actual movement path from a physics callback with its engine delta.
# A separate visible-window pass is still required for real mouse/key feel.
const SLOT := "user://star_abyss_native_flight_3d_verify.json"

class FlightClock extends Node:
	var player: NativePlayer
	var mode := "idle"
	var axes := Vector2.ZERO
	var lift := false
	var descend := false
	var shift := false
	var frames := 0
	var elapsed := 0.0
	var min_delta := INF
	var max_delta := 0.0

	func _physics_process(delta: float) -> void:
		frames += 1
		elapsed += delta
		min_delta = minf(min_delta, delta)
		max_delta = maxf(max_delta, delta)
		if player == null:
			return
		if mode == "flight":
			player._step_flight(delta, axes, lift, descend, shift, false)
		elif mode == "ground":
			player._step_ground(delta, axes, shift, false)


var checks: Array[Dictionary] = []
var failures: Array[String] = []
var clock: FlightClock


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
	clock = FlightClock.new()
	clock.player = player
	root.add_child(clock)
	var floor_y := game.world.height_at(0.0, 190.0)
	player.teleport_to_ground(0.0, 190.0)
	player.rotation.y = 0.0
	var pivot := player.get_node("CameraPivot") as Node3D
	pivot.rotation.x = 0.75
	var up := player._flight_input_direction(Vector2(0.0, 1.0), false, false)
	pivot.rotation.x = -0.75
	var down := player._flight_input_direction(Vector2(0.0, 1.0), false, false)
	var diagonal := player._flight_input_direction(Vector2(1.0, 1.0).normalized(), true, false)
	_check("mouse pitch steers W up and down", up.y > 0.6 and down.y < -0.6, "up=" + str(up) + " down=" + str(down))
	_check("three-axis diagonal is normalized", absf(diagonal.length() - 1.0) < 0.0001, str(diagonal))

	player.global_position = Vector3(0.0, floor_y + 400.0, 190.0)
	player.flight_active = true
	player.energy = 100.0
	player.velocity = Vector3.ZERO
	player._vertical_speed = 0.0
	pivot.rotation.x = 0.75
	clock.mode = "flight"
	clock.axes = Vector2(0.0, 1.0)
	await _frames(45)
	var climbed := player.global_position.y
	_check("pitched W climbs while moving ahead", climbed > floor_y + 415.0 and player.global_position.z < 185.0, str(player.global_position))

	player.global_position = Vector3(0.0, floor_y + 400.0, 190.0)
	player.velocity = Vector3.ZERO
	player._vertical_speed = 0.0
	player.energy = 100.0
	clock.axes = Vector2.ZERO
	clock.descend = true
	clock.shift = false
	await _frames(45)
	var ordinary_descent := floor_y + 400.0 - player.global_position.y
	player.global_position = Vector3(0.0, floor_y + 400.0, 190.0)
	player.velocity = Vector3.ZERO
	player._vertical_speed = 0.0
	player.energy = 100.0
	clock.shift = true
	await _frames(45)
	var boosted_descent := floor_y + 400.0 - player.global_position.y
	_check("Shift+C descends faster and spends energy", boosted_descent > ordinary_descent + 10.0 and player.energy < 99.0, "normal=" + str(ordinary_descent) + " boost=" + str(boosted_descent) + " energy=" + str(player.energy))

	player.global_position = Vector3(0.0, floor_y + 12.0, 190.0)
	player.velocity = Vector3.ZERO
	player._vertical_speed = 0.0
	player.energy = 100.0
	pivot.rotation.x = -1.1
	clock.axes = Vector2(0.0, 1.0)
	clock.descend = false
	clock.shift = true
	var lowest_clearance := INF
	for i in range(90):
		await _frames(1)
		lowest_clearance = minf(lowest_clearance, player.global_position.y - player._foot_support_here())
	_check("looking down does not land or hit ground", player.flight_active and lowest_clearance >= NativePlayer.FLIGHT_CLEARANCE - 0.05, "clearance=" + str(lowest_clearance) + " position=" + str(player.global_position))

	clock.mode = "idle"
	player.teleport_to_ground(0.0, 190.0)
	player.energy = 21.0
	_check("G launch is energy gated", not player._try_takeoff(true, false))
	clock.mode = "ground"
	clock.axes = Vector2.ZERO
	clock.shift = false
	await _frames(70)
	_check("ground physics restores launch energy", player.energy >= 25.0 and player._try_takeoff(true, false) and player.flight_active, str(player.energy))
	clock.mode = "flight"
	clock.axes = Vector2.ZERO
	clock.descend = true
	await _frames(35)
	_check("C lands and clears boost", not player.flight_active and not player.boosting and player.global_position.y <= floor_y + 0.05, str(player.global_position))

	# Reproduces a live C-descent stop above the rift ridge terrain. The world
	# stream must be present so both authored collision and height queries run.
	clock.mode = "idle"
	player.global_position = Vector3(1368.319, 11.81357, -1013.209)
	player.flight_active = true
	player.energy = 100.0
	player.velocity = Vector3.ZERO
	player._vertical_speed = 0.0
	game.world.update_stream(player.global_position)
	await _frames(2)
	clock.mode = "flight"
	clock.axes = Vector2.ZERO
	clock.descend = true
	clock.shift = false
	await _frames(160)
	var ridge_floor := player._foot_support_here()
	_check("C lands on streamed ridge terrain", not player.flight_active and absf(player.global_position.y - ridge_floor) < 0.08, "foot=" + str(player.global_position.y) + " terrain=" + str(game.world.height_at(player.global_position.x, player.global_position.z)) + " support=" + str(ridge_floor) + " vertical=" + str(player._vertical_speed) + " on_floor=" + str(player.is_on_floor()))
	_check("engine supplied real physics delta", clock.min_delta > 0.0 and clock.max_delta < 0.05 and clock.elapsed > 2.0, "range=" + str(clock.min_delta) + ".." + str(clock.max_delta) + " elapsed=" + str(clock.elapsed))

	var timing := {"physics_frames": clock.frames, "elapsed_delta": clock.elapsed, "min_delta": clock.min_delta, "max_delta": clock.max_delta}
	clock.queue_free()
	game.initialized = false
	game.queue_free()
	await process_frame
	if FileAccess.file_exists(SLOT):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SLOT))
	print("NATIVE_FLIGHT_3D_JSON=" + JSON.stringify({"total": checks.size(), "passed": checks.size() - failures.size(), "failures": failures, "checks": checks, "timing": timing}))
	quit(0 if failures.is_empty() else 1)
