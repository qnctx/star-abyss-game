extends SceneTree
## Automatic engine clock, actual current Motion methods, candidate asset only.
## Synthetic speed fixture; not a keyboard or full-world playtest.
const CandidateScript = preload("res://assets/motion-r2/gait-r7/candidate_motion.gd")
var actor: Driver
var camera: Camera3D
var output := "res://assets/motion-r2/evidence/gait-r7/candidate1"
var asset := "res://assets/motion-r2/gait-r7/candidate.glb"
var view := "side"
var label := "R7 candidate"
var adapter_path := "res://assets/motion-r2/gait-r7/candidate_motion.gd"
var capture := true
var images: Array = []
var captured: Array[Image] = []

class Driver extends Node3D:
	var motion: NativeMotionR2
	var asset_path: String
	var adapter_path: String
	var camera: Camera3D
	var caption: Label
	var tick := 0
	var elapsed := 0.0
	var wall_start := 0
	var age := 0.0
	var index := 0
	var speed := 0.0
	var done := false
	var records: Array = []
	var stages := [{"name":"idle","speed":0.0,"duration":0.4},{"name":"walk","speed":1.6,"duration":3.0},{"name":"jog","speed":6.8,"duration":2.1},{"name":"sprint","speed":10.0,"duration":1.8},{"name":"stop","speed":0.0,"duration":0.8}]
	func _ready() -> void:
		var adapter := load(adapter_path) as Script
		motion = adapter.new()
		motion.set("asset_path",asset_path)
		add_child(motion)
		wall_start = Time.get_ticks_usec()
	func _process(_dt: float) -> void:
		if caption != null:
			caption.text = "C2 | %s | %.2f m/s | %.2f s | phase %.3f" % [motion.current,speed,elapsed,motion.gait_phase]
	static func vec(p: Vector3) -> Array:
		return [p.x,p.y,p.z]
	static func xf(t: Transform3D) -> Array:
		return [t.basis.x.x,t.basis.x.y,t.basis.x.z,t.basis.y.x,t.basis.y.y,t.basis.y.z,t.basis.z.x,t.basis.z.y,t.basis.z.z,t.origin.x,t.origin.y,t.origin.z]
	func _physics_process(delta: float) -> void:
		if done:
			return
		var c: Dictionary = stages[index]
		speed = move_toward(speed,float(c.speed),28.0*delta)
		position.z -= speed*delta
		motion.step(delta,{"speed":speed,"local_velocity":Vector3(0,0,-speed)})
		age += delta
		elapsed += delta
		tick += 1
		var rig := motion._rig
		var bone_transforms: Array = []
		var names: Array = []
		var projected := {}
		var joints := {}
		for i in range(rig.get_bone_count()):
			var bone := rig.get_bone_global_pose(i)
			bone_transforms.append(bone)
			names.append(String(rig.get_bone_name(i)))
			var world := rig.global_transform*bone.origin
			joints[names[-1]] = vec(world)
			if camera != null:
				var screen := camera.unproject_position(world)
				projected[names[-1]] = [screen.x,screen.y]
		var probe_positions: Array = []
		for terms in motion._sole_points:
			var point := Vector3.ZERO
			for term in terms:
				point += (bone_transforms[term[0]]*Vector3(term[2]))*float(term[1])
			probe_positions.append(vec(rig.global_transform*point))
		var packed_bones: Array = []
		for t in bone_transforms:
			packed_bones.append(xf(t))
		records.append({"tick":tick,"physics_frame":Engine.get_physics_frames(),"in_physics":Engine.is_in_physics_frame(),"delta":delta,"seconds":elapsed,"wall":float(Time.get_ticks_usec()-wall_start)/1e6,"stage":c.name,"stage_age":age,"speed":speed,"clip":motion.current,"phase":motion.gait_phase,"visual_lift":motion._gait_floor_lift,"character_transform":xf(global_transform),"model_transform":xf(motion.model.global_transform),"rig_transform":xf(rig.global_transform),"bone_names":names,"bone_global_poses":packed_bones,"joints_world":joints,"projected_joints":projected,"fixed_material_points_world":probe_positions})
		if age >= float(c.duration):
			age = 0.0
			index += 1
			done = index == stages.size()

func _initialize() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg == "--no-capture":capture = false
		if arg.begins_with("--adapter="):adapter_path = arg.trim_prefix("--adapter=")
		if arg.begins_with("--out="):output = arg.trim_prefix("--out=")
		if arg.begins_with("--model="):asset = arg.trim_prefix("--model=")
		if arg.begins_with("--view="):view = arg.trim_prefix("--view=")
		if arg.begins_with("--label="):label = arg.trim_prefix("--label=")
	call_deferred("run")

func run() -> void:
	DirAccess.make_dir_recursive_absolute(output+"/"+view)
	var driver_hash := FileAccess.get_sha256("res://scripts/native_motion_r2.gd")
	var asset_hash := FileAccess.get_sha256(asset)
	var stage := Node3D.new()
	root.add_child(stage)
	var environment := WorldEnvironment.new()
	environment.environment = Environment.new()
	environment.environment.background_mode = Environment.BG_COLOR
	environment.environment.background_color = Color(0.19,0.23,0.28)
	environment.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.environment.ambient_light_color = Color.WHITE
	environment.environment.ambient_light_energy = 0.7
	stage.add_child(environment)
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-42,35,0)
	light.light_energy = 1.6
	light.shadow_enabled = true
	stage.add_child(light)
	var floor_mesh := MeshInstance3D.new()
	floor_mesh.mesh = PlaneMesh.new()
	floor_mesh.mesh.size = Vector2(160,160)
	floor_mesh.position.y = -0.002
	var shader := Shader.new()
	shader.code = "shader_type spatial; varying vec3 p; void vertex(){p=(MODEL_MATRIX*vec4(VERTEX,1.0)).xyz;} void fragment(){float line=1.0-step(0.018,min(abs(fract(p.x)-0.5),abs(fract(p.z)-0.5))); ALBEDO=mix(vec3(0.22,0.25,0.29),vec3(0.38,0.42,0.47),line);ROUGHNESS=1.0;}"
	var material := ShaderMaterial.new()
	material.shader = shader
	floor_mesh.material_override = material
	stage.add_child(floor_mesh)
	actor = Driver.new()
	actor.asset_path = asset
	actor.adapter_path = adapter_path
	stage.add_child(actor)
	actor.set_physics_process(false)
	camera = Camera3D.new()
	actor.add_child(camera)
	camera.position = Vector3(4.5,0.96,0) if view == "side" else Vector3(0,0.96,-4.5) if view == "front" else Vector3(0,0.96,4.5)
	camera.look_at(Vector3(0,0.96,0))
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 2.2
	camera.current = true
	actor.camera = camera
	var caption := Label.new()
	root.add_child(caption)
	caption.position = Vector2(18,16)
	caption.add_theme_font_size_override("font_size",20)
	actor.caption = caption
	# Render warm-up is outside measured locomotion; CPU fixtures do not render.
	if capture:
		for warmup in range(30):
			await RenderingServer.frame_post_draw
	actor.wall_start = Time.get_ticks_usec()
	actor.set_physics_process(true)
	var previous := -1.0
	while not actor.done:
		if capture:
			await RenderingServer.frame_post_draw
		else:
			await physics_frame
		if capture and actor.elapsed-previous >= 1.0/30.0-0.000001:
			var file := "%05d.png"%actor.tick
			captured.append(root.get_texture().get_image())
			images.append({"file":file,"seconds":actor.elapsed,"wall":float(Time.get_ticks_usec()-actor.wall_start)/1e6,"tick":actor.tick})
			previous = actor.elapsed
	for i in range(captured.size()):
		captured[i].save_png(output+"/"+view+"/"+images[i].file)
	assert(driver_hash == FileAccess.get_sha256("res://scripts/native_motion_r2.gd"),"Shared driver changed during capture")
	assert(asset_hash == FileAccess.get_sha256(asset),"Candidate asset changed during capture")
	var probe_source := JSON.parse_string(FileAccess.get_file_as_string("res://assets/motion-r2/gait-r6/independent/sole-probes.json")) as Dictionary
	var provenance: Array = []
	for side in ["L","R"]:
		for point in probe_source.points[side]:
			provenance.append({"side":side,"id":point.id,"source":point.source,"terms":point.terms})
	var data := {"label":label,"view":view,"time_scale":Engine.time_scale,"captured_pixels":capture,"method":"Actual current production Motion methods with candidate model injection; automatic physics, synthetic speed inputs. captured_pixels=false means dummy-renderer bone data only, not rendered mesh or a visual verification. Orthographic level camera and fixed floor grid for later pixel captures; not full-world or keyboard playtest.","asset_path":asset,"glb_sha256":asset_hash,"driver_sha256":driver_hash,"model_adapter_path":adapter_path,"model_adapter_sha256":FileAccess.get_sha256(adapter_path),"camera":{"projection":"orthographic","level":true,"size":camera.size,"local_transform":Driver.xf(camera.transform),"viewport":[root.size.x,root.size.y]},"transform_encoding":"basis columns x/y/z then origin, 12 floats; bone global poses in skeleton coordinates","fixed_material_points_provenance":provenance,"floor_plane_y":-0.002,"support_plane_y":0.0,"records":actor.records,"images":images}
	FileAccess.open(output+"/"+view+"-trace.json",FileAccess.WRITE).store_string(JSON.stringify(data))
	print("GAIT_R7_PROBE ",JSON.stringify({"view":view,"frames":actor.tick,"seconds":actor.elapsed,"images":images.size(),"asset":asset}))
	quit()
