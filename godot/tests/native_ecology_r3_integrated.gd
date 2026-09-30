extends SceneTree

var planet: NativePlanet
var ecology: Node3D

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var utc_start := Time.get_datetime_string_from_system(true)
	var baseline := "--baseline" in OS.get_cmdline_user_args()
	var stage := Node3D.new()
	root.add_child(stage)
	planet = NativePlanet.new()
	stage.add_child(planet)
	planet.setup_world(null)
	ecology = load("res://assets/planet-ecology-r3/baseline-perf-r3/native_planet_ecology_before_r3.gd").new() if baseline else NativePlanetEcology.new()
	stage.add_child(ecology)
	ecology.setup(planet)
	var environment := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("a8b5cb")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("c3c7cc")
	env.ambient_light_energy = 0.6
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment.environment = env
	stage.add_child(environment)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-40,-35,0)
	sun.light_energy = 1.3
	sun.shadow_enabled = true
	stage.add_child(sun)
	var direction := planet.field.route_direction(17000.0,1800.0)
	var region_name := "forest"
	var frames := 1600
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--region="):
			region_name = arg.trim_prefix("--region=")
			frames = 900
			for region: Dictionary in planet.field.landmark_regions():
				if region.id==region_name: direction = region.direction
	var value: Dictionary = planet.field.sample(direction)
	var origin := NativePlanet.canonical_to_scene(direction*(NativePlanet.RADIUS+float(value.height)))
	var up := NativePlanet.radial_up(origin)
	var forward := up.cross(Vector3.FORWARD).normalized()
	var camera := Camera3D.new()
	stage.add_child(camera)
	camera.position = origin+up*16.0-forward*36.0
	camera.far = 14000.0
	camera.look_at(origin+forward*170.0+up*4.0,up)
	var start := Time.get_ticks_msec()
	var update_us: Array[float] = []
	var frame_ms: Array[float] = []
	var fps_samples: Array[float] = []
	var previous := Time.get_ticks_usec()
	var render_cpu: Array[float] = []
	var render_gpu: Array[float] = []
	if RenderingServer.has_method("viewport_set_measure_render_time"):
		RenderingServer.call("viewport_set_measure_render_time",root.get_viewport_rid(),true)
	for frame in range(frames):
		planet.update_stream(origin)
		var ecology_start := Time.get_ticks_usec()
		ecology.update_stream(origin)
		if frame>800: update_us.append(float(Time.get_ticks_usec()-ecology_start))
		await physics_frame
		var now := Time.get_ticks_usec()
		if frame>800:
			frame_ms.append(float(now-previous)/1000.0)
			fps_samples.append(float(Engine.get_frames_per_second()))
			if RenderingServer.has_method("viewport_get_measured_render_time_cpu"):
				render_cpu.append(float(RenderingServer.call("viewport_get_measured_render_time_cpu",root.get_viewport_rid())))
				render_gpu.append(float(RenderingServer.call("viewport_get_measured_render_time_gpu",root.get_viewport_rid())))
		previous = now
		if frame%200==0: print("R3_STREAM_FRAME=",frame," ",JSON.stringify(ecology.snapshot()))
	await RenderingServer.frame_post_draw
	var image_suffix := "-baseline-repeat" if baseline else ""
	root.get_texture().get_image().save_png("res://assets/planet-ecology-r3/preview-integrated-"+region_name+image_suffix+"-r3.png")
	var distances := [0.0,0.0,0.0]
	var supported_cells := 0
	for cell in ecology.cells.values():
		distances[int(cell.lod)] = maxf(float(distances[int(cell.lod)]),(cell.anchor as Vector3).distance_to(origin))
		if ecology.validate_support_geometry(cell): supported_cells += 1
	var report := {"snapshot":ecology.snapshot(),"max_distance_by_lod":distances,"supported_cells":supported_cells,"near_tiles":planet.loaded_near_tile_count(),"mid_tiles":planet.loaded_mid_tile_count(),"field":value,"duration_ms":Time.get_ticks_msec()-start}
	report["utc_start"] = utc_start
	report["baseline_repeat"] = baseline
	report["performance"] = {"renderer":"OpenGL Compatibility Intel UHD Graphics, 1440x900, default vsync; standalone real-planet ecology scene, not full gameplay", "ecology_update_us":stats(update_us),"physics_frame_interval_ms":stats(frame_ms),"engine_fps":stats(fps_samples),"viewport_render_cpu_ms":stats(render_cpu),"viewport_render_gpu_ms":stats(render_gpu),"process_cpu_ms":Performance.get_monitor(Performance.TIME_PROCESS)*1000.0,"physics_cpu_ms":Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS)*1000.0,"draw_calls":Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),"rendered_primitives":Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME)}
	# Exercise a real travel step and stream rebuild, not just stationary budgets.
	var shifted := origin+forward*120.0
	var selection_start := Time.get_ticks_usec()
	ecology.update_stream(shifted)
	report["move_selection_us"] = Time.get_ticks_usec()-selection_start
	for frame in range(280):
		planet.update_stream(shifted)
		ecology.update_stream(shifted)
		await physics_frame
	report["after_move"] = ecology.snapshot()
	var move_valid := true
	for cell in ecology.cells.values():
		if not ecology.validate_support_geometry(cell): move_valid = false
	report["move_support_valid"] = move_valid
	var suffix := "-baseline-repeat" if baseline else ("" if region_name=="forest" else "-"+region_name)
	report["utc_end"] = Time.get_datetime_string_from_system(true)
	var file := FileAccess.open("res://assets/planet-ecology-r3/integrated-verification"+suffix+"-r3.json",FileAccess.WRITE)
	file.store_string(JSON.stringify(report,"\t"))
	print("R3_INTEGRATED=",JSON.stringify(report))
	quit(0 if ecology.instances>0 and int(ecology.triangles)<=ecology.MAX_TRIANGLES and supported_cells==int(report.snapshot.cells) and move_valid else 1)

func stats(values: Array[float]) -> Dictionary:
	if values.is_empty(): return {"available":false}
	values.sort()
	return {"samples":values.size(),"p50":values[values.size()/2],"p95":values[mini(values.size()-1,int(values.size()*0.95))],"max":values[-1],"min":values[0],"available":values[-1]>0.0}
