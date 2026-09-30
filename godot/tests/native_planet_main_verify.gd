extends SceneTree

## Scene integration and save migration fixture. Far positions are injected to
## test persistence; this does not claim manual traversal or input feel.
var failures: Array[String] = []
var checks := 0
var slot := ""

func _initialize() -> void:
	call_deferred("_run")

func _check(name: String, passed: bool) -> void:
	checks += 1
	print(("PASS: " if passed else "FAIL: ") + name)
	if not passed:
		failures.append(name)

func _make_main() -> NativeMain:
	var main := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	main.save_path = slot
	root.add_child(main)
	return main

func _read_save() -> Dictionary:
	var file := FileAccess.open(slot, FileAccess.READ)
	if file == null:
		return {}
	var data: Variant = JSON.parse_string(file.get_as_text())
	return data if data is Dictionary else {}

func _write_save(data: Dictionary) -> void:
	var file := FileAccess.open(slot, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(data))
		file.flush()

func _wait_surface(main: NativeMain, near: Vector3) -> Dictionary:
	for i in range(720):
		main.world.update_stream(near)
		var sample: Dictionary = main.world.surface_at(near)
		if sample.get("ready", false) == true:
			return sample
		await physics_frame
	return {}

func _wait_restore(main: NativeMain) -> bool:
	for i in range(720):
		if main.pending_planet_restore.is_empty():
			return not main.save_blocked
		await physics_frame
	return false

func _run() -> void:
	slot = "user://star_abyss_planet_main_verify_%d.json" % Time.get_ticks_usec()
	var main := _make_main()
	for i in range(4):
		await physics_frame
	_check("planet world active", main.world.get("planet_enabled") == true)
	main.fragments = 9
	main.investigated = ["beacon", "signal"]
	main._save_game()
	var legacy := _read_save()
	_check("new save has additive planet envelope", legacy.get("planet") is Dictionary)
	legacy.erase("planet")
	var beast_data: Dictionary = legacy.get("riftwing", {})
	beast_data["hp"] = 0.0
	beast_data["mode"] = "dead"
	beast_data["loot_left"] = 1
	legacy["riftwing"] = beast_data
	main.queue_free()
	await process_frame
	_write_save(legacy)
	main = _make_main()
	for i in range(5):
		await physics_frame
	_check("old basin save restores inventory and investigations", main.fragments == 9 and main.investigated.has("beacon") and main.investigated.has("signal"))
	_check("old basin save preserves consumed enemy state", main.beast.mode == "dead" and main.beast.loot_left == 1)
	main._save_game()
	var migrated := _read_save()
	_check("old save migrates without losing root fields", migrated.get("planet") is Dictionary and migrated.get("fragments") == 9 and migrated.get("investigated", []).size() == 2)
	var f2 := InputEventKey.new()
	f2.physical_keycode = KEY_F2
	f2.pressed = true
	main._input(f2)
	for i in range(120):
		if main.pending_duel_action.is_empty() and main.player.global_position.distance_to(Vector3(1370.0, main.world.height_at(1370.0, -1022.0), -1022.0)) < 5.0:
			break
		await physics_frame
	_check("F2 streams real arena collider then teleports", main.pending_duel_action.is_empty() and main.player.global_position.distance_to(Vector3(1370.0, main.world.height_at(1370.0, -1022.0), -1022.0)) < 5.0)

	for destination in [
		{"name": "back hemisphere", "lat": 0.05, "lon": PI},
		{"name": "near north pole", "lat": PI * 0.5 - 0.02, "lon": 1.3},
	]:
		var canonical: Dictionary = NativePlanetCoordinates.to_cartesian(float(destination["lat"]), float(destination["lon"]))
		var rough: Vector3 = NativePlanetCoordinates.canonical_to_local(canonical, NativePlanetCoordinates.tangent_frame())
		main.player.set_physics_process(false)
		main.player.global_position = rough + main.world.up_at(rough) * 500.0
		var surface: Dictionary = await _wait_surface(main, rough)
		var name: String = destination["name"]
		_check(name + " rendered collision ready", not surface.is_empty())
		if surface.is_empty():
			break
		var air_clearance := maxf(500.0, float(surface.get("water_depth", 0.0)) + 50.0)
		var air_point: Vector3 = surface["point"] + main.world.up_at(surface["point"]) * air_clearance
		main.player.global_position = air_point
		main.player.flight_active = true
		main.player.velocity = Vector3.ZERO
		main.skimmer.global_position = surface["point"]
		main._save_game()
		var far_save := _read_save()
		var far_planet: Dictionary = far_save.get("planet", {})
		var root_player: Dictionary = far_save.get("player", {})
		_check(name + " save stores canonical player and skimmer", far_planet.get("position") is Dictionary and far_planet.get("skimmer") is Dictionary)
		_check(name + " root player remains a legacy safe pose", absf(float(root_player.get("x", INF))) < 3000.0 and absf(float(root_player.get("z", INF))) < 3000.0)
		main.queue_free()
		await process_frame
		main = _make_main()
		var restored := await _wait_restore(main)
		_check(name + " reload resolves real surface", restored)
		if not restored:
			print("RESTORE_DIAGNOSTIC: ", name, " frames=", main.pending_restore_frames, " blocked=", main.save_blocked, " expected=", air_point, " support=", JSON.stringify(main.world.surface_at(air_point)), " player_support=", JSON.stringify(main.player._planet_support(air_point)), " clear=", main.player._destination_clear(air_point))
			break
		_check(name + " reload keeps position and vehicle", main.player.global_position.distance_to(air_point) < 3.0 and main.skimmer.global_position.distance_to(surface["point"]) < 3.0)
		_check(name + " reload keeps flight state", main.player.flight_active)
		_check(name + " reload keeps progression", main.fragments == 9 and main.investigated.size() == 2 and main.beast.mode == "dead" and main.beast.loot_left == 1)
		for i in range(3):
			await physics_frame
	main._reset_duel()
	for i in range(120):
		if main.pending_duel_action.is_empty() and main.player.global_position.distance_to(Vector3(1370.0, main.world.height_at(1370.0, -1022.0), -1022.0)) < 5.0:
			break
		await physics_frame
	_check("F3 returns from pole and resets training beast without loot", main.pending_duel_action.is_empty() and main.player.global_position.distance_to(Vector3(1370.0, main.world.height_at(1370.0, -1022.0), -1022.0)) < 5.0 and main.beast.hp == main.beast.max_hp and main.beast.loot_left == 0 and main.training_enemy_slots.has(-1))
	main.queue_free()
	await process_frame
	DirAccess.remove_absolute(ProjectSettings.globalize_path(slot))
	print(JSON.stringify({"passed": checks - failures.size(), "total": checks, "failed": failures}))
	quit(0 if failures.is_empty() else 1)
