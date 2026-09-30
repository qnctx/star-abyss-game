extends SceneTree
const Ecology = preload("res://scripts/native_planet_ecology.gd")
var planet: NativePlanet
var ecology: Node3D
var stage: Node3D
var camera: Camera3D
var origin: Vector3
var output := "res://reports/ecology-damage-r4/"
var failures: Array[String] = []

func _initialize() -> void: call_deferred("run")
func run() -> void:
	DirAccess.make_dir_recursive_absolute(output)
	stage = Node3D.new()
	root.add_child(stage)
	planet = NativePlanet.new()
	stage.add_child(planet)
	planet.setup_world(null)
	var profiling := "--profile" in OS.get_cmdline_user_args()
	ecology = load("res://tests/ecology-r4-profile/ecology.gd").new() if profiling else Ecology.new()
	stage.add_child(ecology)
	ecology.setup(planet)
	ecology.damage_service.bind_save_slot(output+"integrated-isolated.environment.json","integrated-test","r4-integration",false)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color("a8b5cb")
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color("c3c7cc")
	env.environment.ambient_light_energy = .6
	stage.add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-40,-35,0)
	sun.light_energy = 1.3
	sun.shadow_enabled = true
	stage.add_child(sun)
	var direction := planet.field.route_direction(17000.0,1800.0)
	var habitat := "original-wetland"
	var budget_profile := "conservative-320-260k"
	for arg in OS.get_cmdline_user_args():
		if arg=="--budget=candidate":
			ecology.instance_budget = 900
			ecology.triangle_budget = 1300000
			ecology.detail_budgets = PackedInt32Array([200000,300000,800000])
			budget_profile = "candidate-900-1300k"
		if arg.begins_with("--habitat="):
			habitat = arg.trim_prefix("--habitat=")
			var sites: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(output+"habitat-sites.json"))
			var a: Array = sites[habitat].direction
			direction = Vector3(a[0],a[1],a[2])
			output += "habitat-"+habitat+"/"
			DirAccess.make_dir_recursive_absolute(output)
	if budget_profile.begins_with("candidate"):
		output += "candidate/"
		DirAccess.make_dir_recursive_absolute(output)
	if profiling:
		output += "profile/"
		DirAccess.make_dir_recursive_absolute(output)
	var sample: Dictionary = planet.field.sample(direction)
	origin = NativePlanet.canonical_to_scene(direction*(NativePlanet.RADIUS+float(sample.height)))
	var up := NativePlanet.radial_up(origin)
	var forward := up.cross(Vector3.FORWARD).normalized()
	camera = Camera3D.new()
	stage.add_child(camera)
	camera.far = 12000
	# Exactly the R3 integrated reference camera for a meaningful before/after.
	camera.position = origin+up*16-forward*36
	camera.look_at(origin+forward*170+up*4,up)
	var frame_ms: Array[float] = []
	var stream_us: Array[float] = []
	var previous := Time.get_ticks_usec()
	for frame in range(650):
		planet.update_stream(origin)
		var start := Time.get_ticks_usec()
		ecology.update_stream(origin)
		stream_us.append(float(Time.get_ticks_usec()-start))
		await physics_frame
		await RenderingServer.frame_post_draw
		var now := Time.get_ticks_usec()
		if frame>120: frame_ms.append(float(now-previous)/1000.0)
		previous = now
		if frame%150==0: print("R4_INTEGRATED_FRAME=",frame," ",JSON.stringify(ecology.snapshot()))
	await capture("10-real-planet-r3-matched-camera")
	var species := {}
	var ages := {}
	var colliders := 0
	var target := ""
	var best := INF
	for id: String in ecology.damage_service.entities:
		var record: Dictionary = ecology.damage_service.entities[id]
		if record.physical: colliders += record.body.get_child_count()
		if record.kind!="tree": continue
		species[record.asset.species] = int(species.get(record.asset.species,0))+1
		ages[str(record.asset.age)] = int(ages.get(str(record.asset.age),0))+1
		if record.physical:
			var distance: float = record.transform.origin.distance_to(origin)
			if distance<best: best = distance; target = id
	check("real planet spawns ecology",ecology.instances>0)
	check("same region has multiple real tree structures",species.size()>=2 and ages.size()>=2)
	var affected := false
	var query_us := 0
	var stream_diagnostic := {}
	var profile := {}
	if profiling:
		profile["initial_stream"] = ecology.profile_snapshot()
		ecology.reset_profile()
	if not target.is_empty():
		var record: Dictionary = ecology.damage_service.entities[target]
		var tree_origin: Vector3 = record.transform.origin
		var tree_up: Vector3 = record.transform.basis.y.normalized()
		var side: Vector3 = record.transform.basis.x.normalized()
		camera.position = tree_origin+tree_up*8+side*22+forward*25
		camera.look_at(tree_origin+tree_up*5,tree_up)
		await capture("11-real-tree-before")
		var query_start := Time.get_ticks_usec()
		var result: Dictionary = ecology.damage_service.damage({"origin":tree_origin+tree_up*1.12-side*3,"direction":side,"reach":4.0,"radius":.05,"power":600,"damage_type":"blunt","source":"integrated-test","cast_id":"actual-tree-1","stop_on_first":true})
		query_us = Time.get_ticks_usec()-query_start
		if profiling:
			profile["damage_call"] = ecology.profile_snapshot()
			ecology.reset_profile()
		affected = result.changed>0
		stream_diagnostic["hit_part"] = result.hits[0].part if not result.hits.is_empty() else "miss"
		stream_diagnostic["asset"] = record.asset.id
		await ticks(120)
		await capture("12-real-tree-after-same-camera")
		check("actual streamed tree damaged by authority",affected)
		var before: Dictionary = ecology.damage_service.states.duplicate(true)
		stream_diagnostic["before"] = before
		stream_diagnostic["before_clear"] = stream_state(target,record.cell)
		ecology.clear()
		stream_diagnostic["immediately_after_clear"] = ecology.damage_service.states.duplicate(true)
		for frame in range(300):
			planet.update_stream(origin)
			ecology.update_stream(origin)
			await physics_frame
		await capture("13-real-tree-stream-rebuilt-same-camera")
		stream_diagnostic["after"] = ecology.damage_service.states.duplicate(true)
		stream_diagnostic["target_registered"] = ecology.damage_service.entities.has(target)
		stream_diagnostic["same_state"] = ecology.damage_service.states==before
		stream_diagnostic["after_rebuild"] = stream_state(target,record.cell)
		check("damage survives stream unload reload",ecology.damage_service.states==before and ecology.damage_service.entities.has(target))
	camera.position = origin+up*220-forward*90
	camera.look_at(origin+forward*120,up)
	await capture("14-real-planet-birdseye")
	var supported := 0
	for cell: Dictionary in ecology.cells.values():
		if ecology.validate_support_geometry(cell): supported += 1
	check("all rendered ecology still supported",supported==ecology.cells.size())
	var report := {"failures":failures,"habitat":habitat,"field_sample":sample,"budget_profile":budget_profile,"performance":{"sampling":"rendered-frame interval after physics synchronization; isolated scene, not Main","frame_interval_ms":stats(frame_ms),"ecology_stream_us":stats(stream_us),"damage_query_us":query_us,"static_memory_bytes":Performance.get_monitor(Performance.MEMORY_STATIC),"draw_calls":Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),"rendered_primitives":Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME),"gpu":RenderingServer.get_video_adapter_name()},"snapshot":ecology.snapshot(),"species":species,"ages":ages,"physical_shapes":colliders,"supported_cells":supported,"actual_target":target,"actual_damage_applied":affected,"scope":"actual streamed planet ecology, not Main gameplay performance acceptance"}
	report["stream_diagnostic"] = stream_diagnostic
	if profiling:
		profile["settle_and_rebuild"] = ecology.profile_snapshot()
		report["profile"] = profile
	report["source_sha256"] = {}
	for path: String in ["res://scripts/native_environment_damage.gd","res://scripts/native_planet_ecology.gd","res://scripts/native_environment_damage_assets.gd","res://assets/planet-ecology-r4/manifest.json","res://tests/native_environment_damage_integrated.gd"]:
		report.source_sha256[path] = FileAccess.get_sha256(path)
	var file := FileAccess.open(output+"integrated-results.json",FileAccess.WRITE)
	file.store_string(JSON.stringify(report,"\t"))
	print("ENVIRONMENT_R4_INTEGRATED="+JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)

func stream_state(target: String, cell_key: String) -> Dictionary:
	var pending_target := false
	for tile: Dictionary in ecology.pending:
		if NativePlanet._tile_key(tile)==cell_key: pending_target = true
	return {"snapshot":ecology.snapshot(),"target":target,"target_cell":cell_key,"target_registered":ecology.damage_service.entities.has(target),"target_cell_loaded":ecology.cells.has(cell_key),"target_retry":ecology._retry_tiles.get(cell_key,{}).duplicate(true),"target_pending":pending_target,"motions":ecology.damage_service.motions.size(),"debris":ecology.damage_service.debris.size()}

func capture(name: String) -> void:
	await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(output+name+".png")

func ticks(count: int) -> void:
	for i in range(count): await physics_frame

func check(label: String, passed: bool) -> void:
	if not passed: failures.append(label)

func stats(values: Array[float]) -> Dictionary:
	values.sort()
	if values.is_empty(): return {}
	return {"samples":values.size(),"p50":values[values.size()/2],"p95":values[mini(values.size()-1,int(values.size()*.95))],"max":values[-1]}
