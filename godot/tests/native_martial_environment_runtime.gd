extends "res://tests/native_martial_r4_verify.gd"
## Real Main/Player/World physics; authored ecology assets at controlled points.
## Target placement is a test fixture, not the natural ecology streaming audit.
const INTEGRATION_SLOT := "user://martial_r4_verify_environment.json"
const REOPEN_SLOT := "user://martial_r4_verify_cross_process.json"
var environment: NativeEnvironmentDamage
var environment_events: Array[Dictionary] = []
var landing_events: Array[Dictionary] = []
var frame_states: Array[Dictionary] = []
var last_release_hand := Vector3.ZERO
var probe_overlap := false
var observed_overlap := false
var side_view: SubViewport
var side_camera: Camera3D
var integration_run_id := str(Time.get_ticks_usec())

func _run() -> void:
	capture = "--capture" in OS.get_cmdline_user_args()
	var persistence_only := "--persistence-only" in OS.get_cmdline_user_args()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT))
	var incomplete := FileAccess.open(OUT + "/cross-process-fixture.json", FileAccess.WRITE)
	incomplete.store_string(JSON.stringify({"run_id": integration_run_id, "complete": false, "producer_pid": OS.get_process_id()}))
	incomplete.close()
	for suffix in ["", ".bak"]:
		if FileAccess.file_exists(INTEGRATION_SLOT + suffix):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(INTEGRATION_SLOT + suffix))
	game = (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = INTEGRATION_SLOT
	root.add_child(game)
	await _frames(100)
	environment = get_first_node_in_group("native_environment_damage") as NativeEnvironmentDamage
	game.beast.set_physics_process(false)
	game.beast.global_position = Vector3(500, 50, 500)
	for enemy in game.enemies:
		enemy.set_physics_process(false)
		enemy.global_position = Vector3(500, 50, 500)
	game.combat_event.connect(_combat_observed)
	environment.damaged.connect(func(e: Dictionary): environment_events.append(e))
	game.player.descent_strike_landed.connect(func(id: int, point: Vector3, normal: Vector3, speed: float): landing_events.append({"id": id, "point": point, "normal": normal, "speed": speed}))
	Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)
	await _ground()
	if not persistence_only:
		await _enemy_regressions()
	await _tree_and_rock(not persistence_only)
	if not persistence_only:
		await _air_actions()
	await _descent_loop()
	# Keep normal HUD visible at this runner's 960x720 viewport for Chinese fit.
	game.message_until = -1.0
	await _frames(6, "integration-hud")
	_check(game.hint.get_line_count() * game.hint.get_line_height() <= game.hint.size.y + 2.0, "Chinese controls fit the actual bottom HUD without clipped lines")
	frame_states.append({"case": "hud-layout", "viewport": str(root.get_visible_rect().size), "hint_size": str(game.hint.size), "hint_lines": game.hint.get_line_count(), "hint_line_height": game.hint.get_line_height(), "hint_text": game.hint.text})
	var report := {"checks": checks, "failed": failed, "frame_states": frame_states,
		"landing_events": landing_events, "environment_events": environment_events, "persistence_only": persistence_only,
		"physics_frames": Engine.get_physics_frames(), "slot": INTEGRATION_SLOT,
		"scope": "Normal Main/Player physics and R/G input; actual authored tree/rock targets placed deterministically. Natural habitat distribution and moving AI are separate audits."}
	var file := FileAccess.open(OUT + "/environment-runtime.json", FileAccess.WRITE)
	file.store_string(JSON.stringify(report, "\t"))
	var handoff: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(OUT + "/cross-process-fixture.json"))
	handoff.complete = failed.is_empty()
	var handoff_file := FileAccess.open(OUT + "/cross-process-fixture.json", FileAccess.WRITE)
	handoff_file.store_string(JSON.stringify(handoff, "\t"))
	handoff_file.close()
	print("MARTIAL_ENVIRONMENT_RESULT ", JSON.stringify({"passed": checks.size()-failed.size(), "total": checks.size(), "failed": failed}))
	if persistence_only:
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(OUT + "/persistence-crater-default.png")
	game.initialized = false
	game.queue_free()
	await process_frame
	quit(0 if failed.is_empty() else 1)

func _ground() -> void:
	game.martial.cancel()
	game.player.cancel_combat_action()
	game.player.teleport_to_ground(95.0, 170.0)
	game.player.rotation = Vector3.ZERO
	game.player.get_node("CameraPivot").rotation = Vector3.ZERO
	await _frames(12)

func _combat_observed(event: Dictionary) -> void:
	events.append(event)
	if event.get("phase") == "release":
		last_release_hand = game.martial._socket().origin
		if probe_overlap:
			var direction: Vector3 = game.martial.current.direction
			var result: Dictionary = game.martial._sweep_solid(last_release_hand-direction*.12, last_release_hand+direction*.14, .18)
			observed_overlap = result.get("initial_overlap", false)

func _add_entity(id: String, key: String, offset: Vector3, kind: String, exact_origin := Vector3(INF, INF, INF)) -> Dictionary:
	var parent := Node3D.new()
	parent.name = "MartialFixture_" + id
	game.add_child(parent)
	var asset: Dictionary = environment.library.assets[key]
	var point := game.player.global_position + offset
	if exact_origin.is_finite():
		point = exact_origin
	else:
		point.y = game.world.height_at(point.x, point.z)
	var transform := Transform3D(Basis.IDENTITY, point)
	var batch := MultiMesh.new()
	batch.transform_format = MultiMesh.TRANSFORM_3D
	batch.mesh = asset.mesh
	batch.instance_count = 1
	batch.set_instance_transform(0, transform)
	var visual := MultiMeshInstance3D.new()
	visual.multimesh = batch
	parent.add_child(visual)
	var body := StaticBody3D.new()
	body.transform = transform
	parent.add_child(body)
	if kind == "tree":
		for segment: Dictionary in asset.segments:
			environment.library.add_segment(body, segment)
	else:
		var shape := CollisionShape3D.new()
		shape.shape = (asset.mesh as ArrayMesh).create_convex_shape(true, true)
		body.add_child(shape)
	var record := {"cell": id, "kind": kind, "asset": asset, "transform": transform,
		"parent": parent, "batch": batch, "index": 0, "body": body, "physical": true}
	environment.register_entity(id, record)
	return record

func _remove_entity(id: String) -> void:
	if environment.entities.has(id):
		var record: Dictionary = environment.entities[id]
		environment.unregister_cell(id)
		record.parent.queue_free()
	await _frames(3)

func _cast(kind: String, prefix: String, ticks: int = 65) -> void:
	_reset(kind)
	game.player.realm = 6
	_key(KEY_R, true)
	for i in range(ticks):
		await _frames(1)
		if i % 3 == 0:
			frame_states.append({"case": prefix, "frame": Engine.get_physics_frames(), "cast_elapsed": game.player._cast_elapsed,
				"clip": game.player._r2.current, "phase": game.martial.current.get("phase", "finished"),
				"hand_r": str(game.player.combat_socket_transform_world("hand_r").origin), "body": str(game.player.global_position)})
			if capture:
				await RenderingServer.frame_post_draw
				root.get_texture().get_image().save_png(OUT + "/%s-%03d.png" % [prefix, i])
	_key(KEY_R, false)

func _tree_and_rock(include_regressions := true) -> void:
	var tree := _add_entity("martial-tree", "pine-1-0", Vector3(0, 0, -2.2), "tree")
	await _frames(4)
	await _cast("break", "integration-tree-break", 105)
	_check(environment.states.get("martial-tree", {}).get("fallen", false), "R charged break fells an authored tree through the actual damage service")
	_check(int(game.martial.last_result.get("environment_hits", 0)) == 1, "charged tree contact has one authoritative environment hit")
	await _frames(70, "integration-tree-fall")
	# A separate, real OS process will load these bytes and recreate only the
	# deterministic fixture's authored asset at its original placement. State
	# restoration itself remains the unmodified Main / environment load path.
	game._save_game()
	var copied := DirAccess.copy_absolute(INTEGRATION_SLOT, REOPEN_SLOT) if game.last_save_error == OK else ERR_CANT_CREATE
	_check(copied == OK, "real R-destroyed tree snapshot is saved for another Godot process")
	var tree_point: Vector3 = tree.transform.origin
	var fixture := {"producer_pid": OS.get_process_id(), "run_id": integration_run_id, "complete": false, "slot": REOPEN_SLOT, "main_sha256": FileAccess.get_sha256(REOPEN_SLOT),
		"id": "martial-tree", "key": "pine-1-0", "kind": "tree", "position": [tree_point.x, tree_point.y, tree_point.z],
		"generation": environment.GENERATION, "expected_state": environment.states.get("martial-tree", {}),
		"cooldown": game.martial.snapshot(), "first_process_real_r_input": true}
	var fixture_file := FileAccess.open(OUT + "/cross-process-fixture.json", FileAccess.WRITE)
	fixture_file.store_string(JSON.stringify(fixture, "\t"))
	fixture_file.close()
	await _remove_entity("martial-tree")
	_add_entity("martial-oak", "oak-1-0", Vector3(0, 0, -2.2), "tree")
	await _frames(4)
	await _cast("break", "integration-oak-break", 105)
	var oak_state: Dictionary = environment.states.get("martial-oak", {})
	_check(oak_state.get("fallen", false) or not oak_state.get("broken", []).is_empty(), "low-fork oak loses the actual contacted trunk or subtree")
	await _remove_entity("martial-oak")
	_add_entity("martial-rock", "outcrop-0-0", Vector3(0, 0, -3.0), "outcrop")
	await _frames(4)
	await _cast("break", "integration-rock-break", 105)
	_check(environment.states.get("martial-rock", {}).get("fallen", false), "R charged break fractures the authored finite rock mass")
	await _frames(100, "integration-rock-fragments")
	await _remove_entity("martial-rock")
	if not include_regressions:
		return
	# A human-sized trunk gives a visible contact surface without the beast
	# fixture overlapping C2. Exact mesh/socket proximity decides the hit.
	_add_entity("martial-fist-tree", "oak-0-0", Vector3(0, 0, -0.75), "tree")
	await _frames(4)
	await _cast("fist", "integration-fist-tree", 55)
	_check(not environment.states.get("martial-fist-tree", {}).get("health", {}).is_empty(), "fist contacts a real nearby trunk without extended reach")
	await _remove_entity("martial-fist-tree")
	await _thin_wall_overlap()
	await _cast("slash", "integration-slash-miss", 80)
	_check(not game.martial.last_result.get("landed", true), "unobstructed wind slash expires at finite distance")

func _enemy_regressions() -> void:
	var enemy := _target(1.7)
	var before := enemy.hp
	await _cast("fist", "regression-enemy-fist", 50)
	_check(enemy.hp < before, "revised world LOS still accepts an unobstructed close enemy")
	enemy = _target(5.0)
	before = enemy.hp
	await _cast("fist", "regression-enemy-fist-far", 50)
	_check(enemy.hp == before, "revised fist still misses a five-metre target")
	enemy = _target(8.0)
	before = enemy.hp
	await _cast("slash", "regression-enemy-slash", 75)
	_check(enemy.hp < before, "revised world LOS still accepts finite eight-metre slash impact")
	enemy.hp = enemy.max_hp
	enemy.global_position = Vector3(500, 50, 500)
	_reset("break")
	_key(KEY_R, true)
	await _frames(8)
	_key(KEY_R, false)
	await _frames(28)
	_check(events.filter(func(e): return e.phase == "release").is_empty(), "revised authored charge retains early-release cancellation")

func _thin_wall_overlap() -> void:
	# Real R input, with the blocker placed just beyond the prior real contact
	# socket. The chest-to-hand ray ends before this wall but the fist sphere
	# already touches it; the runtime observer confirms that specific edge case.
	var wall := StaticBody3D.new()
	var collider := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(1.5, 2.0, 0.04)
	collider.shape = shape
	wall.add_child(collider)
	game.add_child(wall)
	wall.global_position = last_release_hand + Vector3(0, 0, -0.03)
	var enemy := _target(1.0)
	var before := enemy.hp
	await _frames(4)
	probe_overlap = true
	await _cast("fist", "integration-fist-thin-wall", 55)
	probe_overlap = false
	_check(observed_overlap, "regression fixture observes initial hand-sphere overlap with thin wall")
	_check(enemy.hp == before, "initial-overlap wall prevents a nearby enemy behind it taking damage")
	enemy.hp = enemy.max_hp
	enemy.global_position = Vector3(500, 50, 500)
	wall.queue_free()
	await _frames(3)

func _rise(altitude: float) -> bool:
	game.player.realm = 9
	game.player.energy = 100.0
	_key(KEY_G, true)
	for i in range(240):
		await _frames(1)
		if float(game.world.surface_at(game.player.global_position).get("agl", 0.0)) >= altitude:
			break
	_key(KEY_G, false)
	await _frames(8)
	return game.player.flight_active and float(game.world.surface_at(game.player.global_position).get("agl", 0.0)) >= altitude

func _air_actions() -> void:
	await _ground()
	_check(await _rise(12.0), "real G input reaches airborne test position")
	for kind in ["fist", "slash", "break"]:
		await _cast(kind, "integration-air-" + kind, 110 if kind == "break" else 65)
		_check(frame_states.any(func(s): return s["case"] == "integration-air-" + kind and s.clip == "air_cast_martial_" + kind), "authored air variant is sampled: " + kind)
		_check(game.player.flight_active and not game.player._cast_active, "air skill returns to current flight state: " + kind)
	_check(landing_events.is_empty(), "air fist slash break never emit a terrain strike")

func _descent_loop(persist := true) -> void:
	await _ground()
	_add_entity("martial-impact-tree", "oak-1-0", Vector3(2.4, 0, -2.2), "tree")
	_add_entity("martial-impact-rock", "outcrop-0-0", Vector3(-3.0, 0, -2.5), "outcrop")
	var center := game.player.global_position
	var before: Dictionary = game.world.surface_at(center)
	_check(await _rise(25.0), "real G input prepares active R9 descent")
	_reset("descent")
	game.player.realm = 9
	_key(KEY_R, true)
	await _descent_frames(3, "descent-windup-cancel")
	_key(KEY_R, false)
	await _descent_frames(25, "descent-windup-cancel-recovery")
	_check(landing_events.is_empty() and float(game.martial.cooldowns.get("descent", 0.0)) == 0.0, "cancel before descent is accepted does not charge or deform")
	_reset("descent")
	game.player.realm = 9
	_key(KEY_R, true)
	for i in range(80):
		await _descent_frames(1, "descent-accepted-cancel-windup")
		if game.martial.current.get("phase", "") == "descent":
			break
	_check(game.martial.current.get("phase", "") == "descent", "real R enters accepted descent before cancellation")
	await _descent_frames(2, "descent-accepted-cancel-dive")
	_key(KEY_R, false)
	_key(KEY_G, true)
	var minimum_cancel_agl := INF
	for i in range(90):
		await _descent_frames(1, "descent-accepted-cancel-recovery")
		var surface: Dictionary = game.world.surface_at(game.player.global_position)
		minimum_cancel_agl = minf(minimum_cancel_agl, float(surface.get("agl", INF)))
		if game.player.velocity.dot(game.world.up_at(game.player.global_position)) >= 5.0:
			break
	_key(KEY_G, false)
	_check(minimum_cancel_agl >= 0.35 and game.player.velocity.dot(game.world.up_at(game.player.global_position)) >= 5.0, "real G safely brakes cancelled strike momentum and regains upward velocity")
	_check(landing_events.is_empty() and game.player.flight_active and game.player.descent_strike_active == false, "release after accepted descent restores flight without impact")
	_check(float(game.martial.cooldowns.get("descent", 0.0)) > 0.0, "cancelling an accepted descent keeps the spent cooldown")
	for i in range(1200):
		if float(game.martial.cooldowns.get("descent", 0.0)) <= 0.0:
			break
		await _frames(1)
	_check(float(game.martial.cooldowns.get("descent", 0.0)) <= 0.0, "accepted-descent cooldown expires through normal physics time")
	_check(await _rise(25.0), "real G restores legal strike altitude after cancelled-dive momentum and cooldown wait")
	_reset("descent")
	game.player.realm = 9
	_key(KEY_R, true)
	await _descent_frames(145, "integration-active-descent")
	var dive_frames := frame_states.filter(func(state): return state["case"] == "integration-active-descent" and state.phase == "descent")
	var windup_frames := frame_states.filter(func(state): return state["case"] == "integration-active-descent" and state.phase == "windup")
	_check(dive_frames.size() > 1 and not windup_frames.is_empty(), "captures windup last frame and accepted dive frames")
	if dive_frames.size() > 1 and not windup_frames.is_empty():
		var held_progress := float(dive_frames[0].progress)
		_check(held_progress >= float(windup_frames[-1].progress) and held_progress >= 0.5, "windup to first dive frame does not rewind normalized clip time")
		_check(dive_frames.all(func(state): return absf(float(state.progress) - held_progress) < 0.000001), "accepted descent holds the exact sampled dive key until physical contact")
	_key(KEY_R, false)
	_check(landing_events.size() == 1, "held R produces exactly one actual ground-contact event")
	_check(environment.states.get("martial-impact-tree", {}).get("fallen", false), "active impact fells nearby real tree")
	_check(environment.states.get("martial-impact-rock", {}).get("fallen", false), "active impact fractures nearby real rock")
	for i in range(600):
		await _frames(1)
		var surface: Dictionary = game.world.surface_at(center)
		if surface.get("ready", false) and float(surface.get("agl", 0.0)) > float(before.get("agl", 0.0)) + 0.5:
			break
	var after: Dictionary = game.world.surface_at(center)
	var up := game.world.up_at(center)
	var ray := PhysicsRayQueryParameters3D.create(center + up * 8.0, center - up * 8.0, NativeWorld.LEGACY_TERRAIN_QUERY_LAYER, [game.player.get_rid()])
	var contact := game.player.get_world_3d().direct_space_state.intersect_ray(ray)
	var depth: float = (center - contact.position).dot(up) if not contact.is_empty() else -INF
	frame_states.append({"case": "physical-crater", "frame": Engine.get_physics_frames(), "depth": depth, "surface": str(after), "collider": str(contact.get("collider")), "deformation": game.martial.last_result.get("deformation", {})})
	_check(after.get("ready", false) and depth > 0.5, "committed impact creates a real physical terrain depression")
	_check(game.world.snapshot_deformations().get("records", []).size() == 1, "one active impact persists one terrain deformation record")
	await _frames(20, "integration-crater-default-camera")
	if not persist:
		return
	# Real reconstruction/capture time may consume the original descent CD.
	# If so, use actual T/R input for a fresh, finite fist cast before saving.
	if not game.martial.cooldowns.values().any(func(value): return float(value) > 0.5):
		_key(KEY_T, true)
		_key(KEY_T, false)
		await _frames(1)
		_key(KEY_R, true)
		await _frames(45, "cross-process-fresh-cooldown")
		_key(KEY_R, false)
	_check(game.martial.cooldowns.values().any(func(value): return float(value) > 0.0), "cross-process fixture contains a real nonzero remaining skill cooldown")
	game._save_game()
	_check(game.last_save_error == OK, "tree rock and crater share a successful main save")
	var copied := DirAccess.copy_absolute(INTEGRATION_SLOT, REOPEN_SLOT) if game.last_save_error == OK else ERR_CANT_CREATE
	_check(copied == OK, "complete real tree rock crater save is handed to the next OS process")
	var fixture: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(OUT + "/cross-process-fixture.json"))
	fixture.main_sha256 = FileAccess.get_sha256(REOPEN_SLOT)
	fixture.cooldown = game.martial.snapshot()
	fixture["deformations"] = game.world.snapshot_deformations()
	fixture["crater_origin"] = [center.x, center.y, center.z]
	fixture["crater_depth"] = depth
	fixture["expected_rock_state"] = environment.states.get("martial-rock", {}).duplicate(true)
	var final_fixture := FileAccess.open(OUT + "/cross-process-fixture.json", FileAccess.WRITE)
	final_fixture.store_string(JSON.stringify(fixture, "\t"))
	final_fixture.close()

func _descent_frames(count: int, prefix: String) -> void:
	var previous_phase := ""
	if capture and side_view == null:
		side_view = SubViewport.new()
		side_view.size = Vector2i(512, 512)
		side_view.world_3d = game.get_world_3d()
		side_view.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		root.add_child(side_view)
		side_camera = Camera3D.new()
		side_camera.fov = 48.0
		side_view.add_child(side_camera)
		side_camera.make_current()
	for i in range(count):
		await physics_frame
		await process_frame
		var rig: Skeleton3D = game.player._r2._rig
		var bone_poses := {}
		for bone_name in ["pelvis", "chest", "head", "wristL", "wristR", "ankleL", "ankleR"]:
			var bone := rig.find_bone(bone_name)
			var pose := rig.get_bone_pose(bone)
			var rotation := pose.basis.get_rotation_quaternion()
			bone_poses[bone_name] = {"position": [pose.origin.x, pose.origin.y, pose.origin.z], "rotation": [rotation.x, rotation.y, rotation.z, rotation.w]}
		var frame := Engine.get_physics_frames()
		frame_states.append({"case": prefix, "frame": frame, "phase": game.martial.current.get("phase", "finished"),
			"clip": game.player._r2.current, "progress": game.player._r2._action_progress, "clip_position": game.player._r2.player.current_animation_position,
			"cast_elapsed": game.player._cast_elapsed, "flight": game.player.flight_active, "strike_active": game.player.descent_strike_active, "surface": str(game.world.surface_at(game.player.global_position)), "velocity": str(game.player.velocity), "vertical_speed": game.player._vertical_speed, "message": game.message, "energy": game.player.energy, "bone_poses": bone_poses})
		var phase := String(game.martial.current.get("phase", "finished"))
		if capture and (i < 20 or i % 15 == 0 or phase != previous_phase):
			var focus := game.player.global_position + Vector3.UP
			side_camera.look_at_from_position(focus + Vector3(5.0, 1.0, 0.6), focus, Vector3.UP)
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(OUT + "/%s-default-%05d.png" % [prefix, frame])
			side_view.get_texture().get_image().save_png(OUT + "/%s-side-%05d.png" % [prefix, frame])
		previous_phase = phase
