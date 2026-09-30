extends SceneTree
const Motion = preload("res://scripts/native_motion_r2.gd")
var destination := "res://assets/motion-r2/evidence/combat-sequence"
func _initialize() -> void:
	call_deferred("run")
func run() -> void:
	var stage := Node3D.new()
	root.add_child(stage)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color(0.07,0.085,0.11)
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color.WHITE
	env.environment.ambient_light_energy = 0.7
	stage.add_child(env)
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-35,-35,0)
	light.light_energy = 2.0
	stage.add_child(light)
	var floor_mesh := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(5,5)
	floor_mesh.mesh = plane
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(0.12,0.14,0.17)
	floor_mesh.material_override = material
	floor_mesh.position.y = -0.002
	stage.add_child(floor_mesh)
	var camera := Camera3D.new()
	camera.fov = 38
	stage.add_child(camera)
	camera.current = true
	DirAccess.make_dir_recursive_absolute(destination)
	var views := [Vector3(0,1.6,-4.1),Vector3(4.1,1.6,0),Vector3(2.9,1.6,-3.2)]
	var sequence := [{"action":"guard","duration":0.4},{"action":"jab","duration":0.42,"windup":0.15},{"action":"cross","duration":0.50,"windup":0.19},{"action":"kick","duration":0.68,"windup":0.27},{"action":"guard","duration":0.4},{"action":"hit","duration":0.35,"windup":0.13},{"duration":0.8},{"airborne":true,"action":"jab","duration":0.42,"windup":0.15},{"airborne":true,"action":"cross","duration":0.50,"windup":0.19},{"airborne":true,"action":"kick","duration":0.68,"windup":0.27}]
	for view in range(3):
		var motion := Motion.new()
		stage.add_child(motion)
		camera.position = views[view]
		camera.look_at(Vector3(0,1.16,0))
		var frame := 0
		for state in sequence:
			var duration: float = state.duration
			var count := roundi(duration*30.0)
			for f in range(count):
				var elapsed := float(f)/30.0
				if state.has("windup"):
					state["progress"] = motion._contact_progress(elapsed,state.windup,duration)
				motion.position.y = 0.4 if state.get("airborne",false) else 0.0
				motion.step(1.0/30.0,state)
				await process_frame
				await RenderingServer.frame_post_draw
				root.get_texture().get_image().save_png(destination+"/v%d-%03d.png"%[view,frame])
				frame += 1
		motion.free()
	print("COMBAT_SEQUENCE_COMPLETE normal-speed 3-view grounded combo, guard, hit, recovery, airborne combo")
	quit()
