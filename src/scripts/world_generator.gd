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
const NOISE_AMPLITUDE := 3.0     # Max terrain height from noise
const CRASH_RADIUS := 15.0       # Radius of center crater depression

# ---------------------------------------------------------------------------
# Signals
# ---------------------------------------------------------------------------
signal world_generated

# ---------------------------------------------------------------------------
# Public state
# ---------------------------------------------------------------------------
var base_position: Vector3 = Vector3.ZERO
var height_map: Dictionary = {}   # Vector2(x,z) -> float (surface Y)
var biome_map: Dictionary = {}    # Vector2(x,z) -> int (biome enum)

# ---------------------------------------------------------------------------
# Internal references
# ---------------------------------------------------------------------------
var _noise: Noise = null

# ---------------------------------------------------------------------------
# Scene paths
# ---------------------------------------------------------------------------
const RESOURCE_SCENE := preload("res://scenes/resource_node.tscn")
const BASE_POD_SCENE := preload("res://scenes/base_pod.tscn")
const SPORE_SCENE := preload("res://scenes/vfx_toxic_spores.tscn")
const GROUND_MATERIAL := preload("res://assets/ground_material.tres")
const ICE_CAVE_SCENE := preload("res://scenes/world/ice_cave_entrance.tscn")
const LAVA_FISSURE_SCENE := preload("res://scenes/world/lava_fissure_entrance.tscn")
const GRAVITY_WELL_SCENE := preload("res://scenes/world/gravity_well_entrance.tscn")
const CRASH_ZONE_SCENE := preload("res://scenes/world/crash_zone_entrance.tscn")


# ===========================================================================
# Lifecycle
# ===========================================================================

func _ready() -> void:
	# Load the world noise resource
	var noise_tex: NoiseTexture2D = load("res://assets/world_noise.tres")
	_noise = noise_tex.noise
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
	var scene: Node = get_tree().current_scene
	if not scene:
		push_error("WorldGenerator: no current scene to add terrain to.")
		return

	# 1. Terrain mesh
	var terrain_node := _build_terrain_node()
	scene.add_child(terrain_node)
	# Move terrain as last child so it renders behind everything
	scene.move_child(terrain_node, 0)

	# 2. Build lookup maps
	_build_maps()

	# 3. Resources
	_spawn_resources(scene)

	# 4. Base pod at origin
	_spawn_base_pod(scene)

	# 5. Toxic spore VFX
	_spawn_spores(scene)

	# 6. Zone entrances
	_spawn_zone_entrances(scene)

	print("WorldGenerator: world generated (100x100, %d vertices)." % (GRID_POINTS * GRID_POINTS))
	world_generated.emit()


# ===========================================================================
# Height helpers
# ===========================================================================

func _raw_height(x: float, z: float) -> float:
	## Noise height without any post-processing.
	var y := _noise.get_noise_2d(x, z) * NOISE_AMPLITUDE

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
	mesh_instance.material_override = GROUND_MATERIAL

	var mesh := _generate_terrain_mesh()
	mesh_instance.mesh = mesh

	# --- StaticBody3D for collision ---
	var static_body := StaticBody3D.new()
	static_body.name = "TerrainCollision"

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
		var node: Area3D = RESOURCE_SCENE.instantiate()
		node.resource_type = res_type
		node.amount = randi_range(1, 3)
		scene.add_child(node)
		node.global_position = Vector3(x, y + 0.25, z)
		placed += 1

	print("WorldGenerator: placed %d %s resources." % [count, res_type])


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
	## Place 12 spore emitters within the crash zone (radius 12 from center).
	const SPORE_RADIUS := 12.0
	for _i in range(12):
		var angle := randf() * TAU
		var dist := randf_range(2.0, SPORE_RADIUS)
		var x := cos(angle) * dist
		var z := sin(angle) * dist
		var y := _raw_height(x, z) + 1.5

		var spore := SPORE_SCENE.instantiate()
		scene.add_child(spore)
		spore.global_position = Vector3(x, y, z)

	print("WorldGenerator: 12 spore emitters placed in crash zone.")

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
