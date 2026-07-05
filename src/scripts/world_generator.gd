extends Node
## WorldGenerator — Autoload singleton for procedural terrain generation.
## Creates the 100×100 terrain from OpenSimplexNoise, biome map, resources,
## base pod placement, and toxic spore VFX at game start.

# ---------------------------------------------------------------------------
# Biome constants
# ---------------------------------------------------------------------------
const BIOME_CRASH := 0       # Toxic wasteland center
const BIOME_COLD := 1        # North frozen
const BIOME_HEAT := 2        # East volcanic
const BIOME_GRAVITY := 3     # South anomaly
const BIOME_CRASH_ZONE := 4  # West locked

# ---------------------------------------------------------------------------
# World dimensions
# ---------------------------------------------------------------------------
const WORLD_SIZE := 100          # Quads per side (100×100)
const GRID_POINTS := WORLD_SIZE + 1  # 101 vertices per side
const SPACING := 1.0             # Distance between vertices
const NOISE_AMPLITUDE := 10.0     # Max terrain height from noise (was 3.0, increased for visible hills)
const CRASH_RADIUS := 15.0       # Radius of center crater depression

# ---------------------------------------------------------------------------
# Signals
# ---------------------------------------------------------------------------
signal world_generated

# -----------------------------------------------------------------------
# Public state
# -----------------------------------------------------------------------
var base_position: Vector3 = Vector3.ZERO
var height_map: Dictionary = {}   # Vector2(x,z) -> float (surface Y)
var biome_map: Dictionary = {}    # Vector2(x,z) -> int (biome enum)
var _generated := false           # Guard: only generate once per session

# ---------------------------------------------------------------------------
# Internal references
# ---------------------------------------------------------------------------
var _noise: Noise = null

# ---------------------------------------------------------------------------
# Scene paths
# ---------------------------------------------------------------------------
const RESOURCE_SCENE := preload("res://scenes/resource_node.tscn")
const OXYGEN_PLANT_SCRIPT := preload("res://scripts/oxygen_plant.gd")
const BURIED_RESOURCE_SCRIPT := preload("res://scripts/buried_resource.gd")
const BASE_POD_SCENE := preload("res://scenes/base_pod.tscn")
const SPORE_SCENE := preload("res://scenes/vfx_toxic_spores.tscn")
var _GROUND_MATERIAL: StandardMaterial3D

func _create_ground_material() -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	# Unshaded = show albedo color directly without lighting
	# This avoids "Cannot find member SHADING_MODE_..." errors
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	# Alien rock — warm gray-brown, NOT purple
	mat.albedo_color = Color(0.32, 0.30, 0.26)
	mat.roughness = 0.92
	mat.metallic = 0.0
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	# vertex_color_use_as_albedo = true only needed when mesh has per-vertex color data
	# mat.vertex_color_use_as_albedo = true
	print("WorldGenerator: ground material ready (alien rock)")
	return mat
const ICE_CAVE_SCENE := preload("res://scenes/world/ice_cave_entrance.tscn")
const LAVA_FISSURE_SCENE := preload("res://scenes/world/lava_fissure_entrance.tscn")
const GRAVITY_WELL_SCENE := preload("res://scenes/world/gravity_well_entrance.tscn")
const CRASH_ZONE_SCENE := preload("res://scenes/world/crash_zone_entrance.tscn")


# ===========================================================================
# Lifecycle
# ===========================================================================

func _ready() -> void:
	print("WorldGenerator: _ready() started")
	# Load the world noise resource
	var noise_tex: NoiseTexture2D = load("res://assets/world_noise.tres")
	_noise = noise_tex.noise
	print("WorldGenerator: noise loaded, type=", _noise.noise_type if _noise else "NULL")
	# Create terrain material in code — no .tres file dependency
	_GROUND_MATERIAL = _create_ground_material()
	print("WorldGenerator: noise loaded, terrain material initialized")
	# Defer so scene tree is fully unlocked before any add_child()
	generate_world.call_deferred()


# ===========================================================================
# Public API
# ===========================================================================

func get_height_at(world_pos: Vector2) -> float:
	## Return the terrain surface Y at the given world XZ position.
	return _raw_height(world_pos.x, world_pos.y)


func get_biome_at(world_pos: Vector2) -> int:
	## Classify (x,z) into a biome.
	var dist := world_pos.length()

	if dist < CRASH_RADIUS:
		return BIOME_CRASH
	if world_pos.y > 20.0:
		return BIOME_COLD
	if world_pos.x > 20.0:
		return BIOME_HEAT
	if world_pos.y < -20.0:
		return BIOME_GRAVITY
	if world_pos.x < -20.0:
		return BIOME_CRASH_ZONE
	return BIOME_CRASH


func get_spawn_position(min_dist: float, max_dist: float) -> Vector3:
	## Return a random valid surface position within an annular range.
	for _attempt in range(100):
		var angle := randf() * TAU
		var dist := randf_range(min_dist, max_dist)
		var x := cos(angle) * dist
		var z := sin(angle) * dist
		var y := get_height_at(Vector2(x, z))
		return Vector3(x, y + 0.3, z)

	# Fallback
	return Vector3(randf_range(-WORLD_SIZE / 2.0, WORLD_SIZE / 2.0), 0.0,
			randf_range(-WORLD_SIZE / 2.0, WORLD_SIZE / 2.0))


# ===========================================================================
# World generation
# ===========================================================================

func generate_world() -> void:
	print("WorldGenerator: generate_world() called")
	if _generated:
		print("WorldGenerator: already generated (guard true), skipping.")
		return
	var scene: Node = get_tree().current_scene
	print("WorldGenerator: current_scene = ", scene)
	if not scene:
		push_error("WorldGenerator: no current scene to add terrain to.")
		return
	print("WorldGenerator: current_scene=%s" % scene.name)

	# 1. Terrain mesh
	print("WorldGenerator: BEFORE add_child terrain_node")
	var terrain_node := _build_terrain_node()
	print("WorldGenerator: terrain_node created, adding to scene")
	scene.add_child(terrain_node)
	print("WorldGenerator: AFTER add_child terrain_node, terrain_node.parent=%s" % terrain_node.get_parent().name if terrain_node.get_parent() else "NULL")
	# Move terrain as last child so it renders behind everything
	scene.move_child(terrain_node, 0)

	# 2. Build lookup maps
	_build_maps()

	# 3. Resources
	_spawn_resources(scene)
	_spawn_buried_resources(scene)
	_spawn_oxygen_plants(scene)

	# 4. Base pod at origin
	_spawn_base_pod(scene)

	# 5. Toxic spore VFX
	_spawn_spores(scene)

	# 6. Rock/debris scatter for terrain visual detail
	_spawn_rocks(scene)

	# 7. Zone entrances
	_spawn_zone_entrances(scene)

	print("WorldGenerator: world generated (100x100, %d vertices)." % (GRID_POINTS * GRID_POINTS))
	_generated = true
	world_generated.emit()


# ===========================================================================
# Height helpers
# ===========================================================================

func _raw_height(x: float, z: float) -> float:
	## Noise height without any post-processing.
	## TERRAIN SHIFT: Add 3.0 to move terrain from Y=[-3,0] to Y=[0,3]
	## This fixes camera near-plane clipping on orthogonal cameras in Godot 4.0.2
	if _noise == null:
		return 3.0
	var y := _noise.get_noise_2d(x, z) * NOISE_AMPLITUDE + 3.0

	# Crash-zone depression: height scales down toward center
	var dist := sqrt(x * x + z * z)
	if dist < CRASH_RADIUS:
		y *= dist / CRASH_RADIUS

	return y


# ===========================================================================
# Terrain mesh construction
# ===========================================================================

func _build_terrain_node() -> Node3D:
	var root := Node3D.new()
	root.name = "WorldTerrain"

	# --- MeshInstance3D ---
	var mesh_instance := MeshInstance3D.new()
	mesh_instance.name = "TerrainMesh"

	var mesh := _generate_terrain_mesh()
	mesh_instance.mesh = mesh

	# --- Terrain detail shader (procedural rock/dust/soil variation) ---
	var detail_shader := Shader.new()
	detail_shader.code = """
shader_type spatial;
render_mode unshaded, cull_disabled;

uniform vec4 base_color : source_color = vec4(0.32, 0.30, 0.26, 1.0);
uniform vec4 rock_color : source_color = vec4(0.18, 0.17, 0.16, 1.0);
uniform vec4 dust_color : source_color = vec4(0.48, 0.43, 0.36, 1.0);
uniform float uv_scale = 22.0;
uniform float detail_strength = 0.55;
uniform float roughness = 0.92;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
		mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
	float v = 0.0; float a = 0.5;
	for (int i = 0; i < 5; i++) { v += noise(p) * a; p *= 2.03; a *= 0.5; }
	return v;
}
void fragment() {
	vec2 uv = UV * uv_scale;
	float large = fbm(uv * 0.18);
	float mid = fbm(uv * 0.9);
	float fine = fbm(uv * 4.5);
	float cracks = smoothstep(0.46, 0.52, abs(fbm(uv * 1.7) - 0.5));
	float pebbles = smoothstep(0.72, 0.95, fine);
	vec3 col = base_color.rgb;
	col = mix(col, rock_color.rgb, large * 0.65);
	col = mix(col, dust_color.rgb, mid * 0.35);
	col *= 0.82 + fine * 0.34;
	col = mix(col, rock_color.rgb * 0.65, cracks * 0.42);
	col = mix(col, dust_color.rgb * 1.15, pebbles * 0.22);
	ALBEDO = col;
	ROUGHNESS = roughness;
	METALLIC = 0.0;
}
"""
	var detail_mat := ShaderMaterial.new()
	detail_mat.shader = detail_shader
	detail_mat.set_shader_parameter("base_color", Color(0.32, 0.30, 0.26))
	detail_mat.set_shader_parameter("rock_color", Color(0.18, 0.17, 0.16))
	detail_mat.set_shader_parameter("dust_color", Color(0.48, 0.43, 0.36))
	detail_mat.set_shader_parameter("uv_scale", 22.0)
	detail_mat.set_shader_parameter("roughness", 0.92)
	# TEMPORARILY DISABLED: material_override was causing all-gray terrain
	# likely due to fbm noise issue in Godot 4.6.2
	# mesh_instance.material_override = detail_mat

	# --- StaticBody3D for collision ---
	var static_body := StaticBody3D.new()
	static_body.name = "TerrainCollision"
	# Player movement follows the procedural height function directly.
	# Disabling mesh collision avoids invisible triangle-edge walls/sticking.
	static_body.collision_layer = 0
	static_body.collision_mask = 0

	var collision_shape := CollisionShape3D.new()
	collision_shape.name = "CollisionShape"
	collision_shape.shape = _build_collision_shape(mesh)

	static_body.add_child(collision_shape)
	root.add_child(mesh_instance)
	root.add_child(static_body)

	return root


func _generate_terrain_mesh() -> ArrayMesh:
	## Build a 101×101 vertex grid with Y from noise, return ArrayMesh.
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)

	# Add vertices row by row
	for jz in range(GRID_POINTS):
		for ix in range(GRID_POINTS):
			var x: float = (ix - WORLD_SIZE / 2.0) * SPACING
			var z: float = (jz - WORLD_SIZE / 2.0) * SPACING
			var y: float = _raw_height(x, z)
			# UV: tile the noise texture across the terrain (4 repeats per 100 units)
			st.set_uv(Vector2(ix * 0.04, jz * 0.04))
			st.add_vertex(Vector3(x, y, z))

	# Triangle indices
	var row_stride := GRID_POINTS
	for jz in range(WORLD_SIZE):
		for ix in range(WORLD_SIZE):
			var top_left := jz * row_stride + ix         # top-left
			var top_right := top_left + 1                 # top-right
			var bottom_left := (jz + 1) * row_stride + ix   # bottom-left
			var bottom_right := bottom_left + 1             # bottom-right
	
			# Triangle 1: TL → BL → TR
			st.add_index(top_left)
			st.add_index(bottom_left)
			st.add_index(top_right)
	
			# Triangle 2: TR → BL → BR
			st.add_index(top_right)
			st.add_index(bottom_left)
			st.add_index(bottom_right)

	st.generate_normals()

	var array_mesh := st.commit()
	# In Godot 4, ArrayMesh created via SurfaceTool.commit() has no material set.
	# We must set the material on the mesh surface explicitly, not rely on
	# material_override (which can fail to apply to ArrayMesh in some cases).
	array_mesh.surface_set_material(0, _GROUND_MATERIAL)
	return array_mesh


func _build_collision_shape(mesh: ArrayMesh) -> ConcavePolygonShape3D:
	## Extract faces from the generated ArrayMesh for collision.
	var arrays := mesh.surface_get_arrays(0)
	var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
	var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]

	var faces := PackedVector3Array()
	for i in range(0, indices.size(), 3):
		faces.append(vertices[indices[i]])
		faces.append(vertices[indices[i + 1]])
		faces.append(vertices[indices[i + 2]])

	var shape := ConcavePolygonShape3D.new()
	shape.set_faces(faces)
	return shape


# ===========================================================================
# Map builders
# ===========================================================================

func _build_maps() -> void:
	## Pre-compute height and biome for every integer grid position.
	var half := WORLD_SIZE / 2.0
	for x in range(-half, half + 1):
		for z in range(-half, half + 1):
			var v2 := Vector2(x, z)
			height_map[v2] = _raw_height(x, z)
			biome_map[v2] = get_biome_at(v2)


# ===========================================================================
# Resource placement
# ===========================================================================

func _spawn_resources(scene: Node) -> void:
	# Iron — 35 nodes, scattered across all biomes
	_spawn_resource_batch(scene, "iron", 35, func(_x: float, _z: float) -> bool:
		return true
	)

	# Void crystal — 18 nodes, weighted toward gravity biome (south z < -20)
	_spawn_resource_batch(scene, "void_crystal", 18, func(_x: float, _z: float) -> bool:
		return randf() < 0.7 or _z < -20.0
	)

	# Biomass — 18 nodes, weighted toward cold biome (north z > 20)
	_spawn_resource_batch(scene, "biomass", 18, func(_x: float, _z: float) -> bool:
		return randf() < 0.7 or _z > 20.0
	)

	# Energy core — 6 nodes, near heat biome (east x > 20)
	_spawn_resource_batch(scene, "energy_core", 6, func(_x: float, _z: float) -> bool:
		return randf() < 0.7 or _x > 15.0
	)

	# Blueprint data chips: fixed early teaching pickups close enough to see.
	_spawn_teaching_blueprint_chips(scene)


func _spawn_buried_resources(scene: Node) -> void:
	_spawn_buried_resource_batch(scene, "iron", 14, func(x: float, z: float) -> bool:
		var dist := Vector2(x, z).length()
		return dist > 7.0 and dist < 38.0
	)
	_spawn_buried_resource_batch(scene, "void_crystal", 8, func(x: float, z: float) -> bool:
		return z < -12.0 or randf() < 0.45
	)
	_spawn_buried_resource_batch(scene, "biomass", 8, func(x: float, z: float) -> bool:
		return z > 12.0 or randf() < 0.45
	)
	_spawn_buried_resource_batch(scene, "energy_core", 4, func(x: float, z: float) -> bool:
		return x > 12.0 or randf() < 0.35
	)


func _spawn_resource_batch(scene: Node, res_type: String, count: int,
		accept: Callable) -> void:
	## Spawn `count` resource nodes of `res_type`, using `accept(x,z)` as a
	## placement filter.
	var half := WORLD_SIZE / 2.0
	var placed := 0
	var max_attempts := count * 20

	for _attempt in range(max_attempts):
		if placed >= count:
			break

		var x := randf_range(-half, half)
		var z := randf_range(-half, half)

		if not accept.call(x, z):
			continue

		var y := _raw_height(x, z)
		var node = RESOURCE_SCENE.instantiate()
		if node:
			node.resource_type = res_type
			node.amount = 1 if res_type == "blueprint" else randi_range(1, 3)
			scene.add_child(node)
			node.global_position = Vector3(x, y + 0.04, z)
			placed += 1

	print("WorldGenerator: placed %d %s resources." % [placed, res_type])


func _spawn_teaching_blueprint_chips(scene: Node) -> void:
	# 教学 blueprint 芯片：1 个近距引导 + 4 个分散到 18-32m 不同方向，
	# 避免玩家开局在基地半径内一次性捡到一堆图纸。
	var positions: Array[Vector2] = [
		Vector2(9.0, 7.0),     # 近距引导，基地半径外缘
		Vector2(18.0, -12.0),  # 东偏南
		Vector2(-20.0, 10.0),  # 西偏北
		Vector2(-14.0, -22.0), # 西偏南
		Vector2(24.0, 18.0),   # 东偏北，稍远
	]
	var placed := 0
	for pos in positions:
		var node = RESOURCE_SCENE.instantiate()
		if not node:
			continue
		node.resource_type = "blueprint"
		node.amount = 1
		scene.add_child(node)
		node.global_position = Vector3(pos.x, _raw_height(pos.x, pos.y) + 0.04, pos.y)
		placed += 1
	print("WorldGenerator: placed %d blueprint resources." % placed)


func _spawn_buried_resource_batch(scene: Node, res_type: String, count: int,
		accept: Callable) -> void:
	var half := WORLD_SIZE / 2.0 - 4.0
	var placed := 0
	var max_attempts := count * 30

	for _attempt in range(max_attempts):
		if placed >= count:
			break

		var x := randf_range(-half, half)
		var z := randf_range(-half, half)
		if not accept.call(x, z):
			continue
		if Vector2(x, z).length() < 6.0:
			continue

		var y := _raw_height(x, z)
		var buried = BURIED_RESOURCE_SCRIPT.new()
		buried.resource_type = res_type
		buried.depth = randf_range(0.8, 2.6)
		buried.dig_required = _dig_required_for_depth(buried.depth)
		buried.amount = _buried_amount_for_type(res_type)
		scene.add_child(buried)
		buried.global_position = Vector3(x, y + 0.03, z)
		placed += 1

	print("WorldGenerator: placed %d buried %s resources." % [placed, res_type])


func _dig_required_for_depth(depth: float) -> int:
	if depth >= 2.1:
		return 4
	if depth >= 1.4:
		return 3
	return 2


func _buried_amount_for_type(res_type: String) -> int:
	if res_type == "iron":
		return randi_range(3, 6)
	if res_type == "biomass":
		return randi_range(2, 5)
	if res_type == "energy_core":
		return 1
	return randi_range(2, 4)


# ---------------------------------------------------------------------------
# Daily buried resource refresh
# ---------------------------------------------------------------------------
const MAX_BURIED_RESOURCES := 60
const DAILY_BURIED_MIN := 2
const DAILY_BURIED_MAX := 3
const DAILY_BURIED_BASE_DIST := 25.0
const DAILY_BURIED_SPACING := 8.0

const MAX_VISIBLE_RESOURCES := 90
const DAILY_VISIBLE_MIN := 3
const DAILY_VISIBLE_MAX := 3
const DAILY_VISIBLE_BASE_DIST := 25.0
const DAILY_VISIBLE_SPACING := 8.0


func spawn_daily_resources(day: int) -> void:
	## Spawn 3 new visible resource nodes each dawn, away from base and
	## existing nodes. Resource type is weighted by game day. Cap at
	## MAX_VISIBLE_RESOURCES to avoid bloat.
	if not get_tree() or not get_tree().current_scene:
		return
	if _noise == null:
		# World not fully initialized yet (e.g. autoload _ready race).
		return
	var scene := get_tree().current_scene
	var existing := get_tree().get_nodes_in_group("resource_nodes")
	if existing.size() >= MAX_VISIBLE_RESOURCES:
		print("WorldGenerator: daily visible refresh skipped — cap reached (%d)." % existing.size())
		return

	var to_spawn := randi_range(DAILY_VISIBLE_MIN, DAILY_VISIBLE_MAX)
	var placed := 0
	var half := WORLD_SIZE / 2.0 - 4.0
	# Tighter spacing first; relax if we can't find a slot.
	for spacing_mult in [1.0, 0.5]:
		var spacing: float = DAILY_VISIBLE_SPACING * float(spacing_mult)
		var attempts: int = 20 if spacing_mult > 0.5 else 10
		for _attempt in range(attempts):
			if placed >= to_spawn:
				break
			if existing.size() + placed >= MAX_VISIBLE_RESOURCES:
				break
			var x := randf_range(-half, half)
			var z := randf_range(-half, half)
			if Vector2(x, z).length() < DAILY_VISIBLE_BASE_DIST:
				continue
			if not _is_visible_slot_valid(x, z, existing, spacing):
				continue
			var res_type := _daily_visible_type(day)
			var y := _raw_height(x, z)
			var node = RESOURCE_SCENE.instantiate()
			if node:
				node.resource_type = res_type
				node.amount = 1 if res_type == "blueprint" else randi_range(1, 3)
				scene.add_child(node)
				node.global_position = Vector3(x, y + 0.04, z)
				existing.append(node)
				placed += 1
		if placed >= to_spawn:
			break
	print("WorldGenerator: daily visible refresh day %d placed %d nodes." % [day, placed])


func _is_visible_slot_valid(x: float, z: float, existing: Array, spacing: float) -> bool:
	var pos2 := Vector2(x, z)
	for node in existing:
		if not is_instance_valid(node):
			continue
		var n := node as Node3D
		if not n:
			continue
		if Vector2(n.global_position.x, n.global_position.z).distance_to(pos2) < spacing:
			return false
	# Also avoid overlapping buried resources.
	for res in get_tree().get_nodes_in_group("buried_resources"):
		if not is_instance_valid(res):
			continue
		var r := res as Node3D
		if r and Vector2(r.global_position.x, r.global_position.z).distance_to(pos2) < spacing * 0.6:
			return false
	return true


func _daily_visible_type(day: int) -> String:
	## Weighted visible resource type by game day.
	var roll := randf()
	if day <= 2:
		# 60% iron, 25% biomass, 15% void_crystal
		if roll < 0.6:
			return "iron"
		if roll < 0.85:
			return "biomass"
		return "void_crystal"
	elif day <= 4:
		# 35% iron, 30% void_crystal, 25% biomass, 10% energy_core
		if roll < 0.35:
			return "iron"
		if roll < 0.65:
			return "void_crystal"
		if roll < 0.9:
			return "biomass"
		return "energy_core"
	else:
		# 25% void_crystal, 25% energy_core, 25% iron, 15% biomass, 10% blueprint
		if roll < 0.25:
			return "void_crystal"
		if roll < 0.5:
			return "energy_core"
		if roll < 0.75:
			return "iron"
		if roll < 0.9:
			return "biomass"
		return "blueprint"


func spawn_daily_buried(day: int) -> void:
	## Spawn 2-3 new buried resource nodes each dawn, away from base and
	## existing nodes. Resource type is weighted by game day so later days
	## favor rarer resources. Cap at MAX_BURIED_RESOURCES to avoid bloat.
	if not get_tree() or not get_tree().current_scene:
		return
	if _noise == null:
		# World not fully initialized yet (e.g. autoload _ready race).
		return
	var scene := get_tree().current_scene
	var existing := get_tree().get_nodes_in_group("buried_resources")
	if existing.size() >= MAX_BURIED_RESOURCES:
		print("WorldGenerator: daily buried refresh skipped — cap reached (%d)." % existing.size())
		return

	var to_spawn := randi_range(DAILY_BURIED_MIN, DAILY_BURIED_MAX)
	var placed := 0
	var half := WORLD_SIZE / 2.0 - 4.0
	# Tighter spacing first; relax if we can't find a slot.
	for spacing_mult in [1.0, 0.5]:
		var spacing: float = DAILY_BURIED_SPACING * float(spacing_mult)
		var attempts: int = 20 if spacing_mult > 0.5 else 10
		for _attempt in range(attempts):
			if placed >= to_spawn:
				break
			if existing.size() + placed >= MAX_BURIED_RESOURCES:
				break
			var x := randf_range(-half, half)
			var z := randf_range(-half, half)
			if Vector2(x, z).length() < DAILY_BURIED_BASE_DIST:
				continue
			if not _is_buried_slot_valid(x, z, existing, spacing):
				continue
			var res_type := _daily_buried_type(day)
			var y := _raw_height(x, z)
			var buried = BURIED_RESOURCE_SCRIPT.new()
			buried.resource_type = res_type
			buried.depth = randf_range(0.8, 2.6)
			buried.dig_required = _dig_required_for_depth(buried.depth)
			buried.amount = _buried_amount_for_type(res_type)
			scene.add_child(buried)
			buried.global_position = Vector3(x, y + 0.03, z)
			existing.append(buried)
			placed += 1
		if placed >= to_spawn:
			break
	print("WorldGenerator: daily buried refresh day %d placed %d nodes." % [day, placed])


func _is_buried_slot_valid(x: float, z: float, existing: Array, spacing: float) -> bool:
	var pos2 := Vector2(x, z)
	for node in existing:
		if not is_instance_valid(node):
			continue
		var n := node as Node3D
		if not n:
			continue
		if Vector2(n.global_position.x, n.global_position.z).distance_to(pos2) < spacing:
			return false
	# Also avoid overlapping visible resources.
	for res in get_tree().get_nodes_in_group("resource_nodes"):
		if not is_instance_valid(res):
			continue
		var r := res as Node3D
		if r and Vector2(r.global_position.x, r.global_position.z).distance_to(pos2) < spacing * 0.6:
			return false
	return true


func _daily_buried_type(day: int) -> String:
	## Weighted resource type by game day.
	var roll := randf()
	if day <= 2:
		# 70% iron, 20% biomass, 10% void_crystal
		if roll < 0.7:
			return "iron"
		if roll < 0.9:
			return "biomass"
		return "void_crystal"
	elif day <= 4:
		# 40% iron, 30% void_crystal, 20% energy_core, 10% biomass
		if roll < 0.4:
			return "iron"
		if roll < 0.7:
			return "void_crystal"
		if roll < 0.9:
			return "energy_core"
		return "biomass"
	else:
		# 30% void_crystal, 30% energy_core, 20% blueprint, 20% iron
		if roll < 0.3:
			return "void_crystal"
		if roll < 0.6:
			return "energy_core"
		if roll < 0.8:
			return "blueprint"
		return "iron"


func _spawn_oxygen_plants(scene: Node) -> void:
	const PLANT_COUNT := 14
	var half := WORLD_SIZE / 2.0 - 6.0
	var placed := 0
	var max_attempts := PLANT_COUNT * 25
	for _attempt in range(max_attempts):
		if placed >= PLANT_COUNT:
			break
		var x := randf_range(-half, half)
		var z := randf_range(-half, half)
		if Vector2(x, z).length() < 10.0:
			continue
		var plant := OXYGEN_PLANT_SCRIPT.new()
		scene.add_child(plant)
		plant.global_position = Vector3(x, _raw_height(x, z) + 0.15, z)
		placed += 1
	print("WorldGenerator: placed %d oxygen plants." % placed)


# ===========================================================================
# Base pod placement
# ===========================================================================

func _spawn_base_pod(scene: Node) -> void:
	var h := _raw_height(0.0, 0.0)
	var pod := BASE_POD_SCENE.instantiate()
	scene.add_child(pod)
	pod.global_position = Vector3(0.0, h + 0.1, 0.0)
	base_position = pod.global_position
	print("WorldGenerator: base pod placed at %s." % base_position)


# ===========================================================================
# Toxic spore VFX
# ===========================================================================

func _spawn_spores(scene: Node) -> void:
	## Place 4 spore emitters within the crash zone (reduced from 12).
	const SPORE_RADIUS := 12.0
	for _i in range(4):
		var angle := randf() * TAU
		var dist := randf_range(2.0, SPORE_RADIUS)
		var x := cos(angle) * dist
		var z := sin(angle) * dist
		var y := _raw_height(x, z) + 1.5

		var spore := SPORE_SCENE.instantiate()
		scene.add_child(spore)
		spore.global_position = Vector3(x, y, z)

	print("WorldGenerator: 4 spore emitters placed in crash zone.")


func _spawn_rocks(scene: Node) -> void:
	## Scatter 60 rock/debris meshes across the terrain for visual detail.
	## Plus 40 small debris pieces at varying heights for terrain unevenness effect.
	var rock_materials = [
		_create_rock_material(Color(0.35, 0.28, 0.22)),
		_create_rock_material(Color(0.42, 0.34, 0.25)),
		_create_rock_material(Color(0.28, 0.22, 0.18)),
	]
	var half := WORLD_SIZE / 2.0 - 5.0
	var placed := 0
	const ROCK_COUNT := 60

	while placed < ROCK_COUNT:
		var x := randf_range(-half, half)
		var z := randf_range(-half, half)
		# Skip near center (crash zone)
		if sqrt(x*x + z*z) < 5.0:
			continue

		var y := _raw_height(x, z)

		var rock := MeshInstance3D.new()
		rock.name = "Rock_%d" % placed
		# Use random non-uniform scale to make rocks look varied
		var scale_vec := Vector3(
			randf_range(0.3, 1.2),
			randf_range(0.2, 0.8),
			randf_range(0.3, 1.2)
		)
		rock.scale = scale_vec
		rock.position = Vector3(x, y + scale_vec.y * 0.3, z)

		# Create sphere mesh for rock
		var sphere_mesh := SphereMesh.new()
		sphere_mesh.radius = 0.5
		sphere_mesh.height = 1.0
		rock.mesh = sphere_mesh
		rock.material_override = rock_materials[randi() % rock_materials.size()]

		scene.add_child(rock)
		placed += 1

	print("WorldGenerator: %d rocks scattered across terrain." % placed)

	# Spawn additional small debris at varying heights for terrain unevenness
	_spawn_debris_layer(scene)


func _spawn_debris_layer(scene: Node) -> void:
	## Scatter 40 small debris pieces on the ground so they do not read as airborne pickups.
	const DEBRIS_COUNT := 40
	var half := WORLD_SIZE / 2.0 - 3.0
	var placed := 0
	# Use same color palette as rocks for visual consistency
	var debris_materials = [
		_create_rock_material(Color(0.35, 0.28, 0.22)),
		_create_rock_material(Color(0.42, 0.34, 0.25)),
		_create_rock_material(Color(0.28, 0.22, 0.18)),
	]

	while placed < DEBRIS_COUNT:
		var x := randf_range(-half, half)
		var z := randf_range(-half, half)
		# Skip near center (crash zone)
		if sqrt(x*x + z*z) < 4.0:
			continue

		var terrain_y := _raw_height(x, z)
		var debris := MeshInstance3D.new()
		debris.name = "Debris_%d" % placed
		var scale_vec := Vector3(
			randf_range(0.08, 0.25),
			randf_range(0.05, 0.15),
			randf_range(0.08, 0.25)
		)
		debris.scale = scale_vec
		debris.position = Vector3(x, terrain_y + scale_vec.y * 0.12, z)

		# Use small box mesh for angular debris
		var box_mesh := BoxMesh.new()
		box_mesh.size = Vector3(1.0, 1.0, 1.0)
		debris.mesh = box_mesh
		debris.material_override = debris_materials[randi() % debris_materials.size()]

		scene.add_child(debris)
		placed += 1

	print("WorldGenerator: %d debris pieces added at varying heights." % placed)


func _create_rock_material(color: Color) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	# Slightly metallic for alien rock that catches directional light
	mat.metallic = 0.3
	mat.roughness = 0.7
	return mat

# ===========================================================================
# Zone entrance placement
# ===========================================================================

func _spawn_zone_entrances(scene: Node) -> void:
	# Register each entrance with TeleportManager so T-key teleport works.
	var z_positions: Array[Dictionary] = [
		{ "scene": ICE_CAVE_SCENE,    "pos": Vector3(0, 0, 25), "zone": "极寒区" },
		{ "scene": LAVA_FISSURE_SCENE, "pos": Vector3(25, 0, 0), "zone": "熔岩区" },
		{ "scene": GRAVITY_WELL_SCENE, "pos": Vector3(0, 0, -25), "zone": "重力异常区" },
		{ "scene": CRASH_ZONE_SCENE,   "pos": Vector3(-25, 0, 0), "zone": "Crash Zone" },
	]
	for entry in z_positions:
		var pos: Vector3 = entry["pos"]
		var h := _raw_height(pos.x, pos.z)
		var entrance: Node3D = entry["scene"].instantiate()
		scene.add_child(entrance)
		entrance.global_position = Vector3(pos.x, h, pos.z)
		# TeleportManager lives in main.tscn, not as an autoload — find it via scene tree
		var tm = scene.get_node_or_null("TeleportManager")
		if tm:
			tm.register_beacon(entrance, entry["zone"])

	print("WorldGenerator: 4 zone entrances placed.")
