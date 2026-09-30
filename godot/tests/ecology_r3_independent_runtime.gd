extends SceneTree

const Ecology = preload("res://scripts/native_planet_ecology.gd")
const Planet = preload("res://scripts/native_planet.gd")

class FakeField:
	var legacy := 0.0
	var wet := 0.0
	func sample(_direction: Vector3) -> Dictionary:
		return {"legacy_weight":legacy,"height":0.0,"water_depth":wet,"forest":1.0,"wetland":0.0,"river":0.0,"coast":0.0}

class FakePlanet extends Node3D:
	var field := FakeField.new()
	var support_ready := true
	var visual_ready := true
	var denied_point := Vector3(INF,INF,INF)
	var physics_calls := 0
	var visual_calls := 0
	func surface_at(point: Vector3) -> Dictionary:
		physics_calls += 1
		return make_surface(point,support_ready)
	func rendered_visual_surface_at(point: Vector3) -> Dictionary:
		visual_calls += 1
		return make_surface(point,visual_ready)
	func make_surface(point: Vector3, ready_value: bool) -> Dictionary:
		var canonical := Planet.scene_to_canonical(point)
		var up := canonical.normalized()
		return {"ready":ready_value and point.distance_to(denied_point)>0.01,"normal":Planet.radial_up(point),"point":Planet.canonical_to_scene(up*Planet.RADIUS),"water_depth":field.wet}

var failures: Array[String] = []
func check(label: String, valid: bool) -> void:
	if not valid: failures.append(label)

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var source := FakePlanet.new()
	root.add_child(source)
	var ecology := Ecology.new()
	root.add_child(ecology)
	ecology.setup(source)
	var direction := Vector3(1.0,0.1,0.05).normalized()
	var base: Dictionary = Planet._tile_at(direction,12)
	base["lod"] = 0
	base["distance"] = 20.0
	source.field.legacy = 0.00001
	ecology._build(base,Vector3.ZERO)
	check("any positive legacy weight forbids all sites",ecology.instances==0)
	source.field.legacy = 0.0
	source.support_ready = false
	ecology._build(base,Vector3.ZERO)
	check("unready support forbids all sites",ecology.instances==0)
	source.support_ready = true
	source.field.wet = 1.0
	ecology._build(base,Vector3.ZERO)
	check("deep water forbids trees",ecology.instances==0)
	source.field.wet = 0.0
	var bands: Array[Dictionary] = []
	for lod in range(3):
		ecology.clear()
		source.physics_calls = 0
		source.visual_calls = 0
		for y in range(12):
			for x in range(12):
				var tile := base.duplicate()
				tile.x += x
				tile.y += y
				tile.lod = lod
				tile.distance = [20.0,80.0,400.0][lod]
				ecology._build(tile,Vector3.ZERO)
		check("ready flat dry ground creates trees LOD%d"%lod,ecology.instances>0)
		check("global triangle budget LOD%d"%lod,ecology.triangles<=ecology.MAX_TRIANGLES)
		check("band triangle budget LOD%d"%lod,ecology.band_triangles[lod]<=ecology.BAND_TRIANGLES[lod])
		check("instance budget LOD%d"%lod,ecology.instances<=ecology.MAX_INSTANCES)
		var colliders := 0
		var transform_count := 0
		for cell in ecology.cells.values():
			for child in cell.node.get_children():
				if child is StaticBody3D: colliders += child.get_child_count()
				if child is MultiMeshInstance3D: transform_count += child.multimesh.instance_count
		var tree_count: int = ecology.snapshot().kinds.tree
		check("tree collision policy LOD%d"%lod,colliders==(tree_count if lod<2 else 0))
		check("rendered count matches accounting LOD%d"%lod,transform_count==ecology.instances)
		check("support interface policy LOD%d"%lod,(source.physics_calls>0 and source.visual_calls==0) if lod<2 else (source.visual_calls>0))
		var first_cell: Dictionary = ecology.cells.values()[0]
		check("all sites save center plus four footprint samples LOD%d"%lod,first_cell.supports.size()==first_cell.count*5)
		source.denied_point = first_cell.supports[0]
		check("non-anchor support invalidates cell LOD%d"%lod,not ecology._still_supported(first_cell))
		source.denied_point = Vector3(INF,INF,INF)
		bands.append({"snapshot":ecology.snapshot(),"colliders":colliders,"physics_calls":source.physics_calls,"visual_calls":source.visual_calls})
	ecology.clear()
	check("clear resets budgets",ecology.instances==0 and ecology.triangles==0 and ecology.cells.is_empty())
	# The physics surface query can hit an adjacent tile via its 25cm retry.
	# Missing directional owners must not become an eternally valid {key: 0} cache.
	var native_source := Planet.new()
	ecology.planet = native_source
	var points: Array[Vector3] = [Planet.canonical_to_scene(direction*Planet.RADIUS)]
	var missing_owner_cell := {"lod":0,"supports":points,"owners":ecology._terrain_owners(points,0)}
	check("missing near owner cannot certify support",not ecology._still_supported(missing_owner_cell))
	var owner_node := Node3D.new()
	var near_key := Planet._tile_key(Planet._tile_at(direction,Planet.NEAR_LEVEL))
	native_source._near_tiles[near_key] = {"node":owner_node}
	var owned_cell := {"lod":0,"supports":points,"owners":ecology._terrain_owners(points,0)}
	check("unchanged immutable owner accepted",ecology._still_supported(owned_cell))
	native_source._near_tiles.erase(near_key)
	check("removed owner rejected",not ecology._still_supported(owned_cell))
	var replacement := Node3D.new()
	native_source._near_tiles[near_key] = {"node":replacement}
	check("replaced owner rejected",not ecology._still_supported(owned_cell))
	owner_node.free()
	replacement.free()
	native_source.free()
	ecology.planet = source
	# Visual LOD2 is still solid and physics-supported inside 220m.
	ecology.clear()
	var close_low := base.duplicate()
	close_low.lod = 2
	close_low.distance = 180.0
	source.support_ready = false
	source.visual_ready = true
	ecology._build(close_low,Vector3.ZERO)
	check("near visual LOD2 refuses unready physics despite ready visual",ecology.instances==0)
	source.support_ready = true
	source.physics_calls = 0
	source.visual_calls = 0
	ecology._build(close_low,Vector3.ZERO)
	var base_key := Planet._tile_key(base)
	check("near visual LOD2 populates",ecology.cells.has(base_key))
	if ecology.cells.has(base_key):
		var close_cell: Dictionary = ecology.cells[base_key]
		check("near visual LOD2 uses physics only",source.physics_calls>0 and source.visual_calls==0)
		check("near visual LOD2 colliders match trees",collider_count(close_cell)==int(close_cell.kinds.get("tree",0)) and collider_count(close_cell)>0)
	# Keep visual LOD2 on both sides, so only support policy forces rebuilding.
	var step := 2.0/4096.0
	var center := Planet._cube_direction(base.face,(float(base.x)+0.5)*step-1.0,(float(base.y)+0.5)*step-1.0)
	var tangent := center.cross(Vector3.UP).normalized()
	var far_direction := (center+tangent*260.0/Planet.RADIUS).normalized()
	var close_direction := (center+tangent*180.0/Planet.RADIUS).normalized()
	ecology._select(far_direction)
	check("220m outward crossing invalidates same visual LOD",not ecology.cells.has(base_key))
	build_pending_key(ecology,base_key)
	check("outward crossing repopulates",ecology.cells.has(base_key))
	if ecology.cells.has(base_key):
		check("outward rebuilt tree is visual only",ecology.cells[base_key].support_lod==2 and collider_count(ecology.cells[base_key])==0)
	ecology._select(close_direction)
	check("220m inward crossing invalidates same visual LOD",not ecology.cells.has(base_key))
	build_pending_key(ecology,base_key)
	check("inward crossing repopulates",ecology.cells.has(base_key))
	if ecology.cells.has(base_key):
		check("inward rebuilt tree collides",ecology.cells[base_key].support_lod<2 and collider_count(ecology.cells[base_key])>0)
	print("ECOLOGY_R3_INDEPENDENT="+JSON.stringify({"failures":failures,"bands":bands}))
	quit(0 if failures.is_empty() else 1)

func collider_count(cell: Dictionary) -> int:
	var result := 0
	for child in cell.node.get_children():
		if child is StaticBody3D: result += child.get_child_count()
	return result

func build_pending_key(ecology: Node3D, key: String) -> void:
	for tile in ecology.pending:
		if Planet._tile_key(tile)==key:
			ecology._build(tile,Vector3.ZERO)
			return
