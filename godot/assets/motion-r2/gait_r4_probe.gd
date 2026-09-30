extends SceneTree
## Normal-time, final mesh + raw animation comparisons; synthetic input fixture.
var stage: Node3D
var actor: Driver
var camera: Camera3D
var out := "res://assets/motion-r2/evidence/gait-r4/before"
var view := "side"
var capture := false
var images: Array = []

class Driver extends Node3D:
	var motion: NativeMotionR2
	var raw: NativeMotionR2
	var tick := 0
	var elapsed := 0.0
	var records: Array = []
	var stage_index := 0
	var age := 0.0
	var done := false
	var wall_start := 0
	var soles: Dictionary = {}
	var stages := [{"name":"idle","speed":0.0,"duration":0.5},{"name":"walk","speed":1.6,"duration":2.0},{"name":"jog","speed":6.8,"duration":2.0},{"name":"sprint","speed":10.0,"duration":2.0},{"name":"stop","speed":0.0,"duration":0.8}]
	func _ready() -> void:
		soles = JSON.parse_string(FileAccess.get_file_as_string("res://assets/motion-r2/gait-foot-r4.json"))
		motion = NativeMotionR2.new()
		add_child(motion)
		raw = NativeMotionR2.new()
		add_child(raw)
		raw.visible = false
		wall_start = Time.get_ticks_usec()
	func pose_points(rig: Skeleton3D) -> Dictionary:
		var data := {}
		for n in ["pelvis","hipL","kneeL","ankleL","hipR","kneeR","ankleR","shoulderL","elbowL","wristL"]:
			var p := rig.get_bone_global_pose(rig.find_bone(n)).origin
			data[n] = [p.x,p.y,p.z]
		for side in ["L","R"]:
			var bone := rig.find_bone("ankle"+side)
			var ankle := rig.get_bone_global_pose(bone)
			var deform := ankle.basis*rig.get_bone_global_rest(bone).basis.inverse()
			var floor_y := INF
			for point in soles[side]["sole"]:
				floor_y = minf(floor_y,(ankle.origin+deform*Vector3(point[0],point[1],point[2])).y)
			data["sole_min_"+side] = floor_y
		return data
	func _physics_process(delta: float) -> void:
		if done:
			return
		var c: Dictionary = stages[stage_index]
		age += delta
		elapsed += delta
		tick += 1
		position.z -= float(c.speed)*delta
		motion.step(delta,{"speed":c.speed,"local_velocity":Vector3(0,0,-float(c.speed))})
		raw._rig.reset_bone_poses()
		raw.player.play(raw.names[motion.current],0.0)
		raw.player.seek(motion.player.current_animation_position,true)
		records.append({"tick":tick,"physics_frame":Engine.get_physics_frames(),"delta":delta,"seconds":elapsed,"wall":float(Time.get_ticks_usec()-wall_start)/1000000.0,"stage":c.name,"speed":c.speed,"clip":motion.current,"phase":motion.gait_phase,"raw":pose_points(raw._rig),"runtime":pose_points(motion._rig),"left_locked":motion._foot_anchors.has("L"),"right_locked":motion._foot_anchors.has("R")})
		if age >= float(c.duration):
			age = 0.0
			stage_index += 1
			if stage_index == stages.size():done = true

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	for arg in args:
		if arg.begins_with("--tag="):out = "res://assets/motion-r2/evidence/gait-r4/"+arg.trim_prefix("--tag=")
		if arg.begins_with("--view="):view = arg.trim_prefix("--view=")
		if arg == "--capture":capture = true
	call_deferred("run")

func run() -> void:
	DirAccess.make_dir_recursive_absolute(out+"/"+view)
	stage = Node3D.new()
	root.add_child(stage)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color(0.045,0.055,0.075)
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color.WHITE
	env.environment.ambient_light_energy = 0.75
	stage.add_child(env)
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-40,40,0)
	light.light_energy = 1.5
	stage.add_child(light)
	var floor_mesh := MeshInstance3D.new()
	floor_mesh.mesh = PlaneMesh.new()
	floor_mesh.mesh.size = Vector2(160,160)
	floor_mesh.position.y = -0.005
	var shader := Shader.new()
	shader.code = "shader_type spatial; varying vec3 p; void vertex(){p=(MODEL_MATRIX*vec4(VERTEX,1.0)).xyz;} void fragment(){float line=step(0.025,abs(fract(p.x)-0.5))*step(0.025,abs(fract(p.z)-0.5));ALBEDO=mix(vec3(0.3),vec3(0.12,0.14,0.17),line);ROUGHNESS=1.0;}"
	var mat := ShaderMaterial.new()
	mat.shader = shader
	floor_mesh.material_override = mat
	stage.add_child(floor_mesh)
	actor = Driver.new()
	stage.add_child(actor)
	camera = Camera3D.new()
	actor.add_child(camera)
	camera.position = Vector3(4.5,1.10,0.0) if view == "side" else Vector3(0,1.10,-4.5) if view == "front" else Vector3(0,1.10,4.5)
	camera.look_at(Vector3(0,0.94,0))
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 2.35
	camera.current = true
	var previous := -1.0
	while not actor.done:
		await physics_frame
		if capture and actor.elapsed-previous >= 1.0/30.0:
			await RenderingServer.frame_post_draw
			var file := "%05d.png"%actor.tick
			root.get_texture().get_image().save_png(out+"/"+view+"/"+file)
			images.append({"file":file,"seconds":actor.elapsed,"wall":float(Time.get_ticks_usec()-actor.wall_start)/1000000.0,"tick":actor.tick})
			previous = actor.elapsed
	FileAccess.open(out+"/"+view+"-trace.json",FileAccess.WRITE).store_string(JSON.stringify({"view":view,"time_scale":Engine.time_scale,"records":actor.records,"images":images},"\t"))
	print("GAIT_R4_PROBE ",view," frames=",actor.tick," physics_seconds=",actor.elapsed," images=",images.size())
	quit()
