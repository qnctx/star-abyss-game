extends SceneTree

# Normal NativeMain and NativePlayer physics remain enabled. Synthetic key
# events enter the viewport's ordinary _input path; no movement method is called.
const SLOT := "user://star_abyss_native_planet_product_flight_verify.json"
const REPORT := "res://reports/planet-native-player/product-flight-final.json"
const ORBIT_SCREENSHOT := "res://reports/planet-native-player/product-orbit-final.png"
const SOURCE_PATHS := [
	"res://scripts/native_player.gd", "res://scripts/native_planet_coordinates.gd",
	"res://scripts/native_world.gd", "res://scripts/native_planet.gd",
	"res://scripts/native_planet_field.gd", "res://scripts/native_main.gd",
	"res://scripts/native_ascension.gd", "res://scripts/native_motion_r2.gd",
	"res://scenes/main.tscn", "res://assets/terrain/planet_surface.gdshader",
	"res://assets/motion-r2/c2-motion-r2.glb",
	"res://tests/native_planet_product_flight_verify.gd"
]

class FlightObserver extends Node:
	var player: NativePlayer
	var world: Node3D
	var frames := 0
	var elapsed := 0.0
	var min_delta := INF
	var max_delta := 0.0
	var agl := 0.0
	var max_agl := 0.0
	var min_agl := INF
	var unready_frames := 0
	var radial_speed := 0.0

	func _physics_process(delta: float) -> void:
		frames += 1
		elapsed += delta
		min_delta = minf(min_delta, delta)
		max_delta = maxf(max_delta, delta)
		if player == null:
			return
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
var observer: FlightObserver
var wall_started_ms := 0
var source_started: Dictionary = {}
var milestones: Dictionary = {}
var orbit_capture: Dictionary = {}


func _initialize() -> void:
	call_deferred("_run")


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


func _source_hashes() -> Dictionary:
	var result := {}
	for path: String in SOURCE_PATHS:
		result[path] = FileAccess.get_sha256(path) if FileAccess.file_exists(path) else "MISSING"
	return result


func _mark(label: String, player: NativePlayer) -> void:
	milestones[label] = {"physics_frames": observer.frames, "sim_s": observer.elapsed,
		"wall_s": float(Time.get_ticks_msec() - wall_started_ms) / 1000.0,
		"agl": observer.agl, "energy": player.energy, "radial_speed": observer.radial_speed,
		"unready_frames": observer.unready_frames, "g_event_held": player._held_g,
		"c_event_held": player._held_c, "flight_active": player.flight_active,
		"mouse_mode": Input.get_mouse_mode()}
	print("PRODUCT_FLIGHT_MILESTONE=" + JSON.stringify({"name": label, "state": milestones[label]}))


func _capture_orbit(player: NativePlayer) -> void:
	# Aim the normal Player camera with the same viewport mouse-input path used
	# during play. No OS mouse or desktop focus event is sent by this test.
	var motion := InputEventMouseMotion.new()
	motion.relative = Vector2(0.0, 540.0)
	root.push_input(motion, false)
	await _frames(1)
	await RenderingServer.frame_post_draw
	var screenshot := root.get_texture().get_image()
	var path := ProjectSettings.globalize_path(ORBIT_SCREENSHOT)
	DirAccess.make_dir_recursive_absolute(path.get_base_dir())
	var saved := not screenshot.is_empty() and screenshot.save_png(path) == OK
	orbit_capture = {"path": path, "saved": saved, "width": screenshot.get_width(), "height": screenshot.get_height(),
		"player_pitch": player._look_pitch, "mouse_mode": Input.get_mouse_mode(), "agl": observer.agl,
		"wall_s": float(Time.get_ticks_msec() - wall_started_ms) / 1000.0}
	_check("normal Player orbital viewport screenshot saved", saved and player._look_pitch < -1.2 and screenshot.get_width() >= 640 and screenshot.get_height() >= 360, str(orbit_capture))
	print("PRODUCT_ORBIT_CAPTURE=" + JSON.stringify(orbit_capture))


func _run() -> void:
	wall_started_ms = Time.get_ticks_msec()
	source_started = _source_hashes()
	var game := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = SLOT
	root.add_child(game)
	await physics_frame
	await physics_frame
	var player := game.player as NativePlayer
	var world := game.world as Node3D
	observer = FlightObserver.new()
	observer.player = player
	observer.world = world
	root.add_child(observer)
	_check("normal scene physics remains active", game.is_physics_processing() and player.is_physics_processing() and world.get("planet_enabled") == true)
	var home: Dictionary = world.call("surface_at", player.global_position)
	_check("normal spawn has physical ground", home.get("ready", false) == true, str(home))
	if not checks[0].pass or not checks[1].pass:
		await _finish(game)
		return
	_key(KEY_G, true)
	await _frames(3)
	_check("injected G event reaches normal player input", player._held_g and player.flight_active, "active=" + str(player.flight_active) + " agl=" + str(observer.agl))
	if not checks[2].pass:
		print("PRODUCT_INPUT_DIAGNOSTIC=" + JSON.stringify({"g_held_event": player._held_g, "g_pressed_os": Input.is_physical_key_pressed(KEY_G), "mouse_mode": Input.get_mouse_mode(), "health": player.health, "player_processing": player.is_physics_processing(), "on_terrain": player._on_terrain(), "energy": player.energy, "position": str(player.global_position)}))
		await _finish(game)
		return
	_mark("launched", player)
	for i in range(6000):
		await _frames(1)
		if observer.agl >= 2000.0 and not milestones.has("2km"):
			_mark("2km", player)
		if observer.agl >= 10000.0 and not milestones.has("10km"):
			_mark("10km", player)
		if observer.agl >= 125000.0:
			break
		if i % 600 == 0:
			print("PRODUCT_ORBIT_PROGRESS=" + JSON.stringify({"frame": i, "agl": observer.agl, "energy": player.energy, "unready": observer.unready_frames}))
	_check("normal G flight reaches whole-globe altitude", observer.agl >= 125000.0 and observer.elapsed <= 100.0 and player.energy > 0.0, "agl=" + str(observer.agl) + " elapsed=" + str(observer.elapsed) + " energy=" + str(player.energy))
	_mark("globe_view", player)
	var orbital_save := player.snapshot_canonical()
	_check("normal scene saves orbital canonical position", NativePlanetCoordinates.valid(orbital_save.get("position", {})))
	var camera := player.get_node("CameraPivot/Camera3D") as Camera3D
	_check("normal orbital camera has full-globe far plane", camera.far >= 360000.0, "far=" + str(camera.far))
	await _capture_orbit(player)
	_key(KEY_G, false)
	await _frames(600)
	_mark("coast_braked", player)
	_check("release G brakes climb", absf(observer.radial_speed) < 30.0, "radial=" + str(observer.radial_speed) + " agl=" + str(observer.agl))
	_key(KEY_C, true)
	for i in range(9000):
		await _frames(1)
		if not player.flight_active:
			break
		if i % 900 == 0:
			print("PRODUCT_RETURN_PROGRESS=" + JSON.stringify({"frame": i, "agl": observer.agl, "vertical": observer.radial_speed, "unready": observer.unready_frames}))
	_key(KEY_C, false)
	_mark("landed", player)
	_check("normal C flight brakes and lands on terrain", not player.flight_active and observer.agl <= 0.2 and observer.min_agl >= -0.1, "agl=" + str(observer.agl) + " min=" + str(observer.min_agl))
	_check("normal route retains loaded collision", observer.unready_frames == 0, "unready=" + str(observer.unready_frames))
	_check("normal engine time scale and physics delta", Engine.time_scale == 1.0 and observer.min_delta > 0.0 and observer.max_delta < 0.05, "delta=" + str(observer.min_delta) + ".." + str(observer.max_delta))
	await _finish(game)


func _finish(game: NativeMain) -> void:
	_key(KEY_G, false)
	_key(KEY_C, false)
	var timing := {"frames": observer.frames, "elapsed_delta": observer.elapsed, "min_delta": observer.min_delta, "max_delta": observer.max_delta,
		"wall_s": float(Time.get_ticks_msec() - wall_started_ms) / 1000.0, "time_scale": Engine.time_scale}
	var source_finished := _source_hashes()
	_check("source files unchanged during full run", source_started == source_finished and not source_started.values().has("MISSING"))
	observer.queue_free()
	game.initialized = false
	game.queue_free()
	await process_frame
	if FileAccess.file_exists(SLOT):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SLOT))
	var result := {"total": checks.size(), "passed": checks.size() - failures.size(), "failures": failures, "checks": checks,
		"timing": timing, "milestones": milestones, "orbit_capture": orbit_capture,
		"source_sha256_start": source_started, "source_sha256_end": source_finished}
	var report_path := ProjectSettings.globalize_path(REPORT)
	DirAccess.make_dir_recursive_absolute(report_path.get_base_dir())
	var file := FileAccess.open(report_path, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(result, "\t") + "\n")
		file.flush()
	else:
		push_error("Could not write flight evidence: " + report_path)
	print("NATIVE_PLANET_PRODUCT_FLIGHT_JSON=" + JSON.stringify(result))
	quit(0 if failures.is_empty() and file != null else 1)
