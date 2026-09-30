extends Node3D
class_name NativePlanet

## Six-face, continuous spherical terrain. A low-cost complete globe remains
## visible from orbit; around the traveller, progressively finer *same-field*
## meshes stream in. The innermost tiles own triangle-mesh physics.

const RADIUS: float = NativePlanetField.RADIUS
const CENTER := Vector3(0.0, -RADIUS, 0.0)
const FACES: Array[String] = ["px", "nx", "py", "ny", "pz", "nz"]
const FAR_SEGMENTS: int = 192
const FAR_FALLBACK_SEGMENTS: int = 32
const MID_LEVEL: int = 7
const NEAR_LEVEL: int = 10
const TILE_SEGMENTS: int = 16
const IMPACT_TILE_SEGMENTS: int = 128
const MID_SKIRT: float = 220.0
const NEAR_SKIRT: float = 65.0
const FAR_DROP: float = 30.0
const COLLISION_LAYER: int = 16
const MASK_SIZE: int = 1024

var field: NativePlanetField
var use_baked_far: bool = true
var _far_root: Node3D
var _mid_root: Node3D
var _near_root: Node3D
var _materials: Dictionary = {}
var _water_materials: Dictionary = {}
var _coverage: Dictionary = {}
var _coverage_dirty: Dictionary = {}
var _far_tiles: Dictionary = {}
var _mid_tiles: Dictionary = {}
var _near_tiles: Dictionary = {}
var _wanted_mid: Dictionary = {}
var _wanted_near: Dictionary = {}
var _pinned_near: Dictionary = {}
var _landing_pins: Dictionary = {}
var _build_queue: Array[Dictionary] = []
var _stream_signature: String = ""
var _initialized: bool = false
var _worker: Thread
var _worker_tile: Dictionary = {}
var _worker_collidable: bool = false


func setup_world(legacy_world: Node) -> void:
	if _initialized:
		return
	_initialized = true
	field = NativePlanetField.new(legacy_world)
	_far_root = Node3D.new()
	_far_root.name = "WholePlanet"
	add_child(_far_root)
	_mid_root = Node3D.new()
	_mid_root.name = "RegionalSurface"
	add_child(_mid_root)
	_near_root = Node3D.new()
	_near_root.name = "CollidableSurface"
	add_child(_near_root)
	_setup_coverage_materials()
	var cache_valid: bool = use_baked_far and _far_cache_valid()
	for face in FACES:
		var tile: Dictionary = {"face": face, "level": 0, "x": 0, "y": 0}
		if cache_valid and ResourceLoader.exists(_far_path(face, false)):
			_far_tiles[face] = _load_baked_far(tile)
		else:
			_far_tiles[face] = _build_tile(tile, FAR_SEGMENTS if not use_baked_far else FAR_FALLBACK_SEGMENTS, _far_root, false, 0.0, FAR_DROP)


func _exit_tree() -> void:
	if _worker != null:
		_worker.wait_to_finish()
		_worker = null


static func _far_path(face: String, water: bool) -> String:
	return "res://assets/terrain/planet-far-%s-%s.res" % [face, "water" if water else "land"]


static func _far_cache_valid() -> bool:
	const MANIFEST: String = "res://assets/terrain/planet-far-manifest.json"
	if not FileAccess.file_exists(MANIFEST):
		return false
	var record: Variant = JSON.parse_string(FileAccess.get_file_as_string(MANIFEST))
	if not record is Dictionary or int(record.get("version", 0)) != 3:
		return false
	for source: String in ["scripts/native_planet.gd", "scripts/native_planet_field.gd", "scripts/native_planet_field_r3.gd", "scripts/native_world.gd"]:
		if str(record.get("sources", {}).get(source, "")) != FileAccess.get_sha256("res://" + source):
			return false
	return true


func _load_baked_far(tile: Dictionary) -> Dictionary:
	var face: String = tile.face
	var direction: Vector3 = _cube_direction(face, 0.0, 0.0)
	var center_sample: Dictionary = field.sample(direction)
	var origin: Vector3 = canonical_to_scene(direction * (RADIUS + float(center_sample.height) - FAR_DROP))
	var node := Node3D.new()
	node.name = "Planet_%s" % _tile_key(tile).replace("/", "_")
	node.position = origin
	_far_root.add_child(node)
	var mesh: ArrayMesh = load(_far_path(face, false)) as ArrayMesh
	mesh.surface_set_material(0, _materials[face][0])
	var visual := MeshInstance3D.new()
	visual.mesh = mesh
	visual.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	node.add_child(visual)
	if ResourceLoader.exists(_far_path(face, true)):
		var water_mesh: ArrayMesh = load(_far_path(face, true)) as ArrayMesh
		water_mesh.surface_set_material(0, _water_materials[face][0])
		var water_visual := MeshInstance3D.new()
		water_visual.name = "SurfaceWater"
		water_visual.mesh = water_mesh
		water_visual.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		node.add_child(water_visual)
	return {"node": node, "tile": tile, "spacing": 2.0 * RADIUS / FAR_SEGMENTS}


func _setup_coverage_materials() -> void:
	var shader: Shader = load("res://assets/terrain/planet_surface.gdshader") as Shader
	var water_shader: Shader = load("res://assets/terrain/planet_water.gdshader") as Shader
	var basalt: Texture2D = load("res://assets/terrain/basalt-albedo.png") as Texture2D
	for face in FACES:
		var regional_image := Image.create(MASK_SIZE, MASK_SIZE, false, Image.FORMAT_L8)
		regional_image.fill(Color.BLACK)
		var close_image := Image.create(MASK_SIZE, MASK_SIZE, false, Image.FORMAT_L8)
		close_image.fill(Color.BLACK)
		var regional_texture := ImageTexture.create_from_image(regional_image)
		var close_texture := ImageTexture.create_from_image(close_image)
		_coverage[face] = {"regional_image": regional_image, "regional_texture": regional_texture, "close_image": close_image, "close_texture": close_texture}
		var tiers: Dictionary = {}
		var water_tiers: Dictionary = {}
		for tier in range(3):
			var material := ShaderMaterial.new()
			material.shader = shader
			material.set_shader_parameter("basalt_albedo", basalt)
			material.set_shader_parameter("regional_coverage", regional_texture)
			material.set_shader_parameter("close_coverage", close_texture)
			material.set_shader_parameter("lod_tier", tier)
			tiers[tier] = material
			var water_material := ShaderMaterial.new()
			water_material.shader = water_shader
			water_material.set_shader_parameter("regional_coverage", regional_texture)
			water_material.set_shader_parameter("close_coverage", close_texture)
			water_material.set_shader_parameter("lod_tier", tier)
			water_tiers[tier] = water_material
		_materials[face] = tiers
		_water_materials[face] = water_tiers


func _paint_coverage(tile: Dictionary, loaded: bool) -> void:
	if int(tile.level) != MID_LEVEL and int(tile.level) != NEAR_LEVEL:
		return
	var face: String = tile.face
	var mid: bool = int(tile.level) == MID_LEVEL
	var image: Image = _coverage[face].regional_image if mid else _coverage[face].close_image
	var count: int = 1 << int(tile.level)
	var scale: int = MASK_SIZE / count
	var left: int = int(tile.x) * scale
	var top: int = int(tile.y) * scale
	for y in range(top, top + scale):
		for x in range(left, left + scale):
			image.set_pixel(x, y, Color.WHITE if loaded else Color.BLACK)
	_coverage_dirty[face + ("/regional" if mid else "/close")] = true


func _flush_coverage() -> void:
	for key: String in _coverage_dirty:
		var parts: PackedStringArray = key.split("/")
		var face: String = parts[0]
		if parts[1] == "regional":
			(_coverage[face].regional_texture as ImageTexture).update(_coverage[face].regional_image)
		else:
			(_coverage[face].close_texture as ImageTexture).update(_coverage[face].close_image)
	_coverage_dirty.clear()


static func canonical_to_scene(p: Vector3) -> Vector3:
	return Vector3(-p.z, p.x - RADIUS, -p.y)


static func scene_to_canonical(p: Vector3) -> Vector3:
	return Vector3(p.y + RADIUS, -p.z, -p.x)


static func radial_up(p: Vector3) -> Vector3:
	return (p - CENTER).normalized()


func analytic_surface(scene_position: Vector3) -> Dictionary:
	var direction: Vector3 = scene_to_canonical(scene_position).normalized()
	var sample: Dictionary = field.sample(direction)
	return {"point": canonical_to_scene(direction * (RADIUS + float(sample.height))), "normal": (canonical_to_scene(direction * RADIUS) - CENTER).normalized(), "water_depth": float(sample.water_depth), "height": float(sample.height)}


static func _cube_direction(face: String, u: float, v: float) -> Vector3:
	match face:
		"px": return Vector3(1.0, v, -u).normalized()
		"nx": return Vector3(-1.0, v, u).normalized()
		"py": return Vector3(u, 1.0, -v).normalized()
		"ny": return Vector3(u, -1.0, v).normalized()
		"pz": return Vector3(u, v, 1.0).normalized()
		"nz": return Vector3(-u, v, -1.0).normalized()
	return Vector3.RIGHT


static func _face_uv(p: Vector3) -> Dictionary:
	var a: float = absf(p.x)
	var b: float = absf(p.y)
	var c: float = absf(p.z)
	if a >= b and a >= c:
		return {"face": "px", "u": (-p.z / a + 1.0) * 0.5, "v": (p.y / a + 1.0) * 0.5} if p.x >= 0.0 else {"face": "nx", "u": (p.z / a + 1.0) * 0.5, "v": (p.y / a + 1.0) * 0.5}
	if b >= c:
		return {"face": "py", "u": (p.x / b + 1.0) * 0.5, "v": (-p.z / b + 1.0) * 0.5} if p.y >= 0.0 else {"face": "ny", "u": (p.x / b + 1.0) * 0.5, "v": (p.z / b + 1.0) * 0.5}
	return {"face": "pz", "u": (p.x / c + 1.0) * 0.5, "v": (p.y / c + 1.0) * 0.5} if p.z >= 0.0 else {"face": "nz", "u": (-p.x / c + 1.0) * 0.5, "v": (p.y / c + 1.0) * 0.5}


static func _tile_at(direction: Vector3, level: int) -> Dictionary:
	var coordinate: Dictionary = _face_uv(direction)
	var count: int = 1 << level
	return {"face": coordinate.face, "level": level, "x": clampi(floori(float(coordinate.u) * count), 0, count - 1), "y": clampi(floori(float(coordinate.v) * count), 0, count - 1)}


static func _tile_key(tile: Dictionary) -> String:
	return "%s/%d/%d/%d" % [tile.face, tile.level, tile.x, tile.y]


static func _tile_direction(tile: Dictionary) -> Vector3:
	var count: float = float(1 << int(tile.level))
	return _cube_direction(tile.face, 2.0 * (float(tile.x) + 0.5) / count - 1.0, 2.0 * (float(tile.y) + 0.5) / count - 1.0)


func _neighbor_tiles(direction: Vector3, level: int, rings: int = 1) -> Dictionary:
	var count: int = 1 << level
	var cube: Dictionary = _face_uv(direction)
	var dx: float = 2.0 / float(count)
	var center_u: float = (floorf(float(cube.u) * count) + 0.5) * dx - 1.0
	var center_v: float = (floorf(float(cube.v) * count) + 0.5) * dx - 1.0
	var result: Dictionary = {}
	for radius in range(rings + 1):
		for j in range(-radius, radius + 1):
			for i in range(-radius, radius + 1):
				if maxi(absi(i), absi(j)) != radius:
					continue
				var probe: Vector3 = _cube_direction(cube.face, center_u + float(i) * dx, center_v + float(j) * dx)
				var tile: Dictionary = _tile_at(probe, level)
				result[_tile_key(tile)] = tile
	return result


func update_stream(scene_position: Vector3) -> void:
	if not _initialized or not scene_position.is_finite():
		return
	var canonical: Vector3 = scene_to_canonical(scene_position)
	if canonical.length_squared() < 1.0:
		return
	var direction: Vector3 = canonical.normalized()
	var now: int = Time.get_ticks_msec()
	for key: String in _pinned_near.keys():
		if int(_pinned_near[key].until) < now:
			_pinned_near.erase(key)
			_stream_signature = ""
	for key: String in _landing_pins.keys():
		if int(_landing_pins[key].until) < now:
			_landing_pins.erase(key)
			_stream_signature = ""
	var altitude: float = canonical.length() - RADIUS
	var outside_old_basin: bool = maxf(absf(scene_position.x), absf(scene_position.z)) > 2300.0 or scene_position.y < -1000.0
	# The coarse whole-globe face is too sparse where it meets the 40 m
	# six-kilometre basin. Keep a regional apron around the basin while airborne
	# so its rendered edge has the same continuous field on both sides.
	var basin_apron: bool = altitude > 300.0 and not outside_old_basin
	var mid_enabled: bool = altitude < 9000.0 and (outside_old_basin or basin_apron)
	# The radial footprint must remain a real collidable tile even in orbit.
	# Flight controllers query it for AGL and safe return, not just landing.
	var near_enabled: bool = outside_old_basin
	var near_key: String = _tile_key(_tile_at(direction, NEAR_LEVEL)) if near_enabled else ""
	var mid_key: String = _tile_key(_tile_at(direction, MID_LEVEL)) if mid_enabled else ""
	var signature: String = near_key + ":" + mid_key + ":" + str(_pinned_near.size()) + ":" + str(_landing_pins.size()) + ":" + str(basin_apron)
	if signature != _stream_signature:
		_stream_signature = signature
		_wanted_near = _neighbor_tiles(direction, NEAR_LEVEL) if near_enabled else {}
		_wanted_mid = _neighbor_tiles(direction, MID_LEVEL, 4 if basin_apron else 2) if mid_enabled else {}
		for key: String in _pinned_near:
			_wanted_near[key] = _pinned_near[key].tile
		for key: String in _landing_pins:
			_wanted_near[key] = _landing_pins[key].tile
		_build_queue.clear()
		# Support under the traveller precedes scenic neighbors.
		if near_enabled and not _near_tiles.has(near_key):
			_build_queue.append(_wanted_near[near_key])
		var adjacent: Array[Dictionary] = []
		for key: String in _wanted_near:
			if key != near_key and not _pinned_near.has(key) and not _near_tiles.has(key):
				adjacent.append(_wanted_near[key])
		adjacent.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return _tile_direction(a).distance_squared_to(direction) < _tile_direction(b).distance_squared_to(direction))
		for neighbor: Dictionary in adjacent:
			_build_queue.append(neighbor)
		for key: String in _pinned_near:
			if key != near_key and not _near_tiles.has(key):
				_build_queue.append(_pinned_near[key].tile)
		for key: String in _landing_pins:
			if key != near_key and not _near_tiles.has(key):
				_build_queue.append(_landing_pins[key].tile)
		if mid_enabled and not _mid_tiles.has(mid_key):
			_build_queue.append(_wanted_mid[mid_key])
		for key: String in _wanted_mid:
			if key != mid_key and not _mid_tiles.has(key):
				_build_queue.append(_wanted_mid[key])
		_prune_tiles(_near_tiles, _wanted_near)
		_prune_tiles(_mid_tiles, _wanted_mid)
	if _worker != null and not _worker.is_alive():
		var completed: Dictionary = _worker.wait_to_finish()
		_worker = null
		var finished_tile: Dictionary = _worker_tile
		var finished_key: String = _tile_key(finished_tile)
		if _worker_collidable and _wanted_near.has(finished_key) and not _near_tiles.has(finished_key):
			_near_tiles[finished_key] = _commit_tile(finished_tile, _near_root, true, completed)
			_paint_coverage(finished_tile, true)
		elif not _worker_collidable and _wanted_mid.has(finished_key) and not _mid_tiles.has(finished_key):
			_mid_tiles[finished_key] = _commit_tile(finished_tile, _mid_root, false, completed)
			_paint_coverage(finished_tile, true)
		_worker_tile = {}
	if _worker == null:
		while not _build_queue.is_empty():
			var tile: Dictionary = _build_queue.pop_front()
			var key: String = _tile_key(tile)
			var collidable: bool = int(tile.level) == NEAR_LEVEL
			if (collidable and (_near_tiles.has(key) or not _wanted_near.has(key))) or (not collidable and (_mid_tiles.has(key) or not _wanted_mid.has(key))):
				continue
			_worker_tile = tile
			_worker_collidable = collidable
			_worker = Thread.new()
			var skirt: float = NEAR_SKIRT if collidable else MID_SKIRT
			var segments: int = _segments_for_tile(tile) if collidable else TILE_SEGMENTS
			var result: Error = _worker.start(Callable(self, "_compute_tile_data").bind(tile, segments, collidable, skirt, 0.0))
			if result != OK:
				push_error("Planet terrain worker could not start: %s" % result)
				_worker = null
				_worker_tile = {}
			break
	_flush_coverage()


func prepare_route(from_scene: Vector3, to_scene: Vector3, radius: float, height: float) -> Dictionary:
	if not from_scene.is_finite() or not to_scene.is_finite() or from_scene.distance_to(to_scene) > 2200.0:
		return {"ready": true, "clear": false}
	var requested: Dictionary = {}
	var parts: int = maxi(1, ceili(from_scene.distance_to(to_scene) / 70.0))
	for i in range(parts + 1):
		var point: Vector3 = from_scene.lerp(to_scene, float(i) / parts)
		if point.y > -1000.0 and absf(point.x) <= 2999.0 and absf(point.z) <= 2999.0:
			continue
		var canonical: Vector3 = scene_to_canonical(point)
		if canonical.length_squared() < 1.0:
			return {"ready": true, "clear": false}
		var neighbors: Dictionary = _neighbor_tiles(canonical.normalized(), NEAR_LEVEL)
		for key: String in neighbors:
			requested[key] = neighbors[key]
	var until: int = Time.get_ticks_msec() + 10000
	for key: String in requested:
		_pinned_near[key] = {"tile": requested[key], "until": until}
	_stream_signature = ""
	update_stream(from_scene)
	for key: String in requested:
		if not _near_tiles.has(key):
			return {"ready": false, "clear": false}
	return {"ready": true, "clear": true}


func release_prepared_route() -> void:
	if _pinned_near.is_empty():
		return
	_pinned_near.clear()
	_stream_signature = ""


func pin_surface_landing(direction: Vector3, expiry_msec: int) -> Dictionary:
	if not direction.is_finite() or direction.length_squared() < 0.25:
		return {"ready": true, "clear": false, "reason": "invalid_direction"}
	var needed: Dictionary = _neighbor_tiles(direction.normalized(), NEAR_LEVEL)
	var changed := needed.size() != _landing_pins.size()
	if not changed:
		for key: String in needed:
			if not _landing_pins.has(key):
				changed = true
				break
	_landing_pins.clear()
	for key: String in needed:
		_landing_pins[key] = {"tile": needed[key], "until": expiry_msec}
	if changed:
		_stream_signature = ""
	for key: String in needed:
		if not _near_tiles.has(key):
			return {"ready": false, "clear": false, "reason": "streaming"}
	return {"ready": true, "clear": true}


func release_surface_landing() -> void:
	if _landing_pins.is_empty():
		return
	_landing_pins.clear()
	_stream_signature = ""


func affected_near_tiles(center_direction: Vector3, radius_metres: float) -> Array[Dictionary]:
	var affected: Array[Dictionary] = []
	for tile: Dictionary in _neighbor_tiles(center_direction, NEAR_LEVEL).values():
		var tile_center := _tile_direction(tile)
		if RADIUS * tile_center.distance_to(center_direction) <= radius_metres + _tile_cap_radius(tile):
			affected.append(tile)
	return affected


func _tile_cap_radius(tile: Dictionary) -> float:
	var count: float = float(1 << int(tile.level))
	var center := _tile_direction(tile)
	var furthest := 0.0
	for x in [0.0, 1.0]:
		for y in [0.0, 1.0]:
			var corner := _cube_direction(tile.face, 2.0 * (float(tile.x) + x) / count - 1.0, 2.0 * (float(tile.y) + y) / count - 1.0)
			furthest = maxf(furthest, RADIUS * corner.distance_to(center))
	return furthest


func _segments_for_tile(tile: Dictionary) -> int:
	if field == null or field.deformations == null or field.deformations.count() == 0:
		return TILE_SEGMENTS
	return IMPACT_TILE_SEGMENTS if field.deformations.affects_cap(_tile_direction(tile), _tile_cap_radius(tile)) else TILE_SEGMENTS


func compute_impact_tile_data(tile: Dictionary, preview: NativeSurfaceDeformation) -> Dictionary:
	return _compute_tile_data(tile, IMPACT_TILE_SEGMENTS, true, NEAR_SKIRT, 0.0, preview)


func commit_impact_tile(tile: Dictionary, data: Dictionary) -> void:
	var key := _tile_key(tile)
	var old: Dictionary = _near_tiles.get(key, {})
	var fresh := _commit_tile(tile, _near_root, true, data)
	_near_tiles[key] = fresh
	_paint_coverage(tile, true)
	if not old.is_empty():
		(old.node as Node).queue_free()
	_flush_coverage()


func invalidate_deformation_tiles() -> void:
	for key: String in _near_tiles.keys():
		var record: Dictionary = _near_tiles[key]
		if int(record.get("segments", TILE_SEGMENTS)) == TILE_SEGMENTS and _segments_for_tile(record.tile) == TILE_SEGMENTS:
			continue
		_paint_coverage(record.tile, false)
		(record.node as Node).queue_free()
		_near_tiles.erase(key)
	_stream_signature = ""


func _prune_tiles(active: Dictionary, wanted: Dictionary) -> void:
	for key: String in active.keys():
		if not wanted.has(key):
			_paint_coverage(active[key].tile, false)
			(active[key].node as Node).queue_free()
			active.erase(key)


func _build_tile(tile: Dictionary, segments: int, parent: Node3D, collidable: bool, skirt_depth: float, radial_drop: float) -> Dictionary:
	return _commit_tile(tile, parent, collidable, _compute_tile_data(tile, segments, collidable, skirt_depth, radial_drop))


func _compute_tile_data(tile: Dictionary, segments: int, collidable: bool, skirt_depth: float, radial_drop: float, deformation_override: NativeSurfaceDeformation = null) -> Dictionary:
	var count: int = 1 << int(tile.level)
	var center_direction: Vector3 = _cube_direction(tile.face, 2.0 * (float(tile.x) + 0.5) / count - 1.0, 2.0 * (float(tile.y) + 0.5) / count - 1.0)
	var center_sample: Dictionary = field.sample(center_direction, deformation_override)
	var origin: Vector3 = canonical_to_scene(center_direction * (RADIUS + float(center_sample.height) - radial_drop))
	var vertices := PackedVector3Array()
	var colors := PackedColorArray()
	var normals := PackedVector3Array()
	var uvs := PackedVector2Array()
	var material_weights := PackedVector2Array()
	var water_points := PackedVector3Array()
	var water_depths := PackedFloat32Array()
	var indices := PackedInt32Array()
	var n: int = segments + 1
	for j in range(n):
		for i in range(n):
			var u: float = (float(tile.x) + float(i) / segments) / count
			var v: float = (float(tile.y) + float(j) / segments) / count
			var direction: Vector3 = _cube_direction(tile.face, u * 2.0 - 1.0, v * 2.0 - 1.0)
			var sample: Dictionary = field.sample(direction, deformation_override)
			var surface: Vector3 = canonical_to_scene(direction * (RADIUS + float(sample.height) - radial_drop))
			vertices.append(surface - origin)
			uvs.append(Vector2(u, v))
			colors.append(_terrain_color(sample))
			# Signed channel: dry land carries basin weight; submerged land
			# carries negative water depth. Far opaque water owns deep pixels,
			# avoiding sea-floor z fighting with close first-person clip planes.
			var basin_or_depth: float = -float(sample.water_depth) if float(sample.water_depth) > 0.0 else clampf(float(sample.get("basin", 0.0)), 0.0, 1.0)
			material_weights.append(Vector2(basin_or_depth, clampf(float(sample.get("cold", 0.0)), 0.0, 1.0)))
			var water_level: Variant = sample.water_height
			var water_offset: float = 0.35 if collidable else (-0.7 if int(tile.level) == MID_LEVEL else -8.0)
			var level: float = float(water_level) if water_level != null else 0.0
			water_points.append(canonical_to_scene(direction * (RADIUS + level + water_offset)) - origin)
			water_depths.append(level - float(sample.height) if water_level != null else -maxf(0.01, float(sample.height)))
	for j in range(n):
		for i in range(n):
			var left: Vector3 = vertices[j * n + maxi(i - 1, 0)]
			var right: Vector3 = vertices[j * n + mini(i + 1, segments)]
			var down: Vector3 = vertices[maxi(j - 1, 0) * n + i]
			var up: Vector3 = vertices[mini(j + 1, segments) * n + i]
			var normal: Vector3 = (right - left).cross(up - down).normalized()
			var radial: Vector3 = radial_up(origin + vertices[j * n + i])
			if normal.dot(radial) < 0.0:
				normal = -normal
			normals.append(normal)
	for j in range(segments):
		for i in range(segments):
			var a: int = j * n + i
			var b: int = a + n
			# Clockwise exterior winding, as in the original basin. The cube
			# bridge preserves handedness; the old order exposed back faces.
			indices.append_array(PackedInt32Array([a, b, a + 1, a + 1, b, b + 1]))
	var surface_indices: PackedInt32Array = indices.duplicate()
	if skirt_depth > 0.0:
		var edges: Array[PackedInt32Array] = []
		var top := PackedInt32Array()
		var right_edge := PackedInt32Array()
		var bottom := PackedInt32Array()
		var left_edge := PackedInt32Array()
		for i in range(n):
			top.append(i)
			right_edge.append(i * n + segments)
			bottom.append(segments * n + segments - i)
			left_edge.append((segments - i) * n)
		edges.append_array([top, right_edge, bottom, left_edge])
		for edge: PackedInt32Array in edges:
			var start: int = vertices.size()
			for index: int in edge:
				var p: Vector3 = vertices[index]
				vertices.append(p - radial_up(origin + p) * skirt_depth)
				normals.append(normals[index])
				colors.append(colors[index])
				uvs.append(uvs[index])
				material_weights.append(material_weights[index])
			for i in range(segments):
				indices.append_array(PackedInt32Array([edge[i], start + i, edge[i + 1], edge[i + 1], start + i, start + i + 1]))
	return {"origin": origin, "vertices": vertices, "normals": normals, "colors": colors, "uvs": uvs, "material_weights": material_weights, "indices": indices, "surface_indices": surface_indices, "water_points": water_points, "water_depths": water_depths, "segments": segments}


func _commit_tile(tile: Dictionary, parent: Node3D, collidable: bool, data: Dictionary) -> Dictionary:
	var origin: Vector3 = data.origin
	var vertices: PackedVector3Array = data.vertices
	var normals: PackedVector3Array = data.normals
	var colors: PackedColorArray = data.colors
	var uvs: PackedVector2Array = data.uvs
	var indices: PackedInt32Array = data.indices
	var surface_indices: PackedInt32Array = data.surface_indices
	var water_points: PackedVector3Array = data.water_points
	var water_depths: PackedFloat32Array = data.water_depths
	var segments: int = int(data.segments)
	var count: int = 1 << int(tile.level)
	var arrays: Array = []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_COLOR] = colors
	arrays[Mesh.ARRAY_TEX_UV] = uvs
	arrays[Mesh.ARRAY_TEX_UV2] = data.material_weights
	arrays[Mesh.ARRAY_INDEX] = indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	var tier: int = 0 if int(tile.level) == 0 else (1 if int(tile.level) == MID_LEVEL else 2)
	mesh.surface_set_material(0, _materials[tile.face][tier])
	var node := Node3D.new()
	node.name = "Planet_%s" % _tile_key(tile).replace("/", "_")
	node.position = origin
	parent.add_child(node)
	var visual := MeshInstance3D.new()
	visual.mesh = mesh
	visual.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	node.add_child(visual)
	var water_mesh: ArrayMesh = _build_water_mesh(tile, origin, water_points, water_depths, uvs, surface_indices)
	if water_mesh != null:
		var water_visual := MeshInstance3D.new()
		water_visual.name = "SurfaceWater"
		water_visual.mesh = water_mesh
		water_visual.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		node.add_child(water_visual)
	if collidable:
		var body := StaticBody3D.new()
		body.name = "PlanetTriangleCollision"
		body.collision_layer = 1 | COLLISION_LAYER
		body.collision_mask = 0
		body.add_to_group("native_planet_terrain")
		node.add_child(body)
		var shape := ConcavePolygonShape3D.new()
		shape.backface_collision = true
		var faces := PackedVector3Array()
		for index: int in surface_indices:
			faces.append(vertices[index])
		shape.set_faces(faces)
		var collider := CollisionShape3D.new()
		collider.shape = shape
		body.add_child(collider)
	var spacing: float = 2.0 * RADIUS / float(count * segments)
	return {"node": node, "tile": tile, "spacing": spacing, "segments": segments, "vertices": vertices, "surface_indices": surface_indices}


func _build_water_mesh(tile: Dictionary, origin: Vector3, points: PackedVector3Array, depths: PackedFloat32Array, uvs: PackedVector2Array, ground_indices: PackedInt32Array) -> ArrayMesh:
	var vertices := PackedVector3Array()
	var normals := PackedVector3Array()
	var colors := PackedColorArray()
	var water_uvs := PackedVector2Array()
	var water_material_weights := PackedVector2Array()
	for offset in range(0, ground_indices.size(), 3):
		var polygon: Array[Dictionary] = []
		for corner in range(3):
			var index: int = ground_indices[offset + corner]
			polygon.append({"point": points[index], "depth": float(depths[index]), "uv": uvs[index]})
		polygon = _clip_wet_polygon(polygon)
		if polygon.size() < 3:
			continue
		for corner in range(1, polygon.size() - 1):
			for vertex: Dictionary in [polygon[0], polygon[corner], polygon[corner + 1]]:
				var p: Vector3 = vertex.point
				var depth: float = float(vertex.depth)
				var shore: float = exp(-maxf(depth, 0.0) / 12.0)
				vertices.append(p)
				normals.append(radial_up(origin + p))
				colors.append(Color(0.025 + 0.11 * shore, 0.072 + 0.19 * shore, 0.15 + 0.17 * shore))
				water_uvs.append(vertex.uv)
				water_material_weights.append(Vector2(maxf(depth, 0.0), 0.0))
	if vertices.is_empty():
		return null
	var arrays: Array = []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_COLOR] = colors
	arrays[Mesh.ARRAY_TEX_UV] = water_uvs
	arrays[Mesh.ARRAY_TEX_UV2] = water_material_weights
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	var tier: int = 0 if int(tile.level) == 0 else (1 if int(tile.level) == MID_LEVEL else 2)
	mesh.surface_set_material(0, _water_materials[tile.face][tier])
	return mesh


static func _clip_wet_polygon(source: Array[Dictionary]) -> Array[Dictionary]:
	var output: Array[Dictionary] = []
	var previous: Dictionary = source[-1]
	for current: Dictionary in source:
		var previous_wet: bool = float(previous.depth) > 0.0
		var current_wet: bool = float(current.depth) > 0.0
		if previous_wet != current_wet:
			var t: float = float(previous.depth) / (float(previous.depth) - float(current.depth))
			output.append({"point": (previous.point as Vector3).lerp(current.point, t), "depth": 0.0, "uv": (previous.uv as Vector2).lerp(current.uv, t)})
		if current_wet:
			output.append(current)
		previous = current
	return output


static func _terrain_color(sample: Dictionary) -> Color:
	var h: float = float(sample.height)
	# R3 references 03/05/06/07: muted earth and sage, deep forest, soft silt.
	# Basin mineral colour is evaluated by the shared world-space shader.
	var base: Color = Color(0.29, 0.285, 0.19)
	var moisture: float = float(sample.moisture)
	var ocean: float = float(sample.ocean)
	var forest: float = float(sample.forest)
	var wetland: float = float(sample.wetland)
	var coast: float = float(sample.coast)
	var mountain: float = float(sample.mountains)
	base = base.lerp(Color(0.24, 0.27, 0.17), clampf((h - 30.0) / 600.0, 0.0, 1.0) * 0.35)
	base = base.lerp(Color(0.075, 0.145, 0.095), clampf(forest * 1.5, 0.0, 1.0))
	base = base.lerp(Color(0.145, 0.195, 0.13), wetland * 0.7)
	base = base.lerp(Color(0.43, 0.365, 0.29), coast * 0.64)
	base = base.lerp(Color(0.285, 0.26, 0.30), mountain * 0.82)
	base = base.lerp(Color(0.065, 0.115, 0.16), ocean)
	base = base.lerp(Color(0.51, 0.60, 0.65), float(sample.get("cold", 0.0)))
	base = base.lerp(Color(0.115, 0.085, 0.092), float(sample.get("volcanic", 0.0)) * 0.75)
	var variation: float = clampf((moisture - 0.5) * 0.035, -0.015, 0.015)
	return Color(base.r + variation, base.g + variation, base.b + variation, clampf(float(sample.get("volcanic", 0.0)), 0.0, 1.0))


func surface_at(scene_position: Vector3) -> Dictionary:
	if not _initialized or not scene_position.is_finite():
		return {"ready": false}
	var canonical: Vector3 = scene_to_canonical(scene_position)
	if canonical.length_squared() < 1.0:
		return {"ready": false}
	var direction: Vector3 = canonical.normalized()
	var sample: Dictionary = field.sample(direction)
	var fallback: Vector3 = canonical_to_scene(direction * (RADIUS + float(sample.height)))
	var tile: Dictionary = _tile_at(direction, NEAR_LEVEL)
	var key: String = _tile_key(tile)
	if not _near_tiles.has(key):
		return {"ready": false, "point": fallback, "normal": radial_up(fallback), "agl": (scene_position - fallback).dot(radial_up(fallback)), "water_depth": float(sample.water_depth), "spacing": INF}
	var up: Vector3 = radial_up(scene_position)
	var ray_from: Vector3 = CENTER + up * (RADIUS + 7000.0)
	var ray_to: Vector3 = CENTER + up * (RADIUS - 7000.0)
	var hit: Dictionary = _triangle_surface_hit(ray_from, ray_to, up)
	if hit.is_empty() or not (hit.collider as Node).is_in_group("native_planet_terrain"):
		return {"ready": false, "point": fallback, "normal": radial_up(fallback), "agl": (scene_position - fallback).dot(radial_up(fallback)), "water_depth": float(sample.water_depth), "spacing": INF}
	var point: Vector3 = hit.position
	var normal: Vector3 = hit.normal
	if normal.dot(up) < 0.0:
		normal = -normal
	return {"ready": true, "point": point, "normal": normal, "agl": (scene_position - point).dot(up), "water_depth": float(sample.water_depth), "spacing": float(_near_tiles[key].spacing)}


func rendered_visual_surface_at(scene_position: Vector3, allow_legacy_seam: bool = false) -> Dictionary:
	# Visual-only ecology may follow a real regional mesh without pretending
	# that its coarse triangles provide player collision. Prefer near ownership.
	if not _initialized or not scene_position.is_finite():
		return {"ready": false, "collidable": false}
	var canonical: Vector3 = scene_to_canonical(scene_position)
	var direction: Vector3 = canonical.normalized()
	var sample: Dictionary = field.sample(direction)
	if float(sample.legacy_weight) > 0.0 and not allow_legacy_seam:
		return {"ready": false, "collidable": false}
	var cell: Dictionary = _tile_at(direction, NEAR_LEVEL)
	var record: Dictionary = _near_tiles.get(_tile_key(cell), {})
	var is_near: bool = not record.is_empty()
	if record.is_empty():
		cell = _tile_at(direction, MID_LEVEL)
		record = _mid_tiles.get(_tile_key(cell), {})
	if record.is_empty():
		return {"ready": false, "collidable": false}
	var cube: Dictionary = _face_uv(direction)
	var count: float = float(1 << int(cell.level))
	var segments: int = int(record.get("segments", TILE_SEGMENTS))
	var u: float = clampf((float(cube.u) * count - float(cell.x)) * segments, 0.0, float(segments) - 0.00001)
	var v: float = clampf((float(cube.v) * count - float(cell.y)) * segments, 0.0, float(segments) - 0.00001)
	var offset: int = (floori(v) * segments + floori(u)) * 6
	var vertices: PackedVector3Array = record.vertices
	var indexes: PackedInt32Array = record.surface_indices
	var origin: Vector3 = (record.node as Node3D).position
	var up: Vector3 = radial_up(scene_position)
	for triangle: int in [offset, offset + 3]:
		var a: Vector3 = vertices[indexes[triangle]]
		var b: Vector3 = vertices[indexes[triangle + 1]]
		var c: Vector3 = vertices[indexes[triangle + 2]]
		var intersection: Variant = Geometry3D.ray_intersects_triangle(CENTER - origin, up, a, b, c)
		if intersection == null:
			continue
		var normal: Vector3 = (b - a).cross(c - a).normalized()
		if normal.dot(up) < 0.0:
			normal = -normal
		var point: Vector3 = origin + (intersection as Vector3)
		return {"ready": true, "collidable": is_near, "source": "rendered_near" if is_near else "rendered_regional", "point": point, "normal": normal, "water_depth": float(sample.water_depth), "spacing": record.spacing, "agl": (scene_position - point).dot(up)}
	return {"ready": false, "collidable": false}


func _triangle_surface_hit(ray_from: Vector3, ray_to: Vector3, up: Vector3) -> Dictionary:
	var tangent_a: Vector3 = Vector3.FORWARD.cross(up).normalized()
	if tangent_a.length_squared() < 0.25:
		tangent_a = Vector3.RIGHT.cross(up).normalized()
	var tangent_b: Vector3 = up.cross(tangent_a).normalized()
	var offsets: Array[Vector3] = [Vector3.ZERO, tangent_a * 0.05, -tangent_a * 0.05, tangent_b * 0.05, -tangent_b * 0.05, tangent_a * 0.25, -tangent_a * 0.25, tangent_b * 0.25, -tangent_b * 0.25]
	for offset: Vector3 in offsets:
		var query := PhysicsRayQueryParameters3D.create(ray_from + offset, ray_to + offset, COLLISION_LAYER)
		query.hit_back_faces = true
		var hit: Dictionary = get_world_3d().direct_space_state.intersect_ray(query)
		if not hit.is_empty() and (hit.collider as Node).is_in_group("native_planet_terrain"):
			return hit
	return {}


func loaded_near_tile_count() -> int:
	return _near_tiles.size()


func loaded_mid_tile_count() -> int:
	return _mid_tiles.size()
