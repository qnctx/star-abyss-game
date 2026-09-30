extends Node3D
class_name NativeWorld

## Native port of the original six-kilometre basin in playable/src/layout.mjs.
## Coordinates remain metres, with north along -Z. Terrain rendering, collision,
## and gameplay height queries all sample the same 10 m triangular heightfield.

const HALF_SIZE: float = 3000.0
const GRID_STEP: float = 10.0
const GRID_SEGMENTS: int = 600
const CHUNK_CELLS: int = 16
const CHUNK_SIZE: float = GRID_STEP * CHUNK_CELLS
const CHUNK_COUNT: int = 38
const STREAM_RADIUS: int = 4
const CHUNKS_PER_UPDATE: int = 2
const FAR_STEP: float = 40.0
const FAR_SEGMENTS: int = 150
const FAR_DROP: float = 1.0
const NEAR_SKIRT_DEPTH: float = 8.0

const LANDFORMS: Array[Vector3] = [
	Vector3(-108.0, 105.0, 23.0), Vector3(156.0, 10.0, 31.0),
	Vector3(-78.0, -100.0, 24.0), Vector3(81.0, -287.0, 29.0),
	Vector3(-86.0, -348.0, 33.0), Vector3(-144.0, -600.0, 38.0),
	Vector3(163.0, -658.0, 27.0), Vector3(28.0, -915.0, 36.0),
]
const LANDFORM_RADII: Array[Vector2] = [
	Vector2(65.0, 104.0), Vector2(74.0, 110.0), Vector2(45.0, 86.0),
	Vector2(44.0, 75.0), Vector2(55.0, 93.0), Vector2(72.0, 206.0),
	Vector2(74.0, 170.0), Vector2(210.0, 80.0),
]
const CRATERS: Array[Vector3] = [
	Vector3(145.0, -150.0, 77.0), Vector3(-220.0, -270.0, 56.0),
	Vector3(277.0, -467.0, 110.0),
]
const CRATER_DEPTH_RIM: Array[Vector2] = [
	Vector2(13.0, 10.0), Vector2(8.0, 7.0), Vector2(17.0, 13.0),
]

var _height_cache: Dictionary = {}
var _chunks: Dictionary = {}
var _requested: Dictionary = {}
var _pending: Array[Vector2i] = []
var _stream_center := Vector2i(-1, -1)
var _terrain_root: Node3D
var _terrain_material: StandardMaterial3D
var _far_mask_image: Image
var _far_mask_texture: ImageTexture
var _far_mask_dirty: bool = false
var _initialized: bool = false


func _ready() -> void:
	setup_world()


func setup_world() -> void:
	if _initialized:
		return
	_initialized = true
	_terrain_root = Node3D.new()
	_terrain_root.name = "BasinTerrainChunks"
	add_child(_terrain_root)
	_terrain_material = StandardMaterial3D.new()
	_terrain_material.resource_name = "Basalt terrain - original six-kilometre basin"
	_terrain_material.vertex_color_use_as_albedo = true
	_terrain_material.roughness = 0.96
	_terrain_material.metallic = 0.0
	_terrain_material.cull_mode = BaseMaterial3D.CULL_DISABLED
	_terrain_material.albedo_texture = load("res://assets/terrain/basalt-albedo.png") as Texture2D
	_setup_far_terrain()
	_setup_sky_and_light()
	update_stream(Vector3(0.0, height_at(0.0, 190.0), 190.0))


func height_at(x: float, z: float) -> float:
	# The original chapter stops at ±3 km; clamping the query keeps edge probes
	# finite, while is_solid_at() makes the world boundary impassable.
	var gx: float = (clampf(x, -HALF_SIZE, HALF_SIZE) + HALF_SIZE) / GRID_STEP
	var gz: float = (clampf(z, -HALF_SIZE, HALF_SIZE) + HALF_SIZE) / GRID_STEP
	var ix: int = mini(int(floor(gx + 0.000000001)), GRID_SEGMENTS - 1)
	var iz: int = mini(int(floor(gz + 0.000000001)), GRID_SEGMENTS - 1)
	var u: float = clampf(gx - float(ix), 0.0, 1.0)
	var v: float = clampf(gz - float(iz), 0.0, 1.0)
	var a: float = _grid_height(ix, iz)
	var b: float = _grid_height(ix, iz + 1)
	var d: float = _grid_height(ix + 1, iz)
	if u + v <= 1.0:
		return a + (d - a) * u + (b - a) * v
	var c: float = _grid_height(ix + 1, iz + 1)
	return c * (u + v - 1.0) + b * (1.0 - u) + d * (1.0 - v)


func is_solid_at(p: Vector3, radius: float, height: float) -> bool:
	# p is the bottom centre of a vertical capsule/box. This bounded probe
	# handles the common terrain, slope-edge, and six-kilometre boundary checks.
	if is_nan(p.x) or is_nan(p.y) or is_nan(p.z):
		return true
	if is_inf(p.x) or is_inf(p.y) or is_inf(p.z):
		return true
	var r: float = clampf(radius, 0.0, 10.0)
	if absf(p.x) + r > HALF_SIZE or absf(p.z) + r > HALF_SIZE:
		return true
	if p.y < height_at(p.x, p.z) - 0.02:
		return true
	if r > 0.0:
		for i in range(8):
			var angle: float = float(i) * TAU / 8.0
			var sx: float = p.x + cos(angle) * r
			var sz: float = p.z + sin(angle) * r
			if height_at(sx, sz) > p.y + minf(r, maxf(height, 0.0)):
				return true
	return false


func update_stream(center: Vector3) -> void:
	if not _initialized:
		setup_world()
		return
	var cell := Vector2i(
		clampi(int(floor((center.x + HALF_SIZE) / CHUNK_SIZE)), 0, CHUNK_COUNT - 1),
		clampi(int(floor((center.z + HALF_SIZE) / CHUNK_SIZE)), 0, CHUNK_COUNT - 1)
	)
	if cell != _stream_center:
		_stream_center = cell
		_requested.clear()
		_pending.clear()
		for ring in range(STREAM_RADIUS + 1):
			for dz in range(-ring, ring + 1):
				for dx in range(-ring, ring + 1):
					if maxi(abs(dx), abs(dz)) != ring:
						continue
					var key := cell + Vector2i(dx, dz)
					if key.x < 0 or key.y < 0 or key.x >= CHUNK_COUNT or key.y >= CHUNK_COUNT:
						continue
					_requested[key] = true
					if not _chunks.has(key):
						_pending.append(key)
		for key: Vector2i in _chunks.keys():
			if not _requested.has(key):
				(_chunks[key] as Node3D).queue_free()
				_chunks.erase(key)
				_set_far_mask(key, false)
		# The footprint beneath a fresh spawn or teleport is ready immediately.
		for dz in range(-1, 2):
			for dx in range(-1, 2):
				var near_key := cell + Vector2i(dx, dz)
				if _requested.has(near_key) and not _chunks.has(near_key):
					_build_chunk(near_key)
	var built: int = 0
	while not _pending.is_empty() and built < CHUNKS_PER_UPDATE:
		var key: Vector2i = _pending.pop_front()
		if _requested.has(key) and not _chunks.has(key):
			_build_chunk(key)
			built += 1
	if _far_mask_dirty:
		_far_mask_texture.update(_far_mask_image)
		_far_mask_dirty = false


func loaded_chunk_count() -> int:
	return _chunks.size()


func _grid_height(ix: int, iz: int) -> float:
	var key := Vector2i(ix, iz)
	if _height_cache.has(key):
		return _height_cache[key]
	var x: float = float(ix) * GRID_STEP - HALF_SIZE
	var z: float = float(iz) * GRID_STEP - HALF_SIZE
	var value: float = _raw_height(x, z)
	_height_cache[key] = value
	return value


func _raw_height(x: float, z: float) -> float:
	var relief: float = sin(x * 0.009) * cos(z * 0.008) * 9.0 + sin(x * 0.027 + z * 0.013) * 2.8
	var corridor: float = clampf((absf(x) - 65.0) / 110.0, 0.0, 1.0)
	var ends: float = clampf(maxf(z - 260.0, -z - 840.0) / 150.0, 0.0, 1.0)
	return relief * maxf(corridor, ends) + _phase1_relief(x, z)


func _phase1_relief(x: float, z: float) -> float:
	var relief: float = 0.0
	for i in range(LANDFORMS.size()):
		var feature: Vector3 = LANDFORMS[i]
		var radii: Vector2 = LANDFORM_RADII[i]
		var ax: float = (x - feature.x) / radii.x
		var az: float = (z - feature.y) / radii.y
		var warp: float = 1.0 + sin(z * 0.063 + x * 0.027) * 0.12 + sin(z * 0.139 - x * 0.071) * 0.055
		var r: float = pow(pow(absf(ax), 3.3) + pow(absf(az), 3.3), 1.0 / 3.3) * warp
		if r >= 1.45:
			continue
		var profile: float = 1.0 - _smooth(0.68, 1.10, r)
		var fault: float = sin(x * 0.083 + z * 0.037) * sin(z * 0.061 - x * 0.021)
		var terraced: float = profile * 0.52 + floor(profile * 5.0) / 5.0 * 0.48
		relief += feature.z * terraced + fault * 3.2 * profile
	for i in range(CRATERS.size()):
		var crater: Vector3 = CRATERS[i]
		var shape: Vector2 = CRATER_DEPTH_RIM[i]
		var r: float = Vector2(x - crater.x, (z - crater.y) * 1.08).length() / crater.z
		if r > 1.6:
			continue
		relief += shape.y * exp(-pow((r - 1.0) / 0.17, 2.0)) - shape.x * (1.0 - _smooth(0.15, 0.88, r))
	var canyon: float = 1.0 - _smooth(-80.0, -20.0, z)
	var route: float = 1.0 - (1.0 - _smooth(28.0 - canyon * 10.0, 44.0 - canyon * 10.0, absf(x))) * _smooth(-880.0, -840.0, z) * (1.0 - _smooth(245.0, 295.0, z))
	var ship: float = 1.0 - (1.0 - _smooth(64.0, 105.0, absf(x))) * _smooth(-880.0, -820.0, z) * (1.0 - _smooth(-468.0, -428.0, z))
	var landing: float = _smooth(35.0, 78.0, Vector2(x, z - 190.0).length())
	var recovery: float = _smooth(36.0, 67.0, Vector2(x - 84.0, z - 82.0).length())
	return relief * route * ship * landing * recovery


func _smooth(a: float, b: float, t: float) -> float:
	var u: float = clampf((t - a) / (b - a), 0.0, 1.0)
	return u * u * (3.0 - 2.0 * u)


func _build_chunk(key: Vector2i) -> void:
	var base_ix: int = key.x * CHUNK_CELLS
	var base_iz: int = key.y * CHUNK_CELLS
	var cells_x: int = mini(CHUNK_CELLS, GRID_SEGMENTS - base_ix)
	var cells_z: int = mini(CHUNK_CELLS, GRID_SEGMENTS - base_iz)
	if cells_x <= 0 or cells_z <= 0:
		return
	var origin_x: float = float(base_ix) * GRID_STEP - HALF_SIZE
	var origin_z: float = float(base_iz) * GRID_STEP - HALF_SIZE
	var vertices := PackedVector3Array()
	var normals := PackedVector3Array()
	var colors := PackedColorArray()
	var uvs := PackedVector2Array()
	var indices := PackedInt32Array()
	for j in range(cells_z + 1):
		for i in range(cells_x + 1):
			var ix: int = base_ix + i
			var iz: int = base_iz + j
			var x: float = origin_x + float(i) * GRID_STEP
			var z: float = origin_z + float(j) * GRID_STEP
			var h: float = _grid_height(ix, iz)
			vertices.append(Vector3(float(i) * GRID_STEP, h, float(j) * GRID_STEP))
			var left: float = _grid_height(ix - 1, iz)
			var right: float = _grid_height(ix + 1, iz)
			var back: float = _grid_height(ix, iz - 1)
			var front: float = _grid_height(ix, iz + 1)
			normals.append(Vector3(left - right, GRID_STEP * 2.0, back - front).normalized())
			var variation: float = (sin(x * 0.042 + z * 0.069) + cos(x * 0.14 - z * 0.04)) * 0.035
			var exposure: float = clampf(h / 35.0, 0.0, 1.0)
			colors.append(Color(0.73 + variation + exposure * 0.05, 0.70 + variation * 0.7 + exposure * 0.04, 0.79 + variation * 0.8 + exposure * 0.045))
			uvs.append(Vector2(x * 0.08, z * 0.08))
	for j in range(cells_z):
		for i in range(cells_x):
			var a: int = j * (cells_x + 1) + i
			var b: int = (j + 1) * (cells_x + 1) + i
			var d: int = a + 1
			var c: int = b + 1
			# Same diagonal as PlaneGeometry and legacyTerrainHeight().
			# Godot uses clockwise front faces, opposite Three.js winding.
			indices.append_array(PackedInt32Array([a, d, b, b, d, c]))
	_append_near_skirts(vertices, normals, colors, uvs, indices, cells_x, cells_z)
	var arrays: Array = []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_COLOR] = colors
	arrays[Mesh.ARRAY_TEX_UV] = uvs
	arrays[Mesh.ARRAY_INDEX] = indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	mesh.surface_set_material(0, _terrain_material)
	var chunk := Node3D.new()
	chunk.name = "Terrain_%d_%d" % [key.x, key.y]
	chunk.position = Vector3(origin_x, 0.0, origin_z)
	_terrain_root.add_child(chunk)
	var visual := MeshInstance3D.new()
	visual.name = "Basalt"
	visual.mesh = mesh
	visual.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	chunk.add_child(visual)
	var body := StaticBody3D.new()
	body.name = "TerrainCollision"
	body.collision_layer = 1
	body.collision_mask = 0
	body.add_to_group("native_terrain")
	chunk.add_child(body)
	var collider := CollisionShape3D.new()
	collider.shape = mesh.create_trimesh_shape()
	body.add_child(collider)
	_chunks[key] = chunk
	_set_far_mask(key, true)


func _append_near_skirts(vertices: PackedVector3Array, normals: PackedVector3Array, colors: PackedColorArray, uvs: PackedVector2Array, indices: PackedInt32Array, cells_x: int, cells_z: int) -> void:
	# The coarse far surface can be a little below the exact 10 m edge. These
	# downward mesh strips join it without adding gameplay collision geometry.
	for i in range(cells_x):
		_append_skirt_edge(vertices, normals, colors, uvs, indices, i, i + 1, Vector3(0, 0, -1))
		var south: int = cells_z * (cells_x + 1) + i
		_append_skirt_edge(vertices, normals, colors, uvs, indices, south, south + 1, Vector3(0, 0, 1))
	for j in range(cells_z):
		var west: int = j * (cells_x + 1)
		_append_skirt_edge(vertices, normals, colors, uvs, indices, west, west + cells_x + 1, Vector3(-1, 0, 0))
		var east: int = west + cells_x
		_append_skirt_edge(vertices, normals, colors, uvs, indices, east, east + cells_x + 1, Vector3(1, 0, 0))


func _append_skirt_edge(vertices: PackedVector3Array, normals: PackedVector3Array, colors: PackedColorArray, uvs: PackedVector2Array, indices: PackedInt32Array, first: int, second: int, side_normal: Vector3) -> void:
	var start: int = vertices.size()
	for source in [first, second]:
		vertices.append(vertices[source])
		normals.append(side_normal)
		colors.append(colors[source])
		uvs.append(uvs[source])
	for source in [first, second]:
		vertices.append(vertices[source] - Vector3(0.0, NEAR_SKIRT_DEPTH, 0.0))
		normals.append(side_normal)
		colors.append(colors[source])
		uvs.append(uvs[source])
	indices.append_array(PackedInt32Array([start, start + 1, start + 2, start + 1, start + 3, start + 2]))


func _setup_far_terrain() -> void:
	_far_mask_image = Image.create(CHUNK_COUNT, CHUNK_COUNT, false, Image.FORMAT_RGBA8)
	_far_mask_image.fill(Color(0.0, 0.0, 0.0, 1.0))
	_far_mask_texture = ImageTexture.create_from_image(_far_mask_image)
	var shader_material := ShaderMaterial.new()
	shader_material.resource_name = "Distant basin and near-chunk mask"
	shader_material.shader = load("res://assets/terrain/far_basin.gdshader") as Shader
	shader_material.set_shader_parameter("basalt_albedo", _terrain_material.albedo_texture)
	shader_material.set_shader_parameter("near_mask", _far_mask_texture)
	var vertices := PackedVector3Array()
	var normals := PackedVector3Array()
	var colors := PackedColorArray()
	var uvs := PackedVector2Array()
	var indices := PackedInt32Array()
	for j in range(FAR_SEGMENTS + 1):
		for i in range(FAR_SEGMENTS + 1):
			var ix: int = i * 4
			var iz: int = j * 4
			var x: float = -HALF_SIZE + float(i) * FAR_STEP
			var z: float = -HALF_SIZE + float(j) * FAR_STEP
			var h: float = _grid_height(ix, iz)
			vertices.append(Vector3(x, h - FAR_DROP, z))
			normals.append(Vector3(_grid_height(ix - 4, iz) - _grid_height(ix + 4, iz), FAR_STEP * 2.0, _grid_height(ix, iz - 4) - _grid_height(ix, iz + 4)).normalized())
			var variation: float = (sin(x * 0.042 + z * 0.069) + cos(x * 0.14 - z * 0.04)) * 0.035
			var exposure: float = clampf(h / 35.0, 0.0, 1.0)
			colors.append(Color(0.73 + variation + exposure * 0.05, 0.70 + variation * 0.7 + exposure * 0.04, 0.79 + variation * 0.8 + exposure * 0.045))
			uvs.append(Vector2(x * 0.08, z * 0.08))
	for j in range(FAR_SEGMENTS):
		for i in range(FAR_SEGMENTS):
			var a: int = j * (FAR_SEGMENTS + 1) + i
			var b: int = a + FAR_SEGMENTS + 1
			var d: int = a + 1
			var c: int = b + 1
			indices.append_array(PackedInt32Array([a, d, b, b, d, c]))
	var arrays: Array = []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_COLOR] = colors
	arrays[Mesh.ARRAY_TEX_UV] = uvs
	arrays[Mesh.ARRAY_INDEX] = indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	mesh.surface_set_material(0, shader_material)
	var visual := MeshInstance3D.new()
	visual.name = "SixKilometreFarBasin"
	visual.mesh = mesh
	visual.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_terrain_root.add_child(visual)


func _set_far_mask(key: Vector2i, loaded: bool) -> void:
	_far_mask_image.set_pixel(key.x, key.y, Color.WHITE if loaded else Color(0.0, 0.0, 0.0, 1.0))
	_far_mask_dirty = true


func _setup_sky_and_light() -> void:
	var environment := Environment.new()
	environment.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	# Intel UHD/OpenGL Compatibility rendered the procedural noise sky as
	# hard-edged shards. The panorama samples that same source algorithm once
	# offline, leaving a cheap texture lookup in the shipped game.
	var material := PanoramaSkyMaterial.new()
	material.panorama = load("res://assets/sky/legacy_purple_panorama.png") as Texture2D
	sky.sky_material = material
	environment.sky = sky
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	environment.reflected_light_source = Environment.REFLECTION_SOURCE_BG
	environment.fog_enabled = true
	environment.fog_light_color = Color(0.24, 0.15, 0.23)
	environment.fog_density = 0.0010
	environment.fog_sky_affect = 0.0
	var world_environment := WorldEnvironment.new()
	world_environment.name = "LunarPurpleSky"
	world_environment.environment = environment
	add_child(world_environment)
	var moonlight := DirectionalLight3D.new()
	moonlight.name = "Moonlight"
	moonlight.light_color = Color(0.93, 0.80, 0.85)
	moonlight.light_energy = 1.55
	moonlight.rotation_degrees = Vector3(-57.0, -28.0, 0.0)
	moonlight.shadow_enabled = true
	add_child(moonlight)
