extends SceneTree
const OUT := "res://assets/motion-r2/evidence/r3-keys"
func _initialize() -> void:
	call_deferred("run")
func run() -> void:
	DirAccess.make_dir_recursive_absolute(OUT)
	var stage := Node3D.new()
	root.add_child(stage)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color(0.075,0.085,0.11)
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color.WHITE
	env.environment.ambient_light_energy = 0.85
	stage.add_child(env)
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-32,-40,0)
	light.light_energy = 1.6
	stage.add_child(light)
	var camera := Camera3D.new()
	stage.add_child(camera)
	camera.fov = 33
	camera.current = true
	var motion := NativeMotionR2.new()
	stage.add_child(motion)
	var clips := ["jab","cross","walk","jog","sprint","cast_fist","cast_palm","cast_sweep","cast_cleave","cast_skyfall","air_cast_skyfall"]
	for clip in clips:
		if not motion.names.has(clip):
			push_error("missing clip "+clip)
			quit(2)
			return
		motion.player.play(motion.names[clip])
		for sample in [0.20,0.38,0.50,0.65]:
			motion._rig.reset_bone_poses()
			motion.player.seek(sample*motion.player.current_animation_length,true)
			for view in ["front","side","hand"]:
				var target := Vector3(0,1.0,0)
				camera.position = Vector3(2.4,1.7,-3.7) if view == "front" else Vector3(3.7,1.5,0)
				if view == "hand":
					target = motion.socket_transform_world("hand_l" if clip in ["cast_palm","jab"] else "hand_r").origin
					camera.position = target+Vector3(0.48,0.17,-0.65)
				camera.look_at(target)
				await process_frame
				await RenderingServer.frame_post_draw
				root.get_texture().get_image().save_png(OUT+"/%s-%02d-%s.png"%[clip,roundi(sample*100),view])
	print("R3_KEYS_COMPLETE 132 diagnostic images; static seeks, not normal-speed evidence")
	quit()
