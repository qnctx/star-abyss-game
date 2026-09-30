extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var results: Array[Dictionary] = []
	for path in ["res://assets/riftwing-r11.glb", "res://assets/enemy-r3/riftwing-r3.glb", "res://assets/enemy-r3/rift-prowler-r3.glb"]:
		var node := (load(path) as PackedScene).instantiate()
		root.add_child(node)
		var row := {"path": path}
		for body in node.find_children("*", "MeshInstance3D", true, false):
			if "Body" in String(body.name):
				row["body_aabb"] = str(body.get_aabb())
				row["body_transform"] = str(body.global_transform)
				row["vertices"] = body.mesh.surface_get_array_len(0)
		for animation in node.find_children("*", "AnimationPlayer", true, false):
			row["clips"] = animation.get_animation_list()
		results.append(row)
		node.queue_free()
	await process_frame
	var report := FileAccess.open("res://reports/enemy-r3/asset-audit.json", FileAccess.WRITE)
	report.store_string(JSON.stringify(results, "\t"))
	report.close()
	print("ENEMY_ASSET_AUDIT ", JSON.stringify(results))
	quit()
