extends SceneTree

var root3: Node3D
var actor: Node3D
var animator: AnimationPlayer
var camera: Camera3D
var tick := 0
var clips: Array[String] = ["idle", "walk", "jog", "sprint", "cruise", "boost", "jab", "cross", "kick", "guard", "hit", "cast"]
var destination := "res://assets/motion-r2/evidence"
var camera_views := [Vector3(2.8, 1.8, -3.8), Vector3(3.8, 1.6, 0.0), Vector3(-2.8, 1.8, 3.8)]
var capture_sequence := true

func _initialize() -> void:
	call_deferred("run")

func find_player(n: Node) -> AnimationPlayer:
	if n is AnimationPlayer:
		return n
	for child in n.get_children():
		var a := find_player(child)
		if a != null:
			return a
	return null

func run() -> void:
	root3 = Node3D.new()
	root.add_child(root3)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color(0.07, 0.085, 0.11)
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color.WHITE
	env.environment.ambient_light_energy = 0.65
	root3.add_child(env)
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-35, -35, 0)
	light.light_energy = 2.0
	root3.add_child(light)
	# Neutral QA floor, not a delivered game asset.
	var floor_mesh := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(6,6)
	floor_mesh.mesh = plane
	var floor_material := StandardMaterial3D.new()
	floor_material.albedo_color = Color(0.12,0.14,0.17)
	floor_material.roughness = 1.0
	floor_mesh.material_override = floor_material
	floor_mesh.position.y = -0.002
	root3.add_child(floor_mesh)
	actor = load("res://assets/motion-r2/c2-motion-r2.glb").instantiate()
	root3.add_child(actor)
	animator = find_player(actor)
	print("R2_ANIMATIONS ", animator.get_animation_list())
	camera = Camera3D.new()
	root3.add_child(camera)
	camera.current = true
	camera.fov = 32
	DirAccess.make_dir_recursive_absolute(destination)
	for clip in clips:
		var key := ""
		for k in animator.get_animation_list():
			if String(k).get_slice("/", String(k).get_slice_count("/") - 1) == clip:
				key = k
		if key.is_empty():
			push_error("Missing animation: " + clip)
			quit(2)
			return
		animator.play(key)
		for view in range(3):
			camera.position = camera_views[view]
			camera.look_at(Vector3(0, 1.0, 0))
			for sample in range(8):
				animator.seek(animator.current_animation_length * float(sample) / 8.0, true)
				animator.pause()
				await process_frame
				await RenderingServer.frame_post_draw
				root.get_texture().get_image().save_png(destination + "/%s-v%d-f%d.png" % [clip, view, sample])
	print("R2_PREVIEW_COMPLETE ",clips.size()*24," temporal multiview frames")
	if not capture_sequence:
		quit()
		return
	actor.queue_free()
	await process_frame
	var motion = load("res://scripts/native_motion_r2.gd").new()
	root3.add_child(motion)
	motion.player.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	var sequence := [{"speed":0.88},{"airborne":true},{"airborne":true,"boost":true,"bank":0.8},{"airborne":true,"boost":true,"bank":-0.8},{"airborne":true},{"action":"jab"},{"action":"cross"},{"action":"kick"},{"guard":true},{"action":"hit"},{"action":"cast"},{}]
	var frame := 0
	for state in sequence:
		for f in range(30):
			motion.step(1.0/30.0,state)
			var angle := float(frame)/360.0*TAU
			camera.position = Vector3(sin(angle)*4.0,1.7,cos(angle)*4.0)
			camera.look_at(Vector3(0,1.0,0))
			await process_frame
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(destination+"/sequence-%03d.png"%frame)
			frame += 1
	print("R2_TRANSITION_PREVIEW_COMPLETE 360 frames continuous orbit and state changes")
	quit()
