extends SceneTree

## Isolated reproduction of the player's 1.6 km AGL basin screenshot. Runs in
## the hidden Win32 capture parent; never opens the default native save.
const OUTPUT := "res://reports/planet-orbit-patch-isolation"

func _initialize() -> void:
	call_deferred("_run")

func _capture(label: String) -> void:
	await RenderingServer.frame_post_draw
	var path := OUTPUT + "/" + label + ".png"
	var error := root.get_texture().get_image().save_png(path)
	print("BASIN_VISUAL=", label, ":", error, ":", ProjectSettings.globalize_path(path))

func _run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT))
	var main := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	main.save_path = "user://star_abyss_basin_visual_%d.json" % Time.get_ticks_usec()
	var slot: String = main.save_path
	root.add_child(main)
	for i in range(5):
		await physics_frame
	main.player.set_physics_process(false)
	var ground_y: float = main.world.height_at(0.0, 190.0)
	main.player.global_position = Vector3(0.0, ground_y + 1600.0, 190.0)
	main.player.flight_active = true
	main.player.energy = 83.0
	main.player.velocity = Vector3.ZERO
	main.player.rotation.y = 0.0
	var pivot := main.player.get_node("CameraPivot") as Node3D
	var planet := main.world.get_node("ContinuousPlanet") as NativePlanet
	for i in range(90):
		main.world.update_stream(main.player.global_position)
		await physics_frame
	for pitch in [0.0, -0.35, -0.65]:
		pivot.rotation.x = pitch
		main.player._update_visual(0.05)
		main._update_hud()
		await _capture("default-pitch-%.2f" % pitch)
	pivot.rotation.x = -0.35
	main.player._update_visual(0.05)
	var far_basin := main.world.get_node("BasinTerrainChunks/SixKilometreFarBasin") as MeshInstance3D
	planet._far_root.visible = false
	await _capture("no-planet-far")
	planet._far_root.visible = true
	planet._mid_root.visible = false
	await _capture("no-planet-mid")
	planet._mid_root.visible = true
	far_basin.visible = false
	await _capture("no-basin-far")
	far_basin.visible = true
	for chunk: Node3D in main.world._chunks.values():
		chunk.visible = false
	await _capture("no-basin-near")
	for chunk: Node3D in main.world._chunks.values():
		chunk.visible = true
	for altitude in [100.0, 350.0, 500.0, 700.0, 900.0]:
		main.player.global_position = Vector3(0.0, ground_y + altitude, 190.0)
		for i in range(90):
			main.world.update_stream(main.player.global_position)
			await physics_frame
		pivot.rotation.x = -0.35
		main.player._update_visual(0.05)
		main._update_hud()
		await _capture("handoff-agl-%d" % int(altitude))
	main.player.global_position = Vector3(1370.0, main.world.height_at(1370.0, -1022.0) + 1600.0, -1022.0)
	for i in range(90):
		main.world.update_stream(main.player.global_position)
		await physics_frame
	for yaw in [0.0, PI]:
		main.player.rotation.y = yaw
		for pitch in [-0.35, -0.65, -1.0]:
			pivot.rotation.x = pitch
			main.player._update_visual(0.05)
			main._update_hud()
			await _capture("arena-yaw-%.2f-pitch-%.2f" % [yaw, pitch])
	main.player.rotation.y = PI
	pivot.rotation.x = -0.65
	main.player._update_visual(0.05)
	main._update_hud()
	await _capture("line-all")
	for chunk: Node3D in main.world._chunks.values():
		chunk.visible = false
	await _capture("line-no-basin-near")
	for chunk: Node3D in main.world._chunks.values():
		chunk.visible = true
	far_basin.visible = false
	await _capture("line-no-basin-far")
	far_basin.visible = true
	planet._mid_root.visible = false
	await _capture("line-no-planet-mid")
	planet._mid_root.visible = true
	planet._far_root.visible = false
	await _capture("line-no-planet-far")
	planet._far_root.visible = true
	main.player.global_position = Vector3(0.0, 125000.0, 190.0)
	main.player.rotation.y = 0.0
	pivot.rotation.x = -1.35
	for i in range(5):
		main.world.update_stream(main.player.global_position)
		await physics_frame
	main.player._update_visual(0.05)
	main._update_hud()
	await _capture("orbit-player")
	far_basin.visible = false
	await _capture("orbit-no-basin-far")
	far_basin.visible = true
	for chunk: Node3D in main.world._chunks.values():
		chunk.visible = false
	await _capture("orbit-no-basin-near")
	for chunk: Node3D in main.world._chunks.values():
		chunk.visible = true
	planet._far_root.visible = false
	await _capture("orbit-no-planet-far")
	planet._far_root.visible = true
	var probe_direction: Vector3 = NativePlanet.scene_to_canonical(Vector3(3500.0, 0.0, -1022.0)).normalized()
	var probe_tile: Dictionary = NativePlanet._tile_at(probe_direction, NativePlanet.MID_LEVEL)
	var probe_key: String = NativePlanet._tile_key(probe_tile)
	if planet._mid_tiles.has(probe_key):
		var visual := (planet._mid_tiles[probe_key].node as Node3D).get_child(0) as MeshInstance3D
		var arrays: Array = (visual.mesh as ArrayMesh).surface_get_arrays(0)
		var normals: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
		var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
		var indexes: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
		var winding: Vector3 = (vertices[indexes[1]] - vertices[indexes[0]]).cross(vertices[indexes[2]] - vertices[indexes[0]]).normalized()
		print("BASIN_NORMAL=", probe_key, " normal=", normals[8 * 17 + 8], " winding=", winding, " radial=", main.world.up_at(Vector3(3500.0, 0.0, -1022.0)))
	var heights: Array[Dictionary] = []
	for z in [190.0, -1022.0]:
		for x in [2500.0, 3000.0, 3200.0, 3500.0, 3800.0, 4000.0, 5000.0, 8000.0, 12000.0]:
			var sample: Dictionary = planet.analytic_surface(Vector3(x, 0.0, z))
			heights.append({"x": x, "z": z, "planet_y": sample.point.y, "legacy_y": main.world.height_at(x, z)})
	print("BASIN_HEIGHTS=", JSON.stringify(heights))
	print("BASIN_STATE=", JSON.stringify({"position": str(main.player.global_position), "far": main.player.get_node("CameraPivot/Camera3D").far, "chunks": main.world.loaded_chunk_count(), "planet_near": planet.loaded_near_tile_count(), "planet_mid": planet.loaded_mid_tile_count()}))
	main.initialized = false
	main.queue_free()
	await process_frame
	DirAccess.remove_absolute(ProjectSettings.globalize_path(slot))
	quit()
