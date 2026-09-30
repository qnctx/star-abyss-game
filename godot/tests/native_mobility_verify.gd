extends SceneTree

# Uses an isolated save and real physics shapes. It never opens the normal slot.
const SLOT := "user://star_abyss_native_mobility_verify.json"
var checks: Array[Dictionary] = []
var failed: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _check(name: String, ok: bool, detail: String = "") -> void:
	checks.append({"name": name, "pass": ok, "detail": detail})
	if not ok:
		failed.append(name + ": " + detail)


func _run() -> void:
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	var game := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = SLOT
	root.add_child(game)
	await physics_frame
	await physics_frame
	game.set_physics_process(false)
	game.beast.set_physics_process(false)
	var player := game.player
	player.set_physics_process(false)
	var world := game.world
	var spawn_y := world.height_at(0.0, 190.0)
	player.teleport_to_ground(0.0, 190.0)
	player.energy = 21.0
	game._update_hud()
	await process_frame
	var panel := game.get_node("Hud/TopLeft") as PanelContainer
	_check("Chinese low-energy HUD fits its panel", game.status.get_line_count() >= 6 and game.status.size.y <= panel.size.y and panel.size.y <= 230.0, "lines=" + str(game.status.get_line_count()) + " label=" + str(game.status.size) + " panel=" + str(panel.size))
	_check("G cannot launch below 25%", not player._try_takeoff(true, false) and not player.flight_active, "energy=" + str(player.energy))
	for frame in range(18):
		player._step_ground(0.05, Vector2.ZERO, false, false)
	_check("ground recovery reaches threshold in under five seconds", player.energy >= 24.5 and player.energy < 25.0, "energy=" + str(player.energy))
	for frame in range(2):
		player._step_ground(0.05, Vector2.ZERO, false, false)
	var ready_to_launch := player._on_terrain()
	var destination_clear := player._destination_clear(Vector3(0.0, spawn_y + NativePlayer.FLIGHT_CLEARANCE, 190.0))
	var launched := player._try_takeoff(true, false)
	_check("holding G launches at recovered threshold", launched and player.flight_active and player.global_position.y >= spawn_y + NativePlayer.FLIGHT_CLEARANCE - 0.01, "energy=" + str(player.energy) + " y=" + str(player.global_position.y) + " grounded=" + str(ready_to_launch) + " clear=" + str(destination_clear))
	player.teleport_to_ground(0.0, 190.0)
	player.energy = 40.0
	player.flight_active = true
	player._vertical_speed = 0.0
	player._physics_process(0.05)
	_check("stale flight at zero AGL settles to walking", not player.flight_active, "y=" + str(player.global_position.y))
	_check("40% energy relaunches after stale landing", player._try_takeoff(true, false) and player.flight_active, "energy=" + str(player.energy))
	player.teleport_to_ground(0.0, 190.0)
	player.energy = 40.0
	_check("C has priority over G on the ground", not player._try_takeoff(true, true) and not player.flight_active)
	player._step_ground(0.05, Vector2.ZERO, false, true)
	_check("Space gives a jump without flight", not player.flight_active and player.global_position.y > spawn_y and player._ground_vertical_speed > 0.0)

	# A clear capsule outside the command wall must never place its camera in
	# the authored GLB. This point was reproduced before the camera sweep fix.
	player.teleport_to_ground(-24.0, 174.0)
	player.rotation.y = PI * 0.5
	player.get_node("CameraPivot").rotation.x = 0.0
	var desired := Vector3(0.0, 1.25, 5.0)
	var safe := player._safe_camera_offset(desired)
	var pivot := player.get_node("CameraPivot") as Node3D
	var ray := PhysicsRayQueryParameters3D.create(pivot.global_position, pivot.to_global(desired))
	ray.collision_mask = 1
	var old_hit := player.get_world_3d().direct_space_state.intersect_ray(ray)
	_check("old fixed camera path hits the command wall", not old_hit.is_empty(), str(old_hit.get("position", Vector3.ZERO)))
	_check("camera sweep retracts before command wall", safe.length() < desired.length() - 0.4 and safe.length() > 0.3, "safe=" + str(safe))
	player._update_visual(0.05)
	_check("render camera uses the safe offset", (player.get_node("CameraPivot/Camera3D") as Camera3D).position.distance_to(safe) < 0.02)
	player._first_person = true
	player._update_visual(0.05)
	_check("first-person camera remains at pivot", (player.get_node("CameraPivot/Camera3D") as Camera3D).position.length() < 0.001 and not player.get_node("Model").visible)
	player._first_person = false
	player.global_position = game.beast.global_position + Vector3(0.0, 0.0, -2.0)
	game._process(0.0)
	var wing_meshes_found := game._beast_wing_meshes.size() > 0
	var wing_faded := wing_meshes_found
	for mesh in game._beast_wing_meshes:
		wing_faded = wing_faded and mesh.transparency >= 0.8
	_check("near-camera wing membrane fades without changing collision", wing_faded and player.collision_mask == 1, "meshes=" + str(game._beast_wing_meshes.size()))
	player.teleport_to_ground(0.0, 190.0)
	game._process(0.0)
	var wings_restored := wing_meshes_found
	for mesh in game._beast_wing_meshes:
		wings_restored = wings_restored and mesh.transparency < 0.01
	_check("wing membrane returns to opaque at distance", wings_restored)

	var wall := StaticBody3D.new()
	wall.collision_layer = 1
	wall.collision_mask = 0
	var collider := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(24.0, 14.0, 1.0)
	collider.shape = box
	wall.add_child(collider)
	game.add_child(wall)
	wall.global_position = Vector3(0.0, 5.0, 185.0)
	await physics_frame
	player.teleport_to_ground(0.0, 190.0)
	player.rotation.y = 0.0
	for frame in range(50):
		player._step_ground(0.05, Vector2(0.0, 1.0), false, false)
	_check("walking cannot enter wall", player.global_position.z >= 185.9, str(player.global_position))
	player.teleport_to_ground(0.0, 190.0)
	for frame in range(50):
		player._step_ground(0.05, Vector2(1.0, 1.0), false, false)
	_check("walking slides along wall", player.global_position.z >= 185.9 and player.global_position.x > 2.0, str(player.global_position))
	var approaches := [
		{"label": "forward", "yaw": 0.0, "axes": Vector2(0.0, 1.0)},
		{"label": "backward", "yaw": PI, "axes": Vector2(0.0, -1.0)},
		{"label": "right", "yaw": PI * 0.5, "axes": Vector2(1.0, 0.0)},
		{"label": "left", "yaw": -PI * 0.5, "axes": Vector2(-1.0, 0.0)},
	]
	for approach in approaches:
		player.teleport_to_ground(0.0, 190.0)
		player.rotation.y = float(approach["yaw"])
		for frame in range(35):
			player._step_ground(0.05, approach["axes"], false, false)
		_check("ground wall blocks " + String(approach["label"]), player.global_position.z >= 185.9 and player.global_position.z <= 190.0, str(player.global_position))

	# A boosted 75 m single-frame motion must be swept against a collider.
	wall.global_position = Vector3(0.0, 400.0, -5.0)
	box.size = Vector3(80.0, 30.0, 1.0)
	await physics_frame
	player.global_position = Vector3(0.0, 400.0, 0.0)
	player.flight_active = true
	player.energy = 100.0
	player.velocity = Vector3(0.0, 0.0, -1500.0)
	player._step_flight(0.05, Vector2(0.0, 1.0), false, false, true, false)
	_check("boosted single-frame sweep stops at wall", player.global_position.z >= -4.1, str(player.global_position))
	for approach in approaches:
		player.global_position = Vector3(0.0, 400.0, 0.0)
		player.rotation.y = float(approach["yaw"])
		player.flight_active = true
		player.energy = 100.0
		player.velocity = Vector3(0.0, 0.0, -1500.0)
		player._step_flight(0.05, approach["axes"], false, false, true, false)
		_check("boosted wall blocks " + String(approach["label"]), player.global_position.z >= -4.1, str(player.global_position))
	player.global_position = Vector3(0.0, 400.0, 0.0)
	player.rotation.y = 0.0
	player.velocity = Vector3.ZERO
	for frame in range(8):
		player._step_flight(0.05, Vector2(1.0, 1.0), false, false, true, false)
	_check("boosted turn slides along wall", player.global_position.z >= -4.1 and player.global_position.x > 5.0, str(player.global_position))
	wall.queue_free()
	await physics_frame
	player.teleport_to_ground(-17.0, 173.0)
	var camp_floor := player.global_position.y
	player.global_position.y += 1.2
	player.flight_active = true
	player.energy = 40.0
	player.velocity = Vector3.ZERO
	player._vertical_speed = 0.0
	for frame in range(15):
		player._step_flight(0.05, Vector2.ZERO, false, true, false, false)
	_check("C lands on authored camp floor", not player.flight_active and absf(player.global_position.y - camp_floor) < 0.08, "floor=" + str(camp_floor) + " foot=" + str(player.global_position.y))
	_check("camp landing allows immediate G relaunch", player._try_takeoff(true, false) and player.flight_active, str(player.global_position))
	player.teleport_to_ground(0.0, 190.0)
	player.global_position.y += 4.0
	player.flight_active = true
	player.energy = 0.05
	player.velocity = Vector3.ZERO
	player._vertical_speed = 0.0
	for frame in range(100):
		player._step_flight(0.05, Vector2.ZERO, false, false, false, false)
		if not player.flight_active:
			break
	_check("energy depletion descends and lands safely", not player.flight_active and absf(player.global_position.y - spawn_y) < 0.08, "energy=" + str(player.energy) + " y=" + str(player.global_position.y))
	var recovered_launch := false
	for frame in range(130):
		player._step_ground(0.05, Vector2.ZERO, false, false)
		if player._try_takeoff(true, false):
			recovered_launch = true
			break
	_check("depleted flight recovers to a real second takeoff", recovered_launch and player.flight_active and player.energy >= 25.0, "energy=" + str(player.energy))
	player.global_position = Vector3(0.0, 400.0, 0.0)
	player.flight_active = true
	player.energy = 50.0
	player.velocity = Vector3.ZERO
	for frame in range(20):
		player._step_flight(0.05, Vector2(0.0, 1.0), false, false, false, false)
	var cruise_energy := player.energy
	var cruise_speed := player.horizontal_speed
	player.global_position = Vector3(0.0, 400.0, 0.0)
	player.energy = 50.0
	player.velocity = Vector3.ZERO
	for frame in range(20):
		player._step_flight(0.05, Vector2(0.0, 1.0), false, false, true, false)
	_check("boost is faster and costs more than cruise", player.horizontal_speed > cruise_speed + 100.0 and cruise_energy - player.energy > 1.0, "cruise=" + str(cruise_speed) + " boost=" + str(player.horizontal_speed) + " energy=" + str(cruise_energy) + "/" + str(player.energy))

	game.initialized = false
	game.queue_free()
	await process_frame
	if FileAccess.file_exists(SLOT):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SLOT))
	print("NATIVE_MOBILITY_JSON=" + JSON.stringify({"total": checks.size(), "passed": checks.size() - failed.size(), "failed": failed, "checks": checks}))
	quit(0 if failed.is_empty() else 1)
