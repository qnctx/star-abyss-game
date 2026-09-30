extends SceneTree
const FX = preload("res://scripts/native_vfx_r3.gd")
const MOTION = preload("res://scripts/native_motion_r2.gd")
var world: Node3D
var camera: Camera3D
var motion: Node3D
var fx: Node3D
var records: Array = []
var view := 0
var tier := 4
var elapsed := 0.0
var frame_index := 0
var released := false
var hit := false
var active := false
var profile: Dictionary
var out := "res://assets/vfx-r3/evidence"
var capture_frame := -1

class PhysicsDriver extends Node:
	var tick: Callable
	func _physics_process(delta: float) -> void:
		tick.call(delta)

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	world = Node3D.new()
	root.add_child(world)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color(0.038,0.05,0.075)
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color.WHITE
	env.environment.ambient_light_energy = 0.8
	world.add_child(env)
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-40,-30,0)
	world.add_child(light)
	motion = MOTION.new()
	world.add_child(motion)
	camera = Camera3D.new()
	camera.fov = 54
	world.add_child(camera)
	camera.current = true
	var driver := PhysicsDriver.new()
	driver.tick = _tick
	world.add_child(driver)
	DirAccess.make_dir_recursive_absolute(out)
	for v in range(2):
		view = v
		camera.position = Vector3(3.4,2.4,3.8) if v == 0 else Vector3(3.8,2.1,-0.6)
		camera.look_at(Vector3(0,1.25,-1.5))
		for r in [4,5,6,8,9]:
			tier = r
			profile = MOTION.cast_profile(r)
			elapsed = 0.0
			frame_index = 0
			capture_frame = -1
			released = false
			hit = false
			motion.step(0.0,{"action":profile.action,"progress":0.0})
			fx = FX.new()
			world.add_child(fx)
			fx.begin_cast(tier,profile,motion.socket_transform_world(profile.socket),Vector3(0,1.3,-2.6))
			active = true
			while active:
				await RenderingServer.frame_post_draw
				if capture_frame >= 0:
					root.get_texture().get_image().save_png(out+"/r%d-v%d-f%03d.png"%[tier,view,capture_frame])
					capture_frame = -1
			if is_instance_valid(fx):
				fx.cancel()
	var file := FileAccess.open(out+"/normal-time.json",FileAccess.WRITE)
	file.store_string(JSON.stringify({"mode":"actual physics_frame delta, Engine.time_scale=1, no manual VFX advance","records":records},"\t"))
	print("VFX_R3_NORMAL_TIME_PREVIEW_COMPLETE samples=",records.size())
	quit()

func _tick(delta: float) -> void:
	if not active:
		return
	elapsed += delta
	var progress := 0.5 * minf(1.0,elapsed/profile.windup) if elapsed <= profile.windup else 0.5+0.5*minf(1.0,(elapsed-profile.windup)/profile.recovery)
	motion.step(delta,{"action":profile.action,"progress":progress})
	var socket: Transform3D = motion.socket_transform_world(profile.socket)
	if is_instance_valid(fx):
		fx.follow_socket(socket)
		if elapsed >= profile.windup and not released:
			fx.release(socket,Vector3(0,1.3,-2.6),0.16)
			released = true
		if elapsed >= profile.windup+0.16 and not hit:
			fx.impact(Vector3(0,1.3,-2.6),Vector3.BACK)
			hit = true
		records.append({"view":view,"tier":tier,"frame":Engine.get_physics_frames(),"delta":delta,"elapsed":elapsed,"wall_usec":Time.get_ticks_usec(),"draw_calls_scene":Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),"primitives_scene":Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME),"snapshot":fx.debug_snapshot()})
	frame_index += 1
	# The physics driver never awaits PNG capture and therefore never skips its clock.
	if frame_index % 3 == 0 and elapsed >= profile.windup-0.1 and elapsed <= profile.windup+0.42:
		capture_frame = frame_index
	if elapsed >= profile.duration+0.5:
		active = false
