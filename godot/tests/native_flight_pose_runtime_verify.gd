extends SceneTree

# Product input and physics stay enabled. All keys and mouse motion enter the
# Viewport input path; no player movement method is stepped by this test.
const SLOT := "user://star_abyss_flight_pose_runtime_verify.json"
const REPORT := "res://reports/flight-pose-r1/runtime.json"
const IMAGES := "res://reports/flight-pose-r1/"
const SOURCES := [
	"res://scripts/native_player.gd", "res://scripts/native_motion_r2.gd",
	"res://scripts/native_main.gd", "res://scripts/native_world.gd",
	"res://scripts/native_planet_ecology.gd", "res://scripts/native_ascension.gd",
	"res://scripts/native_martial_skills.gd", "res://scripts/native_martial_library.gd",
	"res://scripts/native_surface_deformation.gd", "res://scripts/native_surface_blink.gd",
	"res://scripts/native_environment_damage.gd", "res://scripts/native_environment_damage_assets.gd",
	"res://assets/planet-ecology-r4/manifest.json", "res://assets/planet-ecology-r4/ecology_r4.gdshader",
	"res://scenes/main.tscn", "res://assets/motion-r2/c2-motion-r2.glb",
	"res://assets/martial-r4/c2-martial-r4.glb"
]

class Observer extends Node:
	var frames := 0
	var elapsed := 0.0
	var min_delta := INF
	var max_delta := 0.0
	func _physics_process(delta: float) -> void:
		frames += 1
		elapsed += delta
		min_delta = minf(min_delta, delta)
		max_delta = maxf(max_delta, delta)

var observer: Observer
var checks: Array[Dictionary] = []
var snapshots: Dictionary = {}
var failures: Array[String] = []
var source_start: Dictionary = {}
var wall_start := 0


func _initialize() -> void:
	call_deferred("_run")


func _hashes() -> Dictionary:
	var result := {}
	for path: String in SOURCES:
		result[path] = FileAccess.get_sha256(path) if FileAccess.file_exists(path) else "MISSING"
	return result


func _check(name: String, passed: bool, detail: String = "") -> void:
	checks.append({"name": name, "pass": passed, "detail": detail})
	if not passed:
		failures.append(name + ": " + detail)


func _key(code: Key, pressed: bool) -> void:
	var event := InputEventKey.new()
	event.physical_keycode = code
	event.keycode = code
	event.pressed = pressed
	root.push_input(event, false)


func _mouse(relative: Vector2) -> void:
	var event := InputEventMouseMotion.new()
	event.relative = relative
	root.push_input(event, false)


func _frames(count: int) -> void:
	var until := observer.frames + count
	while observer.frames < until:
		await physics_frame
	await process_frame


func _agl(game: NativeMain) -> float:
	var sample: Dictionary = game.world.surface_at(game.player.global_position)
	return float(sample.get("agl", -INF))


func _snapshot(label: String, game: NativeMain, screenshot: bool = true) -> void:
	var player := game.player as NativePlayer
	var motion := player._r2 as NativeMotionR2
	var up := player.global_basis.y.normalized()
	var state := {
		"frame": observer.frames, "sim_s": observer.elapsed,
		"wall_s": float(Time.get_ticks_msec() - wall_start) / 1000.0,
		"agl": _agl(game), "energy": player.energy,
		"tangent_speed": player.velocity.slide(up).length(),
		"radial_speed": player.velocity.dot(up),
		"flight_active": player.flight_active, "boosting": player.boosting,
		"w_event_held": player._held_keys.get(KEY_W, false),
		"shift_event_held": player._held_keys.get(KEY_SHIFT, false),
		"mode": motion.flight_mode, "weight": motion.flight_pose_weight,
		"clip": motion.current, "cast": player._cast_active,
		"pitch": player._look_pitch, "input": str(player._flight_input_intent),
		"mouse_mode": Input.get_mouse_mode()
	}
	if screenshot:
		var side := Camera3D.new()
		side.near = 0.05
		side.far = 100.0
		player.add_child(side)
		# Parenting keeps the camera beside the capsule while it moves tens of
		# metres between the request and the next rendered frame.
		side.position = Vector3(5.0, 1.5, 0.0)
		side.look_at(player.global_position + up * 1.0, up)
		side.make_current()
		await process_frame
		await RenderingServer.frame_post_draw
		var image := root.get_texture().get_image()
		var path := ProjectSettings.globalize_path(IMAGES + label + ".png")
		DirAccess.make_dir_recursive_absolute(path.get_base_dir())
		state["image"] = path
		state["image_ok"] = not image.is_empty() and image.save_png(path) == OK
		(player.get_node("CameraPivot/Camera3D") as Camera3D).make_current()
		side.queue_free()
	snapshots[label] = state
	print("FLIGHT_POSE_SNAPSHOT=" + JSON.stringify({"label": label, "state": state}))


func _spawn() -> NativeMain:
	var game := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = SLOT
	root.add_child(game)
	await _frames(2)
	return game


func _remove_game(game: NativeMain) -> void:
	for code in [KEY_G, KEY_C, KEY_W, KEY_A, KEY_S, KEY_D, KEY_SHIFT, KEY_R]:
		_key(code, false)
	game.initialized = false
	game.queue_free()
	await _frames(2)
	if FileAccess.file_exists(SLOT):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SLOT))


func _run() -> void:
	wall_start = Time.get_ticks_msec()
	source_start = _hashes()
	observer = Observer.new()
	root.add_child(observer)
	var game := await _spawn()
	var player := game.player as NativePlayer
	_check("normal product scene and player physics", game.is_physics_processing() and player.is_physics_processing())
	_key(KEY_G, true)
	for i in range(1800):
		await _frames(1)
		if _agl(game) >= 900.0:
			break
	_check("G reaches safe low flight altitude", player.flight_active and _agl(game) >= 900.0, str(_agl(game)))
	await _snapshot("ascent-low", game)
	_key(KEY_G, false)
	await _frames(150)
	await _snapshot("hover-low", game)
	_check("stationary hover may stand", player._r2.flight_mode == "hover" and player._r2.flight_pose_weight < 0.1, str(snapshots["hover-low"]))
	_key(KEY_W, true)
	await _frames(240)
	await _snapshot("cruise-low", game)
	_check("ordinary W cruise keeps forward travel pose", player._r2.flight_mode == "cruise" and player._r2.flight_pose_weight > 0.48 and player.horizontal_speed > 40.0, str(snapshots["cruise-low"]))
	_key(KEY_R, true)
	await _frames(2)
	_key(KEY_R, false)
	await _snapshot("cast-low", game)
	_check("R cast interrupts flight pose", player._cast_active and player._r2.current.begins_with("air_cast"), str(snapshots["cast-low"]))
	await _frames(120)
	await _snapshot("cast-return-low", game)
	_check("cast end restores moving flight pose", not player._cast_active and player._r2.flight_mode == "cruise" and player._r2.flight_pose_weight > 0.48, str(snapshots["cast-return-low"]))
	_key(KEY_W, false)
	_key(KEY_G, true)
	for i in range(1200):
		await _frames(1)
		if _agl(game) >= 1900.0:
			break
	_key(KEY_G, false)
	await _frames(120)
	_check("long boost route starts above terrain relief", _agl(game) >= 1900.0, str(_agl(game)))
	_key(KEY_W, true)
	await _frames(60)
	_key(KEY_SHIFT, true)
	await _frames(180)
	await _snapshot("boost-low", game)
	_check("Shift accelerates into authored boost", player.boosting and player._r2.flight_mode == "accelerate" and player._r2.flight_pose_weight > 0.95, str(snapshots["boost-low"]))
	var boost_start := observer.frames
	var before_threshold := false
	var after_threshold := false
	var was_boosting := player.boosting
	while observer.frames - boost_start < 4200:
		await _frames(1)
		if not before_threshold and player.energy <= 11.0:
			await _snapshot("energy-before-threshold", game)
			before_threshold = true
		# Detect the actual acceleration transition, not an arbitrary low energy
		# value: ordinary cruise drains only 0.03/s after boost is unavailable.
		if not after_threshold and was_boosting and not player.boosting and player.energy <= NativePlayer.BOOST_MIN_ENERGY + 0.05:
			await _snapshot("energy-boost-cutoff", game)
			await _frames(45)
			await _snapshot("energy-after-threshold", game)
			after_threshold = true
		was_boosting = player.boosting
	await _snapshot("boost-held-70s", game)
	_key(KEY_SHIFT, false)
	_key(KEY_W, false)
	_check("energy naturally cancels boost while input remains held", before_threshold and after_threshold and snapshots["energy-before-threshold"]["energy"] > NativePlayer.BOOST_MIN_ENERGY and snapshots["energy-boost-cutoff"]["energy"] <= NativePlayer.BOOST_MIN_ENERGY + 0.05 and snapshots["energy-after-threshold"]["w_event_held"] and snapshots["energy-after-threshold"]["shift_event_held"], str(snapshots.get("energy-boost-cutoff", {})))
	_check("movement stays pitched after boost energy limit", after_threshold and snapshots["energy-after-threshold"]["flight_active"] and snapshots["energy-after-threshold"]["tangent_speed"] > 80.0 and snapshots["energy-after-threshold"]["weight"] > 0.48, str(snapshots.get("energy-after-threshold", {})))
	_check("70 second hold used normal physics time", float(snapshots["boost-held-70s"]["sim_s"]) - float(snapshots["boost-low"]["sim_s"]) >= 69.9 and Engine.time_scale == 1.0, str(observer.elapsed))
	await _remove_game(game)

	game = await _spawn()
	player = game.player as NativePlayer
	_key(KEY_G, true)
	for i in range(5000):
		await _frames(1)
		if _agl(game) >= 10000.0:
			break
	await _snapshot("ascent-high", game)
	_check("G reaches high altitude with radial ascent pose", player.flight_active and _agl(game) >= 10000.0 and player._r2.flight_mode == "ascend" and player._r2.flight_pose_weight > 0.3, str(snapshots["ascent-high"]))
	_key(KEY_G, false)
	await _frames(450)
	_key(KEY_W, true)
	await _frames(240)
	await _snapshot("cruise-high", game)
	_check("high altitude W remains in cruise", player._r2.flight_mode == "cruise" and player._r2.flight_pose_weight > 0.48, str(snapshots["cruise-high"]))
	_mouse(Vector2(0.0, 260.0))
	await _frames(125)
	await _snapshot("mouse-dive-high", game)
	_check("viewport pitch produces radial dive pose", player._look_pitch < -0.5 and player._r2.flight_mode == "dive" and player._r2.flight_pose_weight > 0.55, str(snapshots["mouse-dive-high"]))
	_key(KEY_W, false)
	_mouse(Vector2(0.0, -260.0))
	await _frames(300)
	await _snapshot("dive-release-high", game)
	_check("release and level return toward hover", player.flight_active and player._r2.flight_pose_weight < 0.15, str(snapshots["dive-release-high"]))
	await _remove_game(game)

	var source_end := _hashes()
	_check("sources frozen during product run", source_start == source_end and not source_start.values().has("MISSING"))
	_check("normal physics delta", observer.min_delta > 0.0 and observer.max_delta < 0.05, str(observer.min_delta) + ".." + str(observer.max_delta))
	var report := {
		"checks": checks, "failures": failures, "snapshots": snapshots,
		"frames": observer.frames, "sim_s": observer.elapsed,
		"wall_s": float(Time.get_ticks_msec() - wall_start) / 1000.0,
		"min_delta": observer.min_delta, "max_delta": observer.max_delta,
		"source_sha256_start": source_start, "source_sha256_end": source_end
	}
	var path := ProjectSettings.globalize_path(REPORT)
	DirAccess.make_dir_recursive_absolute(path.get_base_dir())
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t") + "\n")
		file.flush()
	print("FLIGHT_POSE_RUNTIME_RESULT=" + JSON.stringify({"passed": checks.size() - failures.size(), "total": checks.size(), "failures": failures, "report": path}))
	observer.queue_free()
	quit(0 if failures.is_empty() and file != null else 1)
