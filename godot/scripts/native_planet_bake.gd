extends SceneTree

## Reproducible offline cache of the exact NativePlanetField globe. The saved
## ArrayMesh resources contain geometry only; live shader coverage masks and
## materials are attached when the game loads them.
## Godot --headless --path godot --script res://scripts/native_planet_bake.gd

func _initialize() -> void:
	call_deferred("_bake")


func _bake() -> void:
	var legacy := NativeWorld.new()
	var planet := NativePlanet.new()
	planet.use_baked_far = false
	root.add_child(planet)
	planet.setup_world(legacy)
	var failed: bool = false
	for face in NativePlanet.FACES:
		var tile: Dictionary = planet._far_tiles[face]
		var node: Node3D = tile.node
		var land_mesh: ArrayMesh = ((node.get_child(0) as MeshInstance3D).mesh as ArrayMesh).duplicate(true) as ArrayMesh
		land_mesh.surface_set_material(0, null)
		var land_path: String = NativePlanet._far_path(face, false)
		var land_error: Error = ResourceSaver.save(land_mesh, land_path)
		failed = failed or land_error != OK
		print("BAKE ", face, " land_vertices=", land_mesh.surface_get_array_len(0), " triangles=", land_mesh.surface_get_array_index_len(0) / 3, " error=", land_error)
		if node.get_child_count() > 1:
			var water_mesh: ArrayMesh = ((node.get_child(1) as MeshInstance3D).mesh as ArrayMesh).duplicate(true) as ArrayMesh
			water_mesh.surface_set_material(0, null)
			var water_path: String = NativePlanet._far_path(face, true)
			var water_error: Error = ResourceSaver.save(water_mesh, water_path)
			failed = failed or water_error != OK
			print("BAKE ", face, " water_vertices=", water_mesh.surface_get_array_len(0), " error=", water_error)
	if not failed:
		var sources: Dictionary = {}
		for source: String in ["scripts/native_planet.gd", "scripts/native_planet_field.gd", "scripts/native_planet_field_r3.gd", "scripts/native_world.gd"]:
			sources[source] = FileAccess.get_sha256("res://" + source)
		var manifest := FileAccess.open("res://assets/terrain/planet-far-manifest.json", FileAccess.WRITE)
		if manifest == null:
			failed = true
		else:
			manifest.store_string(JSON.stringify({"version": 3, "segments": NativePlanet.FAR_SEGMENTS, "sources": sources}, "  "))
			manifest.close()
	planet.queue_free()
	legacy.free()
	await process_frame
	quit(1 if failed else 0)
