extends SceneTree


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var world := NativeWorld.new()
	root.add_child(world)
	var planet: NativePlanet = world._planet
	var valid := NativePlanet._far_cache_valid()
	var face_vertices: Dictionary = {}
	var correct := valid
	for face: String in NativePlanet.FACES:
		var record: Dictionary = planet._far_tiles.get(face, {})
		if record.is_empty():
			correct = false
			continue
		var mesh: ArrayMesh = ((record.node as Node3D).get_child(0) as MeshInstance3D).mesh
		var vertices: int = mesh.surface_get_array_len(0)
		face_vertices[face] = vertices
		correct = correct and vertices == (NativePlanet.FAR_SEGMENTS + 1) * (NativePlanet.FAR_SEGMENTS + 1)
	print("NATIVE_PLANET_FAR_CACHE_JSON=" + JSON.stringify({"valid_manifest": valid, "face_vertices": face_vertices, "segments": NativePlanet.FAR_SEGMENTS, "passed": correct}))
	quit(0 if correct else 1)
