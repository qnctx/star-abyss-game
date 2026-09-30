extends "res://tests/native_martial_r4_verify.gd"
## Real Main/Player/World physics; authored ecology assets at controlled points.
## Target placement is a test fixture, not the natural ecology streaming audit.
const SUPPORT_OUT := "res://reports/martial-support-r43"
const INTEGRATION_SLOT := "user://martial_support_r43_producer.json"
const REOPEN_SLOT := "user://martial_support_r43_reopen.json"
const FROZEN_SOURCES := {
	"res://scripts/native_environment_damage.gd": "681d4ff64c310c975f8abe18f5021d92d5373cfe737f3b105a017f140bc778ee",
	"res://scripts/native_planet_ecology.gd": "73e2c462a670b31cf3d632834a00b65d0d05d9ebf9e664688fca2310f6b99db1",
}
const ROCK_IDS := ["martial-rock", "martial-impact-rock"]
const POSITION_TOLERANCE := 0.20
const CONTACT_TOLERANCE := 0.20
var support_fixtures: Dictionary = {}
var live_support_samples: Dictionary = {}
var support_waits: Array[Dictionary] = []
var support_stage := "producer-before-crater"
var frozen_start: Dictionary = {}
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
	frozen_start = _frozen_hashes()
	_check(frozen_start == FROZEN_SOURCES, "support producer uses exact frozen 681/73e ecology sources")
	capture = "--capture" in OS.get_cmdline_user_args()
	var persistence_only := "--persistence-only" in OS.get_cmdline_user_args()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(SUPPORT_OUT))
	var incomplete := FileAccess.open(SUPPORT_OUT + "/cross-process-fixture.json", FileAccess.WRITE)
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
		"support_fixtures": support_fixtures, "live_support_samples": live_support_samples,
		"support_waits": support_waits, "source_sha256_start": frozen_start, "source_sha256_end": _frozen_hashes(),
		"scope": "Controlled caller resets realm/energy/position/cooldown and stops/repositions AI. Real R/G input, Main/Player/environment physics, authored deterministic targets, real terrain support and disk save. Not natural ecology or moving-AI end-to-end evidence."}
	_check(_frozen_hashes() == frozen_start, "support producer frozen ecology source hashes remain unchanged")
	var file := FileAccess.open(SUPPORT_OUT + "/environment-runtime.json", FileAccess.WRITE)
	file.store_string(JSON.stringify(report, "\t"))
	var handoff: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(SUPPORT_OUT + "/cross-process-fixture.json"))
	handoff.complete = failed.is_empty()
	handoff["support_fixtures"] = support_fixtures
	handoff["live_support_samples"] = live_support_samples
	handoff["source_sha256"] = frozen_start
	handoff["support_schema"] = 1
	var handoff_file := FileAccess.open(SUPPORT_OUT + "/cross-process-fixture.json", FileAccess.WRITE)
	handoff_file.store_string(JSON.stringify(handoff, "\t"))
	handoff_file.close()
	print("MARTIAL_SUPPORT_PRODUCER_RESULT ", JSON.stringify({"passed": checks.size()-failed.size(), "total": checks.size(), "failed": failed}))
	if persistence_only:
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(SUPPORT_OUT + "/persistence-crater-default.png")
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
				root.get_texture().get_image().save_png(SUPPORT_OUT + "/%s-%03d.png" % [prefix, i])
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
	var fixture_file := FileAccess.open(SUPPORT_OUT + "/cross-process-fixture.json", FileAccess.WRITE)
	fixture_file.store_string(JSON.stringify(fixture, "\t"))
	fixture_file.close()
	await _remove_entity("martial-tree")
	_add_entity("martial-oak", "oak-1-0", Vector3(0, 0, -2.2), "tree")
	await _frames(4)
	await _cast("break", "integration-oak-break", 105)
	var oak_state: Dictionary = environment.states.get("martial-oak", {})
	_check(oak_state.get("fallen", false) or not oak_state.get("broken", []).is_empty(), "low-fork oak loses the actual contacted trunk or subtree")
	await _remove_entity("martial-oak")
	var rock := _add_entity("martial-rock", "outcrop-0-0", Vector3(0, 0, -3.0), "outcrop")
	_remember_support_fixture("martial-rock", "outcrop-0-0", rock)
	await _frames(4)
	await _cast("break", "integration-rock-break", 105)
	_check(environment.states.get("martial-rock", {}).get("fallen", false), "R charged break fractures the authored finite rock mass")
	await _frames(100, "integration-rock-fragments")
	await _wait_support_settled("martial-rock", "producer-before-crater")
	support_fixtures["martial-rock"]["before_crater"] = _entity_geometry("martial-rock")
	_assert_supported_geometry(support_fixtures["martial-rock"].before_crater, "producer real R fractured rock before crater")
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
	var impact_rock := _add_entity("martial-impact-rock", "outcrop-0-0", Vector3(-3.0, 0, -2.5), "outcrop")
	_remember_support_fixture("martial-impact-rock", "outcrop-0-0", impact_rock)
	support_fixtures["martial-impact-rock"]["original_standing"] = _entity_geometry("martial-impact-rock")
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
	support_stage = "producer-post-crater"
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
	# Restore the original R-broken fixture AFTER the real crater exists. Doing
	# this before the blast would intentionally clear its already-broken mass,
	# leaving no fragments to compare. Registration runs the normal support
	# queue; no saved state or pose is manually imported or rewritten here.
	if support_fixtures.has("martial-rock") and not environment.entities.has("martial-rock"):
		var prior: Dictionary = support_fixtures["martial-rock"]
		_add_entity("martial-rock", String(prior.key), Vector3.ZERO, "outcrop", _v3(prior.original_position))
	for id: String in ROCK_IDS:
		await _wait_support_settled(id, "producer-post-crater")
		support_fixtures[id]["settled_after_crater"] = _entity_geometry(id)
		_assert_supported_geometry(support_fixtures[id].settled_after_crater, "producer post-crater " + id)
		support_fixtures[id]["expected_state"] = environment.states.get(id, {}).duplicate(true)
		support_fixtures[id]["observed_live"] = _has_live_sample(id)
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
	var fixture: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(SUPPORT_OUT + "/cross-process-fixture.json"))
	fixture.main_sha256 = FileAccess.get_sha256(REOPEN_SLOT)
	fixture.cooldown = game.martial.snapshot()
	fixture["deformations"] = game.world.snapshot_deformations()
	fixture["crater_origin"] = [center.x, center.y, center.z]
	fixture["crater_depth"] = depth
	fixture["expected_rock_state"] = environment.states.get("martial-rock", {}).duplicate(true)
	fixture["expected_impact_rock_state"] = environment.states.get("martial-impact-rock", {}).duplicate(true)
	fixture["support_fixtures"] = support_fixtures
	fixture["live_support_samples"] = live_support_samples
	fixture["support_schema"] = 1
	var final_fixture := FileAccess.open(SUPPORT_OUT + "/cross-process-fixture.json", FileAccess.WRITE)
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
		_observe_live_support()
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
			root.get_texture().get_image().save_png(SUPPORT_OUT + "/%s-default-%05d.png" % [prefix, frame])
			side_view.get_texture().get_image().save_png(SUPPORT_OUT + "/%s-side-%05d.png" % [prefix, frame])
		previous_phase = phase

func _frames(count: int, prefix := "") -> void:
	# Override the base helper as well: no image may leak into old martial-r4.
	for i in range(count):
		await physics_frame
		await process_frame
		_observe_live_support()
		if capture and not prefix.is_empty() and i % 3 == 0:
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(SUPPORT_OUT + "/%s-%03d.png" % [prefix, i])

func _frozen_hashes() -> Dictionary:
	var hashes := {}
	for path: String in FROZEN_SOURCES:
		hashes[path] = FileAccess.get_sha256(path)
	return hashes

func _v3(values: Array) -> Vector3:
	return Vector3(float(values[0]), float(values[1]), float(values[2]))

func _xyz(point: Vector3) -> Array:
	return [point.x, point.y, point.z]

func _pose(transform: Transform3D) -> Dictionary:
	return {"position": _xyz(transform.origin), "basis": [_xyz(transform.basis.x), _xyz(transform.basis.y), _xyz(transform.basis.z)]}

func _bounds(points: Array[Vector3]) -> Dictionary:
	if points.is_empty(): return {}
	var box := AABB(points[0], Vector3.ZERO)
	for point: Vector3 in points: box = box.expand(point)
	return {"position": _xyz(box.position), "size": _xyz(box.size), "center": _xyz(box.get_center())}

func _remember_support_fixture(id: String, key: String, record: Dictionary) -> void:
	support_fixtures[id] = {"id": id, "key": key, "kind": "outcrop",
		"original_position": _xyz((record.transform as Transform3D).origin),
		"original_transform": _pose(record.transform), "fixture_not_natural_distribution": true}

func _support_busy(id: String) -> Dictionary:
	var pending := 0
	var dynamic := 0
	var moving := 0
	for item: Dictionary in environment.support_rechecks.values():
		if String(item.id) == id: pending += 1
	for item: Dictionary in environment.debris:
		if String(item.id) == id: dynamic += 1
	for item: Dictionary in environment.motions:
		if String(item.id) == id: moving += 1
	return {"pending": pending, "dynamic": dynamic, "moving": moving}

func _wait_support_settled(id: String, label: String) -> void:
	var quiet := 0
	var started := Engine.get_physics_frames()
	var wall_started := Time.get_ticks_msec()
	var transitions: Array[Dictionary] = []
	var previous := {}
	for i in range(900):
		await _frames(1)
		var busy := _support_busy(id)
		if busy != previous:
			transitions.append({"frame": Engine.get_physics_frames(), "busy": busy.duplicate()})
			previous = busy
		quiet = quiet + 1 if int(busy.pending) + int(busy.dynamic) + int(busy.moving) == 0 else 0
		if quiet >= 12 or Time.get_ticks_msec() - wall_started > 45000: break
	var waited := {"id": id, "label": label, "frames": Engine.get_physics_frames() - started,
		"quiet_frames": quiet, "wall_ms": Time.get_ticks_msec() - wall_started, "transitions": transitions,
		"environment_physics_active": environment.is_physics_processing(), "main_physics_active": game.is_physics_processing()}
	support_waits.append(waited)
	_check(quiet >= 12 and environment.is_physics_processing() and game.is_physics_processing(), label + " normal support queue and debris settle: " + id)

func _has_live_sample(id: String) -> bool:
	for key: String in live_support_samples:
		if key.ends_with("|" + id) and not live_support_samples[key].is_empty(): return true
	return false

func _observe_live_support() -> void:
	if not is_instance_valid(environment): return
	for id: String in ROCK_IDS:
		if not environment.entities.has(id): continue
		var oldest := -1.0
		for item: Dictionary in environment.debris:
			if String(item.id) == id and is_instance_valid(item.body) and not item.body.freeze:
				oldest = maxf(oldest, float(item.age))
		if oldest < 0.0: continue
		var key := support_stage + "|" + id
		var bucket := mini(2, floori(oldest))
		var samples: Array = live_support_samples.get(key, [])
		if samples.any(func(sample): return int(sample.bucket) == bucket): continue
		# This is an observation of a live engine RigidBody, not a forced pose.
		samples.append({"bucket": bucket, "oldest_debris_age": oldest, "geometry": _entity_geometry(id)})
		live_support_samples[key] = samples

func _enabled_shapes(body: CollisionObject3D) -> Dictionary:
	var shapes: Array[Dictionary] = []
	var vertices: Array[Vector3] = []
	var active := 0
	for child in body.get_children():
		if not child is CollisionShape3D: continue
		var shape := child as CollisionShape3D
		var enabled := not shape.disabled and shape.shape != null and body.collision_layer != 0
		if enabled: active += 1
		shapes.append({"enabled": enabled, "disabled_property": shape.disabled,
			"shape_type": shape.shape.get_class() if shape.shape != null else "missing",
			"world_pose": _pose(shape.global_transform)})
		if enabled and shape.shape is ConvexPolygonShape3D:
			for point: Vector3 in (shape.shape as ConvexPolygonShape3D).points:
				vertices.append(shape.global_transform * point)
	var backend_active := -1
	if body.has_method("is_shape_owner_disabled"):
		backend_active = 0
		for owner_id in body.get_shape_owners():
			if not bool(body.call("is_shape_owner_disabled", owner_id)) and body.collision_layer != 0:
				backend_active += body.shape_owner_get_shape_count(owner_id)
	return {"enabled_child_shapes": active, "enabled_backend_shapes": backend_active,
		"collision_layer": body.collision_layer, "collision_mask": body.collision_mask,
		"shapes": shapes, "world_hull_bounds": _bounds(vertices), "hull_vertex_count": vertices.size()}

func _collider_evidence(hit: Dictionary) -> Dictionary:
	if hit.is_empty(): return {"collider": "none", "rid": 0, "shape": -1, "groups": []}
	var body := hit.get("collider") as Node
	var rid: RID = hit.get("rid", RID())
	var groups: Array[String] = []
	if body != null:
		for group: StringName in body.get_groups(): groups.append(String(group))
	var parent := body.get_parent() if body != null else null
	return {"collider": String(body.get_path()) if body != null else "none", "rid": rid.get_id(),
		"shape": hit.get("shape", -1), "groups": groups,
		"class": body.get_class() if body != null else "", "name": String(body.name) if body != null else "",
		"collision_layer": (body as CollisionObject3D).collision_layer if body is CollisionObject3D else 0,
		"environment_entity": body.get_meta("environment_entity", "") if body != null else "",
		"environment_part": body.get_meta("environment_part", "") if body != null else "",
		"parent": String(parent.get_path()) if parent != null else "",
		"parent_impact_refined": parent.get_meta("impact_refined", false) if parent != null else false}

func _terrain_support_ray(point: Vector3) -> Dictionary:
	# Independent real terrain ray: no environment._fragment_clearance or
	# analytic height fallback. Masks exclude all fragment/entity colliders.
	var up := game.world.up_at(point)
	var old_basin := point.y > -1000.0 and absf(point.x) <= 3000.0 and absf(point.z) <= 3000.0
	var mask := 32 if old_basin else 16
	var group := "native_terrain" if old_basin else "native_planet_terrain"
	var from := point + up * 24.0
	var to := point - up * 40.0
	var query := PhysicsRayQueryParameters3D.create(from, to, mask)
	query.hit_back_faces = true
	var hit := game.get_world_3d().direct_space_state.intersect_ray(query)
	var evidence := _collider_evidence(hit)
	evidence.merge({"ready": false, "mask": mask, "sample": _xyz(point), "ray_from": _xyz(from),
		"ray_to": _xyz(to), "terrain_group": group, "up": _xyz(up)})
	if hit.is_empty(): return evidence
	var body := hit.collider as Node
	var ready := body != null and body.is_inside_tree() and not body.is_queued_for_deletion() and body.is_in_group(group)
	evidence.merge({"ready": ready, "point": _xyz(hit.position), "normal": _xyz(hit.normal),
		"ray_hit_distance": from.distance_to(hit.position),
		"clearance": (point - (hit.position as Vector3)).dot(up)}, true)
	return evidence

func _entity_first_hit(mesh: MeshInstance3D, expected: CollisionObject3D) -> Dictionary:
	var box: AABB = mesh.global_transform * mesh.mesh.get_aabb()
	var center := box.get_center()
	var up := game.world.up_at(center)
	var right := Vector3.RIGHT.slide(up).normalized()
	if right.is_zero_approx(): right = Vector3.FORWARD.slide(up).normalized()
	var forward := right.cross(up).normalized()
	var span := maxf(2.0, box.size.length() + 1.0)
	var directions: Array[Vector3] = [up, right, -right, forward, -forward,
		(up + right).normalized(), (up - right).normalized(), (up + forward).normalized(), (up - forward).normalized(), -up]
	var attempts: Array[Dictionary] = []
	for point: Vector3 in [center, center + up * box.size.length() * 0.12, center - up * box.size.length() * 0.12]:
		for direction: Vector3 in directions:
			var from := point + direction * span
			var to := point - direction * span
			var query := PhysicsRayQueryParameters3D.create(from, to, 1, [game.player.get_rid()])
			var hit := game.get_world_3d().direct_space_state.intersect_ray(query)
			var same: bool = not hit.is_empty() and hit.get("collider") == expected
			var attempt := _collider_evidence(hit)
			attempt.merge({"from": _xyz(from), "to": _xyz(to), "first_hit_is_part_body": same,
				"expected_body_rid": expected.get_rid().get_id(),
				"hit_point": _xyz(hit.position) if not hit.is_empty() else []})
			attempts.append(attempt)
			if same and box.grow(0.08).has_point(hit.position):
				return {"hit": true, "matches_visible_mesh_bounds": true, "attempt": attempt, "attempt_count": attempts.size()}
	return {"hit": false, "attempts": attempts}

func _entity_geometry(id: String) -> Dictionary:
	if not environment.entities.has(id): return {"id": id, "registered": false}
	var record: Dictionary = environment.entities[id]
	var parts := {}
	var state: Dictionary = environment.states.get(id, {})
	for part: String in record.get("part_nodes", {}):
		var entry: Dictionary = record.part_nodes[part]
		var body := entry.body as CollisionObject3D
		var mesh := entry.mesh as MeshInstance3D
		if not is_instance_valid(body) or not is_instance_valid(mesh) or mesh.mesh == null: continue
		var vertices: Array[Vector3] = []
		var unique_local_vertices := {}
		var raw_vertex_count := 0
		for surface_index in range(mesh.mesh.get_surface_count()):
			var source: PackedVector3Array = mesh.mesh.surface_get_arrays(surface_index)[Mesh.ARRAY_VERTEX]
			raw_vertex_count += source.size()
			for local_vertex: Vector3 in source:
				if unique_local_vertices.has(local_vertex): continue
				unique_local_vertices[local_vertex] = true
				vertices.append(mesh.global_transform * local_vertex)
		var missing := 0
		var lowest := INF
		var highest := -INF
		var contact := {}
		var closest_contact := {}
		var points: Array = []
		var probes: Array[Dictionary] = []
		var missing_indices: Array[int] = []
		var penetrated_indices: Array[int] = []
		for vertex_index in range(vertices.size()):
			var vertex: Vector3 = vertices[vertex_index]
			points.append(_xyz(vertex))
			var terrain := _terrain_support_ray(vertex)
			terrain["vertex_index"] = vertex_index
			probes.append(terrain)
			if not terrain.get("ready", false):
				missing += 1
				missing_indices.append(vertex_index)
				continue
			var clearance := float(terrain.clearance)
			if clearance < lowest: lowest = clearance; contact = terrain
			highest = maxf(highest, clearance)
			if closest_contact.is_empty() or absf(clearance) < absf(float(closest_contact.clearance)): closest_contact = terrain
			if clearance < -CONTACT_TOLERANCE: penetrated_indices.append(vertex_index)
		parts[part] = {"body_class": body.get_class(), "body_path": String(body.get_path()),
			"body_world_pose": _pose(body.global_transform), "mesh_world_pose": _pose(mesh.global_transform),
			"visible": mesh.is_visible_in_tree(), "removed": part in state.get("removed", []),
			"support_role": "anchored_authored_base" if part == "stump" and part not in state.get("broken", []) else "detached_fragment",
			"rigid_frozen": (body as RigidBody3D).freeze if body is RigidBody3D else true,
			"linear_velocity": _xyz((body as RigidBody3D).linear_velocity) if body is RigidBody3D else [0, 0, 0],
			"shapes": _enabled_shapes(body), "mesh_world_bounds": _bounds(vertices),
			"world_vertex_samples": points, "raw_vertex_count": raw_vertex_count, "unique_vertex_count": vertices.size(),
			"support_samples": vertices.size(), "missing_support_samples": missing,
			"terrain_probes": probes, "missing_vertex_indices": missing_indices, "penetrated_vertex_indices": penetrated_indices,
			"lowest_clearance": lowest if is_finite(lowest) else null, "highest_clearance": highest if is_finite(highest) else null,
			"lowest_contact": contact, "closest_ray_surface_contact": closest_contact,
			"first_entity_hit": _entity_first_hit(mesh, body), "own_shape_overlap": _own_shape_overlap(body)}
	return {"id": id, "registered": true, "frame": Engine.get_physics_frames(), "stage": support_stage,
		"original_world_pose": _pose(record.transform), "original_body": _enabled_shapes(record.body),
		"state_fallen": state.get("fallen", false), "state_cleared": state.get("cleared", false),
		"parts": parts, "busy": _support_busy(id), "vertex_sampling": "all_unique_mesh_vertices_all_surfaces"}

func _own_shape_overlap(expected: CollisionObject3D) -> Dictionary:
	# Read each actual enabled convex collision child, put a tiny query sphere at
	# its interior vertex centroid, and match the server result's RID AND owner.
	# Other world bodies remain in the query. Occlusion can hide a scene ray, but
	# cannot fabricate this collider/shape-specific physics-server overlap.
	var queries: Array[Dictionary] = []
	var all_matched := true
	for node: Node in expected.get_children():
		if not node is CollisionShape3D: continue
		var child := node as CollisionShape3D
		if child.disabled or child.shape == null: continue
		if not child.shape is ConvexPolygonShape3D:
			all_matched = false
			queries.append({"source_shape": String(child.get_path()), "matched_body_and_shape": false, "reason": "unsupported non-convex shape"})
			continue
		var source: PackedVector3Array = (child.shape as ConvexPolygonShape3D).points
		if source.is_empty():
			all_matched = false
			queries.append({"source_shape": String(child.get_path()), "matched_body_and_shape": false, "reason": "empty convex shape"})
			continue
		var centroid := Vector3.ZERO
		for point: Vector3 in source: centroid += point
		centroid /= float(source.size())
		var query_center: Vector3 = child.global_transform * centroid
		var probe := SphereShape3D.new()
		probe.radius = 0.025
		var query := PhysicsShapeQueryParameters3D.new()
		query.shape = probe
		query.transform = Transform3D(Basis.IDENTITY, query_center)
		query.collision_mask = 1
		query.collide_with_bodies = true
		query.collide_with_areas = false
		var hits: Array[Dictionary] = game.get_world_3d().direct_space_state.intersect_shape(query, 256)
		var evidence: Array[Dictionary] = []
		var matched := false
		for hit: Dictionary in hits:
			var detail := _collider_evidence(hit)
			var expected_rid: bool = hit.get("rid", RID()) == expected.get_rid()
			var expected_owner := false
			if expected_rid and int(hit.get("shape", -1)) >= 0:
				var owner_id: int = expected.shape_find_owner(int(hit.shape))
				expected_owner = expected.shape_owner_get_owner(owner_id) == child
			detail["matches_expected_rid"] = expected_rid
			detail["matches_expected_shape_owner"] = expected_owner
			evidence.append(detail)
			if expected_rid and expected_owner: matched = true
		queries.append({"source_shape": String(child.get_path()), "source_shape_pose": _pose(child.global_transform),
			"convex_vertex_count": source.size(), "interior_centroid": _xyz(query_center),
			"query_radius": probe.radius, "mask": 1, "excluded_rids": [], "max_results": 256,
			"result_count": hits.size(), "result_cap_reached": hits.size() == 256,
			"expected_body_rid": expected.get_rid().get_id(), "matched_body_and_shape": matched, "hits": evidence})
		all_matched = all_matched and matched
	return {"all_enabled_shapes_overlap": all_matched and not queries.is_empty(), "queries": queries}

func _assert_supported_geometry(snapshot: Dictionary, label: String) -> void:
	_check(snapshot.get("registered", false) and snapshot.get("state_fallen", false), label + " actual fractured entity is registered")
	_check(not snapshot.get("state_cleared", true) and not snapshot.get("parts", {}).is_empty(), label + " retains real fragment geometry")
	if not snapshot.get("registered", false): return
	_check(int(snapshot.original_body.enabled_child_shapes) == 0 and int(snapshot.original_body.enabled_backend_shapes) == 0, label + " original solid rock collider is inactive")
	for part: String in snapshot.parts:
		var detail: Dictionary = snapshot.parts[part]
		if detail.get("removed", false): continue
		_check(detail.visible and int(detail.shapes.enabled_child_shapes) > 0 and int(detail.shapes.enabled_backend_shapes) > 0, label + " enabled visible collision: " + part)
		_check(detail.own_shape_overlap.get("all_enabled_shapes_overlap", false), label + " real overlap identifies each enabled part collider RID and shape: " + part)
		_check(int(detail.support_samples) > 0 and int(detail.missing_support_samples) == 0, label + " all unique mesh vertices query loaded physical terrain: " + part)
		var clearance: Variant = detail.get("lowest_clearance")
		if detail.get("support_role") == "anchored_authored_base":
			# The authored base is the hull below local y=0.24 and intentionally
			# embeds into soil. It may penetrate, but must not hover after a crater.
			_check(clearance != null and float(clearance) <= CONTACT_TOLERANCE, label + " authored anchored base remains supported after terrain change: " + part)
		else:
			_check(clearance != null and absf(float(clearance)) <= CONTACT_TOLERANCE, label + " fragment contact neither floats nor penetrates terrain: " + part)
		_check(detail.rigid_frozen == true, label + " normal debris lifecycle settled: " + part)

func _compare_geometry(expected: Dictionary, actual: Dictionary, label: String) -> Dictionary:
	var deltas := {}
	_check(expected.get("parts", {}).keys().size() == actual.get("parts", {}).keys().size(), label + " same materialized part count")
	for part: String in expected.get("parts", {}):
		if not actual.get("parts", {}).has(part): _check(false, label + " missing fragment " + part); continue
		var before: Dictionary = expected.parts[part]
		var after: Dictionary = actual.parts[part]
		var displacement := _v3(before.mesh_world_pose.position).distance_to(_v3(after.mesh_world_pose.position))
		var vertex_error := 0.0
		var before_points: Array = before.world_vertex_samples
		var after_points: Array = after.world_vertex_samples
		if before_points.size() != after_points.size(): vertex_error = INF
		else:
			for i in range(before_points.size()): vertex_error = maxf(vertex_error, _v3(before_points[i]).distance_to(_v3(after_points[i])))
		var collision_error := INF
		if not before.shapes.world_hull_bounds.is_empty() and not after.shapes.world_hull_bounds.is_empty():
			collision_error = maxf(_v3(before.shapes.world_hull_bounds.position).distance_to(_v3(after.shapes.world_hull_bounds.position)), _v3(before.shapes.world_hull_bounds.size).distance_to(_v3(after.shapes.world_hull_bounds.size)))
		var support_error := INF
		if not before.lowest_contact.is_empty() and not after.lowest_contact.is_empty():
			support_error = _v3(before.lowest_contact.point).distance_to(_v3(after.lowest_contact.point))
		deltas[part] = {"mesh_origin_m": displacement, "max_unique_vertex_m": vertex_error if is_finite(vertex_error) else null,
			"collision_world_hull_m": collision_error if is_finite(collision_error) else null, "terrain_contact_m": support_error if is_finite(support_error) else null,
			"producer_body_pose": before.body_world_pose, "consumer_body_pose": after.body_world_pose,
			"body_origin_may_differ_due_to_rigid_center_offset": true}
		_check(displacement <= POSITION_TOLERANCE and vertex_error <= POSITION_TOLERANCE, label + " fragment visual world pose restored within 0.20m: " + part)
		_check(collision_error <= POSITION_TOLERANCE, label + " actual collision hull restored within 0.20m: " + part)
		_check(support_error <= POSITION_TOLERANCE, label + " loaded terrain contact matches producer within 0.20m: " + part)
	return deltas
