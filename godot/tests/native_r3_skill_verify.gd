extends SceneTree

const SLOT := "user://star_abyss_native_r3_skill_verify.json"
var failed: Array[String] = []
var records: Array[Dictionary] = []
var deltas: Array[float] = []

func _initialize() -> void:
	call_deferred("_run")

func _check(ok: bool, label: String) -> void:
	if ok:
		print("PASS: " + label)
	else:
		failed.append(label)
		printerr("FAIL: " + label)

func _frames(game: NativeMain, count: int) -> void:
	for i in range(count):
		await physics_frame
		deltas.append(game.last_combat_physics_delta)

func _run() -> void:
	if FileAccess.file_exists(SLOT):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SLOT))
	var game := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = SLOT
	root.add_child(game)
	await _frames(game, 5)
	deltas.clear()
	game.beast.set_physics_process(false)
	game.combat_event.connect(func(record: Dictionary) -> void: records.append(record))
	var player := game.player
	var beast := game.beast
	game.set_physics_process(false)
	player.realm = 9
	game.message_until = -1.0
	game._update_hud()
	game.hint.text = game._combat_hint_text()
	await process_frame
	_check(game.hint.text.contains("道源压掌") and game.hint.get_line_count() <= 2 and game.hint.size.y >= 50.0, "R9 Chinese combat hint fits the visible two-line HUD")
	var previous_window_size := root.size
	root.size = Vector2i(960, 540)
	await process_frame
	game.hint.text = game._combat_hint_text()
	await process_frame
	var visible_height := root.get_visible_rect().size.y
	_check(game.hint.text.contains("道源压掌") and game.hint.position.y >= 0.0 and game.hint.position.y + game.hint.size.y <= visible_height and game.hint.get_line_count() <= 2, "R9 Chinese hint remains fully visible at 960x540")
	root.size = previous_window_size
	await process_frame
	game.set_physics_process(true)
	player.teleport_to_ground(beast.global_position.x, beast.global_position.z + 12.0)
	player.realm = 4
	player.energy = 100.0
	game.world.update_stream(player.global_position)
	var camera := player.get_node("CameraPivot/Camera3D") as Camera3D
	camera.look_at(beast.global_position + Vector3.UP * 1.3)
	var before := beast.hp
	var space_event := InputEventKey.new()
	space_event.physical_keycode = KEY_SPACE
	space_event.pressed = true
	game._input(space_event)
	_check(game.pending_cast.is_empty() and absf(player.energy - 100.0) < 0.001, "Space input cannot start or charge a martial cast")
	var cast_event := InputEventKey.new()
	cast_event.physical_keycode = KEY_R
	cast_event.pressed = true
	game._input(cast_event)
	_check(game.pending_cast.get("r3", false) and String(game.pending_cast.get("action", "")) == "cast_fist" and absf(player.energy - 97.0) < 0.001, "R4 ground cast starts from the realm profile and spends energy once")
	var r3_effect: Variant = game.ascension._r3_cast_vfx
	_check(r3_effect != null and is_instance_valid(r3_effect) and String(r3_effect.resource_version) == "r3-existing-reference", "R4 uses the authored R3 image-derived VFX asset")
	await _frames(game, 65)
	var phases: Array[String] = []
	for record in records:
		if String(record.get("side", "player")) == "player":
			phases.append(String(record["phase"]))
	_check(phases.count("start") == 1 and phases.count("release") == 1 and phases.count("impact") == 1, "one start, release, and impact after live physics frames")
	_check(beast.hp < before and absf(beast.hp - (before - 28000.0)) < 0.01, "R4 ground cast damages the actual beast exactly once")
	_check(deltas.size() >= 65 and deltas.all(func(delta: float) -> bool: return delta > 0.0 and delta <= 0.05), "physics samples record actual positive engine delta")
	var energy_before_retry := player.energy
	game._try_r3_cast()
	_check(game.pending_cast.is_empty() and absf(player.energy - energy_before_retry) < 0.001, "cooldown rejects a rapid repeat without charge")
	await _frames(game, 45)
	player.energy = 100.0
	camera.look_at(player.global_position + Vector3(0.0, 1.3, 50.0))
	var miss_hp := beast.hp
	game._try_r3_cast()
	var miss_effect: Variant = game.ascension._r3_cast_vfx
	var miss_phases: Array[String] = []
	if miss_effect != null and is_instance_valid(miss_effect):
		miss_effect.visual_event.connect(func(_serial: int, phase: String, _detail: Dictionary) -> void: miss_phases.append(phase))
	await _frames(game, 65)
	_check(absf(beast.hp - miss_hp) < 0.01 and miss_phases.has("miss") and not miss_phases.has("impact"), "martial miss dissipates without target impact flash or damage")
	player.realm = 8
	player.energy = 100.0
	game.attack_ready = 0.0
	game.cast_cooldown_until = 0.0
	camera.look_at(beast.global_position + Vector3.UP * 1.3)
	var hp_before_interrupt := beast.hp
	game._try_r3_cast()
	_check(game.pending_cast.get("r3", false) and String(game.pending_cast.get("action", "")) == "cast_cleave", "R8 chooses distinct downward action")
	await _frames(game, 12)
	player.apply_hit(Vector3.BACK, 100.0)
	await _frames(game, 130)
	_check(game.pending_cast.is_empty() and absf(beast.hp - hp_before_interrupt) < 0.01, "damage interrupts windup with no delayed hit")
	game._reset_duel()
	_check(game.training_enemy_slots.has(-1) and game.training_enemy_slots.has(0) and absf(beast.hp - beast.max_hp) < 0.01 and absf(game.enemies[0].hp - game.enemies[0].max_hp) < 0.01, "F3 restores both duel opponents as training targets")
	beast.receive_hit(beast.max_hp)
	player.teleport_to_ground(beast.global_position.x, beast.global_position.z + 2.0)
	var fragments_before_training_pickup := game.fragments
	game._try_pickup()
	_check(game.fragments == fragments_before_training_pickup and beast.loot_left > 0, "training reset cannot duplicate saved loot")
	game._save_game()
	var saved_remaining := maxf(0.0, game.cast_cooldown_until - game.time)
	game.initialized = false
	game.queue_free()
	await process_frame
	var loaded := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	loaded.save_path = SLOT
	root.add_child(loaded)
	await _frames(loaded, 5)
	var loaded_remaining := maxf(0.0, loaded.cast_cooldown_until - loaded.time)
	_check(saved_remaining > 0.0 and absf(loaded_remaining - saved_remaining) < 0.2, "cooldown survives F5 style save and reload")
	_check(loaded.training_enemy_slots.has(-1) and loaded.training_enemy_slots.has(0), "training no-loot state survives save and reload")
	loaded.initialized = false
	loaded.queue_free()
	await process_frame
	if FileAccess.file_exists(SLOT):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SLOT))
	print("NATIVE_R3_SKILL_VERIFY=" + JSON.stringify({"passed": 16 - failed.size(), "total": 16, "failed": failed}))
	quit(0 if failed.is_empty() else 1)
