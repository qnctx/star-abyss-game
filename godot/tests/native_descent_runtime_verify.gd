extends SceneTree

# NativeMain and NativePlayer run their own physics. Viewport key events use the
# same _input path as play; the test never invokes a movement step directly.
const SLOT := "user://star_abyss_descent_runtime_verify.json"
const REPORT := "res://reports/descent-r1/runtime.json"
const DIR := "res://reports/descent-r1/"
const SOURCES := [
	"res://scripts/native_player.gd", "res://scripts/native_motion_r2.gd",
	"res://scripts/native_main.gd", "res://scripts/native_world.gd",
	"res://scripts/native_planet.gd", "res://scripts/native_planet_ecology.gd",
	"res://scripts/native_ascension.gd", "res://scripts/native_martial_skills.gd",
	"res://scripts/native_surface_deformation.gd", "res://scripts/native_surface_blink.gd",
	"res://scripts/native_environment_damage.gd", "res://scripts/native_environment_damage_assets.gd",
	"res://assets/planet-ecology-r4/manifest.json", "res://assets/planet-ecology-r4/ecology_r4.gdshader",
	"res://scenes/main.tscn", "res://assets/martial-r4/c2-martial-r4.glb"
]

class Observer extends Node:
	var frames := 0
	var elapsed := 0.0
	var min_delta := INF
	var max_delta := 0.0
	var warmup_frames := 0
	var cadence_frames := 0
	var cadence_started := false
	func _physics_process(delta: float) -> void:
		frames += 1
		elapsed += delta
		# Godot delivers several queued 60Hz callbacks while the 20Hz tick
		# change propagates. Count them, then measure every settled callback.
		if not cadence_started and absf(delta - 0.05) < 0.001:
			cadence_started = true
		if cadence_started:
			cadence_frames += 1
			min_delta = minf(min_delta, delta)
			max_delta = maxf(max_delta, delta)
		else:
			warmup_frames += 1

var observer: Observer
var checks: Array[Dictionary] = []
var failures: Array[String] = []
var states: Dictionary = {}
var landing_events: Array[Dictionary] = []
var failure_events: Array[Dictionary] = []
var original_ticks := 60
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


func _frames(count: int) -> void:
	var until := observer.frames + count
	while observer.frames < until:
		await physics_frame
	await process_frame


func _spawn() -> NativeMain:
	var game := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = SLOT
	root.add_child(game)
	await _frames(2)
	(game.player as NativePlayer).descent_strike_landed.connect(_landed)
	(game.player as NativePlayer).descent_strike_failed.connect(_failed)
	return game


func _remove(game: NativeMain) -> void:
	for code in [KEY_G, KEY_C, KEY_W, KEY_SHIFT]:
		_key(code, false)
	game.initialized = false
	game.queue_free()
	await _frames(2)
	if FileAccess.file_exists(SLOT):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SLOT))


func _landed(id: int, point: Vector3, normal: Vector3, speed: float) -> void:
	landing_events.append({"id": id, "point": str(point), "normal": str(normal), "speed": speed, "frame": observer.frames})


func _failed(id: int, reason: String) -> void:
	failure_events.append({"id": id, "reason": reason, "frame": observer.frames})


func _agl(game: NativeMain) -> float:
	var sample: Dictionary = game.world.surface_at(game.player.global_position)
	return float(sample.get("agl", -INF))


func _record(name: String, game: NativeMain, screenshot: bool = false) -> void:
	var player := game.player as NativePlayer
	var up := player.global_basis.y.normalized()
	var state := {"frame": observer.frames, "sim_s": observer.elapsed,
		"agl": _agl(game), "radial_speed": player.velocity.dot(up),
		"tangent_speed": player.velocity.slide(up).length(), "energy": player.energy,
		"flight_active": player.flight_active, "boosting": player.boosting,
		"strike_active": player.descent_strike_active,
		"pose_mode": player._r2.flight_mode, "pose_weight": player._r2.flight_pose_weight,
		"c_held": player._held_c, "shift_held": player._held_keys.get(KEY_SHIFT, false)}
	if screenshot:
		var camera := Camera3D.new()
		camera.near = 0.05
		camera.far = 100.0
		player.add_child(camera)
		camera.position = Vector3(5.0, 1.5, 0.0)
		camera.look_at(player.global_position + up, up)
		camera.make_current()
		await process_frame
		await RenderingServer.frame_post_draw
		var image := root.get_texture().get_image()
		var path := ProjectSettings.globalize_path(DIR + name + ".png")
		DirAccess.make_dir_recursive_absolute(path.get_base_dir())
		state["image"] = path
		state["image_ok"] = not image.is_empty() and image.save_png(path) == OK
		(player.get_node("CameraPivot/Camera3D") as Camera3D).make_current()
		camera.queue_free()
	states[name] = state
	print("DESCENT_STATE=" + JSON.stringify({"name": name, "state": state}))


func _ordinary_descent(boost: bool) -> void:
	var label := "shift-c" if boost else "c"
	var game := await _spawn()
	var player := game.player as NativePlayer
	_key(KEY_G, true)
	for i in range(700):
		await _frames(1)
		if _agl(game) >= 350.0:
			break
	_key(KEY_G, false)
	await _frames(40)
	await _record(label + "-start", game)
	if boost:
		_key(KEY_SHIFT, true)
	_key(KEY_C, true)
	var hit_100 := false
	var hit_25 := false
	var min_agl := INF
	for i in range(700):
		await _frames(1)
		var agl := _agl(game)
		min_agl = minf(min_agl, agl)
		if not hit_100 and agl <= 100.0:
			await _record(label + "-100m", game, true)
			hit_100 = true
		if not hit_25 and agl <= 25.0:
			await _record(label + "-25m", game)
			hit_25 = true
		if not player.flight_active:
			break
	_key(KEY_C, false)
	_key(KEY_SHIFT, false)
	await _record(label + "-landed", game)
	_check(label + " reaches and brakes at 100m", hit_100 and absf(float(states.get(label + "-100m", {}).get("radial_speed", INF))) <= (125.0 if boost else 73.0), str(states.get(label + "-100m", {})))
	_check(label + " slows through 25m", hit_25 and absf(float(states.get(label + "-25m", {}).get("radial_speed", INF))) < (65.0 if boost else 42.0), str(states.get(label + "-25m", {})))
	_check(label + " lands dry with no penetration", not player.flight_active and _agl(game) <= 0.2 and min_agl >= -0.1, "min=" + str(min_agl) + " final=" + str(_agl(game)))
	_check(label + " ordinary descent never triggers strike", landing_events.is_empty(), str(landing_events))
	await _remove(game)


func _strike_contract() -> void:
	var game := await _spawn()
	var player := game.player as NativePlayer
	player.realm = 6
	_key(KEY_G, true)
	for i in range(120):
		await _frames(1)
		if _agl(game) >= 20.0:
			break
	_key(KEY_G, false)
	await _frames(10)
	var began := player.begin_descent_strike(12001)
	_check("dry R6 strike arms at real loaded height", began, "agl=" + str(_agl(game)))
	if began:
		for i in range(150):
			await _frames(1)
			if not player.descent_strike_active:
				break
		await _record("strike-contact", game, true)
		_check("strike emits one valid physical dry contact", landing_events.size() == 1 and int(landing_events[0]["id"]) == 12001 and float(landing_events[0]["speed"]) >= 12.0 and failure_events.is_empty(), str(landing_events) + " " + str(failure_events))
		await _frames(10)
		_check("contact signal does not repeat", landing_events.size() == 1, str(landing_events))
	_key(KEY_G, true)
	for i in range(120):
		await _frames(1)
		if _agl(game) >= 20.0:
			break
	_key(KEY_G, false)
	var second := player.begin_descent_strike(12002)
	if second:
		await _frames(2)
		player.cancel_descent_strike("test early cancel")
	await _frames(4)
	_check("early cancel emits failure without contact", second and failure_events.size() == 1 and int(failure_events[0]["id"]) == 12002 and landing_events.size() == 1, str(failure_events) + " " + str(landing_events))
	await _remove(game)


func _high_speed_braking() -> void:
	# A saved flight pose supplies a reproducible 1 km/s incoming velocity.
	# Every subsequent movement and contact still runs through normal physics.
	var previous_strikes := landing_events.size()
	var game := await _spawn()
	var player := game.player as NativePlayer
	var sample: Dictionary = game.world.surface_at(player.global_position)
	var up: Vector3 = game.world.up_at(player.global_position)
	var target: Vector3 = sample.get("point", player.global_position) + up * 1000.0
	var saved := player.snapshot()
	saved["flight_active"] = true
	var planet_data := player.snapshot_canonical()
	planet_data["position"] = player._canonical_from_scene(target)
	planet_data["velocity"] = player._direction_scene_to_canonical(-up * 1000.0)
	var prepared := player.restore_canonical(saved, planet_data)
	_check("1km/s incoming descent starts from loaded 1000m pose", prepared and _agl(game) >= 999.0 and player.velocity.dot(up) < -990.0, "prepared=" + str(prepared) + " agl=" + str(_agl(game)) + " speed=" + str(player.velocity.dot(up)))
	if prepared:
		_key(KEY_C, true)
		var reached_100 := false
		var minimum_agl := INF
		for i in range(400):
			await _frames(1)
			var agl := _agl(game)
			minimum_agl = minf(minimum_agl, agl)
			if not reached_100 and agl <= 100.0:
				await _record("fast-c-100m", game, true)
				reached_100 = true
			if not player.flight_active:
				break
		_key(KEY_C, false)
		_check("1km/s approach brakes before 100m", reached_100 and absf(float(states.get("fast-c-100m", {}).get("radial_speed", INF))) < 85.0, str(states.get("fast-c-100m", {})))
		_check("1km/s approach lands without terrain penetration or strike", not player.flight_active and _agl(game) <= 0.2 and minimum_agl >= -0.1 and landing_events.size() == previous_strikes, "minimum=" + str(minimum_agl) + " final=" + str(_agl(game)))
	await _remove(game)


func _run() -> void:
	wall_start = Time.get_ticks_msec()
	original_ticks = Engine.physics_ticks_per_second
	Engine.physics_ticks_per_second = 20
	observer = Observer.new()
	root.add_child(observer)
	var source_start := _hashes()
	await _ordinary_descent(false)
	await _ordinary_descent(true)
	var shift_time := float(states.get("shift-c-100m", {}).get("sim_s", INF)) - float(states.get("shift-c-start", {}).get("sim_s", 0.0))
	var regular_time := float(states.get("c-100m", {}).get("sim_s", INF)) - float(states.get("c-start", {}).get("sim_s", 0.0))
	_check("Shift+C reaches 100m sooner", shift_time < INF and shift_time < regular_time, "shift=" + str(shift_time) + " regular=" + str(regular_time))
	await _strike_contract()
	await _high_speed_braking()
	var source_end := _hashes()
	_check("relevant sources stayed frozen", source_start == source_end and not source_start.values().has("MISSING"))
	_check("real 20Hz physics callback and time scale", Engine.time_scale == 1.0 and observer.cadence_frames > 1000 and observer.min_delta >= 0.049 and observer.max_delta <= 0.051, "settled=" + str(observer.cadence_frames) + " warmup=" + str(observer.warmup_frames) + " delta=" + str(observer.min_delta) + ".." + str(observer.max_delta))
	Engine.physics_ticks_per_second = original_ticks
	var report := {"checks": checks, "failures": failures, "states": states,
		"landing_events": landing_events, "failure_events": failure_events,
		"frames": observer.frames, "sim_s": observer.elapsed,
		"wall_s": float(Time.get_ticks_msec() - wall_start) / 1000.0,
		"warmup_frames": observer.warmup_frames, "cadence_frames": observer.cadence_frames,
		"min_delta": observer.min_delta, "max_delta": observer.max_delta,
		"source_sha256_start": source_start, "source_sha256_end": source_end}
	var path := ProjectSettings.globalize_path(REPORT)
	DirAccess.make_dir_recursive_absolute(path.get_base_dir())
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t") + "\n")
		file.flush()
	print("DESCENT_RUNTIME_RESULT=" + JSON.stringify({"passed": checks.size() - failures.size(), "total": checks.size(), "failures": failures, "report": path}))
	observer.queue_free()
	quit(0 if failures.is_empty() and file != null else 1)
