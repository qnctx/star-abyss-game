extends SceneTree

# Full-world, isolated-save OpenGL evidence. Run only through the hidden-parent
# capture helper so the user's own running game keeps focus and save state.
const SLOT := "user://star_abyss_native_r2_visual_verify.json"
const OUTPUT := "res://reports/r2-main"


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	if FileAccess.file_exists(SLOT):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SLOT))
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT))
	var game := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = SLOT
	root.add_child(game)
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	# Main's asynchronous overlap repair restores the player's physics flag two
	# frames after _ready; wait for it before freezing deterministic poses.
	for frame in range(4):
		await physics_frame
	game.set_physics_process(false)
	game.player.set_physics_process(false)
	game.beast.set_physics_process(false)
	await _pose(game.player, 8, 0.05)
	game._update_hud()
	await _capture("01-spawn-idle")

	var player := game.player
	player.teleport_to_ground(0.0, 190.0)
	player.horizontal_speed = 6.8
	player.velocity = Vector3(0.0, 0.0, -6.8)
	await _pose(player, 8, 0.05)
	game._update_hud()
	await _capture("02-ground-jog")
	player.horizontal_speed = 10.0
	player.velocity = Vector3(0.0, 0.0, -10.0)
	await _pose(player, 8, 0.05)
	game._update_hud()
	await _capture("03-ground-sprint")

	player.teleport_to_ground(0.0, 190.0)
	player.global_position.y += 5.0
	player.flight_active = true
	player.horizontal_speed = 0.0
	player.boosting = false
	await _pose(player, 6, 0.05)
	game._update_hud()
	await _capture("04-flight-cruise")
	player.boosting = true
	player.horizontal_speed = 180.0
	player.velocity = Vector3(0.0, 0.0, -180.0)
	player._turn_bank = 0.5
	await _pose(player, 8, 0.05)
	game._update_hud()
	await _capture("05-flight-boost-bank")
	await _capture_side("05b-flight-boost-side", player)

	player.teleport_to_ground(0.0, 190.0)
	player.horizontal_speed = 0.0
	player.boosting = false
	player.play_attack(0)
	await _pose(player, 3, 0.05)
	game._update_hud()
	await _capture("06-jab-contact")
	await _capture_side("06b-jab-side", player)
	player._attack_name = ""
	player.guarding = true
	await _pose(player, 7, 0.05)
	game._update_hud()
	await _capture("07-guard")
	await _capture_side("07b-guard-side", player)
	player.guarding = false

	player.teleport_to_ground(NativeRiftwing.HOME_X, NativeRiftwing.HOME_Z + 10.0)
	player.global_position.y += 4.0
	player.flight_active = true
	player.realm = 4
	player.energy = 100.0
	player.rotation.y = 0.0
	player._look_pitch = -0.35
	player.get_node("CameraPivot").rotation.x = -0.35
	game.world.update_stream(player.global_position)
	game.attack_ready = 0.0
	game._try_air_cast()
	if game.ascension._active_cast_vfx != null:
		game.ascension._active_cast_vfx.auto_tick = false
	for frame in range(5):
		player._update_visual(0.05)
		game.ascension._active_cast_vfx.advance(0.05)
		game._physics_process(0.05)
		await process_frame
	game._update_hud()
	await _capture("08-r4-qi-blade-windup")
	await _capture_side("08b-r4-qi-blade-windup-side", player)
	for frame in range(6):
		player._update_visual(0.05)
		if game.ascension._active_cast_vfx != null:
			game.ascension._active_cast_vfx.advance(0.05)
		game._physics_process(0.05)
		await process_frame
	game._update_hud()
	await _capture("09-r4-qi-blade-release")
	await _capture_side("09b-r4-qi-blade-release-side", player)
	for tier in [6, 8, 9]:
		await _capture_high_cast(game, tier)

	player.teleport_to_ground(1364.0, -1032.0)
	player.rotation.y = PI * 0.5
	player._look_pitch = 0.0
	player.get_node("CameraPivot").rotation.x = 0.0
	await _pose(player, 4, 0.05)
	game._process(0.05)
	game._update_hud()
	await _capture("10-riftwing-near-camera")

	game.initialized = false
	game.queue_free()
	await process_frame
	if FileAccess.file_exists(SLOT):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SLOT))
	quit()


func _pose(player: NativePlayer, frames: int, dt: float) -> void:
	for frame in range(frames):
		player._update_visual(dt)
		await process_frame


func _capture(label: String) -> void:
	await RenderingServer.frame_post_draw
	var path := OUTPUT + "/" + label + ".png"
	var error := root.get_texture().get_image().save_png(path)
	print("R2_MAIN_VISUAL=" + label + ":" + str(error) + ":" + ProjectSettings.globalize_path(path))


func _capture_side(label: String, player: NativePlayer) -> void:
	var camera := player.get_node("CameraPivot/Camera3D") as Camera3D
	var previous := camera.transform
	camera.global_position = player.global_position + Vector3(3.0, 2.25, 1.2)
	camera.look_at(player.global_position + Vector3.UP * 1.15, Vector3.UP)
	await _capture(label)
	camera.transform = previous


func _capture_high_cast(game: NativeMain, tier: int) -> void:
	var player := game.player
	for child in game.ascension.get_children():
		if child is NativeVfxR2:
			child.queue_free()
	await process_frame
	game.beast.hp = NativeRiftwing.MAX_HP
	player.teleport_to_ground(NativeRiftwing.HOME_X, NativeRiftwing.HOME_Z + 10.0)
	player.global_position.y += 5.0
	player.flight_active = true
	player.realm = tier
	player.energy = 100.0
	player._update_visual(0.75)
	game.attack_ready = 0.0
	game.world.update_stream(player.global_position)
	var camera := player.get_node("CameraPivot/Camera3D") as Camera3D
	camera.look_at(game.beast.global_position + Vector3.UP * 1.3)
	game._try_air_cast()
	var effect := game.ascension._active_cast_vfx
	if effect == null:
		push_error("R%d cast did not start in full scene" % tier)
		return
	effect.auto_tick = false
	var windup := float(NativeMain.AIR_CAST_RULES[tier]["windup"])
	for frame in range(ceili(windup * 0.7 / 0.05)):
		player._update_visual(0.05)
		effect.advance(0.05)
		game._physics_process(0.05)
		await process_frame
	game._update_hud()
	await _capture("11-r%d-cast-main" % tier)
	var previous := camera.transform
	camera.global_position = player.global_position + Vector3(7.0, 5.0, 11.0)
	camera.look_at((player.global_position + game.beast.global_position) * 0.5 + Vector3.UP, Vector3.UP)
	await _capture("11b-r%d-cast-side" % tier)
	camera.global_position = game.beast.global_position + Vector3(4.0, 3.0, 4.0)
	camera.look_at(game.beast.global_position + Vector3.UP * 1.5, Vector3.UP)
	await _capture("11c-r%d-cast-close" % tier)
	camera.transform = previous
	for frame in range(ceili(windup * 0.4 / 0.05) + 3):
		player._update_visual(0.05)
		if game.ascension._active_cast_vfx != null:
			game.ascension._active_cast_vfx.advance(0.05)
		game._physics_process(0.05)
		await process_frame
