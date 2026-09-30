extends Node3D
class_name NativePlanetRegionsR3

## Streamed geological details for approved reference 12. Frozen field only read.
const Source = preload("res://assets/planet-regions-r3/geology_mesh_source.gd")
const CELL: float = 110.0
const RANGE: float = 620.0
const MAX_PATCHES: int = 42
const MAX_TRIANGLES: int = 44000
const BUILD_PER_UPDATE: int = 1
var planet: NativePlanet
var _cells: Dictionary = {}
var _meshes: Dictionary = {}
var _pending: Array[Dictionary] = []
var _signature: String = ""
var _triangles: int = 0
var _cursor: int = 0
var _max_build_usec: int = 0
var _rejected: Dictionary = {"unloaded":0,"slope":0,"region":0,"budget":0}
var _materials: Array[ShaderMaterial] = []
var _landmarks: Array[Dictionary] = []

func setup(source: NativePlanet) -> void:
	planet = source
	_landmarks = planet.field.landmark_regions()
	for kind in range(3):
		_materials.append(Source.material(kind))
	for variant in range(6):
		for lod in range(2):
			for kind: String in ["ice","vent"]:
				var key: String = "%s-%d-%d" % [kind,variant,lod]
				var path: String = "res://assets/planet-regions-r3/"+key+".tres"
				_meshes[key] = load(path) if FileAccess.file_exists(path) else (Source.ice_cluster(variant,lod) if kind=="ice" else Source.vent(variant,lod))

func _direction(s: float,n: float) -> Vector3:
	return planet.field.route_direction(s,n-NativePlanetField._route_z(s))

func _point(s: float,n: float) -> Vector3:
	return NativePlanet.canonical_to_scene(_direction(s,n)*NativePlanet.RADIUS)

func _noise(a: int,b: int) -> float:
	return fposmod(sin(float(a)*127.1+float(b)*311.7)*43758.5453,1.0)

func _remove(key: String) -> void:
	var cell: Dictionary = _cells[key]
	_triangles -= int(cell.triangles)
	(cell.node as Node3D).queue_free()
	_cells.erase(key)

func update_stream(scene_position: Vector3) -> void:
	if planet==null or planet.field==null:
		return
	var direction: Vector3 = NativePlanet.scene_to_canonical(scene_position).normalized()
	var sample: Dictionary = planet.field.sample(direction)
	var kind: String = "cold" if float(sample.get("cold",0.0))>0.2 else ("volcanic" if float(sample.get("volcanic",0.0))>0.2 else "")
	var altitude: float = NativePlanet.scene_to_canonical(scene_position).length()-NativePlanet.RADIUS-float(sample.height)
	for key: String in _cells.keys():
		if kind=="" or altitude>850.0 or (Vector3(_cells[key].anchor)-scene_position).length()>RANGE+120.0:
			_remove(key)
	if kind=="" or altitude>850.0:
		_pending.clear()
		_signature = ""
		return
	var s: float = atan2(-direction.z,direction.x)*NativePlanet.RADIUS
	var n: float = asin(clampf(-direction.y,-1.0,1.0))*NativePlanet.RADIUS
	var gx: int = floori(s/CELL)
	var gz: int = floori(n/CELL)
	var signature: String = "%s:%d:%d" % [kind,gx,gz]
	if signature!=_signature or (_pending.is_empty() and _cells.size()<MAX_PATCHES):
		_signature = signature
		_pending.clear()
		for z in range(gz-5,gz+6):
			for x in range(gx-5,gx+6):
				var key: String = "%s:%d:%d" % [kind,x,z]
				if _cells.has(key):
					continue
				var at := Vector2((x+0.2+_noise(x,z)*0.6)*CELL,(z+0.2+_noise(z,x)*0.6)*CELL)
				if at.distance_to(Vector2(s,n))<RANGE:
					_pending.append({"key":key,"kind":kind,"s":at.x,"n":at.y,"seed":absi(x*37+z*19)%6,"distance":at.distance_to(Vector2(s,n))})
		_pending.sort_custom(func(a: Dictionary,b: Dictionary)->bool: return float(a.distance)<float(b.distance))
	# Recheck one resident against currently rendered ownership; rebuild after LOD swap.
	if not _cells.is_empty():
		var keys: Array = _cells.keys()
		_cursor = (_cursor+1)%keys.size()
		var key: String = keys[_cursor]
		var cell: Dictionary = _cells[key]
		var surface: Dictionary = planet.rendered_visual_surface_at(cell.anchor)
		var desired_lod: int = 0 if Vector3(cell.anchor).distance_to(scene_position)<220.0 else 1
		var collision_ready: bool = bool(planet.surface_at(cell.anchor).get("ready",false)) if desired_lod==0 else false
		if not bool(surface.get("ready",false)) or Vector3(surface.get("point",cell.anchor)).distance_to(cell.ground)>0.12 or desired_lod!=int(cell.lod) or collision_ready!=bool(cell.collision_ready):
			_remove(key)
	for i in range(BUILD_PER_UPDATE):
		if _pending.is_empty() or _cells.size()>=MAX_PATCHES:
			break
		var candidate: Dictionary = _pending.pop_front()
		var started: int = Time.get_ticks_usec()
		_build(candidate,scene_position)
		_max_build_usec = maxi(_max_build_usec,Time.get_ticks_usec()-started)

func _build(candidate: Dictionary,viewer: Vector3) -> void:
	var query: Vector3 = _point(float(candidate.s),float(candidate.n))
	var value: Dictionary = planet.field.sample(_direction(float(candidate.s),float(candidate.n)))
	if float(value.get(candidate.kind,0.0))<0.2 or float(value.legacy_weight)>0.0 or float(value.water_depth)>0.0:
		_rejected.region += 1
		return
	var surface: Dictionary = planet.rendered_visual_surface_at(query)
	if not bool(surface.get("ready",false)):
		_rejected.unloaded += 1
		return
	var ground: Vector3 = surface.point
	if ground.distance_to(viewer)>RANGE:
		return
	var up: Vector3 = NativePlanet.radial_up(ground)
	var normal: Vector3 = surface.normal
	var slope: float = 1.0-clampf(normal.dot(up),0.0,1.0)
	if (candidate.kind=="cold" and (slope<0.08 or slope>0.92)) or (candidate.kind=="volcanic" and slope>0.20):
		_rejected.slope += 1
		return
	var east: Vector3 = Vector3(up.y,-up.x,0.0).normalized()
	var north: Vector3 = east.cross(up).normalized()
	var downhill: Vector3 = (normal-up*normal.dot(up)).normalized()
	if downhill.length()<0.5:
		downhill = north
	var across: Vector3 = downhill.cross(up).normalized()
	if candidate.kind=="volcanic":
		var left: Dictionary = planet.rendered_visual_surface_at(ground-across*18.0)
		var right: Dictionary = planet.rendered_visual_surface_at(ground+across*18.0)
		if not bool(left.get("ready",false)) or not bool(right.get("ready",false)):
			_rejected.unloaded += 1
			return
		var center_radius: float = NativePlanet.scene_to_canonical(ground).length()
		var side_radius: float = (NativePlanet.scene_to_canonical(left.point).length()+NativePlanet.scene_to_canonical(right.point).length())*0.5
		if center_radius>side_radius-0.012:
			_rejected.slope += 1
			return
	var lod: int = 0 if ground.distance_to(viewer)<220.0 else 1
	var collision_ready: bool = bool(planet.surface_at(ground).get("ready",false)) if lod==0 else false
	var conformed: Dictionary = _ribbon(ground,up,downhill,across,candidate,lod)
	if conformed.is_empty():
		_rejected.unloaded += 1
		return
	var count: int = int(conformed.triangles)
	var cluster: ArrayMesh = _meshes[("ice" if candidate.kind=="cold" else "vent")+"-%d-%d" % [int(candidate.seed),lod]]
	count += cluster.surface_get_array_len(0)/3
	if _triangles+count>MAX_TRIANGLES:
		_rejected.budget += 1
		return
	var holder := Node3D.new()
	holder.name = String(candidate.kind)+"_"+String(candidate.key).replace(":","_")
	add_child(holder)
	holder.global_position = ground
	var film := MeshInstance3D.new()
	film.mesh = conformed.mesh
	holder.add_child(film)
	var detail := MeshInstance3D.new()
	detail.mesh = cluster
	holder.add_child(detail)
	detail.global_basis = Basis(across,up,across.cross(up).normalized())
	if candidate.kind=="cold":
		# The tip cluster starts at the sampled downslope edge of an actual ice skin.
		var wall_up: Vector3 = (up-normal*up.dot(normal)).normalized()
		var wall_across: Vector3 = wall_up.cross(normal).normalized()
		detail.global_basis = Basis(wall_across,wall_up,normal)
		detail.global_position = conformed.lip + normal*0.22
	else:
		detail.global_position = ground-up*0.16
		if collision_ready:
			var body := StaticBody3D.new()
			body.collision_layer = 1
			body.collision_mask = 0
			var shape := CollisionShape3D.new()
			shape.shape = cluster.create_trimesh_shape()
			detail.add_child(body)
			body.add_child(shape)
	_cells[candidate.key] = {"node":holder,"anchor":ground,"ground":ground,"kind":candidate.kind,"triangles":count,"lod":lod,"collision_ready":collision_ready,"conformed_vertices":conformed.vertices,"max_lift":conformed.max_lift}
	_triangles += count

func _ribbon(origin: Vector3,up: Vector3,along: Vector3,across: Vector3,candidate: Dictionary,lod: int) -> Dictionary:
	var cold: bool = candidate.kind=="cold"
	var rows: int = 14 if lod==0 else 8
	var columns: int = 8 if lod==0 else 4
	var half_length: float = (23.0 if cold else 34.0)+float(candidate.seed)*2.4
	var half_width: float = (9.0 if cold else 2.8)+float(candidate.seed)*0.45
	var positions: Array[Vector3] = []
	var colors: Array[Color] = []
	var lip: Vector3 = origin
	var last_height: float = INF
	var max_lift: float = 0.0
	for row in range(rows+1):
		var t: float = float(row)/rows
		var width: float = half_width*(0.07+0.93*pow(sin(PI*t),0.55))*(0.78+0.15*sin(t*23.0+candidate.seed)+0.07*sin(t*57.0+candidate.seed*2.7))
		var bend: float = half_width*0.27*sin(t*7.0+candidate.seed)
		for column in range(columns+1):
			var q: float = float(column)/columns*2.0-1.0
			var edge_shape: float = 1.0+0.17*q*sin(t*41.0+candidate.seed)
			var at: Vector3 = origin+along*((t*2.0-1.0)*half_length)+across*(q*width*edge_shape+bend)
			var surface: Dictionary = planet.rendered_visual_surface_at(at)
			if not bool(surface.get("ready",false)):
				return {}
			var point: Vector3 = surface.point
			if column==columns/2:
				var height: float = NativePlanet.scene_to_canonical(point).length()
				# Cooled lava only follows a monotonic existing descent, never climbs a bank.
				if not cold and row>0 and height>last_height+0.3:
					return {}
				last_height = height
				if row==rows-2:
					lip = point
			var thickness: float = 0.065+(0.35 if cold else 0.15)*(1.0-q*q)*sin(PI*t)
			max_lift = maxf(max_lift,thickness)
			positions.append(point-origin+Vector3(surface.normal)*thickness)
			colors.append(Color(0.35+0.55*(1.0-absf(q)),0.45+0.25*sin(t*29.0+q*13.0),0.15+0.35*sin(PI*t)))
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for row in range(rows):
		for column in range(columns):
			var a: int = row*(columns+1)+column
			for index: int in [a,a+1,a+columns+1,a+1,a+columns+2,a+columns+1]:
				st.set_color(colors[index])
				st.add_vertex(positions[index])
	st.generate_normals()
	st.set_material(_materials[0 if cold else 1])
	return {"mesh":st.commit(),"triangles":rows*columns*2,"vertices":positions.size(),"lip":lip,"max_lift":max_lift}

func snapshot() -> Dictionary:
	var kinds: Dictionary = {"cold":0,"volcanic":0}
	var colliders: int = 0
	var anchors: Array[Dictionary] = []
	for cell: Dictionary in _cells.values():
		kinds[cell.kind] += 1
		if cell.kind=="volcanic" and bool(cell.collision_ready):
			colliders += 1
		anchors.append({"kind":cell.kind,"position":cell.anchor,"lod":cell.lod,"surface_vertices":cell.conformed_vertices,"max_lift":cell.max_lift})
	return {"patches":_cells.size(),"triangles":_triangles,"pending":_pending.size(),"kinds":kinds,"colliders":colliders,"anchors":anchors,"max_patches":MAX_PATCHES,"max_triangles":MAX_TRIANGLES,"range":RANGE,"max_build_usec":_max_build_usec,"rejected":_rejected.duplicate(),"reference":"12-special-regions.png"}
