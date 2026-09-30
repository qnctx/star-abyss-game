extends SceneTree

var game: NativeMain
var beast: NativeEnemyR3
var camera: Camera3D
var label: Label
var records: Array[Dictionary] = []

func _initialize() -> void:
	call_deferred("_run")

func _wait(seconds: float) -> void:
	var before := beast.total_physics_time
	while beast.total_physics_time - before < seconds:
		await physics_frame

func _capture(filename: String, caption: String) -> void:
	label.text = caption
	await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://reports/enemy-r3/" + filename + ".png")
	records.append({"file": filename, "state": beast.get_combat_snapshot()})

func _fixture(kind: String, air := false) -> void:
	beast.restore({"hp": beast.max_hp, "position": [beast.home.x, beast.home.y + (7.0 if air else 0.0), beast.home.z], "mode": "air" if air else "ground"})
	beast.rotation.y = 0.0
	beast.aggro_until = beast.clock + 30.0
	beast._next_sense = beast.clock + 30.0
	beast._decision_ready = beast.clock + 30.0
	game.player.global_position = beast.global_position + Vector3(0, 0, -2.1 if kind == "claw" else -6.0)
	game.player.rotation.y = PI
	game.player.flight_active = air
	beast._last_seen = game.player.global_position
	beast._perceived = true
	camera.global_position = beast.global_position + Vector3(5.5, 3.0, -6.0)
	camera.look_at(beast.global_position + Vector3.UP * 1.1)
	beast._attack(kind)

func _run() -> void:
	DirAccess.make_dir_recursive_absolute("res://reports/enemy-r3")
	game = (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = "user://enemy_r3_visual_fixture.json"
	root.add_child(game)
	game.initialized = false
	game.set_physics_process(false)
	game.set_process(false)
	game.player.set_physics_process(false)
	game.ascension.set_physics_process(false)
	game.get_node("Hud").visible = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	beast = game.beast
	for connection in beast.enemy_attack_requested.get_connections():
		beast.enemy_attack_requested.disconnect(connection.callable)
	beast.enemy_attack_requested.connect(func(_event: Dictionary): pass)
	var model := beast.get_node("Model")
	for child in model.get_children():
		child.queue_free()
	await process_frame
	model.add_child((load("res://assets/enemy-r3/riftwing-r3.glb") as PackedScene).instantiate())
	beast.setup(game.world, game.player)
	game.world.update_stream(beast.global_position)
	camera = Camera3D.new()
	camera.fov = 58.0
	game.add_child(camera)
	camera.current = true
	var overlay := CanvasLayer.new()
	root.add_child(overlay)
	label = Label.new()
	label.position = Vector2(20, 18)
	label.add_theme_font_size_override("font_size", 23)
	label.add_theme_color_override("font_shadow_color", Color.BLACK)
	label.add_theme_constant_override("shadow_offset_x", 2)
	label.add_theme_constant_override("shadow_offset_y", 2)
	overlay.add_child(label)
	await _wait(0.5)
	for action in ["claw", "lunge", "tail", "rise", "shard", "sweep", "dive"]:
		_fixture(action, action in ["sweep", "dive"])
		var rule: Dictionary = NativeEnemyR3.MOVES[action]
		await _wait(float(rule["windup"]) * 0.55)
		await _capture(action + "-windup", "R3 " + action + " / readable windup / actual Godot viewport")
		await _wait(float(rule["windup"]) * 0.45 + float(rule["active"]) * 0.68)
		# Keep camera near moving lunge/dive while showing the target.
		camera.global_position = beast.global_position + Vector3(5.5, 3.0, -6.0)
		camera.look_at(beast.global_position + Vector3.UP * 1.1)
		await _capture(action + "-contact", "R3 " + action + " / contact and follow-through")
	var model_children := model.get_children()
	for child in model_children:
		child.queue_free()
	await process_frame
	model.add_child((load("res://assets/enemy-r3/rift-prowler-r3.glb") as PackedScene).instantiate())
	beast.configure_variant("ground", beast.home)
	beast.setup(game.world, game.player)
	_fixture("claw")
	await _wait(0.49)
	await _capture("ground-variant-claw", "R3 ground prowler / preserved sculpt and animated foreclaw")
	var file := FileAccess.open("res://reports/enemy-r3/visual-records.json", FileAccess.WRITE)
	file.store_string(JSON.stringify({"records": records, "manual_feel_verified": false}, "\t"))
	file.close()
	print("ENEMY_R3_VISUAL_READY ", records.size())
	game.initialized = false
	game.queue_free()
	await process_frame
	quit()
