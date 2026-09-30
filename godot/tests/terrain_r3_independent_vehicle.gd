extends SceneTree

## Controlled vehicle speed fixture on a real streamed planet collider.
## This does not claim keyboard driving feel.
var failures: Array[String] = []
var checks := 0

func _initialize() -> void:
	call_deferred("_run")

func _check(name: String, passed: bool) -> void:
	checks += 1
	print(("PASS: " if passed else "FAIL: ") + name)
	if not passed:
		failures.append(name)

func _run() -> void:
	var main := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	main.save_path = OS.get_environment("TERRAIN_R3_OUTPUT").path_join("vehicle-save.json")
	var slot := main.save_path
	root.add_child(main)
	for i in range(5):
		await physics_frame
	var canonical: Dictionary = NativePlanetCoordinates.to_cartesian(0.0, 17000.0 / NativePlanetCoordinates.DEFAULT_RADIUS)
	var rough: Vector3 = NativePlanetCoordinates.canonical_to_local(canonical, NativePlanetCoordinates.tangent_frame())
	main.player.set_physics_process(false)
	main.player.global_position = rough + main.world.up_at(rough) * 10.0
	var surface: Dictionary = {}
	for i in range(360):
		main.world.update_stream(rough)
		surface = main.world.surface_at(rough)
		if surface.get("ready", false) == true:
			break
		await physics_frame
	_check("17km route has a real dry collidable surface", surface.get("ready", false) == true and float(surface.get("water_depth", INF)) <= 0.15)
	if surface.get("ready", false) == true:
		var start: Vector3 = surface["point"]
		var up: Vector3 = main.world.up_at(start)
		var forward: Vector3 = Vector3.FORWARD.slide(up).normalized()
		main.skimmer.global_position = start
		main.skimmer.global_basis = Basis.looking_at(forward, up)
		main.player.global_position = start + main.skimmer.global_basis.x * 3.0
		main._toggle_vehicle()
		_check("vehicle mounts beyond old 3km edge", main.mounted)
		var before := main.skimmer.global_position
		# surface_at proves the centre tile, while the 1.3 m vehicle footprint
		# can cross a tile edge. Wait for the worker's neighboring real colliders.
		var footprint_ready := false
		for i in range(360):
			main.world.update_stream(before)
			var probe := main.world.surface_at(before - main.skimmer.global_transform.basis.z * 0.545)
			if probe.get("ready", false) == true and not main.world.is_solid_at(probe["point"], 1.3, 2.2):
				footprint_ready = true
				break
			await physics_frame
		_check("17km vehicle footprint has real neighboring collision", footprint_ready)
		main.vehicle_speed = 12.0
		main._drive(0.05)
		if main.skimmer.global_position.distance_to(before) <= 0.1:
			var target := before - main.skimmer.global_transform.basis.z * 0.545
			var candidate_surface: Dictionary = main.world.surface_at(target)
			print("VEHICLE_STALL_DIAGNOSTIC=", JSON.stringify({"speed": main.vehicle_speed, "target": str(target), "surface": str(candidate_surface), "sweep": str(main.world.sweep(before, candidate_surface.get("point", target), 1.3, 2.2)), "solid": main.world.is_solid_at(candidate_surface.get("point", target), 1.3, 2.2)}))
		_check("planet vehicle advances on real terrain", main.skimmer.global_position.distance_to(before) > 0.1)
		_check("vehicle up follows planet radial up", main.skimmer.global_transform.basis.y.dot(main.world.up_at(main.skimmer.global_position)) > 0.999)
		main.vehicle_speed = 0.0
		main._toggle_vehicle()
		_check("planet vehicle finds safe nearby dismount", not main.mounted and main.player.global_position.distance_to(main.skimmer.global_position) < 6.0)
	main.initialized = false
	main.queue_free()
	await process_frame
	DirAccess.remove_absolute(ProjectSettings.globalize_path(slot))
	print(JSON.stringify({"passed": checks - failures.size(), "total": checks, "failed": failures}))
	quit(0 if failures.is_empty() else 1)
