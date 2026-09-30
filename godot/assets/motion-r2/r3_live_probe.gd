extends SceneTree
## Adapter-only, real physics clock. Synthetic input states are NOT human playtest.
const Motion = preload("res://scripts/native_motion_r2.gd")
var OUT := "res://assets/motion-r2/evidence/r3-live"
var driver: MotionDriver
var camera: Camera3D
var images := false
var last_capture := -1.0

class MotionDriver extends Node3D:
	var motion: NativeMotionR2
	var elapsed := 0.0
	var case_time := 0.0
	var case_index := 0
	var release_count := 0
	var records: Array = []
	var cases: Array = []
	var finished := false
	var rest: Array = []
	var failures: Array = []
	var pending: Array = []
	var wall_start := 0
	var frame_count := 0
	func _ready() -> void:
		motion = Motion.new()
		add_child(motion)
		for i in range(motion._rig.get_bone_count()):
			rest.append(motion._rig.get_bone_rest(i))
		cases = [{"name":"walk","speed":1.6,"duration":2.0},{"name":"jog","speed":6.8,"duration":2.0},{"name":"sprint","speed":10.0,"duration":2.0},{"name":"stop","speed":0.0,"duration":0.8}]
		for tier in [4,5,6,8,9]:
			for air in [false,true]:
				var profile: Dictionary = Motion.cast_profile(tier)
				cases.append({"name":str(profile.action)+(":air" if air else ":ground"),"profile":profile,"airborne":air,"duration":float(profile.duration)+0.24})
				var clip := ("air_" if air else "")+str(profile.action)
				if not motion.names.has(clip):
					pending.append("missing authored clip "+clip)
		for side in ["L","R"]:
			if motion._rig.find_bone("palm"+side) < 0:
				pending.append("missing articulated hand "+side)
		wall_start = Time.get_ticks_usec()
	func _physics_process(delta: float) -> void:
		if finished:
			return
		var c: Dictionary = cases[case_index]
		var before := case_time
		case_time += delta
		elapsed += delta
		frame_count += 1
		var state := {"speed":float(c.get("speed",0.0)),"airborne":bool(c.get("airborne",false))}
		position.z -= float(state.speed)*delta
		if c.has("profile"):
			var p: Dictionary = c.profile
			if case_time < float(p.duration):
				state["action"] = p.action
				state["progress"] = motion._contact_progress(case_time,float(p.windup),float(p.duration),float(p.release_normalized))
			if before < float(p.release_time) and case_time >= float(p.release_time):
				release_count += 1
		# One adapter tick per engine physics callback, never a guessed fixed delta.
		motion.step(delta,state)
		for i in range(motion._rig.get_bone_count()):
			if not rest[i].is_equal_approx(motion._rig.get_bone_rest(i)):
				failures.append("rest changed "+str(i))
		var left := motion.socket_transform_world("hand_l")
		var right := motion.socket_transform_world("hand_r")
		var ankle_l := motion.socket_transform_world("foot_l").origin
		var ankle_r := motion.socket_transform_world("foot_r").origin
		if not left.origin.is_finite() or not right.origin.is_finite():
			failures.append("nonfinite socket")
		records.append({"frame":Engine.get_physics_frames(),"delta":delta,"simulation_seconds":elapsed,"wall_seconds":float(Time.get_ticks_usec()-wall_start)/1000000.0,"case":c.name,"case_seconds":case_time,"clip":motion.current,"phase":motion.gait_phase,"socket_l":[left.origin.x,left.origin.y,left.origin.z],"socket_r":[right.origin.x,right.origin.y,right.origin.z],"ankle_l":[ankle_l.x,ankle_l.y,ankle_l.z],"ankle_r":[ankle_r.x,ankle_r.y,ankle_r.z],"planted_l":motion._foot_anchors.has("L"),"planted_r":motion._foot_anchors.has("R"),"release_count":release_count})
		if case_time >= float(c.duration):
			if c.has("profile") and release_count != 1:
				failures.append(str(c.name)+" release count "+str(release_count))
			case_time = 0.0
			release_count = 0
			case_index += 1
			if case_index >= cases.size():
				finished = true

func _initialize() -> void:
	images = "--capture" in OS.get_cmdline_user_args()
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--out="):
			OUT = arg.trim_prefix("--out=")
	call_deferred("run")

func run() -> void:
	DirAccess.make_dir_recursive_absolute(OUT)
	driver = MotionDriver.new()
	root.add_child(driver)
	if images:
		var env := WorldEnvironment.new()
		env.environment = Environment.new()
		env.environment.background_mode = Environment.BG_COLOR
		env.environment.background_color = Color(0.055,0.065,0.085)
		env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
		env.environment.ambient_light_color = Color.WHITE
		env.environment.ambient_light_energy = 0.7
		driver.add_child(env)
		var light := DirectionalLight3D.new()
		light.rotation_degrees = Vector3(-35,-35,0)
		light.light_energy = 1.4
		driver.add_child(light)
		var floor_mesh := MeshInstance3D.new()
		floor_mesh.mesh = PlaneMesh.new()
		floor_mesh.mesh.size = Vector2(140,140)
		floor_mesh.position.y = -0.006
		var shader := Shader.new()
		shader.code = "shader_type spatial; varying vec3 p; void vertex(){p=(MODEL_MATRIX*vec4(VERTEX,1.0)).xyz;} void fragment(){float line=step(0.025,abs(fract(p.x)-0.5))*step(0.025,abs(fract(p.z)-0.5)); ALBEDO=mix(vec3(0.26),vec3(0.12,0.14,0.17),line); ROUGHNESS=1.0;}"
		var mat := ShaderMaterial.new()
		mat.shader = shader
		floor_mesh.material_override = mat
		root.add_child(floor_mesh)
		camera = Camera3D.new()
		driver.add_child(camera)
		camera.position = Vector3(2.7,1.7,-3.8)
		camera.look_at(Vector3(0,0.95,0))
		camera.fov = 33
		camera.current = true
	while not driver.finished:
		await physics_frame
		if images and driver.elapsed-last_capture >= 0.10:
			await RenderingServer.frame_post_draw
			var label := str(driver.cases[mini(driver.case_index,driver.cases.size()-1)].name).replace(":","-")
			var path := "%s/%05d-%s.png" % [OUT,driver.frame_count,label]
			root.get_texture().get_image().save_png(path)
			last_capture = driver.elapsed
	var report := {"method":"real Godot _physics_process(delta), one adapter tick per callback; synthetic states in model fixture, not real keyboard feel","time_scale":Engine.time_scale,"physics_ticks_per_second":Engine.physics_ticks_per_second,"frame_count":driver.frame_count,"bone_count":driver.motion._rig.get_bone_count(),"failures":driver.failures,"pending_asset_requirements":driver.pending,"records":driver.records}
	FileAccess.open(OUT+"/report.json",FileAccess.WRITE).store_string(JSON.stringify(report,"\t"))
	print("R3_LIVE_PROBE ",JSON.stringify({"frames":driver.frame_count,"failures":driver.failures,"pending":driver.pending}))
	quit(1 if not driver.failures.is_empty() else 0)
