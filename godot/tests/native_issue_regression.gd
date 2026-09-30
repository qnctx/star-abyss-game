extends SceneTree

# Main-scene regression for camp collision, camera occlusion and landing/relaunch.
# The visual branch also exercises real imported C2 and ability assets.
const SLOT := "user://star_abyss_issue_regression.json"
var checks: Array[Dictionary] = []
var failures: Array[String] = []


func _initialize() -> void:
	if OS.get_cmdline_user_args().has("--visual"):
		call_deferred("_run_visual")
	else:
		call_deferred("_run_checks")


func _check(name: String, ok: bool, detail: String = "") -> void:
	checks.append({"name": name, "pass": ok, "detail": detail})
	if not ok:
		failures.append(name + (": " + detail if not detail.is_empty() else ""))


func _run_checks() -> void:
	_cleanup()
	var game := await _spawn_game()
	var player := game.player
	var camera := player.get_node("CameraPivot/Camera3D") as Camera3D
	game.set_physics_process(false)
	player.set_physics_process(false)
	game.beast.set_physics_process(false)
	_check("main scene initializes imported R2 C2", game.initialized and player._r2 != null and player._r2.model != null and player._r2._rig != null and player._r2.player != null)
	_check("one native C2 rig owns visible motion", player._r2.model.visible and player._r2._rig.get_bone_count() >= 15, "bones=" + str(player._r2._rig.get_bone_count()))
	var wall_start := player.teleport_to_ground(-14.0, 182.0)
	player.rotation.y = 0.0
	for i in range(40):
		player._step_ground(0.05, Vector2(0.0, 1.0), false, false)
	_check("ground body stops at command side wall", wall_start and player.global_position.z > 176.5 and player.global_position.z < 181.0, str(player.global_position))
	var air_start := player.teleport_to_ground(-14.0, 182.0)
	player.global_position.y += 1.2
	player.flight_active = true
	player.velocity = Vector3.ZERO
	player._vertical_speed = 0.0
	for i in range(20):
		player._step_flight(0.05, Vector2(0.0, 1.0), false, false, false, false)
	_check("low air body cannot fly through camp wall", air_start and player.global_position.z > 176.5 and player.global_position.z < 181.0, str(player.global_position))
	var camera_start := player.teleport_to_ground(-14.0, 182.0)
	player.rotation.y = PI
	player.get_node("CameraPivot").rotation.x = 0.0
	await physics_frame
	player._update_visual(0.1)
	var wall_camera_length := camera.position.length()
	var wall_camera_clear := not player._camera_shape_overlaps(camera.global_position, player.collision_mask | NativePlayer.CAMERA_ONLY_LAYER)
	_check("third-person camera retracts before camp wall", camera_start and wall_camera_length < Vector3(0.0, 1.25, 5.0).length() - 0.05 and wall_camera_clear, "camera_offset=" + str(camera.position) + " clear=" + str(wall_camera_clear))
	var beast_start := player.teleport_to_ground(NativeRiftwing.HOME_X, NativeRiftwing.HOME_Z - 2.4)
	game.world.update_stream(player.global_position)
	player.rotation.y = 0.0
	await physics_frame
	player._update_visual(0.1)
	var beast_camera_clear := not player._camera_shape_overlaps(camera.global_position, NativePlayer.CAMERA_ONLY_LAYER)
	_check("riftwing membrane cannot cover camera near plane", beast_start and game._beast_camera_blocker != null and beast_camera_clear, "camera_offset=" + str(camera.position) + " clear=" + str(beast_camera_clear))
	var open_ground := player.teleport_to_ground(40.0, 40.0)
	player.global_position.y += 0.08
	player.flight_active = true
	player._vertical_speed = -4.0
	player.velocity = Vector3(0.0, -4.0, 0.0)
	player.energy = 100.0
	player._physics_process(0.05)
	_check("ground contact clears stale flying state", open_ground and not player.flight_active and absf(player._vertical_speed) < 0.01, "flight=" + str(player.flight_active) + " y=" + str(player.global_position.y))
	player.energy = 24.0
	var early_launch := player._try_takeoff(true, false)
	player.energy = 25.0
	var descend_blocks := player._try_takeoff(true, true)
	var relaunched := player._try_takeoff(true, false)
	_check("G relaunches after landing at 25 energy; C overrides", not early_launch and not descend_blocks and relaunched and player.flight_active, "early=" + str(early_launch) + " descend=" + str(descend_blocks) + " relaunch=" + str(relaunched))
	player.teleport_to_ground(40.0, 40.0)
	player.global_position.y += 2.0
	player.flight_active = true
	player.velocity = Vector3.ZERO
	player._vertical_speed = 0.0
	player.energy = 100.0
	for i in range(80):
		player._step_flight(0.05, Vector2.ZERO, false, true, false, false)
	var landed_after_fall := not player.flight_active
	var flew_again := player._try_takeoff(true, false)
	_check("controlled drop can land then immediately fly again", landed_after_fall and flew_again and player.flight_active, "landed=" + str(landed_after_fall) + " relaunched=" + str(flew_again) + " y=" + str(player.global_position.y))
	game.initialized = false
	game.queue_free()
	await process_frame
	_cleanup()
	print("NATIVE_ISSUE_JSON=" + JSON.stringify({"passed": checks.size() - failures.size(), "total": checks.size(), "failed": failures, "checks": checks}))
	quit(0 if failures.is_empty() else 1)


func _spawn_game() -> NativeMain:
	var game := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = SLOT
	root.add_child(game)
	await physics_frame
	await physics_frame
	await physics_frame
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	return game


func _cleanup() -> void:
	if FileAccess.file_exists(SLOT):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SLOT))


func _run_visual() -> void:
	_cleanup()
	var game := await _spawn_game()
	var player := game.player
	var camera := player.get_node("CameraPivot/Camera3D") as Camera3D
	# The restoration task resumes physics after two frames. Lock only after it
	# has finished, then drive the real main-scene nodes at known pose times.
	game.set_physics_process(false)
	player.set_physics_process(false)
	game.beast.set_physics_process(false)
	game.ascension.set_physics_process(false)
	player.global_position = Vector3(-140.2397, 3.27444, -329.9384)
	player.rotation.y = 0.435536
	player.get_node("CameraPivot").rotation.x = 0.366667
	game.world.update_stream(player.global_position)
	await _visual_pose(player, 4, 0.04)
	game._update_hud()
	await _capture("issue-signal-saved-pose")
	player.teleport_to_ground(-14.0, 182.0)
	player.rotation.y = PI
	player.get_node("CameraPivot").rotation.x = 0.0
	await physics_frame
	await _visual_pose(player, 3, 0.05)
	game._update_hud()
	await _capture("issue-camp-wall-camera")
	print("ISSUE_CAMERA_WALL=" + JSON.stringify({"offset": camera.position, "clear": not player._camera_shape_overlaps(camera.global_position, player.collision_mask | NativePlayer.CAMERA_ONLY_LAYER)}))
	player.teleport_to_ground(NativeRiftwing.HOME_X, NativeRiftwing.HOME_Z - 3.0)
	player.rotation.y = PI
	game.world.update_stream(player.global_position)
	await physics_frame
	await _visual_pose(player, 4, 0.05)
	game._update_hud()
	await _capture("issue-riftwing-clear-front")
	player.rotation.y = 0.0
	await _visual_pose(player, 4, 0.05)
	await _capture("issue-riftwing-camera-near-wing")
	print("ISSUE_CAMERA_WING=" + JSON.stringify({"offset": camera.position, "model_visible": player._model.visible, "clear": not player._camera_shape_overlaps(camera.global_position, NativePlayer.CAMERA_ONLY_LAYER)}))
	player.teleport_to_ground(40.0, 40.0)
	player.rotation.y = 0.0
	player.get_node("CameraPivot").rotation.x = 0.0
	player.velocity = Vector3.ZERO
	player.horizontal_speed = 0.0
	await _visual_pose(player, 4, 0.05)
	game._update_hud()
	await _capture_side("issue-c2-idle-side", player)
	player.velocity = Vector3(0.0, 0.0, -1.8)
	player.horizontal_speed = 1.8
	await _visual_pose(player, 8, 0.05)
	game._update_hud()
	await _capture_side("issue-c2-walk-side", player)
	player.velocity = Vector3(0.0, 0.0, -10.0)
	player.horizontal_speed = 10.0
	await _visual_pose(player, 8, 0.05)
	game._update_hud()
	await _capture_side("issue-c2-sprint-side", player)
	player.global_position.y += 5.0
	player.flight_active = true
	player.velocity = Vector3(0.0, 0.0, -48.0)
	player.horizontal_speed = 48.0
	player.boosting = true
	await _visual_pose(player, 5, 0.05)
	game._update_hud()
	await _capture("issue-c2-boost-third-person")
	await _capture_side("issue-c2-boost-side", player)
	player.boosting = false
	player.velocity = Vector3(0.0, 0.0, -6.8)
	player.horizontal_speed = 6.8
	player.play_attack(0)
	await _visual_pose(player, 3, 0.05)
	game._update_hud()
	await _capture_side("issue-c2-moving-jab-side", player)
	player._attack_name = ""
	player.velocity = Vector3.ZERO
	player.horizontal_speed = 0.0
	player.teleport_to_ground(NativeRiftwing.HOME_X, NativeRiftwing.HOME_Z + 12.0)
	player.global_position.y += 4.0
	player.flight_active = true
	player.rotation.y = 0.0
	game.world.update_stream(player.global_position)
	game.attack_ready = 0.0
	game.pending_cast_time = -1.0
	player.realm = 4
	player.energy = 100.0
	await _visual_pose(player, 3, 0.05)
	game._try_air_cast()
	var r4_effect: NativeVfxR2 = game.ascension._active_cast_vfx
	if r4_effect != null:
		r4_effect.auto_tick = false
		r4_effect.advance(0.3)
	player._update_visual(0.3)
	game._update_hud()
	await _capture("issue-r4-air-cast")
	print("ISSUE_R4_VFX=" + JSON.stringify({"effect": r4_effect != null, "mesh_count": r4_effect.mesh_root.find_children("*", "MeshInstance3D", true, false).size() if r4_effect != null else 0, "age": r4_effect.age if r4_effect != null else -1.0}))
	if r4_effect != null:
		r4_effect.queue_free()
	game.ascension._active_cast_vfx = null
	game.pending_cast.clear()
	game.pending_cast_time = -1.0
	game.attack_ready = 0.0
	player._cast_active = false
	player.realm = 8
	player.energy = 100.0
	await process_frame
	game._try_air_cast()
	var r8_effect: NativeVfxR2 = game.ascension._active_cast_vfx
	if r8_effect != null:
		r8_effect.auto_tick = false
		r8_effect.advance(0.8)
	player._update_visual(0.8)
	game._update_hud()
	await _capture("issue-r8-air-cast")
	print("ISSUE_R8_VFX=" + JSON.stringify({"effect": r8_effect != null, "mesh_count": r8_effect.mesh_root.find_children("*", "MeshInstance3D", true, false).size() if r8_effect != null else 0, "age": r8_effect.age if r8_effect != null else -1.0}))
	game.initialized = false
	game.queue_free()
	await process_frame
	_cleanup()
	quit()


func _visual_pose(player: NativePlayer, frames: int, dt: float) -> void:
	for i in range(frames):
		player._update_visual(dt)
		await process_frame


func _capture(name: String) -> void:
	await RenderingServer.frame_post_draw
	var path := "res://reports/" + name + ".png"
	var result := root.get_texture().get_image().save_png(path)
	print("NATIVE_ISSUE_VISUAL=" + name + ":" + str(result) + ":" + ProjectSettings.globalize_path(path))


func _capture_side(name: String, player: NativePlayer) -> void:
	var camera := player.get_node("CameraPivot/Camera3D") as Camera3D
	var old_transform := camera.global_transform
	var old_fov := camera.fov
	camera.global_position = player.global_position + Vector3(3.6, 2.2, 1.8)
	camera.fov = 55.0
	camera.look_at(player.global_position + Vector3.UP * 1.0, Vector3.UP)
	await _capture(name)
	camera.global_transform = old_transform
	camera.fov = old_fov
