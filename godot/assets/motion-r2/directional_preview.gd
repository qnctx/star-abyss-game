extends SceneTree
var results: Array = []
func _initialize() -> void:
	call_deferred("run")
func run() -> void:
	var scene := Node3D.new()
	root.add_child(scene)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color(0.06,0.08,0.11)
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color.WHITE
	env.environment.ambient_light_energy = 0.7
	scene.add_child(env)
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-40,-30,0)
	light.light_energy = 1.8
	scene.add_child(light)
	var floor_node := MeshInstance3D.new()
	var floor_mesh := PlaneMesh.new()
	floor_mesh.size = Vector2(50,50)
	floor_node.mesh = floor_mesh
	var mat := ShaderMaterial.new()
	var shader := Shader.new()
	shader.code = "shader_type spatial; varying vec3 wp; void vertex(){wp=(MODEL_MATRIX*vec4(VERTEX,1.0)).xyz;} void fragment(){vec2 line=abs(fract(wp.xz+0.5)-0.5); float g=1.0-smoothstep(0.01,0.025,min(line.x,line.y)); ALBEDO=mix(vec3(0.12,0.14,0.17),vec3(0.3,0.34,0.38),g); ROUGHNESS=1.0;}"
	mat.shader = shader
	floor_node.material_override = mat
	floor_node.position.y = -0.002
	scene.add_child(floor_node)
	var camera := Camera3D.new()
	scene.add_child(camera)
	camera.current = true
	camera.fov = 38
	var label := Label.new()
	label.position = Vector2(20,20)
	label.add_theme_font_size_override("font_size",24)
	root.add_child(label)
	var cases := [
		{"name":"jog-W","speed":6.8,"v":Vector3(0,0,-6.8)},
		{"name":"sprint-W","speed":10.0,"v":Vector3(0,0,-10)},
		{"name":"jog-S","speed":6.8,"v":Vector3(0,0,6.8)},
		{"name":"jog-A","speed":6.8,"v":Vector3(-6.8,0,0)},
		{"name":"jog-D","speed":6.8,"v":Vector3(6.8,0,0)},
		{"name":"moving-jab","speed":6.8,"v":Vector3(0,0,-6.8),"action":"jab"},
		{"name":"strafe-guard","speed":6.8,"v":Vector3(6.8,0,0),"guard":true},
		{"name":"boost-jab","speed":120.0,"v":Vector3(0,0,-120),"airborne":true,"boost":true}]
	var out := "res://assets/motion-r2/evidence/directional"
	DirAccess.make_dir_recursive_absolute(out)
	for case in cases:
		var motion = load("res://scripts/native_motion_r2.gd").new()
		scene.add_child(motion)
		var state: Dictionary = case.duplicate()
		state["local_velocity"] = case["v"]
		for f in range(90):
			if case["name"] == "boost-jab":
				state["bank"] = sin(float(f)/20.0)
				if f >= 30 and f < 54:
					state["action"] = "jab"
					state["progress"] = float(f-30)/24.0
				else:
					state.erase("action")
					state.erase("progress")
			elif case.has("action"):
				state["progress"] = fposmod(float(f)/30.0,0.6)/0.6
			motion.step(1.0/30.0,state)
			if not case.get("airborne",false):
				motion.position += case["v"] / 30.0
			var target: Vector3 = motion.position+Vector3(0,1,0)
			camera.position = target+Vector3(2.7,0.9,4.1)
			camera.look_at(target)
			label.text = "%s | %.1f m/s | frame %d"%[case["name"],case["speed"],f]
			await process_frame
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(out+"/%s-%03d.png"%[case["name"],f])
		results.append({"case":case["name"],"gait":motion.gait_name,"rate":motion.playback_rate})
		motion.queue_free()
		await process_frame
	var file := FileAccess.open(out+"/report.json",FileAccess.WRITE)
	file.store_string(JSON.stringify(results,"  "))
	print("DIRECTIONAL_PREVIEW 720 actual rendered frames ",JSON.stringify(results))
	quit()
