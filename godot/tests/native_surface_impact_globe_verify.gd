extends SceneTree

var _failures: Array[String] = []
var _checks := 0
var _results: Dictionary = {}
var _sites: Dictionary = {}


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var world := NativeWorld.new()
	root.add_child(world)
	world.surface_deformation_committed.connect(_on_impact)
	await _site(world, 3500.0, 350.0, "blend-apron")
	await _site(world, 8000.0, 350.0, "outer-globe")
	_check("two sparse globe impacts saved", world.snapshot_deformations().records.size() == 2)
	var saved := world.snapshot_deformations()
	await _revisit(world, "blend-apron")
	var cleared := world.restore_deformations([])
	_check("clear removes globe offset", cleared.get("valid", false) and absf(float(world._planet.field.sample(_sites["blend-apron"].direction).height) - float(_sites["blend-apron"].before_height)) < 0.05)
	var restored := world.restore_deformations(JSON.parse_string(JSON.stringify(saved)))
	_check("globe records restored", restored.get("valid", false) and world.snapshot_deformations().records.size() == 2)
	await _revisit(world, "blend-apron")
	print("NATIVE_SURFACE_IMPACT_GLOBE_JSON=" + JSON.stringify({"checks": _checks, "passed": _checks - _failures.size(), "failures": _failures, "results": _results}))
	quit(0 if _failures.is_empty() else 1)


func _site(world: NativeWorld, x: float, z: float, cast_id: String) -> void:
	var estimate := world._planet.analytic_surface(Vector3(x, 100.0, z))
	var up := world.up_at(estimate.point)
	var view: Vector3 = estimate.point + up * 1000.0
	var support: Dictionary = {}
	var relevant: Array[Dictionary] = world._planet.affected_near_tiles(NativePlanet.scene_to_canonical(estimate.point).normalized(), 8.0)
	for i in range(1500):
		world.update_stream(view)
		support = world._planet.surface_at(estimate.point + up)
		var all_tiles := true
		for tile: Dictionary in relevant:
			if not world._planet._near_tiles.has(NativePlanet._tile_key(tile)):
				all_tiles = false
				break
		if support.get("ready", false) and all_tiles:
			break
		await create_timer(0.01).timeout
	_check(cast_id + " collidable near tile ready", support.get("ready", false))
	if not bool(support.get("ready", false)):
		return
	var physical: Vector3 = support.point
	var direction := NativePlanet.scene_to_canonical(physical).normalized()
	var before_height: float = world._planet.field.sample(direction).height
	var query := {"origin": physical, "radius": 8.0, "power": 600.0, "source": "test", "cast_id": cast_id, "phase": 0, "world_seed": NativePlanetCoordinates.PLANET_SEED}
	var request := world.request_surface_impact(query)
	_check(cast_id + " crater accepted", request.get("accepted", false))
	if not bool(request.get("accepted", false)):
		_results[cast_id] = request
		return
	var impact_id := str(request.id)
	for i in range(1500):
		if _results.has(impact_id):
			break
		await create_timer(0.02).timeout
	_check(cast_id + " mesh and collider committed", _results.get(impact_id, {}).get("applied", false))
	for i in range(3):
		await physics_frame
	var after_height: float = world._planet.field.sample(direction).height
	_check(cast_id + " field has one metre depth", absf(after_height - before_height + 1.0) < 0.05)
	_sites[cast_id] = {"direction": direction, "before_height": before_height}
	var after_support := world._planet.surface_at(physical + up)
	var actual_height: float = (Vector3(after_support.get("point", Vector3.ZERO)) - NativePlanet.CENTER).length() - NativePlanet.RADIUS
	var actual_direction := NativePlanet.scene_to_canonical(after_support.point).normalized() if after_support.get("ready", false) else direction
	var expected_height: float = world._planet.field.sample(actual_direction).height
	_check(cast_id + " live triangle collider follows crater", after_support.get("ready", false) and absf(actual_height - expected_height) < 0.3)
	if cast_id == "outer-globe":
		var far_from: Vector3 = Vector3(after_support.point) + world.up_at(after_support.point) * 125000.0
		var too_far := world.prepare_surface_landing(far_from, 75000.0, "globe-r8")
		_check("outer globe R8 range enforced", too_far.get("reason") == "out_of_range")
		var prepared: Dictionary = {}
		for i in range(150):
			prepared = world.prepare_surface_landing(far_from, 180000.0, "globe-r9")
			if prepared.get("ready", false):
				break
			world.update_stream(far_from)
			await create_timer(0.01).timeout
		_check("outer globe R9 125 km landing prepared", prepared.get("ready", false) and prepared.get("clear", false))
		if prepared.get("clear", false):
			_check("outer globe R9 ticket consumed", world.consume_surface_landing(prepared.ticket, far_from, 0.42, 1.72).get("valid", false))


func _revisit(world: NativeWorld, cast_id: String) -> void:
	var direction: Vector3 = _sites[cast_id].direction
	var point := NativePlanet.canonical_to_scene(direction * (NativePlanet.RADIUS + float(world._planet.field.sample(direction).height)))
	var up := world.up_at(point)
	var support: Dictionary = {}
	for i in range(1500):
		world.update_stream(point + up * 1000.0)
		support = world._planet.surface_at(point + up)
		if support.get("ready", false):
			break
		await create_timer(0.01).timeout
	var tile: Dictionary = NativePlanet._tile_at(direction, NativePlanet.NEAR_LEVEL)
	var record: Dictionary = world._planet._near_tiles.get(NativePlanet._tile_key(tile), {})
	_check(cast_id + " crater refined on return", support.get("ready", false) and int(record.get("segments", 0)) == NativePlanet.IMPACT_TILE_SEGMENTS)
	if not bool(support.get("ready", false)):
		return
	var live_direction := NativePlanet.scene_to_canonical(support.point).normalized()
	var actual_height: float = (Vector3(support.point) - NativePlanet.CENTER).length() - NativePlanet.RADIUS
	var expected_height: float = world._planet.field.sample(live_direction).height
	_check(cast_id + " return collider matches saved field", absf(actual_height - expected_height) < 0.3)


func _on_impact(result: Dictionary) -> void:
	_results[str(result.get("id", ""))] = result


func _check(name: String, okay: bool) -> void:
	_checks += 1
	if not okay:
		_failures.append(name)
