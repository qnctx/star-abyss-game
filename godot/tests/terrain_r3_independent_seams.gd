extends SceneTree
var output: String
var main: NativeMain
var camera: Camera3D
var meshes: Array[MeshInstance3D] = []
var records: Array[Dictionary] = []

func _mid_geometry(planet: NativePlanet, kind: String) -> Dictionary:
	var originals := {}
	for tile in planet._mid_root.get_children():
		for child in tile.get_children():
			if child is MeshInstance3D and child.name != "SurfaceWater":
				var original: ArrayMesh = child.mesh
				var arrays := original.surface_get_arrays(0)
				var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
				var top_count := NativePlanet.TILE_SEGMENTS * NativePlanet.TILE_SEGMENTS * 6
				arrays[Mesh.ARRAY_INDEX] = indices.slice(0, top_count) if kind == "top" else indices.slice(top_count)
				var copy := ArrayMesh.new()
				copy.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
				copy.surface_set_material(0, original.surface_get_material(0))
				originals[child] = original
				child.mesh = copy
	return originals

func _initialize() -> void:
	call_deferred("_run")

func _shot(label: String) -> void:
	await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(output.path_join(label + ".png"))
	print("SEAM_SHOT ", label)

func _collect(node: Node) -> void:
	if node is MeshInstance3D:
		meshes.append(node)
	for child in node.get_children():
		_collect(child)

func _variants(label: String, eye: Vector3, target: Vector3) -> void:
	main.player.global_position = eye
	camera.position = eye
	camera.look_at(target)
	for i in range(180):
		main.world.update_stream(eye)
		await physics_frame
	var planet: NativePlanet = main.world._planet
	meshes.clear()
	_collect(planet)
	var record := {"view": label, "meshes": []}
	record["far_cache_valid_at_capture"] = NativePlanet._far_cache_valid()
	record["legacy_boundary_projection"] = []
	for x in [-3000.0, -1500.0, 0.0, 1500.0, 3000.0]:
		var point := Vector3(x, main.world.height_at(x, -3000.0) - NativeWorld.FAR_DROP, -3000.0)
		record.legacy_boundary_projection.append({"world": str(point), "pixel": str(camera.unproject_position(point))})
	if label == "basin":
		record["boundary_mid_top_heights"] = []
		for x in [-1600.0, -800.0, 0.0, 800.0, 1600.0]:
			var start := Vector3(x, 100.0, -3000.0)
			var end := Vector3(x, -100.0, -3000.0)
			var heights: Array[float] = []
			for tile in planet._mid_root.get_children():
				var mesh := tile.get_child(0) as MeshInstance3D
				var arrays := mesh.mesh.surface_get_arrays(0)
				var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
				var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
				for i in range(0, NativePlanet.TILE_SEGMENTS * NativePlanet.TILE_SEGMENTS * 6, 3):
					var hit: Variant = Geometry3D.segment_intersects_triangle(start, end, mesh.to_global(vertices[indices[i]]), mesh.to_global(vertices[indices[i+1]]), mesh.to_global(vertices[indices[i+2]]))
					if hit != null:
						heights.append(hit.y)
			record.boundary_mid_top_heights.append({"x": x, "z": -3000.0, "old_far_y": main.world.height_at(x, -3000.0) - NativeWorld.FAR_DROP, "mid_top_y": heights})
	for mesh in meshes:
		record.meshes.append({"path": str(mesh.get_path()), "position": str(mesh.global_position), "vertices": mesh.mesh.surface_get_array_len(0)})
	records.append(record)
	await _shot(label + "-all")
	for mode in ["no-water", "no-land", "no-far", "no-mid", "no-near", "far-only", "water-only", "no-basin", "no-basin-near", "no-basin-far"]:
		for mesh in meshes:
			var water := mesh.name == "SurfaceWater"
			mesh.visible = not ((mode == "no-water" and water) or (mode == "no-land" and not water) or (mode == "water-only" and not water))
		planet._far_root.visible = mode != "no-far"
		planet._mid_root.visible = mode != "no-mid" and mode != "far-only"
		planet._near_root.visible = mode != "no-near" and mode != "far-only"
		var basin := main.world.get_node("BasinTerrainChunks") as Node3D
		basin.visible = mode != "no-basin" and mode != "water-only"
		var far := basin.get_node("SixKilometreFarBasin") as Node3D
		far.visible = mode != "no-basin-far"
		for chunk: Node3D in main.world._chunks.values():
			chunk.visible = mode != "no-basin-near"
		await _shot(label + "-" + mode)
	for mesh in meshes:
		mesh.visible = true
	planet._far_root.visible = true
	planet._mid_root.visible = true
	planet._near_root.visible = true
	main.world.get_node("BasinTerrainChunks").visible = true
	main.world.get_node("BasinTerrainChunks/SixKilometreFarBasin").visible = true
	for chunk: Node3D in main.world._chunks.values():
		chunk.visible = true
	for geometry in ["top", "skirts"]:
		var originals := _mid_geometry(planet, geometry)
		await _shot(label + "-mid-" + geometry + "-only")
		for mesh in originals:
			mesh.mesh = originals[mesh]
	for near_value in [10.0, 100.0, 1000.0]:
		camera.near = near_value
		await _shot(label + "-camera-near-%d" % int(near_value))
	camera.near = 0.3

func _run() -> void:
	output = OS.get_environment("TERRAIN_R3_OUTPUT")
	assert(not output.is_empty())
	main = (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	main.save_path = output.path_join("seams-isolated-save.json")
	root.add_child(main)
	await physics_frame
	main.set_process(false)
	main.set_physics_process(false)
	main.player.set_physics_process(false)
	main.player.visible = false
	for node in main.find_children("*", "Control", true, false):
		node.hide()
	camera = Camera3D.new()
	camera.near = 0.3
	camera.far = 800000.0
	camera.fov = 65.0
	root.add_child(camera)
	camera.make_current()
	await _variants("basin", Vector3(0,1600,190), Vector3(0,0,-950))
	await _variants("orbit", Vector3(95000,160000,110000), NativePlanet.CENTER)
	var file := FileAccess.open(output.path_join("seams-nodes.json"), FileAccess.WRITE)
	file.store_string(JSON.stringify(records, "\t"))
	file.close()
	main.initialized = false
	main.queue_free()
	await process_frame
	quit()
