extends SceneTree

# Full low-altitude / orbit / return route driven with real physics callback
# delta against the authored, streamed, collidable planet.
const SLOT := "user://star_abyss_native_planet_orbit_verify.json"

class OrbitClock extends Node:
	var player: NativePlayer
	var world: Node3D
	var mode := "idle"
	var frames := 0
	var elapsed := 0.0
	var min_delta := INF
	var max_delta := 0.0
	var max_agl := 0.0
	var min_agl := INF
	var unready_frames := 0
	var agl := 0.0
	var radial_speed := 0.0

	func _physics_process(delta: float) -> void:
		frames += 1
		elapsed += delta
		min_delta = minf(min_delta, delta)
		max_delta = maxf(max_delta, delta)
		if mode == "idle" or player == null:
			return
		world.call("update_stream", player.global_position)
		player._sync_canonical_before_motion()
		if player.flight_active:
			player._step_flight_planet(delta, Vector2.ZERO, mode == "ascend", mode == "descend", false, false)
		else:
			player._step_ground_planet(delta, Vector2.ZERO, false, false, false)
		player._sync_canonical_after_motion()
		var sample: Dictionary = world.call("surface_at", player.global_position)
		if sample.get("ready", false) != true:
			unready_frames += 1
			return
		agl = float(sample["agl"])
		max_agl = maxf(max_agl, agl)
		min_agl = minf(min_agl, agl)
		radial_speed = player.velocity.dot(world.call("up_at", player.global_position))


var checks: Array[Dictionary] = []
var failures: Array[String] = []
var clock: OrbitClock


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
	var player := game.player as NativePlayer
	var world := game.world as Node3D
	player.set_physics_process(false)
	clock = OrbitClock.new()
	clock.player = player
	clock.world = world
	root.add_child(clock)
	_check("planet world API available", world.get("planet_enabled") == true and world.has_method("surface_at"))
	if checks[0].pass != true:
		await _finish(game)
		return
	var home: Dictionary = {}
	for i in range(24):
		world.call("update_stream", Vector3(0.0, 0.0, 190.0))
		await _frames(1)
		home = world.call("surface_at", Vector3(0.0, 0.0, 190.0))
		if home.get("ready", false) == true:
			break
	_check("launch site has real collision", home.get("ready", false) == true)
	if home.get("ready", false) != true or not player.teleport_to_surface(home["point"]):
		_check("ground teleport succeeded", false)
		await _finish(game)
		return
	player.energy = 100.0
	_check("G launches", player._try_takeoff(true, false))
	clock.mode = "ascend"
	for i in range(6000):
		await _frames(1)
		if clock.agl >= 125000.0:
			break
		if i % 600 == 0:
			print("ORBIT_PROGRESS=" + JSON.stringify({"frame": i, "agl": clock.agl, "energy": player.energy, "unready": clock.unready_frames}))
	_check("normal G reaches globe view within 100 simulated seconds", clock.agl >= 125000.0 and clock.elapsed <= 100.0 and player.energy > 0.0, "agl=" + str(clock.agl) + " elapsed=" + str(clock.elapsed) + " energy=" + str(player.energy))
	player._update_visual(0.0166666667)
	var camera := player.get_node("CameraPivot/Camera3D") as Camera3D
	_check("orbital camera sees full globe", camera.far >= 360000.0, "far=" + str(camera.far))
	var orbital_save := player.snapshot_canonical()
	_check("orbit save stays canonical", NativePlanetCoordinates.valid(orbital_save.get("position", {})))
	clock.mode = "coast"
	await _frames(600)
	_check("releasing G brakes radial ascent", absf(clock.radial_speed) < 30.0, "radial=" + str(clock.radial_speed) + " agl=" + str(clock.agl))
	clock.mode = "descend"
	for i in range(9000):
		await _frames(1)
		if not player.flight_active:
			break
		if i % 900 == 0:
			print("RETURN_PROGRESS=" + JSON.stringify({"frame": i, "agl": clock.agl, "vertical": clock.radial_speed, "unready": clock.unready_frames}))
	_check("C brakes and lands on physical terrain", not player.flight_active and clock.agl <= 0.2 and clock.min_agl >= -0.1, "agl=" + str(clock.agl) + " min=" + str(clock.min_agl))
	_check("streaming keeps ground readiness", clock.unready_frames == 0, "unready=" + str(clock.unready_frames))
	_check("real physics delta at normal time scale", Engine.time_scale == 1.0 and clock.min_delta > 0.0 and clock.max_delta < 0.05, "delta=" + str(clock.min_delta) + ".." + str(clock.max_delta))
	await _finish(game)


func _finish(game: NativeMain) -> void:
	var timing := {"frames": clock.frames, "elapsed_delta": clock.elapsed, "min_delta": clock.min_delta, "max_delta": clock.max_delta}
	clock.queue_free()
	game.initialized = false
	game.queue_free()
	await process_frame
	if FileAccess.file_exists(SLOT):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SLOT))
	print("NATIVE_PLANET_ORBIT_JSON=" + JSON.stringify({"total": checks.size(), "passed": checks.size() - failures.size(), "failures": failures, "checks": checks, "timing": timing}))
	quit(0 if failures.is_empty() else 1)
