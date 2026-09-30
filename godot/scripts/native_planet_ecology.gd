extends Node3D
class_name NativePlanetEcology

## Image-derived R4 species/age meshes and entity-level environmental damage.
## Stable cube-sphere sites: physical support nearby, real rendered triangles afar.
const LEVEL := 12
const COUNT := 4096
const RANGE := 900.0
const MAX_INSTANCES := 900
const MAX_TRIANGLES := 1300000
const KINDS := ["tree", "reed", "pebble", "outcrop", "crystal", "floatrock", "grass"]
const BAND_TRIANGLES := [200000,300000,800000]
@export var instance_budget := 320
@export var triangle_budget := 260000
@export var detail_budgets := PackedInt32Array([100000,70000,90000])
var band_triangles := [0,0,0]
var rejected := {"not_ready":0,"footprint":0,"legacy":0,"water":0,"slope":0,"clearance":0}
var planet: Node3D
var meshes: Dictionary = {}
var cells: Dictionary = {}
var pending: Array[Dictionary] = []
var _retry_tiles: Dictionary = {}
var last_position := Vector3(INF, INF, INF)
var instances := 0
var triangles := 0
var _tick := 0
var use_saved_meshes := true
var asset_library = preload("res://scripts/native_environment_damage_assets.gd").new()
var damage_service: Node3D
var _species_counts: Dictionary = {}

func setup(source: Node3D) -> void:
	planet = source
	asset_library.load_library()
	damage_service = preload("res://scripts/native_environment_damage.gd").new()
	damage_service.name = "NativeEnvironmentDamage"
	add_child(damage_service)
	damage_service.setup(self,asset_library)
	for kind in KINDS:
		if kind in ["tree","outcrop"]: continue
		for lod in range(3):
			var key := "%s-%d" % [kind, lod]
			var resource_path := "res://assets/planet-ecology-r3/"+key
			if use_saved_meshes and FileAccess.file_exists(resource_path+".res"):
				var saved := load(resource_path+".res") as ArrayMesh
				var saved_shape: Shape3D
				if kind not in ["reed","grass"]: saved_shape = load(resource_path+"-collision.tres") as Shape3D
				meshes[key] = {"mesh":saved,"triangles":saved.surface_get_array_len(0)/3,"shape":saved_shape}
				continue
			var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://assets/planet-ecology-r3/" + key + ".json"))
			var vertices := PackedVector3Array()
			var normals := PackedVector3Array()
			var colors := PackedColorArray()
			for i in range(0, data.positions.size(), 3):
				vertices.append(Vector3(data.positions[i], data.positions[i+1], data.positions[i+2]))
				normals.append(Vector3(data.normals[i], data.normals[i+1], data.normals[i+2]))
				colors.append(Color(data.colors[i], data.colors[i+1], data.colors[i+2]))
			var arrays := []
			arrays.resize(Mesh.ARRAY_MAX)
			arrays[Mesh.ARRAY_VERTEX] = vertices
			arrays[Mesh.ARRAY_NORMAL] = normals
			arrays[Mesh.ARRAY_COLOR] = colors
			var mesh := ArrayMesh.new()
			mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
			var detail_material := ShaderMaterial.new()
			detail_material.shader = preload("res://assets/planet-ecology-r3/ecology_surface_r3.gdshader")
			detail_material.set_shader_parameter("asset_kind",KINDS.find(kind))
			mesh.surface_set_material(0, detail_material)
			var shape: Shape3D
			if kind == "tree":
				var capsule := CapsuleShape3D.new()
				capsule.radius = 1.15
				capsule.height = 12.0
				shape = capsule
			elif kind not in ["reed","grass"]: shape = mesh.create_convex_shape(true,true)
			meshes[key] = {"mesh": mesh, "triangles": vertices.size() / 3, "shape":shape}

func clear() -> void:
	if damage_service!=null: damage_service.clear_stream()
	for cell in cells.values():
		remove_child(cell.node)
		cell.node.queue_free()
	cells.clear()
	pending.clear()
	_retry_tiles.clear()
	instances = 0
	triangles = 0
	band_triangles = [0,0,0]
	last_position = Vector3(INF, INF, INF)

func invalidate_surface_region(origin: Vector3, radius: float) -> void:
	# Called only AFTER the terrain owner commits both mesh and collision.
	# Damage states live outside streamed cells and survive the requery.
	if damage_service!=null: damage_service.invalidate_support_region(origin,radius)
	for key in cells.keys():
		var cell: Dictionary = cells[key]
		var affected := false
		for point: Vector3 in cell.supports:
			if point.distance_to(origin)<=maxf(0.0,radius)+24.0: affected = true; break
		if not affected: continue
		damage_service.unregister_cell(key)
		instances -= int(cell.count)
		triangles -= int(cell.triangles)
		band_triangles[int(cell.lod)] -= int(cell.triangles)
		remove_child(cell.node)
		cell.node.queue_free()
		cells.erase(key)
	last_position = Vector3(INF,INF,INF)

func update_stream(scene_position: Vector3) -> void:
	if planet == null or meshes.is_empty():
		return
	_tick += 1
	var canonical: Vector3 = NativePlanet.scene_to_canonical(scene_position)
	var sample: Dictionary = planet.field.sample(canonical)
	var altitude: float = canonical.length() - NativePlanet.RADIUS - float(sample.height)
	if altitude > 900.0 or float(sample.legacy_weight) > 0.0:
		if not cells.is_empty(): clear()
		return
	# Immutable tile-owner checks are cheap enough each frame; no stale batch is
	# kept after its underlying collision/visual triangles stream out.
	if planet is NativePlanet:
		for key in cells.keys():
			if _still_supported(cells[key]): continue
			instances -= int(cells[key].count)
			triangles -= int(cells[key].triangles)
			band_triangles[int(cells[key].lod)] -= int(cells[key].triangles)
			damage_service.unregister_cell(key)
			remove_child(cells[key].node)
			cells[key].node.queue_free()
			cells.erase(key)
	if not last_position.is_finite() or scene_position.distance_to(last_position) > 40.0 or (_tick % 180 == 0 and pending.is_empty()):
		last_position = scene_position
		_select(canonical.normalized())
	# Bounded per-frame CPU work; never instantiate the entire planet.
	for key in _retry_tiles.keys():
		if int(_retry_tiles[key].after)>_tick: continue
		var retry: Dictionary = _retry_tiles[key].tile
		_retry_tiles.erase(key)
		_build(retry,scene_position)
		return
	for i in range(mini(1, pending.size())):
		var item: Dictionary = pending.pop_front()
		_build(item, scene_position)

func _select(direction: Vector3) -> void:
	var wanted: Dictionary = {}
	var uv: Dictionary = NativePlanet._face_uv(direction)
	var step := 2.0 / float(COUNT)
	var cu := float(uv.u)*2.0-1.0
	var cv := float(uv.v)*2.0-1.0
	var span := ceili(RANGE/(step*NativePlanet.RADIUS)*(1.0+cu*cu+cv*cv))+2
	for y in range(-span, span+1):
		for x in range(-span, span+1):
			var d := NativePlanet._cube_direction(uv.face, float(uv.u)*2.0-1.0+x*step, float(uv.v)*2.0-1.0+y*step)
			var tile := NativePlanet._tile_at(d, LEVEL)
			var center := NativePlanet._cube_direction(tile.face, (float(tile.x)+0.5)*step-1.0, (float(tile.y)+0.5)*step-1.0)
			var distance := direction.distance_to(center)*NativePlanet.RADIUS
			if distance > RANGE: continue
			var key := NativePlanet._tile_key(tile)
			tile["distance"] = distance
			tile["lod"] = _lod(distance)
			tile["support_lod"] = 1 if distance<220.0 else 2
			wanted[key] = tile
	for key in cells.keys():
		if not wanted.has(key) or int(wanted[key].lod) != int(cells[key].lod) or int(wanted[key].support_lod) != int(cells[key].get("support_lod",cells[key].lod)) or not _still_supported(cells[key]):
			instances -= int(cells[key].count)
			triangles -= int(cells[key].triangles)
			band_triangles[int(cells[key].lod)] -= int(cells[key].triangles)
			damage_service.unregister_cell(key)
			remove_child(cells[key].node)
			cells[key].node.queue_free()
			cells.erase(key)
	for key in _retry_tiles.keys():
		if not wanted.has(key): _retry_tiles.erase(key)
	pending.clear()
	for key in wanted:
		if not cells.has(key): pending.append(wanted[key])
	pending.sort_custom(func(a: Dictionary,b: Dictionary) -> bool: return a.distance < b.distance)

func _build(tile: Dictionary, player_position: Vector3) -> void:
	var key := NativePlanet._tile_key(tile)
	if cells.has(key): return
	if instances>=mini(instance_budget,MAX_INSTANCES) or triangles>=mini(triangle_budget,MAX_TRIANGLES): return
	if int(band_triangles[int(tile.lod)])+128>int(detail_budgets[int(tile.lod)]): return
	var root := Node3D.new()
	root.name = key.replace("/", "_")
	var count := 0
	var tri_count := 0
	var unready := false
	var anchor := Vector3.ZERO
	var supports: Array[Vector3] = []
	var lod: int = tile.lod
	var support_lod := lod if not tile.has("distance") else (1 if float(tile.distance)<220.0 else 2)
	var kinds: Dictionary = {}
	var groups: Dictionary = {}
	var records: Array[Dictionary] = []
	var tree_sites: Array[Dictionary] = []
	for kind: String in KINDS:
		if lod==2 and kind in ["reed","pebble"] and float(tile.get("distance",INF))>220.0: continue
		if kind=="grass" and float(tile.get("distance",0))>130.0: continue
		var rng := RandomNumberGenerator.new()
		rng.seed = hash(key+kind)
		# Site count and all RNG draws stay invariant across LOD changes.
		var candidate_count := 32 if kind=="tree" else (40 if kind=="grass" else 3)
		for candidate in range(candidate_count):
			var u := (float(tile.x)+rng.randf_range(.04,.96))*2.0/COUNT-1.0
			var v := (float(tile.y)+rng.randf_range(.04,.96))*2.0/COUNT-1.0
			var direction := NativePlanet._cube_direction(tile.face,u,v)
			var sample: Dictionary = planet.field.sample(direction)
			var choice := rng.randf()
			var scale_value := rng.randf_range(.91,1.09) if kind in ["tree","outcrop"] else rng.randf_range(.8,1.45)
			var yaw := rng.randf()*TAU
			if float(sample.legacy_weight)>0.0: rejected.legacy += 1; continue
			if float(sample.water_depth)>(.55 if kind=="reed" else .04): rejected.water += 1; continue
			if choice>density(kind,sample,direction): continue
			var approximate := NativePlanet.canonical_to_scene(direction*(NativePlanet.RADIUS+float(sample.height)))
			var support: Dictionary = _surface(approximate,support_lod)
			if not support.get("ready",false): unready = true; rejected.not_ready += 1; continue
			var up := NativePlanet.radial_up(approximate)
			var slope := (support.normal as Vector3).dot(up)
			var asset_key := "%s-%d"%[kind,lod]
			var asset: Dictionary
			if kind=="tree":
				# Species uses immutable field habitat, not a different terrain LOD's normal.
				var habitat_slope := 1.0-float(sample.get("mountains",0))*.12
				asset_key = tree_asset_key(sample,direction,habitat_slope,hash(key+str(candidate)),lod)
				asset = asset_library.assets[asset_key]
			elif kind=="outcrop":
				asset_key = "outcrop-0-%d"%lod
				asset = asset_library.assets[asset_key]
			else: asset = meshes[asset_key]
			if instances+count>=mini(instance_budget,MAX_INSTANCES) or triangles+tri_count+int(asset.triangles)>mini(triangle_budget,MAX_TRIANGLES) or int(band_triangles[lod])+tri_count+int(asset.triangles)>int(detail_budgets[lod]): continue
			var allowed_slope := (.90 if asset.get("species","")=="pine" else .95) if kind=="tree" else (.95 if kind=="reed" else .87)
			if slope<allowed_slope: rejected.slope += 1; continue
			var support_axis: Vector3 = up if kind=="tree" else support.normal
			var basis := Basis(Quaternion(Vector3.UP,support_axis))*Basis(Vector3.UP,yaw)
			var point: Vector3 = support.point
			if kind not in ["reed","grass"] and point.distance_to(player_position)<2.0: rejected.clearance += 1; continue
			var radius := float(asset.footprint)*scale_value if kind in ["tree","outcrop"] else (2.6 if kind=="grass" else (.9 if kind in ["reed","pebble"] else (7.0 if kind=="crystal" else 3.9)))*scale_value
			# Crown spacing between same-tile candidates; roots never intersect.
			var crowded := false
			if kind=="tree":
				for site in tree_sites:
					if point.distance_to(site.point)<maxf(radius+float(site.radius),float(asset.crown_radius)*.58): crowded = true; break
			if crowded: rejected.clearance += 1; continue
			var supported := true
			var footprint: Array[Vector3] = [point]
			for axis: Vector3 in [basis.x,-basis.x,basis.z,-basis.z]:
				var probe: Vector3 = point+axis*radius
				var edge_sample: Dictionary = planet.field.sample(NativePlanet.scene_to_canonical(probe))
				if float(edge_sample.legacy_weight)>0.0 or float(edge_sample.water_depth)>(.55 if kind=="reed" else .04): supported = false; break
				var edge: Dictionary = _surface(probe,support_lod)
				var tolerance := (.9 if asset.get("species","")=="pine" else .65) if kind=="tree" else (.055 if kind=="grass" else (.08 if kind=="reed" else .20))
				if not edge.get("ready",false) or absf(((edge.point as Vector3)-point).dot(support_axis))>tolerance*scale_value: supported = false; break
				footprint.append(edge.point)
			if not supported: rejected.footprint += 1; continue
			anchor = point
			supports.append_array(footprint)
			if kind=="tree": tree_sites.append({"point":point,"radius":radius})
			if kind=="floatrock": point += up*(16.0+9.0*choice)
			var transform := Transform3D(basis.scaled(Vector3.ONE*scale_value),point)
			if not groups.has(asset_key): groups[asset_key] = {"asset":asset,"transforms":[],"kind":kind}
			var index: int = groups[asset_key].transforms.size()
			groups[asset_key].transforms.append(transform)
			kinds[kind] = int(kinds.get(kind,0))+1
			count += 1
			tri_count += int(asset.triangles)
			var body: StaticBody3D
			if support_lod<2 and kind not in ["reed","grass"]:
				body = StaticBody3D.new()
				body.collision_layer = 1
				body.collision_mask = 0
				body.transform = transform
				root.add_child(body)
				if kind=="tree":
					for segment: Dictionary in asset.segments:
						# Continuous woody trunks remain solid throughout the near
						# support range; small boughs use hit queries outside LOD0.
						if lod==0 or segment.part in ["trunk","stump"] or str(segment.part).begins_with("stem_"): asset_library.add_segment(body,segment)
				else:
					var collider := CollisionShape3D.new()
					collider.shape = (asset.mesh as ArrayMesh).create_convex_shape(true,true) if kind=="outcrop" else asset.shape
					body.add_child(collider)
			if kind in ["tree","outcrop"]:
				var id := "ecology-r4.2:"+key+":"+kind+":"+str(candidate)
				if body!=null: body.set_meta("environment_entity",id)
				records.append({"id":id,"asset_key":asset_key,"index":index,"cell":key,"kind":kind,"asset":asset,"transform":transform,"body":body,"physical":support_lod<2,"parent":root})
	if count==0:
		root.free()
		if unready: _retry_tiles[key] = {"tile":tile,"after":_tick+45}
		return
	for asset_key: String in groups:
		var group: Dictionary = groups[asset_key]
		var batch := MultiMesh.new()
		batch.transform_format = MultiMesh.TRANSFORM_3D
		batch.mesh = group.asset.mesh
		batch.instance_count = group.transforms.size()
		for i in range(batch.instance_count): batch.set_instance_transform(i,group.transforms[i])
		group["batch"] = batch
		var visual := MultiMeshInstance3D.new()
		visual.multimesh = batch
		visual.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if lod==0 else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		root.add_child(visual)
	add_child(root)
	for record in records:
		record["batch"] = groups[record.asset_key].batch
		damage_service.register_entity(record.id,record)
	instances += count
	triangles += tri_count
	band_triangles[lod] += tri_count
	cells[key] = {"node":root,"count":count,"triangles":tri_count,"kinds":kinds,"lod":lod,"support_lod":support_lod,"anchor":anchor,"supports":supports,"owners":_terrain_owners(supports,support_lod)}

func tree_asset_key(sample: Dictionary, direction: Vector3, slope: float, seed_value: int, lod: int) -> String:
	var moisture := maxf(float(sample.get("wetland",0)),float(sample.get("river",0)))
	var p := direction*NativePlanet.RADIUS
	var cluster := .5+.5*sin(p.x*.021+sin(p.z*.013)*2.0+p.y*.008)
	var species := "oak"
	if moisture>.20 and slope>.97 and cluster>.48: species = "alder"
	elif slope<.965 or float(sample.get("cold",0))>.16 or cluster<.38: species = "pine"
	var age_value := absi(seed_value)%100
	var age := 0 if age_value<28 else (1 if age_value<83 else 2)
	return "%s-%d-%d"%[species,age,lod]


func _terrain_owners(points: Array[Vector3], lod: int) -> Dictionary:
	var owners := {}
	if not planet is NativePlanet: return owners
	# Terrain triangle arrays are immutable during a tile node's lifetime.
	# Tracking every footprint's owners avoids thousands of redundant ray casts
	# when travelling, while invalidating immediately on unload/replacement.
	for point: Vector3 in points:
		var direction := NativePlanet.scene_to_canonical(point).normalized()
		var near_key := NativePlanet._tile_key(NativePlanet._tile_at(direction,NativePlanet.NEAR_LEVEL))
		var near: Dictionary = planet._near_tiles.get(near_key,{})
		# Physics support may have used NativePlanet's sub-metre ray-offset
		# fallback across a tile edge; never cache a missing physics owner as proof.
		if near.is_empty() and lod<2: return {}
		owners[near_key] = 0 if near.is_empty() else (near.node as Node).get_instance_id()
		if near.is_empty() and lod>=2:
			var mid_key := NativePlanet._tile_key(NativePlanet._tile_at(direction,NativePlanet.MID_LEVEL))
			var mid: Dictionary = planet._mid_tiles.get(mid_key,{})
			owners[mid_key] = 0 if mid.is_empty() else (mid.node as Node).get_instance_id()
	return owners

func _still_supported(cell: Dictionary) -> bool:
	if planet is NativePlanet and not cell.get("owners",{}).is_empty():
		for key in cell.owners:
			var record: Dictionary = planet._near_tiles.get(key,planet._mid_tiles.get(key,{}))
			var current := 0 if record.is_empty() else (record.node as Node).get_instance_id()
			if current != int(cell.owners[key]): return false
		return true
	return validate_support_geometry(cell)

func validate_support_geometry(cell: Dictionary) -> bool:
	for point: Vector3 in cell.supports:
		var support: Dictionary = _surface(point,int(cell.get("support_lod",cell.lod)))
		if not support.get("ready",false) or (support.point as Vector3).distance_to(point)>0.2: return false
	return true

func _surface(point: Vector3, lod: int) -> Dictionary:
	if lod>=2 and planet.has_method("rendered_visual_surface_at"):
		return planet.rendered_visual_surface_at(point)
	return planet.surface_at(point)

func snapshot() -> Dictionary:
	var kinds := {}
	for kind in KINDS: kinds[kind] = 0
	for cell in cells.values():
		for kind in cell.kinds: kinds[kind] += int(cell.kinds[kind])
	return {"instances":instances,"triangles":triangles,"cells":cells.size(),"pending":pending.size(),"kinds":kinds,"max_instances":mini(instance_budget,MAX_INSTANCES),"max_triangles":mini(triangle_budget,MAX_TRIANGLES),"detail_budgets":Array(detail_budgets),"range":RANGE,"band_triangles":band_triangles.duplicate(),"rejected":rejected.duplicate(),"asset_revision":"r4","environment_damage":damage_service.snapshot() if damage_service!=null else {}}

func _lod(distance: float) -> int:
	return 0 if distance<32.0 else (1 if distance<125.0 else 2)

func density(kind: String, sample: Dictionary, direction: Vector3) -> float:
	if float(sample.get("legacy_weight",0))>0.0: return 0.0
	var forest := float(sample.get("forest",0))
	var wetland := float(sample.get("wetland",0))
	var river := float(sample.get("river",0))
	var coast := float(sample.get("coast",0))
	var cold := float(sample.get("cold",0))
	var volcanic := float(sample.get("volcanic",0))
	var p := direction*NativePlanet.RADIUS
	var patch := 0.55+0.25*sin(p.y*0.011+sin(p.z*0.007)*2.0)+0.2*sin(p.z*0.018+p.x*0.005)
	match kind:
		"tree": return clampf(forest*patch*(1.0-wetland*0.7)*(1.0-maxf(cold,volcanic)),0,0.95)
		"reed": return clampf((wetland*0.85+river*0.25)*patch*(1.0-cold),0,0.9)
		"pebble": return maxf(coast,river)*0.48
		"outcrop": return maxf(float(sample.get("mountains",0))*0.38,coast*0.25)
		"crystal": return float(sample.get("crystal",0))*0.24
		"floatrock": return float(sample.get("storm",0))*0.035
		"grass":
			var plains := float(sample.get("plains",1.0-maxf(forest,maxf(float(sample.get("mountains",0)),maxf(wetland,float(sample.get("ocean",0)))))))
			return clampf((plains*0.8+forest*0.35)*patch*(1.0-maxf(cold,volcanic)),0,0.85)
	return 0.0
