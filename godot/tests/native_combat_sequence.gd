extends SceneTree

# Independent 30 fps visual capture of the real main scene and imported C2.
# The isolated slot is never the user's native or browser save.
const SLOT := "user://star_abyss_combat_verify.json"
const OUT := "res://reports/native-combat-sequence"
const DT := 1.0 / 30.0
const VIEWS := {
	"front": Vector3(0.0, 2.2, -4.1),
	"side": Vector3(4.1, 2.2, 0.0),
	"three-quarter": Vector3(3.1, 2.2, -3.2),
}
var manifest: Array[Dictionary] = []
var output_root := OUT
var physics_clock := false


func _initialize() -> void:
	physics_clock = OS.get_cmdline_user_args().has("--guard-physics")
	if physics_clock:
		Engine.physics_ticks_per_second = 30
	call_deferred("_run")


func _run() -> void:
	_cleanup()
	var guard_only := OS.get_cmdline_user_args().has("--guard-only") or physics_clock
	if guard_only:
		output_root = OUT + ("/after-hit-physics-30hz" if physics_clock else "/after-hit-fix")
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output_root))
	var game := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = SLOT
	root.add_child(game)
	# NativeMain finishes its overlap-recovery coroutine after two physics frames.
	# Locking player physics earlier is silently undone by that coroutine.
	await physics_frame
	await physics_frame
	await physics_frame
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	game.set_physics_process(false)
	game.player.set_physics_process(false)
	game.beast.set_physics_process(false)
	game.ascension.set_physics_process(false)
	game.save_clock = -100000.0
	if guard_only:
		await _capture_scenario(game, "guard-and-hit", "side", 48)
	else:
		for view in ["front", "side", "three-quarter"]:
			await _capture_scenario(game, "combo", view, 60)
		await _capture_scenario(game, "moving-jab", "three-quarter", 42)
		await _capture_scenario(game, "guard-and-hit", "side", 48)
		await _capture_scenario(game, "air-melee", "three-quarter", 48)
	var path := output_root + "/manifest.json"
	var file := FileAccess.open(path, FileAccess.WRITE)
	file.store_string(JSON.stringify({"fps": 30, "main_scene": "res://scenes/main.tscn", "isolated_slot": SLOT, "clips": manifest}, "\t"))
	file.close()
	print("NATIVE_COMBAT_CAPTURE=" + ProjectSettings.globalize_path(path))
	game.initialized = false
	game.queue_free()
	await process_frame
	_cleanup()
	quit()


func _reset(game: NativeMain, airborne: bool) -> void:
	var player := game.player
	game._cancel_melee()
	game.attack_ready = 0.0
	game.combo = 0
	game.combo_expires_at = -1.0
	game.queued_attack = false
	player._attack_name = ""
	player._attack_serial += 1
	player._hurt_time = 0.0
	player._visual_hitstop = 0.0
	player._hit_impulse = Vector3.ZERO
	player.guarding = false
	player._cast_active = false
	player.health = player.max_health
	player.energy = 100.0
	player.velocity = Vector3.ZERO
	player.horizontal_speed = 0.0
	player.boosting = false
	player.flight_active = false
	player.rotation.y = 0.0
	player.get_node("CameraPivot").rotation.x = 0.0
	player.teleport_to_ground(40.0, 40.0)
	if airborne:
		player.global_position.y += 4.0
		player.flight_active = true
		player._vertical_speed = 0.0
	game.world.update_stream(player.global_position)
	game._update_hud()


func _capture_scenario(game: NativeMain, scenario: String, view: String, count: int) -> void:
	var player := game.player
	_reset(game, scenario == "air-melee")
	var camera := player.get_node("CameraPivot/Camera3D") as Camera3D
	camera.current = true
	camera.fov = 55.0
	for warmup in range(12):
		player._update_visual(DT)
		await process_frame
	var name := scenario + "-" + view
	var directory := output_root + "/" + name
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(directory))
	var observed: Array[String] = []
	var queued_cross := false
	var queued_kick := false
	var health_before := player.health
	var health_guarded := player.health
	var health_unblocked := player.health
	for frame in range(count):
		if physics_clock:
			await physics_frame
			var engine_dt := player.get_physics_process_delta_time()
			var inside_physics := Engine.is_in_physics_frame()
			if frame in [0, 10, 30, 34, 38, 40]:
				print("NATIVE_COMBAT_CLOCK=" + JSON.stringify({"frame": frame, "inside_physics": inside_physics, "engine_dt": engine_dt, "manual_dt": DT, "ticks_per_second": Engine.physics_ticks_per_second}))
			if not inside_physics or absf(engine_dt - DT) > 0.0001:
				printerr("NATIVE_COMBAT_CLOCK_MISMATCH=" + str(frame))
				quit(1)
				return
		if scenario == "combo":
			if frame == 0:
				game._try_attack()
			elif game.combo == 1 and game.attack_ready <= 0.13 and not queued_cross:
				game._try_attack()
				queued_cross = true
			elif game.combo == 2 and game.attack_ready <= 0.13 and not queued_kick:
				game._try_attack()
				queued_kick = true
		elif scenario == "moving-jab":
			player._step_ground(DT, Vector2(0.0, 1.0), false, false)
			if frame == 6:
				game._try_attack()
		elif scenario == "guard-and-hit":
			player.guarding = frame < 24
			if frame == 10:
				player.apply_hit(Vector3.FORWARD, 1000.0)
				health_guarded = player.health
			if frame == 30:
				player.apply_hit(Vector3.FORWARD, 1000.0)
				health_unblocked = player.health
			player._hurt_time = maxf(0.0, player._hurt_time - DT)
			player._step_ground(DT, Vector2.ZERO, false, false)
		elif scenario == "air-melee":
			player._step_flight(DT, Vector2.ZERO, false, false, false, false)
			if frame == 0 or frame == 14:
				game._try_attack()
		game._physics_process(DT)
		player._update_visual(DT)
		if scenario == "guard-and-hit" and frame in [8, 10, 30, 34, 38, 40]:
			var rig := player._r2._rig as Skeleton3D
			var ankle_l_y := (rig.global_transform * rig.get_bone_global_pose(rig.find_bone("ankleL"))).origin.y
			var ankle_r_y := (rig.global_transform * rig.get_bone_global_pose(rig.find_bone("ankleR"))).origin.y
			print("NATIVE_COMBAT_HIT_TRACE=" + JSON.stringify({"frame": frame, "player_y": player.global_position.y, "ankle_l_y": ankle_l_y, "ankle_r_y": ankle_r_y, "speed": player.horizontal_speed, "hurt": player._hurt_time, "guard": player.guarding}))
		if not player._attack_name.is_empty() and not observed.has(player._attack_name):
			observed.append(player._attack_name)
		game._update_hud()
		camera.global_position = player.global_position + VIEWS[view]
		camera.look_at(player.global_position + Vector3.UP * 1.12, Vector3.UP)
		await RenderingServer.frame_post_draw
		var path := directory + "/f%03d.jpg" % frame
		var result := root.get_texture().get_image().save_jpg(path, 0.86)
		if result != OK:
			printerr("NATIVE_COMBAT_CAPTURE_ERROR=" + str(result) + ":" + path)
			quit(1)
			return
		await process_frame
	manifest.append({"name": name, "frames": count, "observed_actions": observed, "health_before": health_before, "health_after_guarded_hit": health_guarded, "health_after_unblocked_hit": health_unblocked, "last_position": str(player.global_position), "flight_active": player.flight_active})
	print("NATIVE_COMBAT_CLIP=" + name + ":" + JSON.stringify(manifest.back()))


func _cleanup() -> void:
	if FileAccess.file_exists(SLOT):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SLOT))
