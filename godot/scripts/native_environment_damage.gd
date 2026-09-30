extends Node3D
class_name NativeEnvironmentDamage
## Sole environmental damage authority. See docs/development/ECOLOGY-DAMAGE-R4.md.
const Assets = preload("res://scripts/native_environment_damage_assets.gd")
const GENERATION := "ecology-r4.2"
const MAX_QUERY_RADIUS := 32.0
const MAX_QUERY_REACH := 64.0
const MAX_HITS := 32
const MAX_DYNAMIC := 24
const MAX_DEDUPE := 512
const MAX_PERSISTENT_ENTITIES := 2048
signal damaged(result: Dictionary)
signal surface_impact_requested(query: Dictionary)
signal persistence_failed(message: String)
var library: RefCounted
var ecology: Node3D
var entities: Dictionary = {}
var states: Dictionary = {}
var seen: Dictionary = {}
var impact_seen: Dictionary = {}
var motions: Array[Dictionary] = []
var debris: Array[Dictionary] = []
var support_rechecks: Dictionary = {}
var base_rechecks: Dictionary = {}
var save_path := ""
var world_seed := ""
var slot_identity := ""
var state_error := ""
var _corrupt_state := false
var dirty := false
var _serial := 0

func _ready() -> void:
	add_to_group("native_environment_damage")

func setup(owner_ecology: Node3D, asset_library: RefCounted) -> void:
	ecology = owner_ecology
	library = asset_library

func register_entity(id: String, record: Dictionary) -> void:
	record["id"] = id
	entities[id] = record
	if states.has(id):
		_reanchor_state(id)
		_materialize(id)
		_queue_support_rechecks(id)
		base_rechecks[id] = true

func unregister_cell(cell_key: String) -> void:
	for id in entities.keys():
		if entities[id].cell != cell_key: continue
		for motion in motions.duplicate():
			if motion.id==id: _finish_motion(motion)
		for item in debris.duplicate():
			if item.id==id: _settle_debris(item)
		for key in support_rechecks.keys():
			if support_rechecks[key].id==id: support_rechecks.erase(key)
		base_rechecks.erase(id)
		entities.erase(id)

func clear_stream() -> void:
	var cell_keys := {}
	for record: Dictionary in entities.values(): cell_keys[record.cell] = true
	for key: String in cell_keys: unregister_cell(key)

func damage(query: Dictionary) -> Dictionary:
	var result := {"hits":[],"hit_points":[],"changed":0,"blocked":false,"query_id":str(query.get("cast_id",""))}
	var origin: Vector3 = query.get("origin",Vector3(INF,INF,INF))
	var power := float(query.get("power",0.0))
	if not origin.is_finite() or not is_finite(power) or power<=0.0: return result
	var radius := clampf(float(query.get("radius",0.0)),0.0,MAX_QUERY_RADIUS)
	var reach := clampf(float(query.get("reach",0.0)),0.0,MAX_QUERY_REACH)
	var direction: Vector3 = query.get("direction",Vector3.ZERO)
	if not direction.is_finite() or not is_finite(radius) or not is_finite(reach): return result
	if reach>0.0 and direction.is_zero_approx(): return result
	# A direct physics sweep may identify its first solid blocker. Fail closed
	# for malformed contacts, and retain only that entity before geometry work.
	var contact_rid := RID()
	if query.has("contact_rid"):
		if typeof(query.contact_rid)!=TYPE_RID: return result
		contact_rid = query.contact_rid
		if not contact_rid.is_valid(): return result
	direction = direction.normalized()
	var end := origin+direction*reach
	_serial += 1
	var cast_id := str(query.get("cast_id","anonymous-%d"%_serial))
	if cast_id.is_empty(): cast_id = "anonymous-%d"%_serial
	result.query_id = cast_id
	var phase := str(query.get("phase",0))
	var dedupe_key := str(query.get("source",""))+":"+cast_id+":"+phase
	if query.get("deform_surface",false)==true and power>=600.0 and not impact_seen.has(dedupe_key):
		impact_seen[dedupe_key] = true
		if impact_seen.size()>MAX_DEDUPE: impact_seen.erase(impact_seen.keys()[0])
		var request := query.duplicate()
		request["radius"] = radius
		request["cast_id"] = cast_id
		request["world_seed"] = world_seed
		request["generation"] = GENERATION
		result["deformation_request"] = request
		surface_impact_requested.emit(request)
	if not seen.has(dedupe_key):
		seen[dedupe_key] = {}
		if seen.size()>MAX_DEDUPE: seen.erase(seen.keys()[0])
	var candidates: Array[Dictionary] = []
	for id in entities:
		var record: Dictionary = entities[id]
		if not record.get("physical",false) or seen[dedupe_key].has(id): continue
		if contact_rid.is_valid() and not _matches_contact_rid(record,contact_rid): continue
		var state: Dictionary = states.get(id,{})
		if state.get("cleared",false): continue
		var transform: Transform3D = record.transform
		var scale_value := transform.basis.get_scale().x
		if transform.origin.distance_to(origin)>reach+radius+float(record.asset.height)*scale_value+8.0: continue
		var best := {}
		for segment: Dictionary in record.asset.segments:
			var part := str(segment.part)
			if part=="stump" or part in state.get("removed",[]): continue
			var pose := Transform3D.IDENTITY
			var live_entry: Dictionary = record.get("part_nodes",{}).get(part,{})
			var live_body = live_entry.get("body")
			if is_instance_valid(live_body) and live_body is RigidBody3D:
				# Re-supported saved debris has a previous persisted pose while
				# its live grouped body is moving toward the new terrain.
				pose = live_body.transform*(live_entry.mesh as MeshInstance3D).transform
			elif state.get("poses",{}).has(part): pose = _decode_transform(state.poses[part])
			elif part in state.get("broken",[]):
				# Moving detached bodies are queried at their current authoritative pose.
				if not record.get("part_nodes",{}).has(part): continue
				var body: Node3D = record.part_nodes[part].body
				var mesh: MeshInstance3D = record.part_nodes[part].mesh
				pose = body.transform*mesh.transform
			elif state.get("fallen",false) and record.kind=="tree":
				if record.get("part_nodes",{}).has(part): pose = record.part_nodes[part].body.transform
				else: pose = _decode_transform(state.get("fall_pose",_encode_transform(Transform3D.IDENTITY)))
			var a: Vector3 = transform*(pose*segment.a)
			var b: Vector3 = transform*(pose*segment.b)
			var nearest := Geometry3D.get_closest_points_between_segments(origin,end,a,b)
			var distance: float = nearest[0].distance_to(nearest[1])
			var thickness := float(segment.radius)*scale_value
			if distance>radius+thickness: continue
			var contact_center: Vector3 = nearest[0]
			var contact_axis: Vector3 = nearest[1]
			var order := maxf(0.0,distance-thickness)
			if reach>0.0:
				# First entry into the expanded woody capsule, not the surface at
				# closest approach. At a crossing, tiny signed rounding errors in
				# the latter can flip the normal and choose a farther main stem.
				var first_axis := Geometry3D.get_closest_point_to_segment(origin,a,b)
				var low := 0.0
				var high := clampf((contact_center-origin).dot(direction),0.0,reach)
				if origin.distance_to(first_axis)<=radius+thickness: high = 0.0
				else:
					for step in range(14):
						var mid := (low+high)*.5
						var probe := origin+direction*mid
						var axis_point := Geometry3D.get_closest_point_to_segment(probe,a,b)
						if probe.distance_to(axis_point)<=radius+thickness: high = mid
						else: low = mid
				order = high
				contact_center = origin+direction*high
				contact_axis = Geometry3D.get_closest_point_to_segment(contact_center,a,b)
			var separation := contact_center-contact_axis
			var normal: Vector3 = separation.normalized() if separation.length_squared()>.0000000001 else (-direction if reach>0 else transform.basis.x.normalized())
			var point: Vector3 = contact_axis+normal*thickness
			if best.is_empty() or order<float(best.order):
				best = {"id":id,"part":part,"point":point,"normal":normal,"order":order,"surface_distance":maxf(0.0,distance-thickness)}
		if best.is_empty() and record.kind=="outcrop" and contact_rid.is_valid():
			best = _rock_contact(record,state,query,origin,end,radius,contact_rid)
		if not best.is_empty(): candidates.append(best)
	candidates.sort_custom(func(a: Dictionary,b: Dictionary)->bool:return a.order<b.order)
	var max_targets := clampi(int(query.get("max_targets",MAX_HITS)),1,MAX_HITS)
	if query.get("stop_on_first",false): max_targets = 1
	var occlusion_origin: Vector3 = query.get("occlusion_origin",origin)
	if not occlusion_origin.is_finite(): return result
	for hit in candidates.slice(0,MAX_HITS):
		if result.changed>=max_targets: break
		var id: String = hit.id
		var record: Dictionary = entities[id]
		if not states.has(id) and states.size()>=MAX_PERSISTENT_ENTITIES:
			result["budget_exhausted"] = true
			continue
		var blocked := _occluder(record,occlusion_origin,hit.point,query)
		if not blocked.is_empty():
			result.blocked = true
			result["occluder"] = blocked
			continue
		seen[dedupe_key][id] = true
		var state: Dictionary = states.get(id,{"health":{},"broken":[],"poses":{},"fallen":false})
		if not state.has("pose_anchor"): state["pose_anchor"] = _encode_transform(record.transform)
		var part: String = hit.part
		var kind: String = record.kind
		var damage_type := str(query.get("damage_type","blunt"))
		var applied := power*(0.30 if kind=="outcrop" and damage_type=="slash" else 1.0)
		if str(query.get("falloff",""))=="linear": applied *= maxf(0.0,1.0-float(hit.surface_distance)/maxf(.001,radius))
		if applied<=0.0: continue
		# Any outcrop chunk contributes to this finite rock mass's total integrity.
		var detached: bool = part in state.broken
		var remnant := bool(state.get("fallen",false)) and (not detached or kind=="outcrop")
		var hp_key := "remnant" if remnant else ("debris_"+part if detached else ("rock" if kind=="outcrop" else ("trunk" if part=="trunk" else part)))
		var max_hp := (120.0 if kind=="outcrop" else 90.0) if remnant else (float(record.asset.hp) if hp_key in ["rock","trunk"] else maxf(45.0,float(record.asset.hp)*(.68 if part.begins_with("stem_") else .31)))
		state.health[hp_key] = maxf(0.0,float(state.health.get(hp_key,max_hp))-applied)
		states[id] = state
		_materialize(id)
		var destroyed: bool = state.health[hp_key]<=0.0
		if destroyed:
			if remnant:
				state["cleared"] = true
				for motion in motions.duplicate():
					if motion.id==id: _finish_motion(motion)
				for item in debris.duplicate():
					if item.id==id: _settle_debris(item)
				for piece in record.part_nodes:
					var body: CollisionObject3D = record.part_nodes[piece].body
					body.collision_layer = 0
					body.hide()
					for child in body.get_children():
						if child is CollisionShape3D: child.set_deferred("disabled",true)
			elif detached:
				if not state.has("removed"): state["removed"] = []
				var fragment_root := str(state.get("fragment_roots",{}).get(part,part))
				var members := _subtree_parts(record,fragment_root)
				for item in debris.duplicate():
					if item.id==id and item.part==fragment_root: _settle_debris(item)
				for member: String in members:
					if member not in state.broken or not record.part_nodes.has(member): continue
					if str(state.get("fragment_roots",{}).get(member,member))!=fragment_root: continue
					if member not in state.removed: state.removed.append(member)
					record.part_nodes[member].body.collision_layer = 0
					record.part_nodes[member].body.hide()
			elif hp_key=="trunk": _fell_tree(id,direction if reach>0 else (record.transform.origin-origin))
			elif hp_key=="rock":
				state.fallen = true
				for piece: String in record.asset.parts:
					if piece.begins_with("chunk_"): _break_part(id,piece,direction,power)
			else: _break_part(id,part,direction,power)
		else:
			var visual: MeshInstance3D = record.part_nodes.get(part,{}).get("mesh")
			if is_instance_valid(visual):
				var material := StandardMaterial3D.new()
				material.vertex_color_use_as_albedo = true
				material.albedo_color = Color(.78,.70,.59)
				material.roughness = 1.0
				material.cull_mode = BaseMaterial3D.CULL_DISABLED
				visual.material_override = material
		var collider: CollisionObject3D = record.part_nodes.get(part,{}).get("body",record.body)
		result.hits.append({"entity_id":id,"kind":kind,"part":part,"point":hit.point,"normal":hit.normal,"damage":applied,"destroyed":destroyed,"blocked":true,"collider":collider,"rid":collider.get_rid() if is_instance_valid(collider) else RID()})
		result.hit_points.append(hit.point)
		result.changed += 1
		result.blocked = true
	dirty = dirty or result.changed>0
	if result.changed>0: damaged.emit(result)
	return result

func _matches_contact_rid(record: Dictionary, contact_rid: RID) -> bool:
	var body = record.get("body")
	if is_instance_valid(body) and body is CollisionObject3D and body.get_rid()==contact_rid: return true
	for entry: Dictionary in record.get("part_nodes",{}).values():
		var part_body = entry.get("body")
		if is_instance_valid(part_body) and part_body is CollisionObject3D and part_body.get_rid()==contact_rid: return true
	return false

func _rock_contact(record: Dictionary, state: Dictionary, query: Dictionary, origin: Vector3, end: Vector3, radius: float, contact_rid: RID) -> Dictionary:
	# Intact rock uses its actual convex hull; its chunk capsules are only
	# analytic proxies and can sit behind that hull. Revalidate a supplied
	# direct contact against the same live physics surface before accepting it.
	if not is_inside_tree() or get_world_3d()==null: return {}
	if typeof(query.get("contact_point"))!=TYPE_VECTOR3 or typeof(query.get("contact_normal"))!=TYPE_VECTOR3: return {}
	if typeof(query.get("contact_shape"))!=TYPE_INT or int(query.contact_shape)<0: return {}
	var point: Vector3 = query.contact_point
	var normal: Vector3 = query.contact_normal
	if not point.is_finite() or not normal.is_finite() or absf(normal.length_squared()-1.0)>.02: return {}
	normal = normal.normalized()
	var center := Geometry3D.get_closest_point_to_segment(point,origin,end)
	if point.distance_to(center)>radius+.005: return {}
	var ray := PhysicsRayQueryParameters3D.create(point+normal*.01,point-normal*.01,17)
	var surface := get_world_3d().direct_space_state.intersect_ray(ray)
	if surface.is_empty() or surface.rid!=contact_rid or int(surface.shape)!=int(query.contact_shape): return {}
	if (surface.position as Vector3).distance_to(point)>.005: return {}
	var transform: Transform3D = record.transform
	var scale_value := transform.basis.get_scale().x
	var nearest_part := ""
	var nearest_gap := INF
	for segment: Dictionary in record.asset.segments:
		var part := str(segment.part)
		if not part.begins_with("chunk_") or part in state.get("removed",[]): continue
		var pose := Transform3D.IDENTITY
		if record.has("live"):
			var entry: Dictionary = record.get("part_nodes",{}).get(part,{})
			var body = entry.get("body")
			if not is_instance_valid(body) or not body is CollisionObject3D or body.get_rid()!=contact_rid: continue
			var mesh: MeshInstance3D = entry.mesh
			pose = body.transform*mesh.transform
		var a: Vector3 = transform*(pose*segment.a)
		var b: Vector3 = transform*(pose*segment.b)
		var axis := Geometry3D.get_closest_point_to_segment(point,a,b)
		var gap := maxf(0.0,point.distance_to(axis)-float(segment.radius)*scale_value)
		if gap<nearest_gap:
			nearest_gap = gap
			nearest_part = part
	if nearest_part.is_empty(): return {}
	return {"id":record.id,"part":nearest_part,"point":surface.position,"normal":surface.normal,"order":origin.distance_to(center),"surface_distance":point.distance_to(center)}

func _occluder(record: Dictionary, origin: Vector3, point: Vector3, query: Dictionary) -> Dictionary:
	if not is_inside_tree() or get_world_3d()==null: return {}
	var direction := (point-origin).normalized()
	if direction.is_zero_approx(): return {}
	var ray := PhysicsRayQueryParameters3D.create(origin,point+direction*.025,17)
	var excludes: Array[RID] = []
	for rid: RID in query.get("exclude_rids",[]): excludes.append(rid)
	ray.exclude = excludes
	var hit := get_world_3d().direct_space_state.intersect_ray(ray)
	if hit.is_empty(): return {}
	var collider: Object = hit.collider
	if collider==record.body: return {}
	if collider is Node and str(collider.get_meta("environment_entity",""))==str(record.get("id","")): return {}
	for piece: Dictionary in record.get("part_nodes",{}).values():
		if collider==piece.body: return {}
	return {"point":hit.position,"normal":hit.normal,"collider":collider,"rid":hit.rid}

func _materialize(id: String) -> void:
	var record: Dictionary = entities[id]
	if record.has("live"): return
	# Preserve the site's origin, so hiding one instance cannot expand a batch's
	# bounds all the way back to the distant legacy scene origin.
	var zero := Transform3D(Basis().scaled(Vector3.ZERO),(record.transform as Transform3D).origin)
	(record.batch as MultiMesh).set_instance_transform(int(record.index),zero)
	if is_instance_valid(record.body):
		record.body.collision_layer = 0
		for child in record.body.get_children():
			if child is CollisionShape3D: child.set_deferred("disabled",true)
	var live := Node3D.new()
	live.name = "Damage_"+str(id.hash())
	record.parent.add_child(live)
	live.transform = record.transform
	record["live"] = live
	record["part_nodes"] = {}
	var state: Dictionary = states[id]
	if state.get("cleared",false): return
	for part: String in record.asset.parts:
		if part in state.get("removed",[]): continue
		var body := StaticBody3D.new()
		body.collision_layer = 1 if record.physical else 0
		body.collision_mask = 0
		body.set_meta("environment_entity",id)
		body.set_meta("environment_part",part)
		live.add_child(body)
		var mesh := MeshInstance3D.new()
		mesh.mesh = library.mesh_named(str(record.asset.id)+"_"+part)
		body.add_child(mesh)
		if record.physical: _part_shapes(record,part,body)
		if state.poses.has(part): body.transform = _decode_transform(state.poses[part])
		elif state.get("fallen",false) and record.kind=="tree" and part!="stump":
			body.transform = _decode_transform(state.get("fall_pose",_encode_transform(Transform3D.IDENTITY)))
		record.part_nodes[part] = {"body":body,"mesh":mesh}

func _part_shapes(record: Dictionary, part: String, body: CollisionObject3D, offset := Vector3.ZERO) -> void:
	if record.kind=="outcrop":
		var shape := CollisionShape3D.new()
		shape.shape = (library.mesh_named(str(record.asset.id)+"_"+part) as ArrayMesh).create_convex_shape(true,true)
		shape.position = -offset
		body.add_child(shape)
	else:
		for segment: Dictionary in record.asset.segments:
			if segment.part!=part: continue
			if body is RigidBody3D:
				var dynamic_segment := segment.duplicate()
				dynamic_segment.physical = true
				Assets.add_segment(body,dynamic_segment,offset)
			else: Assets.add_segment(body,segment,offset)

func _fell_tree(id: String, direction: Vector3) -> void:
	var record: Dictionary = entities[id]
	var state: Dictionary = states[id]
	state.fallen = true
	var local_direction: Vector3 = record.transform.basis.inverse()*direction
	local_direction.y = 0
	if local_direction.length()<0.01: local_direction = Vector3.RIGHT
	local_direction = local_direction.normalized()
	var axis := Vector3.UP.cross(local_direction).normalized()
	var pivot := Vector3(0,.96,0)
	var angle := 0.0
	# Sweep the actual woody collider paths to first supported ground contact.
	for step in range(1,53):
		var test_angle := step*PI/104.0
		var pose := Transform3D(Basis(axis,test_angle),pivot-Basis(axis,test_angle)*pivot)
		var penetrates := false
		for segment: Dictionary in record.asset.segments:
			if segment.part=="stump" or segment.part in state.broken: continue
			for local_point: Vector3 in [segment.a,segment.b]:
				if local_point.y<1.7: continue
				var world_point: Vector3 = record.transform*(pose*local_point)
				if _clearance(record,world_point)<float(segment.radius)*record.transform.basis.get_scale().x:
					penetrates = true
					break
			if penetrates: break
		if penetrates: break
		angle = test_angle
	var target := Transform3D(Basis(axis,angle),pivot-Basis(axis,angle)*pivot)
	state["fall_pose"] = _encode_transform(target)
	motions.append({"id":id,"elapsed":0.0,"duration":1.7,"axis":axis,"angle":angle,"pivot":pivot,"target":target})
	while motions.size()>6: _finish_motion(motions[0])

func _subtree_parts(record: Dictionary, root_part: String) -> Array[String]:
	var members: Array[String] = [root_part]
	var parents: Dictionary = record.asset.get("parents",{})
	for i in range(record.asset.parts.size()):
		var grew := false
		for child: String in parents:
			if child not in members and str(parents[child]) in members:
				members.append(child)
				grew = true
		if not grew: break
	return members

func _break_part(id: String, part: String, direction: Vector3, power: float) -> void:
	var record: Dictionary = entities[id]
	var state: Dictionary = states[id]
	if part in state.broken: return
	var members: Array[String] = []
	var bounds: AABB = record.part_nodes[part].mesh.mesh.get_aabb()
	if not state.has("fragment_roots"): state["fragment_roots"] = {}
	for member: String in _subtree_parts(record,part):
		if member in state.broken or member in state.get("removed",[]): continue
		members.append(member)
		state.broken.append(member)
		state.fragment_roots[member] = part
		bounds = bounds.merge(record.part_nodes[member].mesh.mesh.get_aabb())
	var center := bounds.get_center()
	var body := RigidBody3D.new()
	body.name = "Fragment_"+part
	body.set_meta("environment_entity",id)
	body.set_meta("environment_part",part)
	body.gravity_scale = 0.0
	body.mass = 28.0 if record.kind=="outcrop" else 7.0+members.size()*2.0
	body.collision_layer = 1
	body.collision_mask = 1
	body.continuous_cd = true
	body.linear_damp = .7
	body.angular_damp = 1.6
	body.physics_material_override = PhysicsMaterial.new()
	body.physics_material_override.friction = .85
	body.physics_material_override.bounce = .08
	(record.live as Node3D).add_child(body)
	body.position = center
	for member: String in members:
		var old: StaticBody3D = record.part_nodes[member].body
		var mesh: MeshInstance3D = record.part_nodes[member].mesh
		old.remove_child(mesh)
		body.add_child(mesh)
		mesh.position = -center
		_part_shapes(record,member,body,center)
		old.collision_layer = 0
		old.queue_free()
		record.part_nodes[member] = {"body":body,"mesh":mesh}
	var up: Vector3 = record.transform.basis.y.normalized()
	var outward: Vector3 = record.transform.basis*Vector3(center.x,0,center.z).normalized()
	body.linear_velocity = (direction.normalized()+outward*.8)*minf(5.0,power/140.0)+up*2.1
	body.angular_velocity = up.cross(outward+direction).normalized()*1.5
	var item := {"id":id,"part":part,"members":members,"body":body,"center":center,"age":0.0}
	debris.append(item)
	while debris.size()>MAX_DYNAMIC: _settle_debris(debris[0])

func invalidate_support_region(origin: Vector3, radius: float) -> void:
	# Called after the terrain collider commit. Public registered entities are
	# covered too, even when they do not belong to an ecology streamed cell.
	for id: String in entities:
		var record: Dictionary = entities[id]
		if not states.has(id) or not record.get("physical",false): continue
		var bound: float = float(record.asset.height)*record.transform.basis.get_scale().x+32.0
		if record.transform.origin.distance_to(origin)<=maxf(0.0,radius)+bound:
			_queue_support_rechecks(id)
			base_rechecks[id] = true

func _reanchor_registered_base(id: String) -> void:
	if not entities.has(id) or not states.has(id): return
	var record: Dictionary = entities[id]
	var state: Dictionary = states[id]
	if state.get("cleared",false) or not record.get("physical",false): return
	var support := _physical_support(record.transform.origin)
	if not support.get("ready",false):
		base_rechecks[id] = true
		return
	var previous: Transform3D = record.transform
	var current := previous
	current.origin = support.point
	if current.origin.distance_to(previous.origin)<.02: return
	var correction := current.affine_inverse()*previous
	var retained := {}
	for part: String in record.get("part_nodes",{}):
		if part=="stump": continue
		if part not in state.broken and not state.get("fallen",false): continue
		var body: Node3D = record.part_nodes[part].body
		retained[body.get_instance_id()] = {"body":body,"world_pose":body.global_transform}
	record["transform"] = current
	if is_instance_valid(record.body): record.body.transform = current
	if record.has("live"):
		(record.live as Node3D).transform = current
		for entry: Dictionary in retained.values():
			(entry.body as Node3D).global_transform = entry.world_pose
	else: (record.batch as MultiMesh).set_instance_transform(int(record.index),current)
	_reanchor_state(id)
	for motion in motions:
		if motion.id!=id: continue
		motion["anchor_correction"] = correction*motion.get("anchor_correction",Transform3D.IDENTITY)
		motion.target = correction*motion.target
	_queue_support_rechecks(id)
	dirty = true

func _reanchor_state(id: String) -> void:
	var state: Dictionary = states[id]
	var current: Transform3D = entities[id].transform
	if state.has("pose_anchor"):
		var previous := _decode_transform(state.pose_anchor)
		if not previous.is_equal_approx(current):
			# Persisted detached/fallen poses represent world positions. A newly
			# lowered root must not apply the crater displacement a second time.
			var correction := current.affine_inverse()*previous
			for part: String in state.poses:
				state.poses[part] = _encode_transform(correction*_decode_transform(state.poses[part]))
			if state.has("fall_pose"): state.fall_pose = _encode_transform(correction*_decode_transform(state.fall_pose))
			state.pose_anchor = _encode_transform(current)
			dirty = true
	else: state["pose_anchor"] = _encode_transform(current)

func _queue_support_rechecks(id: String) -> void:
	if not entities.has(id) or not states.has(id): return
	var state: Dictionary = states[id]
	if state.get("cleared",false): return
	for root_part: String in state.get("fragment_roots",{}).values():
		support_rechecks[id+"|"+root_part] = {"id":id,"part":root_part}
	if state.get("fallen",false) and entities[id].kind=="tree":
		support_rechecks[id+"|@fallen"] = {"id":id,"part":"@fallen"}

func _support_members(record: Dictionary, state: Dictionary, root_part: String) -> Array[String]:
	var members: Array[String] = []
	for part: String in record.get("part_nodes",{}):
		if part=="stump" or part in state.get("removed",[]): continue
		if root_part=="@fallen":
			if part not in state.broken: members.append(part)
		elif part in state.broken and str(state.get("fragment_roots",{}).get(part,""))==root_part: members.append(part)
	return members

func _resume_support(item: Dictionary) -> void:
	var id: String = item.id
	if not entities.has(id) or not states.has(id): return
	var record: Dictionary = entities[id]
	var state: Dictionary = states[id]
	if state.get("cleared",false) or not record.get("physical",false): return
	for moving in debris:
		if moving.id==id and moving.part==item.part: return
	if item.part=="@fallen":
		for motion in motions:
			if motion.id==id:
				support_rechecks[id+"|"+str(item.part)] = item
				return
	var members := _support_members(record,state,item.part)
	if members.is_empty(): return
	var root_entry: Dictionary = record.part_nodes[members[0]]
	var provisional := {"id":id,"part":item.part,"members":members}
	var clearance := _fragment_clearance(record,provisional)
	if not is_finite(clearance):
		support_rechecks[id+"|"+str(item.part)] = item
		return
	if absf(clearance)<=.035: return
	var bounds: AABB = root_entry.mesh.mesh.get_aabb()
	for member: String in members: bounds = bounds.merge(record.part_nodes[member].mesh.mesh.get_aabb())
	var center := bounds.get_center()
	var pose: Transform3D = root_entry.body.transform*root_entry.mesh.transform
	var body := RigidBody3D.new()
	body.name = "SupportFragment_"+str(item.part)
	body.set_meta("environment_entity",id)
	body.set_meta("environment_part",item.part)
	body.gravity_scale = 0.0
	body.mass = 28.0 if record.kind=="outcrop" else 7.0+members.size()*2.0
	body.collision_layer = 1
	body.collision_mask = 1
	body.continuous_cd = true
	body.linear_damp = .7
	body.angular_damp = 1.6
	body.physics_material_override = PhysicsMaterial.new()
	body.physics_material_override.friction = .85
	body.physics_material_override.bounce = .08
	(record.live as Node3D).add_child(body)
	body.transform = pose*Transform3D(Basis.IDENTITY,center)
	var retired := {}
	for member: String in members:
		var entry: Dictionary = record.part_nodes[member]
		var old: CollisionObject3D = entry.body
		var mesh: MeshInstance3D = entry.mesh
		old.remove_child(mesh)
		body.add_child(mesh)
		mesh.transform = Transform3D(Basis.IDENTITY,-center)
		_part_shapes(record,member,body,center)
		old.collision_layer = 0
		retired[old.get_instance_id()] = old
		record.part_nodes[member] = {"body":body,"mesh":mesh}
	for old: CollisionObject3D in retired.values(): old.queue_free()
	debris.append({"id":id,"part":item.part,"members":members,"body":body,"center":center,"age":0.0,"fallen_group":item.part=="@fallen"})
	while debris.size()>MAX_DYNAMIC: _settle_debris(debris[0])

func _store_fragment_pose(item: Dictionary, pose: Transform3D, target_states: Dictionary) -> void:
	if item.get("fallen_group",false): target_states[item.id].fall_pose = _encode_transform(pose)
	else:
		for member: String in item.get("members",[item.part]): target_states[item.id].poses[member] = _encode_transform(pose)

func _physics_process(delta: float) -> void:
	if not base_rechecks.is_empty():
		var id: String = base_rechecks.keys()[0]
		base_rechecks.erase(id)
		_reanchor_registered_base(id)
	# One support group per physics tick; missing terrain waits without allowing
	# gravity to drop a frozen saved fragment through an unloaded world.
	if not support_rechecks.is_empty():
		var key: String = support_rechecks.keys()[0]
		var recheck: Dictionary = support_rechecks[key]
		support_rechecks.erase(key)
		_resume_support(recheck)
	for motion in motions.duplicate():
		if not entities.has(motion.id): motions.erase(motion); continue
		motion.elapsed += delta
		var t := minf(1.0,float(motion.elapsed)/float(motion.duration))
		var angle := float(motion.angle)*t*t
		var rotation := Basis(motion.axis,angle)
		var pose: Transform3D = motion.get("anchor_correction",Transform3D.IDENTITY)*Transform3D(rotation,motion.pivot-rotation*motion.pivot)
		var record: Dictionary = entities[motion.id]
		for part in record.part_nodes:
			if part=="stump" or part in states[motion.id].broken: continue
			record.part_nodes[part].body.transform = pose
		if t>=1.0: _finish_motion(motion)
	for item in debris.duplicate():
		if not is_instance_valid(item.body): debris.erase(item); continue
		item.age += delta
		var body: RigidBody3D = item.body
		var record: Dictionary = entities[item.id]
		var up: Vector3 = record.transform.basis.y.normalized()
		body.apply_central_force(-up*body.mass*9.8)
		if float(item.age)>3.4 or (float(item.age)>.65 and body.sleeping): _settle_debris(item)

func _finish_motion(motion: Dictionary) -> void:
	if entities.has(motion.id):
		var record: Dictionary = entities[motion.id]
		for part in record.part_nodes:
			if part=="stump" or part in states[motion.id].broken: continue
			record.part_nodes[part].body.transform = motion.target
	motions.erase(motion)
	dirty = true

func _settle_debris(item: Dictionary) -> void:
	if not entities.has(item.id) or not is_instance_valid(item.body): debris.erase(item); return
	var record: Dictionary = entities[item.id]
	var body: RigidBody3D = item.body
	body.freeze = true
	body.linear_velocity = Vector3.ZERO
	body.angular_velocity = Vector3.ZERO
	# Snap the lowest actual mesh samples onto support after bounded physics.
	var lowest := _fragment_clearance(record,item)
	if is_finite(lowest): body.global_position -= record.transform.basis.y.normalized()*lowest
	else: support_rechecks[str(item.id)+"|"+str(item.part)] = {"id":item.id,"part":item.part}
	var local_pose: Transform3D = body.transform*Transform3D(Basis.IDENTITY,-item.center)
	_store_fragment_pose(item,local_pose,states)
	debris.erase(item)
	dirty = true

func _fragment_clearance(record: Dictionary, item: Dictionary) -> float:
	var lowest := INF
	for member: String in item.get("members",[item.part]):
		var mesh: MeshInstance3D = record.part_nodes[member].mesh
		var vertices: PackedVector3Array = mesh.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]
		for i in range(0,vertices.size(),maxi(1,vertices.size()/96)):
			var clearance := _clearance(record,mesh.global_transform*vertices[i])
			if not is_finite(clearance): return INF
			lowest = minf(lowest,clearance)
	return lowest

func _clearance(record: Dictionary, world_point: Vector3) -> float:
	var up: Vector3 = record.transform.basis.y.normalized()
	if ecology!=null and ecology.planet!=null:
		var support := _physical_support(world_point)
		if support.get("ready",false): return (world_point-(support.point as Vector3)).dot(up)
		return INF
	# Standalone authored test scenes can explicitly use their original plane;
	# a streamed world never treats an unloaded old plane as fresh support.
	return (world_point-(record.transform as Transform3D).origin).dot(up)

func _physical_support(point: Vector3) -> Dictionary:
	var source: Node3D = ecology.planet
	if not source is NativePlanet: return source.surface_at(point)
	var owner_world := ecology.get_parent()
	var old_basin := point.y>-1000.0 and absf(point.x)<=3000.0 and absf(point.z)<=3000.0
	var mask := 16
	var terrain_group := "native_planet_terrain"
	var up := NativePlanet.radial_up(point)
	var ray_from := NativePlanet.CENTER+up*(NativePlanet.RADIUS+7000.0)
	var ray_to := NativePlanet.CENTER+up*(NativePlanet.RADIUS-7000.0)
	if old_basin:
		if owner_world==null or not owner_world.has_method("_physical_landing_support"): return {"ready":false}
		# Existing immutable basin contract: 6km, 160m chunks, indices 0..37.
		var cell := Vector2i(clampi(floori((point.x+3000.0)/160.0),0,37),clampi(floori((point.z+3000.0)/160.0),0,37))
		var chunks: Dictionary = owner_world.get("_chunks")
		if not chunks.has(cell): return {"ready":false}
		mask = 32
		terrain_group = "native_terrain"
		ray_from = point+up*100.0
		ray_to = point-up*100.0
	else:
		var direction := NativePlanet.scene_to_canonical(point).normalized()
		var key := NativePlanet._tile_key(NativePlanet._tile_at(direction,NativePlanet.NEAR_LEVEL))
		if not source._near_tiles.has(key): return {"ready":false}
	var ray := PhysicsRayQueryParameters3D.create(ray_from,ray_to,mask)
	ray.hit_back_faces = true
	var hit := get_world_3d().direct_space_state.intersect_ray(ray)
	if hit.is_empty() or not (hit.collider as Node).is_in_group(terrain_group): return {"ready":false}
	return {"ready":true,"point":hit.position,"normal":hit.normal}

func bind_save_slot(path: String, seed: Variant, identity: String, restore := true) -> Error:
	if path.is_empty() or identity.is_empty(): return ERR_INVALID_PARAMETER
	if ecology!=null: ecology.clear()
	else: clear_stream()
	save_path = path
	world_seed = str(seed)
	slot_identity = identity
	states.clear()
	seen.clear()
	impact_seen.clear()
	state_error = ""
	_corrupt_state = false
	dirty = false
	if not restore: return OK
	var input_path := path
	# Recover the rename crash window only for this explicitly identified slot.
	if not FileAccess.file_exists(input_path) and FileAccess.file_exists(path+".bak"): input_path = path+".bak"
	if not FileAccess.file_exists(input_path): return OK
	var raw: Variant = JSON.parse_string(FileAccess.get_file_as_string(input_path))
	return import_state(raw)

func import_state(raw: Variant) -> Error:
	if raw is Dictionary and raw.get("generation") is String and raw.generation!=GENERATION:
		state_error = "environment_generation_mismatch: saved="+str(raw.generation).left(64)+" required="+GENERATION+"; original preserved"
		_corrupt_state = true
		persistence_failed.emit(state_error)
		return ERR_FILE_CORRUPT
	if not raw is Dictionary or not (raw.get("version") is float or raw.get("version") is int) or raw.version!=1 or raw.get("generation","")!=GENERATION or raw.get("world_seed",null)!=world_seed or raw.get("slot_identity","")!=slot_identity or not raw.get("entities") is Dictionary:
		state_error = "Invalid or incompatible environment sidecar; original file preserved"
		_corrupt_state = true
		persistence_failed.emit(state_error)
		return ERR_FILE_CORRUPT
	if raw.entities.size()>MAX_PERSISTENT_ENTITIES:
		state_error = "Environment state exceeds persistent entity budget"
		_corrupt_state = true
		persistence_failed.emit(state_error)
		return ERR_FILE_CORRUPT
	for id in raw.entities:
		var state: Variant = raw.entities[id]
		if not _valid_state(state):
			state_error = "Malformed environment entity state; original file preserved"
			_corrupt_state = true
			persistence_failed.emit(state_error)
			return ERR_FILE_CORRUPT
	if ecology!=null: ecology.clear()
	else: clear_stream()
	states = raw.entities.duplicate(true)
	support_rechecks.clear()
	base_rechecks.clear()
	seen.clear()
	impact_seen.clear()
	state_error = ""
	_corrupt_state = false
	dirty = false
	return OK

func _valid_state(value: Variant) -> bool:
	if not value is Dictionary: return false
	var state: Dictionary = value
	if not state.get("health") is Dictionary or not state.get("broken") is Array or not state.get("poses") is Dictionary or not state.get("fallen") is bool: return false
	for hp: Variant in state.health.values():
		if not (hp is float or hp is int) or not is_finite(float(hp)) or float(hp)<0.0: return false
	for part: Variant in state.broken:
		if not part is String: return false
	if state.has("cleared") and not state.cleared is bool: return false
	if state.has("removed"):
		if not state.removed is Array: return false
		for part: Variant in state.removed:
			if not part is String: return false
	if state.has("fragment_roots"):
		if not state.fragment_roots is Dictionary: return false
		for part: Variant in state.fragment_roots:
			if not part is String or not state.fragment_roots[part] is String: return false
			if part not in state.broken or state.fragment_roots[part] not in state.broken: return false
			var fragment_root: String = state.fragment_roots[part]
			if state.fragment_roots.get(fragment_root,"")!=fragment_root: return false
	for part: String in state.broken:
		if not state.get("fragment_roots",{}).has(part) or not state.poses.has(part): return false
	var poses: Array = state.poses.values()
	if state.has("fall_pose"): poses.append(state.fall_pose)
	if state.has("pose_anchor"):
		if not state.pose_anchor is Array or state.pose_anchor.size()!=12: return false
		for number: Variant in state.pose_anchor:
			if not (number is int or number is float) or not is_finite(float(number)) or absf(float(number))>1000000.0: return false
		if absf(_decode_transform(state.pose_anchor).basis.determinant())<.01: return false
	for pose: Variant in poses:
		if not pose is Array or pose.size()!=12: return false
		for number: Variant in pose:
			if not (number is int or number is float) or not is_finite(float(number)) or absf(float(number))>10000.0: return false
		var t := _decode_transform(pose)
		if absf(t.basis.determinant())<.01: return false
	return true

func save_state() -> Error:
	if save_path.is_empty(): return ERR_UNCONFIGURED
	if _corrupt_state: return ERR_FILE_CORRUPT
	var envelope := export_state()
	var temp := save_path+".tmp"
	var backup := save_path+".bak"
	var file := FileAccess.open(temp,FileAccess.WRITE)
	if file==null: return _save_error("open temporary environment file",FileAccess.get_open_error())
	file.store_string(JSON.stringify(envelope))
	file.flush()
	var error := file.get_error()
	file.close()
	if error!=OK: return _save_error("flush environment file",error)
	if FileAccess.file_exists(save_path):
		if FileAccess.file_exists(backup): DirAccess.remove_absolute(backup)
		error = DirAccess.rename_absolute(save_path,backup)
		if error!=OK: return _save_error("backup environment file",error)
	error = DirAccess.rename_absolute(temp,save_path)
	if error!=OK:
		if FileAccess.file_exists(backup): DirAccess.rename_absolute(backup,save_path)
		return _save_error("replace environment file",error)
	dirty = false
	state_error = ""
	return OK

func export_state() -> Dictionary:
	# A save must never terminate live animation or freeze moving bodies. The
	# snapshot restores settled poses while the current simulation keeps moving.
	var saved_states := states.duplicate(true)
	for item in debris:
		if not entities.has(item.id) or not is_instance_valid(item.body): continue
		var record: Dictionary = entities[item.id]
		var body: RigidBody3D = item.body
		var pose: Transform3D = body.transform*Transform3D(Basis.IDENTITY,-item.center)
		var lowest := _fragment_clearance(record,item)
		if is_finite(lowest): pose.origin.y -= lowest/(record.transform as Transform3D).basis.get_scale().y
		_store_fragment_pose(item,pose,saved_states)
	var envelope := {"version":1,"generation":GENERATION,"world_seed":world_seed,"slot_identity":slot_identity,"entities":saved_states}
	return envelope

func _save_error(action: String, code: Error) -> Error:
	state_error = action+": "+error_string(code)
	persistence_failed.emit(state_error)
	return code

func reset_state(persist := true) -> Error:
	if ecology!=null: ecology.clear()
	states.clear()
	support_rechecks.clear()
	base_rechecks.clear()
	seen.clear()
	impact_seen.clear()
	state_error = ""
	_corrupt_state = false
	dirty = true
	return save_state() if persist and not save_path.is_empty() else OK

func snapshot() -> Dictionary:
	return {"registered":entities.size(),"modified":states.size(),"max_persistent_entities":MAX_PERSISTENT_ENTITIES,"moving_trees":motions.size(),"dynamic_fragments":debris.size(),"pending_support":support_rechecks.size(),"pending_base_support":base_rechecks.size(),"max_dynamic_fragments":MAX_DYNAMIC,"save_bound":not save_path.is_empty(),"dirty":dirty,"state_error":state_error,"generation":GENERATION}

static func _encode_transform(t: Transform3D) -> Array:
	return [t.basis.x.x,t.basis.x.y,t.basis.x.z,t.basis.y.x,t.basis.y.y,t.basis.y.z,t.basis.z.x,t.basis.z.y,t.basis.z.z,t.origin.x,t.origin.y,t.origin.z]

static func _decode_transform(a: Array) -> Transform3D:
	if a.size()!=12: return Transform3D.IDENTITY
	return Transform3D(Basis(Vector3(a[0],a[1],a[2]),Vector3(a[3],a[4],a[5]),Vector3(a[6],a[7],a[8])),Vector3(a[9],a[10],a[11]))
