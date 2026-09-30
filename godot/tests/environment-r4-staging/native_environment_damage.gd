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
	if states.has(id): _materialize(id)

func unregister_cell(cell_key: String) -> void:
	for id in entities.keys():
		if entities[id].cell != cell_key: continue
		for motion in motions.duplicate():
			if motion.id==id: _finish_motion(motion)
		for item in debris.duplicate():
			if item.id==id: _settle_debris(item)
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
			if state.get("poses",{}).has(part): pose = _decode_transform(state.poses[part])
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
			var normal: Vector3 = (nearest[0]-nearest[1]).normalized()
			if normal.is_zero_approx(): normal = -direction if reach>0 else transform.basis.x.normalized()
			var point: Vector3 = nearest[1]+normal*thickness
			var order := origin.distance_to(point)
			if best.is_empty() or order<float(best.order):
				best = {"id":id,"part":part,"point":point,"normal":normal,"order":order,"surface_distance":maxf(0.0,distance-thickness)}
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

func _physics_process(delta: float) -> void:
	for motion in motions.duplicate():
		if not entities.has(motion.id): motions.erase(motion); continue
		motion.elapsed += delta
		var t := minf(1.0,float(motion.elapsed)/float(motion.duration))
		var angle := float(motion.angle)*t*t
		var rotation := Basis(motion.axis,angle)
		var pose := Transform3D(rotation,motion.pivot-rotation*motion.pivot)
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
	var local_pose: Transform3D = body.transform*Transform3D(Basis.IDENTITY,-item.center)
	for member: String in item.get("members",[item.part]):
		states[item.id].poses[member] = _encode_transform(local_pose)
	debris.erase(item)
	dirty = true

func _fragment_clearance(record: Dictionary, item: Dictionary) -> float:
	var lowest := INF
	for member: String in item.get("members",[item.part]):
		var mesh: MeshInstance3D = record.part_nodes[member].mesh
		var vertices: PackedVector3Array = mesh.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]
		for i in range(0,vertices.size(),maxi(1,vertices.size()/96)):
			lowest = minf(lowest,_clearance(record,mesh.global_transform*vertices[i]))
	return lowest

func _clearance(record: Dictionary, world_point: Vector3) -> float:
	var up: Vector3 = record.transform.basis.y.normalized()
	if ecology!=null and ecology.planet!=null:
		var support: Dictionary = ecology.planet.surface_at(world_point)
		if support.get("ready",false): return (world_point-(support.point as Vector3)).dot(up)
	# Last supported tangent plane remains valid for unload finalization.
	return (world_point-(record.transform as Transform3D).origin).dot(up)

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
		for member: String in item.get("members",[item.part]):
			saved_states[item.id].poses[member] = _encode_transform(pose)
	var envelope := {"version":1,"generation":GENERATION,"world_seed":world_seed,"slot_identity":slot_identity,"entities":saved_states}
	return envelope

func _save_error(action: String, code: Error) -> Error:
	state_error = action+": "+error_string(code)
	persistence_failed.emit(state_error)
	return code

func reset_state(persist := true) -> Error:
	if ecology!=null: ecology.clear()
	states.clear()
	seen.clear()
	impact_seen.clear()
	state_error = ""
	_corrupt_state = false
	dirty = true
	return save_state() if persist and not save_path.is_empty() else OK

func snapshot() -> Dictionary:
	return {"registered":entities.size(),"modified":states.size(),"max_persistent_entities":MAX_PERSISTENT_ENTITIES,"moving_trees":motions.size(),"dynamic_fragments":debris.size(),"max_dynamic_fragments":MAX_DYNAMIC,"save_bound":not save_path.is_empty(),"dirty":dirty,"state_error":state_error,"generation":GENERATION}

static func _encode_transform(t: Transform3D) -> Array:
	return [t.basis.x.x,t.basis.x.y,t.basis.x.z,t.basis.y.x,t.basis.y.y,t.basis.y.z,t.basis.z.x,t.basis.z.y,t.basis.z.z,t.origin.x,t.origin.y,t.origin.z]

static func _decode_transform(a: Array) -> Transform3D:
	if a.size()!=12: return Transform3D.IDENTITY
	return Transform3D(Basis(Vector3(a[0],a[1],a[2]),Vector3(a[3],a[4],a[5]),Vector3(a[6],a[7],a[8])),Vector3(a[9],a[10],a[11]))
