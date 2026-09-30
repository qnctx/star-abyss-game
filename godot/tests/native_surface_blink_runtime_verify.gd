extends SceneTree
## Real NativeMain / Player / World, normal callbacks, real Ctrl+Q events.
## Only fixture placement uses restore_canonical. No manual motion, ability
## advance, prepare/consume calls, disabled subsystem, or mocked world.
## Run in an exclusive GPU window; --no-capture permits a logic-only run.
const SOURCES := [
	"res://scripts/native_main.gd", "res://scripts/native_player.gd",
	"res://scripts/native_world.gd", "res://scripts/native_planet.gd",
	"res://scripts/native_surface_blink.gd", "res://scripts/native_ascension.gd",
	"res://scripts/native_motion_r2.gd", "res://scripts/native_martial_library.gd",
	"res://scenes/main.tscn", "res://assets/martial-r4/c2-martial-r4.glb",
	"res://assets/martial-r4/aperture.glb", "res://assets/martial-r4/impact-reference.png",
	"res://tests/native_surface_blink_runtime_verify.gd",
]
const DEFAULT_SLOT := "user://star_abyss_native_v1.json"
const CASE_TIMEOUT := 20.0
const WALL_TIMEOUT_MS := 45000

class Observer extends Node:
	signal sampled(delta: float)
	var frames := 0
	var seconds := 0.0
	var minimum_delta := INF
	var maximum_delta := 0.0
	func _physics_process(delta: float) -> void:
		frames += 1
		seconds += delta
		minimum_delta = minf(minimum_delta, delta)
		maximum_delta = maxf(maximum_delta, delta)
		sampled.emit(delta)

var game: NativeMain
var observer: Observer
var blink: Node
var run_id := ""
var slot := ""
var output_dir := ""
var capture := true
var run_remote_case := false
var failures: Array[String] = []
var checks: Array[Dictionary] = []
var cases: Array[Dictionary] = []
var fixtures: Array[Dictionary] = []
var screenshots: Array[Dictionary] = []
var source_start: Dictionary = {}
var protected_start: Dictionary = {}
var active_case := ""
var observations: Array[Dictionary] = []
var outcomes: Array[Dictionary] = []
var energy_steps: Array[Dictionary] = []
var last_energy := 0.0
var screenshot_serial := 0
var windup_frames := 0
var home := Vector3.ZERO
var blocker: StaticBody3D


func _initialize() -> void:
	call_deferred("_run")


func _check(label: String, passed: bool, detail: Variant = "") -> void:
	checks.append({"label": label, "passed": passed, "detail": detail})
	print("PASS: " if passed else "FAIL: ", label)
	if not passed:
		failures.append(label)


func _hashes() -> Dictionary:
	var result := {}
	for path: String in SOURCES:
		result[path] = FileAccess.get_sha256(path) if FileAccess.file_exists(path) else "MISSING"
	return result


func _protected_hashes() -> Dictionary:
	var result := {}
	for suffix in ["", ".bak", ".environment-r4.json", ".environment-r4.json.bak"]:
		var path: String = DEFAULT_SLOT + suffix
		result[path] = FileAccess.get_sha256(path) if FileAccess.file_exists(path) else "MISSING"
	return result


func _key(code: Key, down: bool, control := false) -> void:
	var event := InputEventKey.new()
	event.keycode = code
	event.physical_keycode = code
	event.pressed = down
	event.ctrl_pressed = control
	root.push_input(event, false)


func _surface_input() -> void:
	_key(KEY_Q, true, true)
	_key(KEY_Q, false, true)


func _frames(count: int) -> void:
	var until := observer.frames + count
	while observer.frames < until:
		await physics_frame
	await process_frame


func _observe(_delta: float) -> void:
	if active_case.is_empty() or not is_instance_valid(game):
		return
	var energy := game.player.energy
	if energy < last_energy - 1.0:
		energy_steps.append({"frame": Engine.get_physics_frames(), "before": last_energy, "after": energy, "drop": last_energy - energy})
	last_energy = energy
	if (blink.get("current") as Dictionary).get("phase") == "windup":
		windup_frames += 1
	if observer.frames % 3 == 0 and observations.size() < 500:
		observations.append(_state())


func _resolved(result: Dictionary) -> void:
	if active_case.is_empty():
		return
	# Synchronous signal captures committed energy/position before gravity or
	# ground recovery can hide the cost in the following physics frame.
	outcomes.append({"result": result.duplicate(true), "state": _state(),
		"terrain_probe": _terrain_probe(game.player.global_position),
		"body_clear": _body_clear(game.player.global_position)})


func _state() -> Dictionary:
	var player := game.player
	var surface: Dictionary = game.world.surface_at(player.global_position)
	var camera := player.get_node("CameraPivot/Camera3D") as Camera3D
	var visible_effects: Array[Dictionary] = []
	for effect: Dictionary in game.ascension.get("_effects"):
		var node: Node3D = effect.get("node")
		if is_instance_valid(node) and node.visible:
			visible_effects.append({"path": String(node.get_path()), "position": node.global_position,
				"age": effect.get("age"), "scale": node.scale,
				"mesh_count": node.find_children("*", "MeshInstance3D", true, false).size()})
	return {"physics_frame": Engine.get_physics_frames(), "observer_frame": observer.frames,
		"game_time": game.time, "position": player.global_position,
		"canonical": player.snapshot_canonical(), "velocity": player.velocity,
		"agl": surface.get("agl"), "surface_ready": surface.get("ready", false),
		"surface_point": surface.get("point"), "water_depth": surface.get("water_depth"),
		"energy": player.energy, "health": player.health, "realm": player.realm,
		"flight": player.flight_active, "on_floor": player.is_on_floor(),
		"cooldown_remaining": blink.get("cooldown_remaining"),
		"current": (blink.get("current") as Dictionary).duplicate(true),
		"clip": player._r2.current, "cast_elapsed": player._cast_elapsed,
		"cast_active": player._cast_active, "combat_serial": player.combat_serial,
		"message": game.message, "visible_effects": visible_effects, "camera_position": camera.global_position,
		"camera_forward": -camera.global_basis.z, "default_camera_current": camera.current,
		"main_physics": game.is_physics_processing(), "player_physics": player.is_physics_processing(),
		"ascension_physics": game.ascension.is_physics_processing()}


func _body_clear(at: Vector3) -> bool:
	var shape_node := game.player.get_node("CollisionShape3D") as CollisionShape3D
	var query := PhysicsShapeQueryParameters3D.new()
	query.shape = shape_node.shape
	var moved := shape_node.global_transform
	var up := game.world.up_at(at)
	moved.basis = Basis(Quaternion(game.player.global_basis.y.normalized(), up)) * moved.basis
	moved.origin += at - game.player.global_position + up * 0.015
	query.transform = moved
	query.collision_mask = game.player.collision_mask
	query.exclude = [game.player.get_rid()]
	return game.player.get_world_3d().direct_space_state.intersect_shape(query, 1).is_empty()


func _terrain_probe(at: Vector3) -> Dictionary:
	var up := game.world.up_at(at)
	var ray := PhysicsRayQueryParameters3D.create(at + up * 4.0, at - up * 8.0, 17, [game.player.get_rid()])
	ray.hit_back_faces = true
	var hit := game.player.get_world_3d().direct_space_state.intersect_ray(ray)
	if hit.is_empty():
		return {"hit": false}
	var collider: Node = hit.collider
	return {"hit": true, "point": hit.position, "normal": hit.normal,
		"collider": String(collider.get_path()), "collision_layer": collider.get("collision_layer"),
		"terrain": collider.is_in_group("native_terrain") or collider.is_in_group("native_planet_terrain")}


func _capture(label: String, side := false) -> void:
	if not capture:
		return
	var viewport: Viewport = root
	var extra: SubViewport
	if side:
		extra = SubViewport.new()
		extra.size = Vector2i(960, 720)
		extra.world_3d = game.player.get_world_3d()
		extra.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		root.add_child(extra)
		var camera := Camera3D.new()
		extra.add_child(camera)
		var up := game.world.up_at(game.player.global_position)
		var right := game.player.global_basis.x.normalized()
		var focus := game.player.global_position + up
		camera.global_position = focus + right * 6.0 + up * 1.0
		camera.look_at(focus, up)
		camera.current = true
		viewport = extra
	await RenderingServer.frame_post_draw
	screenshot_serial += 1
	var path := output_dir + "/%03d-%s%s.png" % [screenshot_serial, label, "-supplementary-side" if side else "-default-camera"]
	var error := viewport.get_texture().get_image().save_png(path)
	screenshots.append({"path": path, "error": error, "supplementary": side,
		"state_at_capture": _state(), "image_is_game_geometry": true})
	if extra != null:
		extra.queue_free()
	_check("capture " + label + (" supplementary" if side else " default"), error == OK, path)


func _place(label: String, rank: int, altitude: float, base: Vector3) -> bool:
	active_case = ""
	for code in [KEY_W, KEY_A, KEY_S, KEY_D, KEY_G, KEY_C, KEY_CTRL, KEY_SHIFT, KEY_Q]:
		_key(code, false)
	var up := game.world.up_at(base)
	var origin := base + up * altitude
	var started := Time.get_ticks_msec()
	var support: Dictionary = {}
	# This is fixture preparation, not ability execution. Do not prepare a
	# landing ticket here. Real scene stream/colliders must support legal restore.
	for i in range(600):
		game.world.update_stream(origin)
		support = game.world.surface_at(origin)
		if support.get("ready", false) == true:
			break
		if Time.get_ticks_msec() - started > WALL_TIMEOUT_MS:
			break
		await _frames(1)
	var stats := game.player.snapshot()
	stats.merge({"realm": rank, "energy": 100.0, "health": game.player.max_health,
		"flight_active": true, "first_person": false, "pitch": -1.2,
		"vx": 0.0, "vy": 0.0, "vz": 0.0, "vertical_speed": 0.0}, true)
	var frame := NativePlanetCoordinates.tangent_frame()
	var canonical := NativePlanetCoordinates.local_to_canonical(origin, frame)
	var pose := {"version": NativePlanetCoordinates.PLANET_VERSION,
		"id": NativePlanetCoordinates.PLANET_ID, "seed": NativePlanetCoordinates.PLANET_SEED,
		"radius": NativePlanetCoordinates.DEFAULT_RADIUS, "position": canonical,
		"forward": NativePlanetCoordinates.point(0, -1, 0),
		"velocity": NativePlanetCoordinates.point(0, 0, 0)}
	var placed: bool = support.get("ready", false) == true and game.player.restore_canonical(stats, pose)
	fixtures.append({"case": label, "method": "public restore_canonical after actual stream readiness",
		"requested_origin": origin, "requested_altitude": altitude, "rank": rank,
		"canonical": canonical, "support": support, "accepted": placed,
		"setup_is_not_claimed_as_flown_distance": true, "wall_ms": Time.get_ticks_msec() - started})
	_check(label + " legal canonical fixture", placed, fixtures[-1])
	if not placed:
		return false
	Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)
	await _frames(6)
	_check(label + " normal physics retained", game.is_physics_processing() and game.player.is_physics_processing() and game.ascension.is_physics_processing() and Engine.time_scale == 1.0)
	# Respect the real previous cooldown. Never reset private ability state.
	var cooldown_start := observer.seconds
	var cooldown_wall_start := Time.get_ticks_msec()
	while float(blink.get("cooldown_remaining")) > 0.0 and observer.seconds - cooldown_start < 27.0 and Time.get_ticks_msec() - cooldown_wall_start < WALL_TIMEOUT_MS:
		await _frames(1)
	_check(label + " cooldown naturally ready", float(blink.get("cooldown_remaining")) <= 0.000001)
	return true


func _add_blocker(at: Vector3) -> void:
	blocker = StaticBody3D.new()
	blocker.name = "VerificationOnlyLandingObstruction"
	blocker.collision_layer = 1
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(5.0, 3.0, 5.0)
	shape.shape = box
	blocker.add_child(shape)
	var mesh := MeshInstance3D.new()
	var visible_box := BoxMesh.new()
	visible_box.size = box.size
	mesh.mesh = visible_box
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(0.8, 0.08, 0.25)
	mesh.material_override = material
	blocker.add_child(mesh)
	game.add_child(blocker)
	var up := game.world.up_at(at)
	blocker.global_basis = Basis(Quaternion(Vector3.UP, up))
	blocker.global_position = at + up * 0.9
	# Deliberately visible diagnostic collision fixture; never production art.


func _exercise(label: String, rank: int, altitude: float, kind: String, base: Vector3) -> void:
	if not await _place(label, rank, altitude, base):
		return
	if kind == "blocked":
		_add_blocker(base + game.world.up_at(base) * 0.8)
		await _frames(3)
		_check(label + " obstruction actually overlaps landing capsule", not _body_clear(base + game.world.up_at(base) * 0.8))
	observations.clear()
	outcomes.clear()
	energy_steps.clear()
	windup_frames = 0
	active_case = label
	last_energy = game.player.energy
	var before := _state()
	var wall_start := Time.get_ticks_msec()
	var start_time := observer.seconds
	_surface_input()
	var input_message := game.message
	var accepted: bool = blink.is_pending()
	var interrupted := false
	var obstruction_added := kind == "blocked"
	var captures := 0
	while observer.seconds - start_time < CASE_TIMEOUT and Time.get_ticks_msec() - wall_start < WALL_TIMEOUT_MS:
		await _frames(1)
		var current: Dictionary = blink.get("current")
		if kind == "late_block" and not obstruction_added and current.get("phase") == "windup":
			_add_blocker(current.target)
			obstruction_added = true
		if not interrupted and observer.seconds - start_time > 0.10 and kind in ["cancel", "move_cancel"] and blink.is_pending():
			if kind == "cancel":
				_surface_input()
			else:
				_key(KEY_W, true)
			interrupted = true
		if capture and captures < 12 and observer.frames % 6 == 0:
			await _capture(label + "-phase-%02d" % captures)
			captures += 1
		if not blink.is_pending() and observer.seconds - start_time >= 0.15:
			break
	_key(KEY_W, false)
	var at_resolution := _state()
	var timed_out: bool = blink.is_pending()
	if timed_out:
		# Bound a failed test through the real cancel input as well; do not let a
		# late completion leak into the next fixture and disguise the timeout.
		_surface_input()
	await _capture(label + "-resolution")
	await _capture(label + "-resolution", true)
	await _frames(75)
	var after := _state()
	await _capture(label + "-settled")
	var succeeded: Array[Dictionary] = []
	for outcome: Dictionary in outcomes:
		if outcome.result.get("ok", false):
			succeeded.append(outcome)
	var expects_success := kind == "success"
	_check(label + " resolves expected outcome", succeeded.size() == 1 if expects_success else succeeded.is_empty(), {"input_message": input_message, "outcomes": outcomes})
	_check(label + " finite wait ends", not timed_out and not blink.is_pending(), at_resolution)
	if kind == "locked":
		_check(label + " realm lock is the actual rejection", not accepted and "R8" in input_message, input_message)
	if kind == "range":
		_check(label + " range is the actual rejection", not accepted and ("out_of_range" in input_message or "距离" in input_message), input_message)
	if expects_success and succeeded.size() == 1:
		var outcome: Dictionary = succeeded[0]
		var cost := 25.0 if rank == 8 else 35.0
		var cooldown := 20.0 if rank == 8 else 25.0
		_check(label + " real dry collider beneath arrival", outcome.terrain_probe.get("terrain", false) and outcome.state.get("surface_ready", false) and float(outcome.state.get("water_depth", INF)) <= 0.15, outcome.terrain_probe)
		_check(label + " committed capsule clear", outcome.body_clear == true)
		_check(label + " one exact ability cost", energy_steps.size() == 1 and absf(float(energy_steps[0].drop) - cost) < 0.12, energy_steps)
		_check(label + " one cooldown commit", absf(float(outcome.state.cooldown_remaining) - cooldown) < 0.04, outcome.state)
		_check(label + " physically reaches selected surface", (outcome.state.position as Vector3).distance_to(outcome.result.target) < 0.05 and float(after.get("agl", INF)) >= -0.10 and float(after.get("agl", INF)) <= 0.20, after)
		_check(label + " actual distance matches high-altitude fixture", absf(float(outcome.result.get("distance", 0.0)) - altitude) <= maxf(2.0, altitude * 0.005), outcome.result)
		_check(label + " authored windup actually occupied physics frames", windup_frames >= 35, windup_frames)
		_check(label + " no duplicate delayed resolution", outcomes.size() == 1)
	else:
		_check(label + " no skill cost or cooldown", energy_steps.is_empty() and float(after.cooldown_remaining) <= 0.000001, {"energy_steps": energy_steps, "after": after})
		var max_displacement := 8.0 if kind == "move_cancel" else 0.50
		_check(label + " no teleport", (after.position as Vector3).distance_to(before.position) <= max_displacement, {"before": before.position, "after": after.position})
		if kind in ["cancel", "move_cancel"]:
			_check(label + " actual pending attempt interrupted", accepted and interrupted and outcomes.size() == 1, outcomes)
		if kind == "late_block":
			_check(label + " obstacle inserted after real preparation", obstruction_added and windup_frames > 0)
		if kind in ["blocked", "late_block"]:
			var rejection := String(outcomes[-1].result.get("reason", "")) if not outcomes.is_empty() else input_message
			_check(label + " obstruction is the actual rejection", "blocked" in rejection or "阻挡" in rejection or "占据" in rejection, rejection)
	cases.append({"label": label, "kind": kind, "before": before, "input_message": input_message,
		"accepted": accepted, "resolution": at_resolution, "after": after,
		"outcomes": outcomes.duplicate(true), "energy_steps": energy_steps.duplicate(true),
		"trace": observations.duplicate(true), "windup_physics_frames": windup_frames,
		"wall_ms": Time.get_ticks_msec() - wall_start})
	active_case = ""
	if is_instance_valid(blocker):
		blocker.queue_free()
		blocker = null
		await _frames(2)


func _remote_base() -> Vector3:
	var planet: Node = game.world.get("_planet")
	if planet == null or not planet.has_method("analytic_surface"):
		return Vector3(INF, INF, INF)
	for lat in [0.10, -0.10, 0.20, -0.20]:
		for lon in [0.14, -0.14, 0.24, -0.24]:
			var canonical := NativePlanetCoordinates.to_cartesian(lat, lon)
			var scene := NativePlanetCoordinates.canonical_to_local(canonical, NativePlanetCoordinates.tangent_frame())
			var sample: Dictionary = planet.call("analytic_surface", scene)
			if float(sample.get("water_depth", INF)) <= 0.15:
				return sample.point
	return Vector3(INF, INF, INF)


func _run() -> void:
	run_id = str(Time.get_ticks_usec())
	slot = "user://surface_blink_runtime_verify_" + run_id + ".json"
	output_dir = "res://reports/surface-blink-runtime/" + run_id
	capture = not "--no-capture" in OS.get_cmdline_user_args() and DisplayServer.get_name() != "headless"
	run_remote_case = "--remote" in OS.get_cmdline_user_args()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output_dir))
	source_start = _hashes()
	protected_start = _protected_hashes()
	observer = Observer.new()
	observer.process_physics_priority = 1000
	observer.sampled.connect(_observe)
	root.add_child(observer)
	game = (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = slot
	root.add_child(game)
	await _frames(90)
	blink = game.ascension.get("surface_blink")
	var dependencies := is_instance_valid(blink) and game.world.has_method("prepare_surface_landing") and game.world.has_method("consume_surface_landing") and game.world.has_method("cancel_surface_landing") and game.player.has_method("blink_to_prepared_surface")
	_check("real high-tier interfaces available", dependencies)
	_check("authored clips and aperture asset present", source_start["res://assets/martial-r4/c2-martial-r4.glb"] != "MISSING" and source_start["res://assets/martial-r4/aperture.glb"] != "MISSING")
	_check("normal engine time scale", Engine.time_scale == 1.0)
	if not dependencies or Engine.time_scale != 1.0:
		await _finish()
		return
	blink.resolved.connect(_resolved)
	var support := game.world.surface_at(Vector3(0, 0, 190))
	_check("starting physical terrain ready and dry", support.get("ready", false) and float(support.get("water_depth", INF)) <= 0.15)
	if support.get("ready", false) != true:
		await _finish()
		return
	home = support.point
	await _exercise("r7-locked", 7, 120.0, "locked", home)
	await _exercise("r8-125km-out-of-range", 8, 125000.0, "range", home)
	await _exercise("r8-toggle-cancel", 8, 120.0, "cancel", home)
	await _exercise("r8-movement-cancel", 8, 120.0, "move_cancel", home)
	await _exercise("r8-blocked-destination", 8, 120.0, "blocked", home)
	await _exercise("r8-new-obstacle-after-prepare", 8, 120.0, "late_block", home)
	await _exercise("r8-120m-arrival", 8, 120.0, "success", home)
	await _exercise("r9-120m-arrival", 9, 120.0, "success", home)
	await _exercise("r9-125km-arrival", 9, 125000.0, "success", home)
	if run_remote_case:
		var remote_base := _remote_base()
		_check("remote dry region found without mocked field", remote_base.is_finite(), remote_base)
		if remote_base.is_finite():
			await _exercise("r9-remote-125km-arrival", 9, 125000.0, "success", remote_base)
	# Save by the existing product key path into this run's unique slot.
	_key(KEY_F5, true)
	_key(KEY_F5, false)
	await _frames(3)
	_check("independent slot written by product save action", FileAccess.file_exists(slot) and game.last_save_error == OK, slot)
	if FileAccess.file_exists(slot):
		var saved: Variant = JSON.parse_string(FileAccess.get_file_as_string(slot))
		_check("save contains remaining surface cooldown", saved is Dictionary and saved.get("ascension", {}).get("surface_blink", {}).has("cooldown_remaining"))
	await _finish()


func _json_value(value: Variant) -> Variant:
	if value is Vector3:
		return [value.x, value.y, value.z]
	if value is Dictionary:
		var result := {}
		for key in value:
			result[str(key)] = _json_value(value[key])
		return result
	if value is Array:
		var result: Array = []
		for item in value:
			result.append(_json_value(item))
		return result
	if value is float and not is_finite(value):
		return str(value)
	return value


func _finish() -> void:
	active_case = ""
	for code in [KEY_W, KEY_A, KEY_S, KEY_D, KEY_G, KEY_C, KEY_CTRL, KEY_SHIFT, KEY_Q]:
		_key(code, false)
	var source_end := _hashes()
	_check("source and assets unchanged throughout run", source_start == source_end)
	_check("test Main uses its independent save slot", game.save_path == slot and slot.begins_with("user://surface_blink_runtime_verify_"))
	_check("real physics frames observed", observer.frames >= 90 and observer.minimum_delta > 0.0 and Engine.time_scale == 1.0)
	var report := {"run_id": run_id, "slot": slot, "scope": "Real runtime input and physics; fixture relocation is not flight-distance evidence.",
		"visual_acceptance": "Screenshots captured; human image inspection still required." if capture else "NOT VERIFIED: capture disabled or headless.",
		"remote_fixture": "Optional remote fixture preloads real origin support; this does not claim a cold-cache benchmark.",
		"checks": checks, "failures": failures, "fixtures": fixtures, "cases": cases, "screenshots": screenshots,
		"physics_frames": observer.frames, "physics_seconds": observer.seconds,
		"delta_min": observer.minimum_delta, "delta_max": observer.maximum_delta,
		"source_sha256_start": source_start, "source_sha256_end": source_end,
		"default_slot_hashes_start": protected_start, "default_slot_hashes_end": _protected_hashes(), "default_slot_observation_scope": "Read-only hashes during this test window; external user activity may change these files. Test Main is bound to the independent slot before entering the tree."}
	var path := output_dir + "/runtime-verification.json"
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(_json_value(report), "\t") + "\n")
		file.flush()
	print("SURFACE_BLINK_RUNTIME_RESULT=" + JSON.stringify({"checks": checks.size(), "failed": failures,
		"report": ProjectSettings.globalize_path(path), "slot": ProjectSettings.globalize_path(slot), "capture": capture}))
	if is_instance_valid(game):
		game.queue_free()
	await process_frame
	observer.queue_free()
	quit(0 if failures.is_empty() and file != null else 1)
