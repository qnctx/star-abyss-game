extends SceneTree
## Independent slot, engine physics, actual player/mesh/enemy. No manual step().
const SLOT := "user://martial_r4_verify_basic.json"
const OUT := "res://reports/martial-r4"
var game: NativeMain
var failed: Array[String] = []
var events: Array[Dictionary] = []
var checks: Array[Dictionary] = []
var capture := false

func _initialize() -> void:
	call_deferred("_run")

func _check(ok: bool, label: String) -> void:
	checks.append({"ok": ok, "label": label})
	print("PASS: " if ok else "FAIL: ", label)
	if not ok:
		failed.append(label)

func _frames(count: int, prefix := "") -> void:
	for i in range(count):
		await physics_frame
		if capture and not prefix.is_empty() and i % 3 == 0:
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(OUT + "/%s-%03d.png" % [prefix, i])

func _key(code: Key, down: bool) -> void:
	var e := InputEventKey.new()
	e.physical_keycode = code
	e.pressed = down
	root.push_input(e)

func _reset(kind: String) -> void:
	game.martial.cancel()
	game.player.cancel_combat_action()
	game.player._hurt_time = 0.0
	game.player.health = 100.0
	game.player.energy = 100.0
	game.attack_ready = 0.0
	game.martial.current.clear()
	game.martial.cooldowns.clear()
	game.martial.selected = kind
	game.player.realm = 4
	game.player.guarding = false
	events.clear()

func _target(distance: float) -> NativeEnemyR3:
	var enemy := game.enemies[0]
	var p := game.player.global_position
	enemy.global_position = p + Vector3(0, 0, -distance)
	enemy.global_position.y = game.world.height_at(enemy.global_position.x, enemy.global_position.z)
	enemy.hp = 1000000.0
	enemy.mode = "idle"
	enemy.phase = "idle"
	enemy.rotation = Vector3.ZERO
	return enemy

func _run() -> void:
	capture = "--capture" in OS.get_cmdline_user_args()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT))
	if FileAccess.file_exists(SLOT):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SLOT))
	if FileAccess.file_exists(SLOT + ".bak"):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SLOT + ".bak"))
	game = (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = SLOT
	root.add_child(game)
	await _frames(100)
	game.beast.set_physics_process(false)
	game.beast.global_position = Vector3(500, 50, 500)
	for enemy in game.enemies:
		enemy.set_physics_process(false) # Isolate geometric target motion only.
	game.combat_event.connect(func(e: Dictionary): events.append(e))
	game.player.teleport_to_ground(95.0, 170.0)
	game.player.rotation = Vector3.ZERO
	game.player.get_node("CameraPivot").rotation = Vector3.ZERO
	Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)
	await _frames(30)
	_check(game.player._r2.names.has("cast_martial_fist") and game.player._r2.names.has("air_cast_martial_break"), "independent authored C2 clips installed")
	_reset("fist")
	var enemy := _target(0.9)
	var before := enemy.hp
	_key(KEY_R, true)
	await _frames(50, "fist-close")
	_key(KEY_R, false)
	_check(enemy.hp < before, "fist contacts near actual enemy mesh")
	_check(events.filter(func(e): return e.phase == "release").size() == 1, "one authoritative release per R press")
	_reset("fist")
	enemy = _target(5.0)
	before = enemy.hp
	_key(KEY_R, true)
	await _frames(50, "fist-miss")
	_key(KEY_R, false)
	_check(enemy.hp == before, "fist cannot damage target five metres away")
	_reset("slash")
	game.player.realm = 0
	_key(KEY_R, true)
	await _frames(2)
	_key(KEY_R, false)
	_check(game.martial.current.is_empty(), "wind slash is locked below R1")
	_reset("slash")
	enemy = _target(8.0)
	before = enemy.hp
	_key(KEY_R, true)
	await _frames(85, "slash")
	_key(KEY_R, false)
	_check(enemy.hp < before, "finite wind slash reaches an unobstructed target")
	var blocker := StaticBody3D.new()
	blocker.collision_layer = 1
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(4, 4, 0.25)
	shape.shape = box
	blocker.add_child(shape)
	game.add_child(blocker)
	blocker.global_position = game.player.global_position + Vector3(0, 1.6, -3)
	await _frames(3)
	_reset("slash")
	before = enemy.hp
	_key(KEY_R, true)
	await _frames(85, "slash-wall")
	_key(KEY_R, false)
	_check(enemy.hp == before, "solid wall stops wind slash")
	blocker.queue_free()
	await _frames(3)
	_reset("break")
	_key(KEY_R, true)
	await _frames(8)
	_key(KEY_R, false)
	await _frames(45)
	_check(events.filter(func(e): return e.phase == "release").is_empty(), "early charge release cancels without delayed damage")
	_reset("break")
	_key(KEY_R, true)
	await _frames(24)
	var right := InputEventMouseButton.new()
	right.button_index = MOUSE_BUTTON_RIGHT
	right.pressed = true
	root.push_input(right)
	await _frames(60, "cancel")
	right.pressed = false
	root.push_input(right)
	_key(KEY_R, false)
	_check(events.filter(func(e): return e.phase == "release").is_empty(), "real right mouse input cancels charged cast")
	_reset("break")
	enemy = _target(2.0)
	before = enemy.hp
	_key(KEY_R, true)
	await _frames(135, "break-full")
	_key(KEY_R, false)
	_check(enemy.hp < before, "fully charged short-range pressure impacts actual target")
	var saved: Dictionary = game.martial.snapshot()
	game._save_game()
	var text := FileAccess.get_file_as_string(SLOT)
	var raw: Dictionary = JSON.parse_string(text)
	_check(raw.get("combat", {}).has("martial") and raw.has("environment_slot"), "martial cooldown and environment identity saved additively")
	game.martial.cooldowns.clear()
	game.martial.restore(raw.combat.martial)
	_check(float(game.martial.cooldowns.get("break", 0)) >= float(saved.cooldowns.get("break", 0)) - 0.1, "restore preserves current skill cooldown")
	_check(raw.get("environment_state") is Dictionary, "environment authoritative state shares the committed main snapshot")
	var mirror_path := SLOT + ".environment-r4.json"
	var mirror_hash := FileAccess.get_sha256(mirror_path)
	game.save_path = "user://martial_r4_missing_directory/never_create/main.json"
	game._save_game()
	_check(game.last_save_error != OK and FileAccess.get_sha256(mirror_path) == mirror_hash, "failed main write leaves environment mirror unchanged")
	game.save_path = SLOT
	var bad_mirror := FileAccess.open(mirror_path, FileAccess.WRITE)
	bad_mirror.store_string("{broken sidecar")
	bad_mirror.close()
	game._environment_inline_present = true
	game._environment_inline = raw.environment_state
	game._bind_environment_slot()
	_check(not game.save_blocked, "valid inline authority restores despite a corrupt sidecar")
	game._environment_inline_present = true
	game._environment_inline = {"version": "corrupt"}
	game._bind_environment_slot()
	_check(game.save_blocked, "invalid inline state protects the original main save")
	game.save_blocked = false
	game._environment_inline_present = true
	game._environment_inline = raw.environment_state
	game._bind_environment_slot()
	game._save_game()
	var report := {"failed": failed, "checks": checks, "capture": capture, "physics_frame": Engine.get_physics_frames(), "test_slot": SLOT, "limitations": "Stationary real enemy isolates geometry; AI integration and environment destruction covered separately."}
	var output := FileAccess.open(OUT + "/basic-verification.json", FileAccess.WRITE)
	output.store_string(JSON.stringify(report, "\t"))
	print("MARTIAL_R4_RESULT ", JSON.stringify(report))
	game.queue_free()
	await process_frame
	quit(0 if failed.is_empty() else 1)
