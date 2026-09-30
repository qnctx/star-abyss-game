extends SceneTree
var game: Node
var camera: Camera3D
var view: SubViewport
var ecology: NativePlanetEcology
func _initialize() -> void: call_deferred("_run")
func _run() -> void:
	var out := "res://assets/planet-ecology/evidence"
	var hashes: Dictionary = {}
	for path in ["scripts/native_planet_ecology.gd","scripts/native_planet.gd","scripts/native_world.gd","scripts/native_planet_field.gd"]:
		hashes[path] = FileAccess.get_sha256("res://"+path)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(out))
	game = load("res://scenes/main.tscn").instantiate()
	game.save_path = "user://ecology_isolated_unused.json"
	root.add_child(game)
	await physics_frame
	game.set_physics_process(false)
	game.player.set_physics_process(false)
	var planet: Node3D = game.world._planet
	ecology = game.world._planet_ecology
	view = SubViewport.new()
	view.size = Vector2i(960,540)
	view.world_3d = game.get_world_3d()
	view.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(view)
	camera = Camera3D.new()
	camera.far = 1200.0
	view.add_child(camera)
	var rows: Array = []
	for distance in [17000,27000,34000]:
		var direction: Vector3 = planet.field.route_direction(distance)
		var ground := NativePlanet.canonical_to_scene(planet.field.surface_point(direction))
		var up := NativePlanet.radial_up(ground)
		var east := up.cross(Vector3.FORWARD).normalized()
		var north := east.cross(up).normalized()
		for i in range(180):
			game.world.update_stream(ground+up*3.0)
			await physics_frame
		var actual: Dictionary = planet.surface_at(ground)
		if actual.get("ready",false): ground = actual.point
		camera.global_position = ground+up*3.2-east*10.0
		camera.look_at(ground+north*60.0+up*3.0,up)
		await process_frame
		if DisplayServer.get_name() != "headless":
			await RenderingServer.frame_post_draw
			view.get_texture().get_image().save_png(out+"/route-"+str(distance)+".png")
		rows.append({"distance":distance,"stats":ecology.snapshot(),"field":planet.field.sample(direction),"surface":actual,"camera_position":camera.global_position,"camera_basis":camera.global_basis,"ground":ground})
		print("ECOLOGY_ROUTE ", rows.back())
	ecology.update_stream(Vector3(0,10000,0))
	rows.append({"unload":ecology.snapshot()})
	var changed: Array = []
	for path in hashes:
		if hashes[path] != FileAccess.get_sha256("res://"+path): changed.append(path)
	var f := FileAccess.open(out+"/verification.json",FileAccess.WRITE)
	f.store_string(JSON.stringify({"rows":rows,"hashes":hashes,"changed":changed,"utc":Time.get_datetime_string_from_system(true),"method":"Controlled ecological streaming fixture with real rendered/collidable planet; no player gameplay claim."},"\t"))
	game.initialized = false
	quit()
