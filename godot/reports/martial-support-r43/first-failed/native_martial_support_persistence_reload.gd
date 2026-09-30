extends "res://tests/native_martial_support_persistence_runtime.gd"
## Launch only after the producer Godot process exited. No direct import_state,
## no disabled physics, no fabricated destruction marker, no manual skill step.
func _run() -> void:
	frozen_start = _frozen_hashes()
	support_stage = "consumer-reloaded-support"
	_check(frozen_start == FROZEN_SOURCES, "support consumer uses exact frozen 681/73e ecology sources")
	capture = "--capture" in OS.get_cmdline_user_args()
	var fixture_value: Variant = JSON.parse_string(FileAccess.get_file_as_string(SUPPORT_OUT + "/cross-process-fixture.json"))
	if not fixture_value is Dictionary:
		push_error("Missing producer fixture; run native_martial_support_persistence_runtime in a separate process first")
		quit(1)
		return
	var fixture: Dictionary = fixture_value
	if not fixture.get("complete", false):
		push_error("Producer did not complete successfully; stale or incomplete handoff is rejected")
		quit(1)
		return
	if int(fixture.get("support_schema", 0)) != 1 or not fixture.get("support_fixtures") is Dictionary:
		push_error("Missing geometry handoff; original state-only artifact is not accepted by support-r43")
		quit(1)
		return
	_check(fixture.get("source_sha256", {}) == frozen_start, "producer and consumer use the same frozen ecology code")
	_check(int(fixture.producer_pid) != OS.get_process_id(), "consumer is a distinct Godot operating-system process")
	_check(String(fixture.slot) == REOPEN_SLOT, "consumer uses only the fixed private cross-process test slot")
	_check(FileAccess.get_sha256(REOPEN_SLOT) == String(fixture.main_sha256), "consumer opens the exact producer save bytes")
	game = (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = REOPEN_SLOT
	root.add_child(game)
	environment = get_first_node_in_group("native_environment_damage") as NativeEnvironmentDamage
	var initial_cooldown: Dictionary = game.martial.snapshot()
	_check(not game.save_blocked and environment.GENERATION == String(fixture.generation), "actual Main accepts producer generation and complete inline envelope")
	var point := Vector3(float(fixture.position[0]), float(fixture.position[1]), float(fixture.position[2]))
	var record := _add_entity(String(fixture.id), String(fixture.key), Vector3.ZERO, String(fixture.kind), point)
	Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)
	await _frames(45, "cross-process-reloaded-tree")
	var state: Dictionary = environment.states.get(String(fixture.id), {})
	_check(state.get("fallen", false) and fixture.expected_state.get("fallen", false), "real R-produced fallen state survives OS process restart")
	var active_standing_shapes := 0
	for child in record.body.get_children():
		if child is CollisionShape3D and not child.disabled:
			active_standing_shapes += 1
	_check(int(record.body.collision_layer) == 0 or active_standing_shapes == 0, "original standing trunk collider is inactive again after process restart")
	var ray := PhysicsRayQueryParameters3D.create(point + Vector3(-2, 1.4, 0), point + Vector3(2, 1.4, 0), 1, [game.player.get_rid()])
	var hit := game.player.get_world_3d().direct_space_state.intersect_ray(ray)
	_check(hit.get("collider") != record.body, "physical ray cannot hit the restored original standing trunk")
	_check(not record.get("part_nodes", {}).is_empty(), "saved fallen authored mesh and replacement bodies materialize")
	_check(initial_cooldown.selected == fixture.cooldown.selected, "selected martial skill restores across OS processes")
	for kind in fixture.cooldown.cooldowns:
		_check(absf(float(initial_cooldown.cooldowns.get(kind, 0.0)) - float(fixture.cooldown.cooldowns[kind])) < 0.1, "saved skill cooldown restores before elapsed physics: " + String(kind))
	_check(fixture.cooldown.cooldowns.values().any(func(value): return float(value) > 0.0) and initial_cooldown.cooldowns.values().any(func(value): return float(value) > 0.0), "consumer actually restores a nonzero remaining skill cooldown")
	_check(environment.states.get("martial-rock", {}) == fixture.expected_rock_state, "real R-produced fractured-rock state survives process restart")
	var crater_origin := Vector3(float(fixture.crater_origin[0]), float(fixture.crater_origin[1]), float(fixture.crater_origin[2]))
	var up := game.world.up_at(crater_origin)
	var crater_hit: Dictionary = {}
	var restored_depth := -INF
	for i in range(600):
		await _frames(1)
		var crater_ray := PhysicsRayQueryParameters3D.create(crater_origin + up * 8.0, crater_origin - up * 8.0, NativeWorld.LEGACY_TERRAIN_QUERY_LAYER, [game.player.get_rid()])
		crater_hit = game.player.get_world_3d().direct_space_state.intersect_ray(crater_ray)
		if not crater_hit.is_empty():
			restored_depth = (crater_origin - crater_hit.position).dot(up)
			if restored_depth > 0.5 and absf(restored_depth - float(fixture.crater_depth)) < 0.2:
				break
	_check(game.world.snapshot_deformations().get("records", []).size() == fixture.deformations.records.size() and fixture.deformations.records.size() == 1, "one actual strike record survives process restart")
	_check(restored_depth > 0.5 and absf(restored_depth - float(fixture.crater_depth)) < 0.2, "real terrain collider restores the saved crater depth across OS processes")
	# The same authored assets are now physically recreated at BOTH original
	# positions. Main already restored disk state; register_entity performs its
	# normal support queue and dynamic settlement against the reloaded crater.
	var actual_support := {}
	var geometry_deltas := {}
	for id: String in ROCK_IDS:
		var original: Dictionary = fixture.support_fixtures.get(id, {})
		if original.is_empty() or not original.has("settled_after_crater"):
			_check(false, "producer supplied origin/key/geometry for " + id)
			continue
		var original_point := _v3(original.original_position)
		var registered := _add_entity(id, String(original.key), Vector3.ZERO, "outcrop", original_point)
		_check((registered.transform as Transform3D).origin.distance_to(original_point) < 0.0001, "same original rock position is re-registered: " + id)
		await _wait_support_settled(id, "consumer support after actual Main restore")
		var geometry := _entity_geometry(id)
		actual_support[id] = geometry
		_assert_supported_geometry(geometry, "consumer reloaded " + id)
		geometry_deltas[id] = _compare_geometry(original.settled_after_crater, geometry, "cross-process " + id)
		await _frames(6, "support-reloaded-" + id)
	_check(environment.states.get("martial-impact-rock", {}).get("fallen", false), "actual impact-rock destruction also restores, not only the earlier R rock")
	await _frames(6, "cross-process-reloaded-crater")
	_check(_frozen_hashes() == frozen_start, "support consumer frozen ecology source hashes remain unchanged")
	var report := {"producer_pid": fixture.producer_pid, "consumer_pid": OS.get_process_id(), "checks": checks,
		"failed": failed, "generation": environment.GENERATION, "state": state, "initial_cooldown": initial_cooldown,
		"actual_ray": str(hit), "crater_ray": str(crater_hit), "restored_crater_depth": restored_depth, "producer_crater_depth": fixture.crater_depth, "standing_collision_layer": record.body.collision_layer, "enabled_standing_shapes": active_standing_shapes, "physics_frame": Engine.get_physics_frames(),
		"actual_support_geometry": actual_support, "producer_support_geometry": fixture.support_fixtures,
		"geometry_deltas": geometry_deltas, "support_waits": support_waits,
		"consumer_live_support_samples": live_support_samples, "producer_live_support_samples": fixture.get("live_support_samples", {}),
		"source_sha256_start": frozen_start, "source_sha256_end": _frozen_hashes(),
		"scope": "Producer caller fixtures reset realm/energy/position/cooldown and stopped AI. Consumer loads exact Main disk bytes, re-registers authored rocks at recorded original origins and waits normal support/debris physics. Rays query actual loaded terrain and each enabled fragment collider; no direct import_state or skill stepping. Not natural ecology end-to-end. Live motion is claimed only where live_support_samples contains observations."}
	var output := FileAccess.open(SUPPORT_OUT + "/cross-process-reload-verification.json", FileAccess.WRITE)
	output.store_string(JSON.stringify(report, "\t"))
	print("MARTIAL_SUPPORT_CONSUMER_RESULT ", JSON.stringify({"checks": checks.size(), "failed": failed, "producer_pid": fixture.producer_pid, "consumer_pid": OS.get_process_id()}))
	game.initialized = false
	game.queue_free()
	await process_frame
	quit(0 if failed.is_empty() else 1)
