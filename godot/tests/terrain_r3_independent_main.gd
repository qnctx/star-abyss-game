extends SceneTree

## Full main scene stays instantiated. Static placement is diagnostic only;
## it does not claim player-controlled flight or traversal.
var output: String
var rows: Array[Dictionary] = []
var checks: Array[Dictionary] = []
var main: NativeMain
var slot: String

func _initialize() -> void:
	call_deferred("_run")

func _check(label: String, passed: bool) -> void:
	checks.append({"name": label, "pass": passed})
	print("CHECK ", label, " ", passed)

func _capture(label: String) -> void:
	main._update_hud()
	await RenderingServer.frame_post_draw
	_check("capture " + label, root.get_texture().get_image().save_png(output.path_join(label + ".png")) == OK)

func _settle(point: Vector3) -> Dictionary:
	main.player.global_position = point
	for i in range(240):
		main.world.update_stream(point)
		await physics_frame
		if i >= 45:
			var surface: Dictionary = main.world.surface_at(point)
			if surface.get("ready", false):
				return surface
	return main.world.surface_at(point)

func _place(label: String, point: Vector3, pitch: float, yaw: float = 0.0) -> void:
	main.player.global_position = point
	main.player.velocity = Vector3.ZERO
	main.player.rotation = Vector3(0.0, yaw, 0.0)
	var up: Vector3 = main.world.up_at(point)
	var forward: Vector3 = Vector3(sin(-yaw), 0.0, -cos(yaw)).slide(up).normalized()
	main.player.global_basis = Basis.looking_at(forward, up)
	var surface: Dictionary = await _settle(point)
	var pivot := main.player.get_node("CameraPivot") as Node3D
	pivot.rotation.x = pitch
	main.player._update_visual(0.05)
	# Allow ecology to fill its async queue; measure complete-main rendered frames.
	for i in range(120):
		await process_frame
	var timings: Array[float] = []
	var previous := Time.get_ticks_usec()
	for i in range(120):
		await process_frame
		var now := Time.get_ticks_usec()
		timings.append(float(now-previous)/1000.0)
		previous = now
	var ecology: Node = main.world.get_node_or_null("PlanetEcology")
	var stats: Dictionary = {}
	if ecology != null and ecology.has_method("debug_stats"):
		stats = ecology.call("debug_stats")
	rows.append({"label": label, "position": [point.x, point.y, point.z], "surface": surface,
		"render_intervals_ms": timings, "ecology": stats, "camera_near": (main.player.get_node("CameraPivot/Camera3D") as Camera3D).near,
		"draw_calls": Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME), "triangles": Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME)})
	await _capture(label)

func _run() -> void:
	output = OS.get_environment("TERRAIN_R3_OUTPUT")
	if output.is_empty():
		push_error("Use terrain_r3_independent_capture.py so outputs and SHA are isolated")
		quit(2)
		return
	slot = output.path_join("isolated-save.json")
	main = (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	main.save_path = slot
	root.add_child(main)
	for i in range(6):
		await physics_frame
	_check("complete main: player/vehicle/enemy/world", is_instance_valid(main.player) and is_instance_valid(main.skimmer) and is_instance_valid(main.beast) and main.world.planet_enabled)
	main.player.set_physics_process(false)
	var y: float = main.world.height_at(0.0, 190.0)
	await _place("basin-ground", Vector3(0.0, y + 0.1, 190.0), -0.15)
	main.fragments = 9
	main.investigated = ["beacon", "signal"]
	main._save_game()
	var save: Variant = JSON.parse_string(FileAccess.get_file_as_string(slot))
	_check("isolated save contains progression/vehicle/planet", save is Dictionary and save.get("fragments") == 9 and save.has("skimmer") and save.has("planet") and save.get("investigated", []).size() == 2)
	main.player.flight_active = true
	await _place("basin-1600m", Vector3(0.0, y + 1600.0, 190.0), -0.65)
	if OS.get_environment("TERRAIN_R3_SMOKE") != "1":
		for distance in [3000.0, 4000.0, 8000.0, 17000.0, 27000.0, 34000.0, 42000.0]:
			var direction: Vector3 = main.world._planet.field.route_direction(distance)
			var analytic: Dictionary = main.world._planet.field.sample(direction)
			var ground: Vector3 = NativePlanet.canonical_to_scene(direction * (NativePlanet.RADIUS + float(analytic.height)))
			var up: Vector3 = main.world.up_at(ground)
			var surface: Dictionary = await _settle(ground + up * 2.0)
			_check("real triangle support " + str(distance), surface.get("ready", false))
			var ray := PhysicsRayQueryParameters3D.create(ground + up * 80.0, ground - up * 80.0, 1)
			ray.hit_back_faces = true
			var hit: Dictionary = main.world.get_world_3d().direct_space_state.intersect_ray(ray)
			_check("independent physics ray " + str(distance), not hit.is_empty())
			rows.append({"distance": distance, "analytic": analytic, "support": surface, "ray": hit})
			await _place("route-%d-ground" % int(distance), ground + up * maxf(2.0, float(analytic.get("water_depth", 0.0)) + 2.0), -0.15, -PI / 2.0)
			await _place("route-%d-overview" % int(distance), ground + up * 600.0, -0.65, -PI / 2.0)
		if main.world._planet.field.has_method("landmark_regions"):
			for region: Dictionary in main.world._planet.field.call("landmark_regions"):
				var point: Vector3 = region.position
				var up: Vector3 = main.world.up_at(point)
				var support: Dictionary = await _settle(point + up * 2.0)
				_check("special support " + str(region.id), support.get("ready", false))
				var ray := PhysicsRayQueryParameters3D.create(point + up * 100.0, point - up * 100.0, 1)
				ray.hit_back_faces = true
				var hit: Dictionary = main.world.get_world_3d().direct_space_state.intersect_ray(ray)
				_check("special independent ray " + str(region.id), not hit.is_empty())
				rows.append({"special_region": region, "support": support})
				await _place("special-%s-ground" % str(region.id), point + up * 2.0, -0.15)
				await _place("special-%s-overview" % str(region.id), point + up * 600.0, -0.65)
	await _place("orbit-player", Vector3(0.0, 125000.0, 190.0), -1.35)
	# Keep original complete player image, then isolate equipment only for attribution.
	var visuals: Array[Node3D] = []
	for child in main.player.get_children():
		if child is Node3D and child.name != "CameraPivot" and child.visible:
			visuals.append(child)
			child.visible = false
	await _capture("orbit-equipment-isolation")
	var basin_far := main.world.get_node_or_null("BasinTerrainChunks/SixKilometreFarBasin") as Node3D
	if basin_far != null:
		basin_far.visible = false
		await _capture("orbit-no-equipment-no-basin-far")
		basin_far.visible = true
	var planet_far: Node3D = main.world._planet._far_root
	planet_far.visible = false
	await _capture("orbit-no-equipment-no-planet-far")
	planet_far.visible = true
	for child in visuals:
		child.visible = true
	var file := FileAccess.open(output.path_join("observations.json"), FileAccess.WRITE)
	file.store_string(JSON.stringify({"phase": "frozen route visual/physics", "checks": checks, "observations": rows,
		"limitations": ["static placement is not flight traversal", "save reload and UI covered in separate runs"]}, "\t"))
	file.close()
	main.initialized = false
	main.queue_free()
	await process_frame
	var failed := 0
	for check in checks:
		if not check["pass"]:
			failed += 1
	print("TERRAIN_R3_PREPARATION_RESULT ", checks.size() - failed, "/", checks.size(), " (not final acceptance)")
	quit(0 if failed == 0 else 1)
