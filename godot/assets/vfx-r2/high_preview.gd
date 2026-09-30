extends SceneTree
func _initialize() -> void:
	call_deferred("run")
func run() -> void:
	var scene := Node3D.new()
	root.add_child(scene)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color(0.07,0.085,0.11)
	scene.add_child(env)
	var camera := Camera3D.new()
	scene.add_child(camera)
	camera.current = true
	camera.fov = 65
	var out := "res://assets/vfx-r2/evidence/high"
	DirAccess.make_dir_recursive_absolute(out)
	for tier in [6,8,9]:
		for view in range(3):
			camera.position = [Vector3(0,1.4,4),Vector3(3,1.8,3),Vector3(0,1.4,0.25)][view]
			camera.look_at(Vector3(0,1.4,-3))
			for f in range(8):
				var effect = load("res://scripts/native_vfx_r2.gd").new()
				scene.add_child(effect)
				effect.auto_tick = false
				effect.launch_tier(tier,Vector3(0,1.4,3),Vector3(0,1.4,0),0.5)
				effect.advance(float(f)*.1)
				await process_frame
				await RenderingServer.frame_post_draw
				root.get_texture().get_image().save_png(out+"/r%d-v%d-f%d.png"%[tier,view,f])
				effect.queue_free()
				await process_frame
	print("HIGH_VFX_PREVIEW 72 frames: normal oblique and camera-inside safety")
	quit()
