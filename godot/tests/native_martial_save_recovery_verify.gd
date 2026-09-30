extends SceneTree
## Real Main scenes and FileAccess storage; never opens the user's game slot.
## Run only after the shared project parses:
## godot --headless --path godot --script res://tests/native_martial_save_recovery_verify.gd
## This verifies persistence, not animation, destruction visuals, or frame rate.
const USER_PREFIX := "user://martial_r4_verify_recovery_"
const REPORT := "res://reports/martial-r4/save-recovery-verification.json"
const MARKER := "recovery-test-unstreamed-entity"
const MAIN_HEALTH := 73.5
const STALE_HEALTH := 11.25
const SAVED_BREAK_CD := 5.75
const SAVED_FIST_CD := 2.25

var game: NativeMain
var checks: Array[Dictionary] = []
var failed: Array[String] = []
var slots: Array[String] = []
var prefix := ""
var golden: Dictionary = {}


func _initialize() -> void:
	prefix = USER_PREFIX + "%d_%d" % [OS.get_process_id(), Time.get_ticks_usec()]
	call_deferred("_run")


func _check(ok: bool, label: String, details: Dictionary = {}) -> bool:
	checks.append({"ok": ok, "label": label, "details": details})
	print("PASS: " if ok else "FAIL: ", label)
	if not ok:
		failed.append(label)
	return ok


func _slot(label: String) -> String:
	var path := prefix + "_" + label + ".json"
	slots.append(path)
	return path


func _write_text(path: String, text: String) -> bool:
	if not _check(path.begins_with(prefix) and not path.contains(".."), "fixture write remains in this run's private prefix", {"path": path}):
		return false
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		return _check(false, "fixture file opens", {"path": path, "error": FileAccess.get_open_error()})
	file.store_string(text)
	file.flush()
	var error := file.get_error()
	file.close()
	return _check(error == OK, "fixture file flushes", {"path": path, "error": error})


func _write_json(path: String, value: Variant) -> bool:
	return _write_text(path, JSON.stringify(value))


func _read_dict(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	return parsed if parsed is Dictionary else {}


func _hash(path: String) -> String:
	return FileAccess.get_sha256(path) if FileAccess.file_exists(path) else ""


func _environment() -> Node:
	return get_first_node_in_group("native_environment_damage")


func _marker_health(envelope: Dictionary) -> float:
	var entities: Variant = envelope.get("entities", {})
	if not entities is Dictionary:
		return -1.0
	var state: Variant = entities.get(MARKER, {})
	if not state is Dictionary or not state.get("health") is Dictionary:
		return -1.0
	return float(state.health.get("trunk", -1.0))


func _environment_with_marker(source: Dictionary, health: float) -> Dictionary:
	# Preserve the live service's version, generation, seed and slot identity.
	# The valid unstreamed record isolates serialization from asset/AI motion;
	# this fixture does not claim to prove actual tree damage.
	var result := source.duplicate(true)
	var states: Dictionary = result.get("entities", {}).duplicate(true)
	states[MARKER] = {"health": {"trunk": health}, "broken": [], "poses": {}, "fallen": false}
	result["entities"] = states
	return result


func _boot(path: String) -> bool:
	if not _check(game == null and _environment() == null, "previous Main and environment are absent before boot"):
		return false
	var scene := load("res://scenes/main.tscn") as PackedScene
	if not _check(scene != null, "real Main scene loads"):
		return false
	game = scene.instantiate() as NativeMain
	if not _check(game != null, "real NativeMain instantiates"):
		return false
	game.save_path = path
	root.add_child(game)
	# Ready/restore runs normally. Disable periodic saves and combatants while
	# waiting for real terrain restoration, without replacing any save method.
	game.save_clock = -1000000.0
	game.martial.set_physics_process(false)
	game.beast.set_physics_process(false)
	for enemy in game.enemies:
		enemy.set_physics_process(false)
	game.camp_npc.set_physics_process(false)
	var settled := false
	for frame in range(900):
		await physics_frame
		if frame < 3:
			continue
		if game.initialized and (game.save_blocked or (game.pending_planet_restore.is_empty() and game.player.is_physics_processing())):
			settled = true
			break
	game.set_physics_process(false)
	game.player.set_physics_process(false)
	return _check(settled, "Main initialization and restore finish", {"slot": path, "save_blocked": game.save_blocked})


func _dispose() -> void:
	if game == null:
		return
	var old_id := game.get_instance_id()
	# Explicitly prevent close/teardown paths from mutating any test fixture.
	game.initialized = false
	game.set_process_input(false)
	game.queue_free()
	game = null
	await process_frame
	await process_frame
	_check(not is_instance_id_valid(old_id) and _environment() == null, "Main unload completes before next instance")


func _run() -> void:
	var baseline_slot := _slot("baseline")
	if not await _boot(baseline_slot):
		await _finish()
		return
	var environment := _environment()
	if not _check(not game.save_blocked and environment != null, "fresh private scene has a writable environment service"):
		await _finish()
		return
	var live_envelope: Dictionary = environment.call("export_state")
	var seeded := _environment_with_marker(live_envelope, MAIN_HEALTH)
	var seed_error: int = environment.call("import_state", seeded)
	if not _check(seed_error == OK, "live service accepts a schema-valid persistence marker", {"error": seed_error}):
		await _finish()
		return
	game.martial.selected = "break"
	game.martial.cooldowns = {"fist": SAVED_FIST_CD, "break": SAVED_BREAK_CD}
	game.fragments = 73
	game._save_game()
	golden = _read_dict(baseline_slot)
	var baseline_ok := game.last_save_error == OK and golden.get("environment_state") is Dictionary and golden.get("surface_impacts") is Dictionary
	if not _check(baseline_ok, "real Main creates the valid baseline and both inline envelopes", {"error": game.last_save_error}):
		await _finish()
		return
	var main_hash := _hash(baseline_slot)
	await _dispose()
	_check(_hash(baseline_slot) == main_hash, "unload does not rewrite the baseline")

	# A newer/older sidecar with the same identity must never replace the main
	# snapshot. Full node destruction/re-instantiation also checks binding order.
	var stale := _environment_with_marker(golden.environment_state, STALE_HEALTH)
	if not _write_json(baseline_slot + ".environment-r4.json", stale):
		await _finish()
		return
	if not await _boot(baseline_slot):
		await _finish()
		return
	_check(not game.save_blocked, "full scene reload accepts the committed main snapshot")
	_check(game.martial.selected == "break" and is_equal_approx(float(game.martial.cooldowns.get("break", -1.0)), SAVED_BREAK_CD) and is_equal_approx(float(game.martial.cooldowns.get("fist", -1.0)), SAVED_FIST_CD), "full scene reload preserves selected skill and cooldowns")
	environment = _environment()
	var restored_environment: Dictionary = environment.call("export_state") if environment != null else {}
	_check(is_equal_approx(_marker_health(restored_environment), MAIN_HEALTH), "full reload uses same-commit environment instead of stale sidecar")
	_check(game.environment_slot_identity == String(golden.environment_slot) and restored_environment.get("slot_identity") == golden.environment_slot, "main and environment retain the same slot identity")
	await _dispose()

	await _verify_backup_recovery()
	await _verify_double_corruption()
	for case in [{"name": "empty_object", "value": {}}, {"name": "null", "value": null}, {"name": "array", "value": []}]:
		await _verify_invalid_inline(String(case.name), case.value)
	await _verify_invalid_surface()
	await _verify_f5_failure()
	await _finish()


func _verify_backup_recovery() -> void:
	var path := _slot("backup")
	if not _write_json(path + ".bak", golden) or not _write_text(path, "{truncated primary"):
		return
	var valid_hash := _hash(path + ".bak")
	var corrupt_hash := _hash(path)
	if not await _boot(path):
		await _dispose()
		return
	_check(not game.save_blocked and game.fragments == int(golden.fragments), "bad primary restores actual progression from valid backup")
	_check(_hash(path + ".recovered-valid.bak") == valid_hash and _hash(path + ".invalid-original.bak") == corrupt_hash, "recovery preserves both valid backup and original bad bytes")
	game.fragments += 1
	game._save_game()
	var committed := _read_dict(path)
	_check(game.last_save_error == OK and int(committed.get("fragments", -1)) == int(golden.fragments) + 1, "first post-recovery save commits the restored game")
	_check(_hash(path + ".bak") == valid_hash and not _read_dict(path + ".bak").is_empty(), "first post-recovery save keeps verified backup hash unchanged")
	await _dispose()
	if await _boot(path):
		_check(not game.save_blocked and game.fragments == int(golden.fragments) + 1, "post-recovery commit survives another complete scene reload")
	await _dispose()


func _verify_double_corruption() -> void:
	var path := _slot("double_bad")
	if not _write_text(path, "{bad primary") or not _write_text(path + ".bak", "[bad backup"):
		return
	var primary_hash := _hash(path)
	var backup_hash := _hash(path + ".bak")
	if await _boot(path):
		_check(game.save_blocked, "both unreadable candidates block saving")
		game._save_game()
		_check(game.last_save_error != OK and _hash(path) == primary_hash and _hash(path + ".bak") == backup_hash, "blocked save preserves both corrupt candidates byte-for-byte")
	await _dispose()
	_check(_hash(path) == primary_hash and _hash(path + ".bak") == backup_hash, "double-corrupt files also survive teardown unchanged")


func _verify_invalid_inline(label: String, value: Variant) -> void:
	var path := _slot("inline_" + label)
	var fixture := golden.duplicate(true)
	fixture["environment_state"] = value
	var sidecar := _environment_with_marker(golden.environment_state, STALE_HEALTH)
	if not _write_json(path, fixture) or not _write_json(path + ".environment-r4.json", sidecar):
		return
	var primary_hash := _hash(path)
	var sidecar_hash := _hash(path + ".environment-r4.json")
	if await _boot(path):
		_check(game.save_blocked, "explicit invalid inline " + label + " cannot fall back to a valid old sidecar")
		game._save_game()
		_check(game.last_save_error != OK and _hash(path) == primary_hash and _hash(path + ".environment-r4.json") == sidecar_hash, "invalid inline " + label + " preserves main and mirror bytes")
	await _dispose()


func _verify_invalid_surface() -> void:
	var path := _slot("surface_bad")
	var fixture := golden.duplicate(true)
	# Keep the real planet/version envelope; corrupt only a record's unit normal.
	var surface: Dictionary = fixture.surface_impacts.duplicate(true)
	surface["records"] = [{"id": "recovery-invalid-center", "center": [0.0, 0.0, 0.0], "radius": 6.0, "depth": 1.0}]
	fixture["surface_impacts"] = surface
	if not _write_json(path, fixture):
		return
	var primary_hash := _hash(path)
	if await _boot(path):
		_check(game.save_blocked, "malformed surface record blocks saving with a valid planet envelope")
		game._save_game()
		_check(game.last_save_error != OK and _hash(path) == primary_hash, "bad surface state remains untouched after attempted save")
	await _dispose()


func _verify_f5_failure() -> void:
	var path := _slot("f5")
	if not _write_json(path, golden) or not _write_json(path + ".environment-r4.json", golden.environment_state):
		return
	if not await _boot(path):
		await _dispose()
		return
	var primary_hash := _hash(path)
	var sidecar_hash := _hash(path + ".environment-r4.json")
	var blocker := _slot("f5_parent_is_file")
	if not _write_text(blocker, "A regular file makes the descendant save path unwritable."):
		await _dispose()
		return
	game.save_path = blocker + "/main.json"
	game.message = "F5 failure probe has not run"
	var press := InputEventKey.new()
	press.physical_keycode = KEY_F5
	press.keycode = KEY_F5
	press.pressed = true
	root.push_input(press)
	var release := InputEventKey.new()
	release.physical_keycode = KEY_F5
	release.keycode = KEY_F5
	root.push_input(release)
	await process_frame
	_check(game.last_save_error != OK, "real F5 input reports an actual FileAccess write failure", {"error": game.last_save_error})
	_check(game.message.contains("失败") and not game.message.contains("已保存"), "F5 write failure does not show a success notice", {"notice": game.message})
	_check(_hash(path) == primary_hash and _hash(path + ".environment-r4.json") == sidecar_hash, "failed F5 leaves original main and environment mirror unchanged")
	await _dispose()


func _finish() -> void:
	await _dispose()
	var report := {"checks": checks, "failed": failed, "private_slots": slots, "fixture_prefix": prefix, "physics_frame": Engine.get_physics_frames(), "limitations": "Real scene/store lifecycle only; valid unstreamed environment marker isolates persistence. No visual, combat, or environment destruction acceptance."}
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(REPORT.get_base_dir()))
	var file := FileAccess.open(REPORT, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t"))
		file.close()
	else:
		failed.append("report file cannot be written")
	print("MARTIAL_SAVE_RECOVERY_RESULT ", JSON.stringify(report))
	quit(0 if failed.is_empty() else 1)
