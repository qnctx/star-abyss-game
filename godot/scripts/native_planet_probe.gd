extends SceneTree

## Repeatable headless geometry/physics probe. Run with:
## Godot --headless --path godot --script res://scripts/native_planet_probe.gd

func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var world := NativeWorld.new()
	root.add_child(world)
	world.setup_world()
	await physics_frame
	var route: Array[float] = [0.0, 3000.0, 4000.0, 8000.0, 17000.0, 27000.0, 34000.0, 42000.0]
	var all_ready: bool = true
	for s in route:
		var direction: Vector3 = world._planet.field.route_direction(s)
		var analytic: Dictionary = world._planet.field.sample(direction)
		var point: Vector3 = NativePlanet.canonical_to_scene(direction * (NativePlanet.RADIUS + float(analytic.height)))
		var probe: Vector3 = point + NativePlanet.radial_up(point) * 2.0
		var max_stream_ms: float = 0.0
		for i in range(12):
			var started: int = Time.get_ticks_usec()
			world.update_stream(probe)
			max_stream_ms = maxf(max_stream_ms, float(Time.get_ticks_usec() - started) / 1000.0)
		await physics_frame
		var surface: Dictionary = world.surface_at(probe)
		var ready: bool = bool(surface.get("ready", false))
		all_ready = all_ready and ready
		print("ROUTE ", s, " height=", analytic.height, " water=", analytic.water_depth, " ready=", ready, " agl=", surface.get("agl", NAN), " spacing=", surface.get("spacing", INF), " near=", world._planet.loaded_near_tile_count(), " worst_stream_ms=", max_stream_ms)
	for direction in [Vector3(-1.0, 0.0, 0.0), Vector3.UP, Vector3.DOWN]:
		var sample: Dictionary = world._planet.field.sample(direction)
		var point: Vector3 = NativePlanet.canonical_to_scene(direction * (NativePlanet.RADIUS + float(sample.height)))
		var probe: Vector3 = point + NativePlanet.radial_up(point) * 2.0
		for i in range(12):
			world.update_stream(probe)
		await physics_frame
		var surface: Dictionary = world.surface_at(probe)
		var ready: bool = bool(surface.get("ready", false))
		all_ready = all_ready and ready
		print("HEMISPHERE ", direction, " ready=", ready, " agl=", surface.get("agl", NAN), " spacing=", surface.get("spacing", INF))
	print("PLANET_PROBE_PASS=", all_ready)
	quit(0 if all_ready else 1)
