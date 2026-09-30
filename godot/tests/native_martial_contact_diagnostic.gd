extends "res://tests/native_martial_environment_runtime.gd"
## Read-only physics query instrumentation around genuine R input.
class Probe extends Node:
	var callback: Callable
	func _physics_process(delta: float) -> void:
		callback.call(delta)
var contact_samples: Array[Dictionary] = []
var sampled_casts := {}
var last_delta := 1.0 / 60.0
func _run() -> void:
	capture = false
	game = (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = "user://martial_contact_diagnostic_" + str(Time.get_ticks_usec()) + ".json"
	root.add_child(game)
	await _frames(100)
	environment = get_first_node_in_group("native_environment_damage") as NativeEnvironmentDamage
	game.beast.set_physics_process(false)
	game.beast.global_position = Vector3(500, 50, 500)
	for enemy in game.enemies:
		enemy.set_physics_process(false)
		enemy.global_position = Vector3(500, 50, 500)
	game.combat_event.connect(_combat_observed)
	var observer := Probe.new()
	observer.process_physics_priority = 4
	observer.callback = _sample_contact
	game.add_child(observer)
	await _ground()
	if not "--ambiguous-only" in OS.get_cmdline_user_args():
		for target in [{"id":"probe-pine", "key":"pine-1-0", "kind":"tree", "z":-2.2}, {"id":"probe-rock", "key":"outcrop-0-0", "kind":"outcrop", "z":-3.0}]:
			_add_entity(target.id, target.key, Vector3(0, 0, target.z), target.kind)
			await _frames(4)
			await _cast("break", target.id, 110)
			_check(int(game.martial.last_result.get("environment_hits", 0)) == 1, "same-aim actual R environment contact: " + String(target.id))
			contact_samples.append({"result": game.martial.last_result.duplicate(true), "state": environment.states.get(target.id, {}), "target": target.id})
			await _remove_entity(target.id)
		await _barrier_cases()
	await _ambiguous_overlap_case()
	var output := FileAccess.open(OUT + "/contact-diagnostic.json", FileAccess.WRITE)
	output.store_string(JSON.stringify({"samples": contact_samples, "slot":game.save_path, "checks":checks, "failed":failed, "scope":"Read-only sphere cast and analytic segment comparisons; actual damage comes only from normal R skill processing."}, "\t"))
	print("MARTIAL_CONTACT_DIAGNOSTIC ", JSON.stringify(contact_samples))
	game.initialized = false
	game.queue_free()
	await process_frame
	quit(0 if failed.is_empty() else 1)
func _combat_observed(event: Dictionary) -> void:
	super._combat_observed(event)
	if event.get("phase") == "impact":
		_sample_contact(last_delta)
func _sample_contact(delta: float) -> void:
	last_delta = delta
	var current: Dictionary = game.martial.current
	if current.is_empty() or current.get("phase") != "travel" or sampled_casts.has(current.cast_id):
		return
	var radius := float(current.rule.radius)
	var from: Vector3 = current.position
	var to: Vector3 = from + current.direction * minf(float(current.rule.reach) - float(current.travelled), float(current.rule.speed) * minf(delta, .05))
	if current.kind == "fist":
		from = current.origin - current.direction * .12
		to = current.origin + current.direction * .14
	var solid: Dictionary = game.martial._sweep_solid(from, to, radius)
	if solid.is_empty(): return
	sampled_casts[current.cast_id] = true
	var sphere := SphereShape3D.new()
	sphere.radius = radius
	var query := PhysicsShapeQueryParameters3D.new()
	query.shape = sphere
	query.transform = Transform3D(Basis.IDENTITY, from)
	query.motion = to - from
	query.collision_mask = 17
	query.exclude = [game.player.get_rid()]
	var space := game.player.get_world_3d().direct_space_state
	var fraction := space.cast_motion(query)
	var unsafe_center := from.lerp(to, fraction[1]) if fraction.size() == 2 else from
	var safe_center: Vector3 = solid.get("center", from)
	query.motion = Vector3.ZERO
	query.transform.origin = unsafe_center
	var rest := space.get_rest_info(query)
	var comparisons: Array[Dictionary] = []
	for id in environment.entities:
		var record: Dictionary = environment.entities[id]
		if record.transform.origin.distance_to(from) > 12.0: continue
		for segment: Dictionary in record.asset.segments:
			var a: Vector3 = record.transform * segment.a
			var b: Vector3 = record.transform * segment.b
			var safe_pair := Geometry3D.get_closest_points_between_segments(from, safe_center, a, b)
			var unsafe_pair := Geometry3D.get_closest_points_between_segments(from, unsafe_center, a, b)
			var thickness: float = float(segment.radius) * record.transform.basis.get_scale().x
			comparisons.append({"id":id, "part":segment.part, "safe_gap":safe_pair[0].distance_to(safe_pair[1]) - radius - thickness, "unsafe_gap":unsafe_pair[0].distance_to(unsafe_pair[1]) - radius - thickness, "same_first_body":record.body.get_rid() == solid.get("rid", RID())})
	comparisons.sort_custom(func(a: Dictionary,b: Dictionary): return a.unsafe_gap < b.unsafe_gap)
	contact_samples.append({"cast_id":current.cast_id, "frame":Engine.get_physics_frames(), "from":str(from), "to":str(to), "safe":str(safe_center), "unsafe":str(unsafe_center), "radius":radius, "fractions":str(fraction), "safe_to_unsafe":safe_center.distance_to(unsafe_center), "solid":str(solid), "rest":str(rest), "nearest":comparisons.slice(0, 6)})

func _wall_at(point: Vector3) -> StaticBody3D:
	var body := StaticBody3D.new()
	var collider := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(2.0, 3.0, .04)
	collider.shape = shape
	body.add_child(collider)
	game.add_child(body)
	body.global_position = point
	return body
func _barrier_cases() -> void:
	await _ground()
	_add_entity("probe-wall-tree", "pine-1-0", Vector3(0, 0, -2.2), "tree")
	var wall := _wall_at(game.player.global_position + Vector3(0, 1.2, -1.15))
	await _frames(4)
	await _cast("break", "probe-wall-before-tree", 110)
	_check(not environment.states.has("probe-wall-tree") and int(game.martial.last_result.get("environment_hits", 0)) == 0, "non-environment first wall blocks a tree behind it")
	contact_samples.append({"case":"wall-before-tree", "result":game.martial.last_result.duplicate(true)})
	wall.queue_free()
	await _remove_entity("probe-wall-tree")
	_add_entity("probe-shield-tree", "pine-1-0", Vector3(0, 0, -2.2), "tree")
	var enemy := _target(4.5)
	var hp := enemy.hp
	await _frames(4)
	await _cast("break", "probe-tree-before-enemy", 110)
	_check(environment.states.get("probe-shield-tree", {}).get("fallen", false) and enemy.hp == hp, "first tree receives impact and shields a farther enemy")
	enemy.hp = enemy.max_hp
	enemy.global_position = Vector3(500, 50, 500)
	await _remove_entity("probe-shield-tree")
	await _cast("break", "probe-reference-hand", 110)
	_add_entity("probe-overlap-tree", "pine-1-0", Vector3(0, 0, -2.2), "tree")
	wall = _wall_at(last_release_hand + Vector3(0, 0, -.03))
	await _frames(4)
	await _cast("break", "probe-initial-overlap-wall", 110)
	var contact: Dictionary = game.martial.last_result.get("contact", {})
	_check(contact.get("solid", {}).get("initial_overlap", false), "real charged hand sphere initially overlaps the thin blocker")
	_check(not environment.states.has("probe-overlap-tree") and int(game.martial.last_result.get("environment_hits", 0)) == 0, "initial-overlap wall does not pass environmental damage through")
	contact_samples.append({"case":"initial-overlap-wall", "result":game.martial.last_result.duplicate(true)})
	wall.queue_free()
	await _remove_entity("probe-overlap-tree")

func _ambiguous_overlap_case() -> void:
	await _ground()
	await _cast("break", "probe-reference-overlap-hand", 110)
	_add_entity("probe-ambiguous-tree", "pine-1-0", Vector3(0, 0, -1.25), "tree")
	var wall := _wall_at(last_release_hand + Vector3(0, 0, -.10))
	await _frames(4)
	await _cast("break", "probe-wall-and-tree-overlap", 110)
	var contact: Dictionary = game.martial.last_result.get("contact", {})
	_check(contact.get("solid", {}).get("ambiguous_overlap", false), "real attack sphere simultaneously overlaps distinct wall and tree bodies")
	_check(not environment.states.has("probe-ambiguous-tree") and int(game.martial.last_result.get("environment_hits", 0)) == 0, "ambiguous simultaneous initial overlap fails closed without tree damage")
	contact_samples.append({"case":"ambiguous-wall-tree-overlap", "result":game.martial.last_result.duplicate(true)})
	wall.queue_free()
	await _remove_entity("probe-ambiguous-tree")
