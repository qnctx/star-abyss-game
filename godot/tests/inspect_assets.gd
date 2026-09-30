extends SceneTree

func _initialize() -> void:
	call_deferred("_inspect")

func _inspect() -> void:
	var scene := load("res://scenes/main.tscn") as PackedScene
	if scene == null:
		push_error("main scene missing")
		quit(1)
		return
	var game := scene.instantiate() as NativeMain
	game.save_path = "user://star_abyss_native_asset_inspection.json"
	root.add_child(game)
	await process_frame
	for path in ["Player/Model", "Riftwing/Model", "SurveySkimmer"]:
		var node := game.get_node_or_null(path)
		if node == null:
			push_error("missing " + path)
			continue
		var stats := {"meshes": 0, "skeletons": [], "animations": []}
		_scan(node, stats)
		print(JSON.stringify({"path": path, "stats": stats}))
	print(JSON.stringify({"chunks": game.world.loaded_chunk_count(), "height_spawn": game.world.height_at(0.0, 190.0)}))
	game.initialized = false
	game.queue_free()
	await process_frame
	quit()

func _scan(node: Node, stats: Dictionary) -> void:
	if node is MeshInstance3D:
		stats["meshes"] += 1
	if node is Skeleton3D:
		var names: Array[String] = []
		for i in range((node as Skeleton3D).get_bone_count()):
			names.append((node as Skeleton3D).get_bone_name(i))
		stats["skeletons"].append(names)
	if node is AnimationPlayer:
		for item in (node as AnimationPlayer).get_animation_list():
			stats["animations"].append(String(item))
	for child in node.get_children():
		_scan(child, stats)
