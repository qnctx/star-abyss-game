extends SceneTree

var game: NativeMain
var camera: Camera3D

func _initialize() -> void:
	call_deferred("_run")

func frames(count: int) -> void:
	for i in range(count):
		await physics_frame

func capture(name: String, text: String) -> void:
	game._notice(text)
	game._update_hud()
	await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://reports/native-ai/" + name + ".png")

func _run() -> void:
	DirAccess.make_dir_recursive_absolute("res://reports/native-ai")
	game = (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = "user://native_ai_visual_test_only.json"
	root.add_child(game)
	game.set_physics_process(false)
	game.set_process(false)
	game.player.set_physics_process(false)
	game.ascension.set_physics_process(false)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	var npc := game.camp_npc
	camera = Camera3D.new()
	camera.fov = 58.0
	game.add_child(camera)
	camera.current = true
	camera.global_position = npc.global_position + Vector3(6.5, 3.0, 8.0)
	camera.look_at(npc.global_position + Vector3.UP * 1.0)
	await frames(20)
	await capture("technician-idle", "营地技师 · 靠近按 E 交谈")
	npc.clock = 109.9
	await frames(70)
	camera.global_position = npc.global_position + Vector3(6.5, 3.0, 8.0)
	camera.look_at(npc.global_position + Vector3.UP * 1.0)
	await capture("technician-walk", "营地技师 · 正在巡检信标")
	game.player.global_position = npc.global_position + Vector3(0.0, 0.0, 2.0)
	game.player.global_position.y = game.world.height_at(game.player.global_position.x, game.player.global_position.z)
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	var interact := InputEventKey.new()
	interact.physical_keycode = KEY_E
	interact.pressed = true
	Input.parse_input_event(interact)
	await frames(2)
	game._update_hud()
	await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://reports/native-ai/technician-interact.png")
	print("NATIVE_AI_E_INTERACTION ", JSON.stringify({"talks": npc.mind.talks, "message": game.message, "hint": game.hint.text}))
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	print("NATIVE_AI_CAMP_VISUAL_READY ", "res://reports/native-ai/")
	game.queue_free()
	await process_frame
	quit()
