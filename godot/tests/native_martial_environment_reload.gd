extends "res://tests/native_martial_environment_runtime.gd"
## Launch only after the producer Godot process exited. No direct import_state,
## no disabled physics, no fabricated destruction marker, no manual skill step.
func _run() -> void:
	capture = "--capture" in OS.get_cmdline_user_args()
	var fixture_value: Variant = JSON.parse_string(FileAccess.get_file_as_string(OUT + "/cross-process-fixture.json"))
	if not fixture_value is Dictionary:
		push_error("Missing producer fixture; run native_martial_environment_runtime in a separate process first")
		quit(1)
		return
	var fixture: Dictionary = fixture_value
	if not fixture.get("complete", false):
		push_error("Producer did not complete successfully; stale or incomplete handoff is rejected")
		quit(1)
		return
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
	await _frames(6, "cross-process-reloaded-crater")
	var report := {"producer_pid": fixture.producer_pid, "consumer_pid": OS.get_process_id(), "checks": checks,
		"failed": failed, "generation": environment.GENERATION, "state": state, "initial_cooldown": initial_cooldown,
		"actual_ray": str(hit), "crater_ray": str(crater_hit), "restored_crater_depth": restored_depth, "producer_crater_depth": fixture.crater_depth, "standing_collision_layer": record.body.collision_layer, "enabled_standing_shapes": active_standing_shapes, "physics_frame": Engine.get_physics_frames(),
		"scope": "Real R destruction in prior OS process, then unmodified Main disk restore and authored fixture registration here. Natural ecology distribution is separate."}
	var output := FileAccess.open(OUT + "/cross-process-reload-verification.json", FileAccess.WRITE)
	output.store_string(JSON.stringify(report, "\t"))
	print("MARTIAL_CROSS_PROCESS_RESULT ", JSON.stringify({"checks": checks.size(), "failed": failed, "producer_pid": fixture.producer_pid, "consumer_pid": OS.get_process_id()}))
	game.initialized = false
	game.queue_free()
	await process_frame
	quit(0 if failed.is_empty() else 1)
