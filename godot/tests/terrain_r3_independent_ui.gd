extends SceneTree
var checks: Array[Dictionary] = []
var layouts: Array[Dictionary] = []
var output: String
var main: NativeMain

func _initialize() -> void:
	call_deferred("_run")

func _check(label: String, passed: bool) -> void:
	checks.append({"name": label, "pass": passed})
	print("UI_CHECK ", label, " ", passed)

func _key(code: Key) -> void:
	var event := InputEventKey.new()
	event.physical_keycode = code
	event.keycode = code
	event.pressed = true
	root.push_input(event, false)
	event = event.duplicate()
	event.pressed = false
	root.push_input(event, false)

func _shot(name: String) -> void:
	main._update_hud()
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(output.path_join(name + ".png"))

func _run() -> void:
	output = OS.get_environment("TERRAIN_R3_OUTPUT")
	assert(not output.is_empty())
	main = (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	main.save_path = output.path_join("ui-save.json")
	root.add_child(main)
	for i in range(90):
		await physics_frame
	for size in [Vector2i(1280,720), Vector2i(800,600)]:
		root.size = size
		for i in range(8):
			await process_frame
		_key(KEY_ESCAPE)
		await process_frame
		_check("Escape releases mouse " + str(size), Input.get_mouse_mode() != Input.MOUSE_MODE_CAPTURED)
		var click := InputEventMouseButton.new()
		click.button_index = MOUSE_BUTTON_LEFT
		click.position = Vector2(size) * 0.5
		click.pressed = true
		root.push_input(click, false)
		click = click.duplicate()
		click.pressed = false
		root.push_input(click, false)
		await process_frame
		_check("viewport click restores control " + str(size), Input.get_mouse_mode() == Input.MOUSE_MODE_CAPTURED)
		main.message_until = 0.0
		main._update_hud()
		await process_frame
		var labels: Array[Dictionary] = []
		for label: Label in main.find_children("*", "Label", true, false):
			if not label.is_visible_in_tree():
				continue
			var rect := label.get_global_rect()
			labels.append({"path": str(label.get_path()), "rect": str(rect), "text": label.text,
				"lines": label.get_line_count(), "visible_lines": label.get_visible_line_count()})
			_check("label bounds " + str(size) + " " + str(label.name), Rect2(Vector2.ZERO, Vector2(size)).encloses(rect))
			_check("label all lines visible " + str(size) + " " + str(label.name), label.get_visible_line_count() >= label.get_line_count())
		layouts.append({"size": str(size), "labels": labels, "buttons": main.find_children("*", "Button", true, false).size()})
		await _shot("ui-%dx%d-third-person" % [size.x,size.y])
		_key(KEY_V)
		for i in range(12):
			await physics_frame
		_check("V switches first person " + str(size), main.player._first_person)
		_check("original near 0.05 " + str(size), is_equal_approx((main.player.get_node("CameraPivot/Camera3D") as Camera3D).near, 0.05))
		await _shot("ui-%dx%d-first-person" % [size.x,size.y])
		_key(KEY_V)
		await physics_frame
	var file := FileAccess.open(output.path_join("ui.json"), FileAccess.WRITE)
	file.store_string(JSON.stringify({"checks": checks, "layouts": layouts}, "\t"))
	file.close()
	main.initialized = false
	main.queue_free()
	await process_frame
	var failed := checks.filter(func(c: Dictionary) -> bool: return not c["pass"]).size()
	quit(0 if failed == 0 else 1)
