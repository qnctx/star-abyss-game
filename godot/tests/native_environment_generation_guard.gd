extends SceneTree
## Cross-process version-protection probe. Run through the Python companion.
## Probe mode keeps real Main/Player/World physics and the 12-second save timer.
## No screenshots and no claim that the persistence marker proves tree damage.
const SLOT_PREFIX := "user://martial_r4_verify_generation_"
const MARKER := "generation-guard-unstreamed-state"

var game: NativeMain
var options: Dictionary = {}
var checks: Array[Dictionary] = []
var failures: Array[String] = []
var samples: Array[Dictionary] = []
var report: Dictionary = {}
var slot := ""
var expected_generation := "ecology-r4.2"
var old_generation := "ecology-r4.1"
var warning_phrase := "环境未恢复"


func _initialize() -> void:
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--guard-") and argument.contains("="):
			var split := argument.find("=")
			options[argument.substr(8, split - 8)] = argument.substr(split + 1)
	slot = String(options.get("slot", ""))
	expected_generation = String(options.get("expected-generation", expected_generation))
	old_generation = String(options.get("old-generation", old_generation))
	warning_phrase = String(options.get("warning", warning_phrase))
	call_deferred("_run")


func _check(ok: bool, label: String, details: Dictionary = {}) -> bool:
	checks.append({"ok": ok, "label": label, "details": details})
	print("PASS: " if ok else "FAIL: ", label)
	if not ok:
		failures.append(label)
	return ok


func _read_dict(path: String) -> Dictionary:
	var value: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	return value if value is Dictionary else {}


func _write_json(path: String, value: Dictionary) -> bool:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		return _check(false, "test output opens", {"path": path, "error": FileAccess.get_open_error()})
	file.store_string(JSON.stringify(value, "\t"))
	file.flush()
	var error := file.get_error()
	file.close()
	return _check(error == OK, "test output flushes", {"path": path, "error": error})


func _write_report() -> void:
	report.merge({"mode": options.get("mode", ""), "pid": OS.get_process_id(), "slot": slot, "expected_generation": expected_generation, "old_generation": old_generation, "checks": checks, "failed": failures, "samples": samples, "limitations": "Generation and storage protection only. The valid unstreamed state marker does not prove physical tree destruction."}, true)
	var path := String(options.get("report", ""))
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		push_error("Generation guard cannot write report: " + path)
		return
	file.store_string(JSON.stringify(report, "\t"))
	file.flush()
	file.close()


func _environment() -> Node:
	return get_first_node_in_group("native_environment_damage")


func _boot() -> bool:
	var scene := load("res://scenes/main.tscn") as PackedScene
	if not _check(scene != null, "real Main resource loads"):
		return false
	game = scene.instantiate() as NativeMain
	if not _check(game != null, "real NativeMain instantiates"):
		return false
	game.save_path = slot
	root.add_child(game)
	# Do not disable physics or modify save_clock: auto-save is part of the test.
	var settled := false
	for frame in range(1500):
		await physics_frame
		if frame < 3:
			continue
		if game.initialized and game.pending_planet_restore.is_empty() and game.player.is_physics_processing():
			settled = true
			break
	return _check(settled, "real player/world restoration settles under normal physics")


func _run() -> void:
	if not _check(slot.begins_with(SLOT_PREFIX) and slot.ends_with(".json") and not slot.contains("..") and not String(options.get("report", "")).is_empty(), "private fixture slot and report arguments are explicit"):
		_write_report()
		quit(1)
		return
	if not _check(old_generation != expected_generation and not old_generation.is_empty(), "fixture generation is intentionally incompatible"):
		_write_report()
		quit(1)
		return
	if options.get("mode") == "seed":
		await _seed()
	elif options.get("mode") == "probe":
		await _probe()
	else:
		_check(false, "known seed/probe mode is supplied")
		_write_report()
		quit(1)


func _seed() -> void:
	if not _check(not FileAccess.file_exists(slot) and not FileAccess.file_exists(slot + ".bak"), "seed refuses to reuse an existing slot") or not (await _boot()):
		_write_report()
		quit(1)
		return
	var environment := _environment()
	if not _check(environment != null and not game.save_blocked, "fresh current-generation game can save"):
		_write_report()
		quit(1)
		return
	var envelope: Dictionary = environment.call("export_state")
	if not _check(envelope.get("generation") == expected_generation, "deployed service generation matches the requested release", {"actual": envelope.get("generation")}):
		_write_report()
		quit(1)
		return
	var states: Dictionary = envelope.get("entities", {}).duplicate(true)
	states[MARKER] = {"health": {"trunk": 81.5}, "broken": [], "poses": {}, "fallen": false}
	envelope["entities"] = states
	if not _check(int(environment.call("import_state", envelope)) == OK, "current service accepts the valid persistence-only marker"):
		_write_report()
		quit(1)
		return
	game.player.realm = 6
	game.fragments = 217
	var site_id := String(NativeMain.SITES[0].id)
	if not game.investigated.has(site_id):
		game.investigated.append(site_id)
	game._save_game()
	var baseline := _read_dict(slot)
	if not _check(game.last_save_error == OK and baseline.get("environment_state") is Dictionary, "real Main writes the baseline with a legal inline environment"):
		_write_report()
		quit(1)
		return
	report["progress"] = {"realm": int(baseline.player.realm), "fragments": int(baseline.fragments), "investigated": baseline.investigated, "environment_slot": baseline.environment_slot}
	# Only the seed phase dismantles its scene before authoring fault fixtures.
	# Probe mode below deliberately retains initialized=true through real close.
	game.initialized = false
	game.queue_free()
	game = null
	await process_frame
	await process_frame
	var old_main := baseline.duplicate(true)
	old_main.environment_state.generation = old_generation
	var mirror: Dictionary = old_main.environment_state.duplicate(true)
	var payloads := {"main": old_main, "backup": old_main, "mirror": mirror, "mirror_backup": mirror, "valid_current_source": baseline}
	var paths := {"main": slot, "backup": slot + ".bak", "mirror": slot + ".environment-r4.json", "mirror_backup": slot + ".environment-r4.json.bak", "valid_current_source": slot + ".valid-current.json"}
	var files := {}
	for label in paths:
		var path: String = paths[label]
		if _write_json(path, payloads[label]):
			files[label] = {"path": ProjectSettings.globalize_path(path), "sha256": FileAccess.get_sha256(path)}
	report["files"] = files
	_check(files.size() == paths.size(), "all original fixture bytes exist before the probe process")
	_write_report()
	quit(0 if failures.is_empty() else 1)


func _visible_labels() -> String:
	var content := ""
	for node in game.find_children("*", "Label", true, false):
		if node is Label and node.is_visible_in_tree():
			content += node.text + "\n"
	return content


func _protected_reason() -> String:
	for property in game.get_property_list():
		if String(property.get("name", "")) == "save_protected_reason":
			return str(game.get("save_protected_reason"))
	return ""


func _observe(stage: String, original_files: Dictionary) -> void:
	var environment := _environment()
	var exported: Dictionary = environment.call("export_state") if environment != null else {}
	var error := str(environment.get("state_error")) if environment != null else "missing_service"
	var visible := _visible_labels()
	var protected_reason := _protected_reason()
	var protected_text := visible.contains("保护") or visible.contains("禁止保存") or visible.contains("只读")
	_check(game.save_blocked, stage + ": Main stays save-protected")
	_check(not protected_reason.is_empty(), stage + ": public save_protected_reason remains available", {"save_protected_reason": protected_reason})
	_check(error.begins_with("environment_generation_mismatch:"), stage + ": mismatch reason remains explicit", {"state_error": error})
	_check(not exported.get("entities", {}).has(MARKER), stage + ": incompatible environment was not restored")
	_check(visible.contains(warning_phrase) and protected_text, stage + ": visible persistent HUD explains unrestored environment and save protection", {"visible_text": visible})
	var hashes := {}
	for label in original_files:
		var entry: Dictionary = original_files[label]
		var path := String(entry.path)
		var hash := FileAccess.get_sha256(path) if FileAccess.file_exists(path) else "MISSING"
		hashes[label] = hash
		_check(hash == String(entry.sha256), stage + ": original " + String(label) + " bytes unchanged")
	samples.append({"stage": stage, "time": game.time, "save_clock": game.save_clock, "last_save_error": game.last_save_error, "physics_frame": Engine.get_physics_frames(), "main_physics_active": game.is_physics_processing(), "player_physics_active": game.player.is_physics_processing(), "state_error": error, "protected_reason": protected_reason, "visible_text": visible, "hashes": hashes})


func _probe() -> void:
	var manifest := _read_dict(String(options.get("manifest", "")))
	if not _check(manifest.get("files") is Dictionary and manifest.get("progress") is Dictionary, "seed manifest is readable") or not (await _boot()):
		_write_report()
		quit(1)
		return
	var files: Dictionary = manifest.files
	var progress: Dictionary = manifest.progress
	_check(OS.get_process_id() != int(manifest.get("pid", -1)), "incompatible fixture loads in a distinct process")
	_check(game.player.realm == int(progress.realm) and game.fragments == int(progress.fragments) and game.environment_slot_identity == String(progress.environment_slot), "player/inventory/slot progress still loads despite environment mismatch")
	for id in progress.investigated:
		_check(game.investigated.has(String(id)), "world investigation progress still loads: " + String(id))
	var environment := _environment()
	var envelope: Dictionary = environment.call("export_state") if environment != null else {}
	_check(envelope.get("generation") == expected_generation, "probe runs the requested current generation")
	_observe("after_ready", files)
	var start_time := game.time
	var start_wall := Time.get_ticks_msec()
	var start_frame := Engine.get_physics_frames()
	var prior_clock := game.save_clock
	var wraps := 0
	while game.time - start_time < 13.0 or Time.get_ticks_msec() - start_wall < 13000 or wraps < 1:
		await physics_frame
		if game.save_clock + 0.5 < prior_clock:
			wraps += 1
		prior_clock = game.save_clock
		if Time.get_ticks_msec() - start_wall > 180000:
			break
	_check(game.time - start_time >= 13.0 and wraps >= 1 and Engine.get_physics_frames() > start_frame and game.is_physics_processing(), "normal physics crosses at least one real 12-second auto-save period", {"game_seconds": game.time - start_time, "wall_msec": Time.get_ticks_msec() - start_wall, "clock_wraps": wraps})
	_check(game.last_save_error != OK, "real auto-save refuses an incompatible environment")
	_observe("after_real_auto_save", files)
	game._save_game()
	_check(game.last_save_error != OK, "explicit save refuses an incompatible environment")
	_observe("after_explicit_save", files)
	var key := InputEventKey.new()
	key.physical_keycode = KEY_F5
	key.keycode = KEY_F5
	key.pressed = true
	root.push_input(key)
	var key_up := InputEventKey.new()
	key_up.physical_keycode = KEY_F5
	key_up.keycode = KEY_F5
	root.push_input(key_up)
	var f5_time := game.time
	while game.time - f5_time < 0.3:
		await physics_frame
	await process_frame
	_check(not game.message.contains("已保存"), "real F5 never claims save success")
	_observe("after_real_f5", files)
	_check(game.initialized and game.is_physics_processing(), "Main remains initialized and active immediately before the real close")
	report["close_requested"] = true
	report["close_path"] = "NativeMain.notification(Node.NOTIFICATION_WM_CLOSE_REQUEST)"
	_write_report()
	# Do not disable initialized/physics, queue_free, or call quit in this branch.
	# Exercise production close/save handling; the Python parent verifies exit.
	game.notification(Node.NOTIFICATION_WM_CLOSE_REQUEST)
	report["close_handler_returned"] = true
	report["close_save_error"] = game.last_save_error
	_check(game.last_save_error != OK, "real close refuses an incompatible environment")
	_write_report()
