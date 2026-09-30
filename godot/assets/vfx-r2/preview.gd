extends SceneTree
var scene: Node3D
var camera: Camera3D
var motion: Node3D
var fx: Node3D
func _initialize() -> void:
	call_deferred("run")
func run() -> void:
	scene = Node3D.new()
	root.add_child(scene)
	var environment := WorldEnvironment.new()
	environment.environment = Environment.new()
	environment.environment.background_mode = Environment.BG_COLOR
	environment.environment.background_color = Color(0.055,0.07,0.095)
	environment.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.environment.ambient_light_color = Color.WHITE
	environment.environment.ambient_light_energy = 0.8
	scene.add_child(environment)
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-40,-30,0)
	scene.add_child(light)
	motion = load("res://scripts/native_motion_r2.gd").new()
	scene.add_child(motion)
	motion.step(0.016,{"action":"cast","progress":0.38})
	motion.player.pause()
	camera = Camera3D.new()
	scene.add_child(camera)
	camera.current = true
	camera.fov = 62
	var out := "res://assets/vfx-r2/evidence"
	DirAccess.make_dir_recursive_absolute(out)
	var views := [Vector3(0,2.25,4.5),Vector3(4,2,1),Vector3(0,1.7,-0.12)]
	for v in range(3):
		camera.position = views[v]
		camera.look_at(Vector3(0,1.4,-3))
		motion.visible = v != 2
		for f in range(8):
			fx = load("res://scripts/native_vfx_r2.gd").new()
			scene.add_child(fx)
			fx.auto_tick = false
			fx.launch(Vector3(0.3,1.4,-0.45),Vector3.FORWARD,8.0)
			fx.advance(float(f)*0.1)
			await process_frame
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(out+"/qi-v%d-f%d.png"%[v,f])
			fx.queue_free()
			await process_frame
	print("R2_VFX_PREVIEW_COMPLETE 24 frames third-person/side/first-person")
	quit()
