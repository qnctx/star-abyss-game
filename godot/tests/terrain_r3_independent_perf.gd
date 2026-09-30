extends SceneTree
var output: String
var data: Array[Dictionary] = []

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	output = OS.get_environment("TERRAIN_R3_OUTPUT")
	assert(not output.is_empty())
	root.size = Vector2i(1440,900)
	var game := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = output.path_join("perf-save.json")
	root.add_child(game)
	await physics_frame
	for distance in [17000.0, 27000.0]:
		game.player.set_physics_process(false)
		var field: NativePlanetField = game.world._planet.field
		var ground: Vector3 = NativePlanet.canonical_to_scene(field.surface_point(field.route_direction(distance)))
		game.player.global_position = ground + game.world.up_at(ground) * 2.0
		for i in range(240):
			game.world.update_stream(game.player.global_position)
			await physics_frame
		var surface: Dictionary = game.world.surface_at(game.player.global_position)
		if surface.get("ready",false):
			game.player.global_position = surface.point + game.world.up_at(surface.point) * 0.03
		game.player.flight_active = false
		game.player.velocity = Vector3.ZERO
		game.player.set_physics_process(true)
		for i in range(180):
			await physics_frame
		var timings: Array[float] = []
		var before := Time.get_ticks_usec()
		var start := before
		var min_agl := INF
		var unready := 0
		while Time.get_ticks_usec() - start < 10000000:
			await process_frame
			var now := Time.get_ticks_usec()
			timings.append(float(now-before)/1000.0)
			before = now
			var foot: Dictionary = game.world.surface_at(game.player.global_position)
			if not foot.get("ready",false):
				unready += 1
			else:
				min_agl = minf(min_agl,float(foot.agl))
		var ecology: NativePlanetEcology = game.world._planet_ecology
		var farthest := 0.0
		for cell: Dictionary in ecology.cells.values():
			for p: Vector3 in cell.get("points",[]):
				farthest = maxf(farthest,p.distance_to(game.player.global_position))
		data.append({"distance": distance, "resolution":"1440x900", "normal_physics":game.player.is_physics_processing(), "render_intervals_ms":timings,
			"ecology":ecology.snapshot(), "farthest_point_if_available":farthest, "minimum_agl":min_agl, "unready_frames":unready,
			"triangles":Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME),"draw_calls":Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)})
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(output.path_join("perf-%d.png" % int(distance)))
	var file := FileAccess.open(output.path_join("perf.json"),FileAccess.WRITE)
	file.store_string(JSON.stringify(data,"\t"))
	file.close()
	game.initialized = false
	game.queue_free()
	await process_frame
	quit()
