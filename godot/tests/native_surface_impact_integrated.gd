extends SceneTree

var _failures: Array[String] = []
var _checks := 0
var _impact_result: Dictionary = {}
var _accepted: Dictionary = {}
var _before: Dictionary = {}
var _second_support: Dictionary = {}


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var world := NativeWorld.new()
	root.add_child(world)
	var x := 400.0
	var z := 190.0
	var baseline := world.base_height_at(x, z)
	world.update_stream(Vector3(x, baseline + 10.0, z))
	for i in range(8):
		await physics_frame
	var before := world._physical_landing_support(Vector3(x, baseline, z), true)
	_before = before
	_check("original basin collider ready", before.get("ready", false))
	if not bool(before.get("ready", false)):
		_finish()
		return
	var ground: Vector3 = before.point
	_second_support = world._physical_landing_support(ground, true)
	world.surface_deformation_committed.connect(_on_impact)
	var query := {"origin": ground, "radius": 8.0, "power": 600.0, "source": "test", "cast_id": "isolated-crater-1", "phase": 0, "world_seed": NativePlanetCoordinates.PLANET_SEED}
	var accepted := world.request_surface_impact(query)
	_accepted = accepted
	_check("authoritative impact accepted", accepted.get("accepted", false))
	if not bool(accepted.get("accepted", false)):
		_finish()
		return
	for i in range(1000):
		if not _impact_result.is_empty():
			break
		await create_timer(0.02).timeout
	_check("visible and collision rebuild committed", _impact_result.get("applied", false))
	for i in range(3):
		await physics_frame
	var after := world._physical_landing_support(Vector3(x, baseline, z), true)
	_check("physical basin collider is lower", after.get("ready", false) and float(after.point.y) < float(before.point.y) - 0.75)
	_check("height field matches finite crater", absf(world.height_at(x, z) - (baseline - 1.0)) < 0.05)
	_check("outside radius remains original", absf(world.height_at(x + 9.0, z) - world.base_height_at(x + 9.0, z)) < 0.01)
	var snapshot := world.snapshot_deformations()
	_check("one committed record saved", snapshot.records.size() == 1)
	var clear_result := world.restore_deformations([])
	for i in range(2):
		await physics_frame
	_check("legacy restore clears crater", clear_result.get("valid", false) and absf(world.height_at(x, z) - baseline) < 0.05)
	var loaded := world.restore_deformations(JSON.parse_string(JSON.stringify(snapshot)))
	for i in range(2):
		await physics_frame
	var restored_hit := world._physical_landing_support(Vector3(x, baseline, z), true)
	_check("restore rebuilds physical crater", loaded.get("valid", false) and restored_hit.get("ready", false) and float(restored_hit.point.y) < float(before.point.y) - 0.75)
	var from: Vector3 = Vector3(restored_hit.point) + world.up_at(restored_hit.point) * 1000.0
	var landing := world.prepare_surface_landing(from, 2000.0, "landing-1")
	_check("dry physical landing ticket issued", landing.get("ready", false) and landing.get("clear", false))
	if landing.get("clear", false):
		var receipt := world.consume_surface_landing(landing.ticket, from, 0.42, 1.72)
		_check("ticket validates exact target", receipt.get("valid", false) and Vector3(receipt.target).distance_to(landing.target) < 0.05)
		_check("ticket cannot be reused", not world.consume_surface_landing(landing.ticket, from, 0.42, 1.72).get("valid", false))
	var moved := world.prepare_surface_landing(from, 2000.0, "landing-moved")
	if moved.get("clear", false):
		_check("moved source invalidates ticket", not world.consume_surface_landing(moved.ticket, from + world.up_at(from) * 20.0, 0.42, 1.72).get("valid", false))
		_check("failed consume releases destination pins", world._legacy_landing_pins.is_empty() and world._planet._landing_pins.is_empty())
	var cancelled := world.prepare_surface_landing(from, 2000.0, "landing-cancel")
	if cancelled.get("clear", false):
		world.cancel_surface_landing(cancelled.ticket)
		_check("cancelled ticket cannot land", not world.consume_surface_landing(cancelled.ticket, from, 0.42, 1.72).get("valid", false))
		_check("cancel releases destination pins", world._legacy_landing_pins.is_empty() and world._planet._landing_pins.is_empty())
	var far_from: Vector3 = Vector3(restored_hit.point) + world.up_at(restored_hit.point) * 125000.0
	var r8_limited := world.prepare_surface_landing(far_from, 75000.0, "r8-too-far")
	_check("R8 cannot return from 125 km", r8_limited.get("reason") == "out_of_range")
	var r9_return := world.prepare_surface_landing(far_from, 180000.0, "r9-far-return")
	_check("R9 prepares 125 km radial ground return", r9_return.get("ready", false) and r9_return.get("clear", false))
	if r9_return.get("clear", false):
		_check("R9 far ticket consumes once", world.consume_surface_landing(r9_return.ticket, far_from, 0.42, 1.72).get("valid", false))
	var wrong_seed := snapshot.duplicate(true)
	wrong_seed["planet_seed"] = "other-planet"
	_check("wrong-planet restore rejected atomically", not world.restore_deformations(wrong_seed).get("valid", false) and world.snapshot_deformations().records.size() == 1)
	_finish()


func _on_impact(result: Dictionary) -> void:
	_impact_result = result


func _check(name: String, okay: bool) -> void:
	_checks += 1
	if not okay:
		_failures.append(name)


func _finish() -> void:
	print("NATIVE_SURFACE_IMPACT_JSON=" + JSON.stringify({"checks": _checks, "passed": _checks - _failures.size(), "failures": _failures, "baseline": _before, "second": _second_support, "request": _accepted, "impact": _impact_result}))
	quit(0 if _failures.is_empty() else 1)
