extends SceneTree

# Isolated recovery regression: never opens the player's normal native save.
const SLOT := "user://star_abyss_native_recovery_verify.json"
const BACKUP := SLOT + ".before-position-repair.bak"
var checks: Array[Dictionary] = []
var failures: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _check(name: String, ok: bool, detail: String = "") -> void:
	checks.append({"name": name, "pass": ok, "detail": detail})
	if not ok:
		failures.append(name + (": " + detail if not detail.is_empty() else ""))


func _run() -> void:
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	_cleanup_slot()
	var zero_fixture := _fixture(Vector3.ZERO, Vector3.ZERO, Vector3.ZERO)
	var zero_text := JSON.stringify(zero_fixture)
	_write_slot(zero_text)
	var recovered := await _spawn_game()
	var world := recovered.world
	_check("all-zero legacy save relocates player", absf(recovered.player.global_position.x) < 0.01 and absf(recovered.player.global_position.z - 190.0) < 0.01, str(recovered.player.global_position))
	_check("all-zero legacy save relocates skimmer", absf(recovered.skimmer.global_position.x - 72.0) < 0.01 and absf(recovered.skimmer.global_position.z - 80.0) < 0.01, str(recovered.skimmer.global_position))
	_check("all-zero legacy save relocates same riftwing", absf(recovered.beast.global_position.x - NativeRiftwing.HOME_X) < 0.01 and absf(recovered.beast.global_position.z - NativeRiftwing.HOME_Z) < 0.01, str(recovered.beast.global_position))
	_check("position repair preserves realm, health, energy and progression", _progress_intact(recovered), _progress_detail(recovered))
	_check("legacy save is backed up byte-for-byte", FileAccess.file_exists(BACKUP) and FileAccess.get_file_as_string(BACKUP) == zero_text)
	var repaired_file: Dictionary = _read_slot()
	_check("repair is persisted as nonzero positions", _all_three_nonzero(repaired_file), JSON.stringify(repaired_file.get("skimmer", [])))
	var walking_start := recovered.player.global_position
	recovered.player.set_physics_process(false)
	for i in range(18):
		recovered.player._step_ground(0.05, Vector2(0.0, 1.0), false, false)
	_check("repaired character actually walks on basin collision", walking_start.z - recovered.player.global_position.z > 1.5 and not world.is_solid_at(recovered.player.global_position, 0.42, 1.72), "from=" + str(walking_start) + " to=" + str(recovered.player.global_position))
	var valid_player := Vector3(-45.0, world.height_at(-45.0, 220.0), 220.0)
	var valid_skimmer := Vector3(90.0, world.height_at(90.0, 80.0), 80.0)
	var parked_height := world.height_at(72.0, 80.0)
	var valid_beast := Vector3(NativeRiftwing.HOME_X + 12.0, world.height_at(NativeRiftwing.HOME_X + 12.0, NativeRiftwing.HOME_Z), NativeRiftwing.HOME_Z)
	await _remove_game(recovered)

	_cleanup_slot()
	_write_slot(JSON.stringify(_fixture(valid_player, valid_skimmer, valid_beast)))
	var valid := await _spawn_game()
	_check("ordinary player location is not reset", _xz_close(valid.player.global_position, valid_player) and not valid.repaired_legacy_positions, str(valid.player.global_position))
	_check("ordinary skimmer and beast locations are not reset", _xz_close(valid.skimmer.global_position, valid_skimmer) and _xz_close(valid.beast.global_position, valid_beast), "car=" + str(valid.skimmer.global_position) + " beast=" + str(valid.beast.global_position))
	_check("ordinary save needs no repair backup", not FileAccess.file_exists(BACKUP))
	await _check_vehicle_exits(valid)
	await _remove_game(valid)

	_cleanup_slot()
	var parked := Vector3(72.0, parked_height, 80.0)
	_write_slot(JSON.stringify(_fixture(parked, parked, valid_beast)))
	var overlapped := await _spawn_game()
	var repaired_origin := overlapped.player.global_position
	_check("nonzero overlap is moved nearby, not sent to start", repaired_origin.distance_to(parked) > 1.0 and repaired_origin.distance_to(parked) <= 8.5 and repaired_origin.distance_to(overlapped.skimmer.global_position) > 1.0 and overlapped.repaired_legacy_positions, "recovered=" + str(repaired_origin))
	_check("overlap repair keeps progress and backs up original", _progress_intact(overlapped) and FileAccess.file_exists(BACKUP), _progress_detail(overlapped))
	await _remove_game(overlapped)

	_cleanup_slot()
	_write_slot(JSON.stringify(_fixture(valid_player, valid_skimmer, valid_beast)))
	var saving := await _spawn_game()
	saving.player.teleport_to_ground(-35.0, 225.0)
	saving.skimmer.global_position = Vector3(87.0, saving.world.height_at(87.0, 75.0), 75.0)
	saving.beast.global_position = Vector3(NativeRiftwing.HOME_X + 10.0, saving.world.height_at(NativeRiftwing.HOME_X + 10.0, NativeRiftwing.HOME_Z), NativeRiftwing.HOME_Z)
	var before_player := saving.player.global_position
	var before_skimmer := saving.skimmer.global_position
	var before_beast := saving.beast.global_position
	saving._save_game()
	var before_teardown := FileAccess.get_file_as_string(SLOT)
	await _remove_game(saving)
	var after_teardown := FileAccess.get_file_as_string(SLOT)
	_check("scene teardown does not overwrite saved transforms", not before_teardown.is_empty() and before_teardown == after_teardown)
	var reopened := await _spawn_game()
	_check("reloaded player position stays nonzero and unchanged", _xz_close(reopened.player.global_position, before_player), str(reopened.player.global_position))
	_check("reloaded vehicle and beast positions stay unchanged", _xz_close(reopened.skimmer.global_position, before_skimmer) and _xz_close(reopened.beast.global_position, before_beast), "car=" + str(reopened.skimmer.global_position) + " beast=" + str(reopened.beast.global_position))
	_check("save-reload still keeps progression", _progress_intact(reopened), _progress_detail(reopened))
	await _remove_game(reopened)
	_cleanup_slot()
	print("NATIVE_RECOVERY_JSON=" + JSON.stringify({"passed": checks.size() - failures.size(), "total": checks.size(), "failed": failures, "checks": checks}))
	quit(0 if failures.is_empty() else 1)


func _spawn_game() -> NativeMain:
	var game := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = SLOT
	root.add_child(game)
	await physics_frame
	await physics_frame
	await physics_frame
	return game


func _remove_game(game: NativeMain) -> void:
	game.queue_free()
	await process_frame


func _fixture(player_position: Vector3, skimmer_position: Vector3, beast_position: Vector3) -> Dictionary:
	return {"version": 1, "player": {"x": player_position.x, "y": player_position.y, "z": player_position.z, "realm": 7, "health": 60000.0, "energy": 37.0, "flight_active": false}, "riftwing": {"hp": 123456.0, "mode": "ground", "position": [beast_position.x, beast_position.y, beast_position.z], "loot_left": 0}, "ascension": {}, "skimmer": [skimmer_position.x, skimmer_position.y, skimmer_position.z], "fragments": 9, "investigated": ["beacon", "signal"]}


func _progress_intact(game: NativeMain) -> bool:
	return game.player.realm == 7 and absf(game.player.health - 60000.0) < 0.01 and absf(game.player.energy - 37.0) < 0.2 and absf(game.beast.hp - 123456.0) < 0.01 and game.fragments == 9 and game.investigated.has("beacon") and game.investigated.has("signal")


func _progress_detail(game: NativeMain) -> String:
	return "realm=" + str(game.player.realm) + " hp=" + str(game.player.health) + " energy=" + str(game.player.energy) + " beast_hp=" + str(game.beast.hp) + " fragments=" + str(game.fragments) + " investigated=" + JSON.stringify(game.investigated)


func _xz_close(a: Vector3, b: Vector3) -> bool:
	return absf(a.x - b.x) < 0.25 and absf(a.z - b.z) < 0.25


func _all_three_nonzero(data: Dictionary) -> bool:
	var p: Dictionary = data.get("player", {})
	var beast: Dictionary = data.get("riftwing", {})
	return absf(float(p.get("z", 0.0))) > 1.0 and absf(float(data.get("skimmer", [0.0, 0.0, 0.0])[0])) > 1.0 and absf(float(beast.get("position", [0.0, 0.0, 0.0])[0])) > 1.0


func _check_vehicle_exits(game: NativeMain) -> void:
	game.skimmer.global_position = Vector3(72.0, game.world.height_at(72.0, 80.0), 80.0)
	game.skimmer.rotation.y = 0.0
	var reached := game.player.teleport_to_ground(72.0, 84.4)
	_check("driver can reach parked skimmer safely", reached)
	game._toggle_vehicle()
	_check("driver mounts real skimmer", game.mounted)
	var right := _add_blocker(game, "right", game.skimmer.global_position + Vector3(2.8, 0.0, 0.0))
	await physics_frame
	game._toggle_vehicle()
	_check("blocked right door chooses left side", not game.mounted and game.player.global_position.x < game.skimmer.global_position.x - 2.0 and not game.player.visible == false, "player=" + str(game.player.global_position))
	game._toggle_vehicle()
	_check("driver remounts for blocked-all-sides probe", game.mounted)
	var left := _add_blocker(game, "left", game.skimmer.global_position + Vector3(-2.8, 0.0, 0.0))
	var back := _add_blocker(game, "back", game.skimmer.global_position + Vector3(0.0, 0.0, 3.4))
	var front := _add_blocker(game, "front", game.skimmer.global_position + Vector3(0.0, 0.0, -3.4))
	await physics_frame
	game._toggle_vehicle()
	_check("all four blocked exits retain mounted state", game.mounted and not game.player.visible and not game.player.is_physics_processing(), "mounted=" + str(game.mounted) + " exit=" + str(game._vehicle_exit_position()))
	for blocker in [right, left, back, front]:
		blocker.queue_free()
	await process_frame


func _add_blocker(game: NativeMain, label: String, ground_point: Vector3) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.name = "QAExitBlocker_" + label
	body.collision_layer = 1
	body.collision_mask = 1
	var shape := BoxShape3D.new()
	shape.size = Vector3(1.4, 2.2, 1.4)
	var collider := CollisionShape3D.new()
	collider.shape = shape
	body.add_child(collider)
	game.add_child(body)
	body.global_position = Vector3(ground_point.x, game.world.height_at(ground_point.x, ground_point.z) + 1.1, ground_point.z)
	return body


func _write_slot(contents: String) -> void:
	var file := FileAccess.open(SLOT, FileAccess.WRITE)
	if file == null:
		push_error("QA save fixture could not be written")
		return
	file.store_string(contents)
	file.flush()


func _read_slot() -> Dictionary:
	var raw: Variant = JSON.parse_string(FileAccess.get_file_as_string(SLOT))
	return raw if raw is Dictionary else {}


func _cleanup_slot() -> void:
	for path in [SLOT, BACKUP]:
		if FileAccess.file_exists(path):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
