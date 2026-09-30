extends Node3D
class_name NativeCamp

## Places the three original camp-v2 authored GLBs. Visual meshes also provide
## exact concave static collision; no box proxy spans the open entrances.

const BUILDINGS := [
	{"id": "command", "path": "res://assets/camp-v2/command.glb", "x": -17.0, "z": 174.0, "yaw": 0.0},
	{"id": "medical", "path": "res://assets/camp-v2/medical.glb", "x": 4.0, "z": 174.0, "yaw": 0.0},
	{"id": "workshop", "path": "res://assets/camp-v2/workshop.glb", "x": 20.0, "z": 174.0, "yaw": 0.0},
]

@export_flags_3d_physics var solid_collision_layer: int = 1

var _buildings: Dictionary = {}
var _bodies: Array[StaticBody3D] = []
var _initialized: bool = false


func setup_camp(world: NativeWorld) -> bool:
	if _initialized:
		return true
	if world == null:
		push_error("NativeCamp requires NativeWorld")
		return false
	var loaded: Array[Dictionary] = []
	for definition in BUILDINGS:
		var scene := load(definition["path"] as String) as PackedScene
		if scene == null:
			push_error("Camp model failed to import: " + (definition["path"] as String))
			return false
		loaded.append({"definition": definition, "scene": scene})
	for entry in loaded:
		var definition: Dictionary = entry["definition"]
		var placed := Node3D.new()
		placed.name = "Camp_" + (definition["id"] as String)
		placed.rotation.y = float(definition["yaw"])
		add_child(placed)
		var model := (entry["scene"] as PackedScene).instantiate() as Node3D
		if model == null:
			push_error("Camp GLB root is not Node3D: " + (definition["id"] as String))
			placed.free()
			_clear_partial()
			return false
		placed.add_child(model)
		var meshes: Array[MeshInstance3D] = []
		_collect_meshes(model, meshes)
		if meshes.is_empty():
			push_error("Camp GLB has no mesh: " + (definition["id"] as String))
			placed.free()
			_clear_partial()
			return false
		var bottom: float = INF
		for visual in meshes:
			var bounds: AABB = visual.get_aabb()
			for corner in range(8):
				bottom = minf(bottom, placed.to_local(visual.to_global(bounds.get_endpoint(corner))).y)
		placed.position = Vector3(float(definition["x"]), world.height_at(float(definition["x"]), float(definition["z"])) - bottom, float(definition["z"]))
		var body := StaticBody3D.new()
		body.name = "AuthoredMeshCollision"
		body.collision_layer = solid_collision_layer
		body.collision_mask = 0
		placed.add_child(body)
		var shapes: int = 0
		for visual in meshes:
			if visual.mesh == null or visual.mesh.get_surface_count() == 0:
				continue
			var shape := visual.mesh.create_trimesh_shape()
			if shape == null:
				continue
			var collider := CollisionShape3D.new()
			collider.name = "MeshTriangles_%d" % shapes
			collider.shape = shape
			body.add_child(collider)
			collider.global_transform = visual.global_transform
			shapes += 1
		if shapes == 0:
			push_error("Camp GLB has no collision triangles: " + (definition["id"] as String))
			placed.free()
			_clear_partial()
			return false
		_bodies.append(body)
		_buildings[definition["id"]] = placed
	_initialized = true
	return true


func building(id: String) -> Node3D:
	return _buildings.get(id) as Node3D


func building_count() -> int:
	return _buildings.size()


func support_height_at(x: float, z: float, max_y: float) -> float:
	# The caller caps step-up by passing its feet height plus the allowed step.
	# Ray intersection comes from the rendered GLB triangles, like the browser
	# camp Octree. -INF tells the caller to use ordinary terrain support.
	if not _initialized or not visible or is_nan(max_y) or is_inf(max_y):
		return -INF
	var start := Vector3(x, max_y + 0.001, z)
	var query := PhysicsRayQueryParameters3D.create(start, Vector3(x, max_y - 20.0, z))
	query.collision_mask = solid_collision_layer
	var hit := get_world_3d().direct_space_state.intersect_ray(query)
	if hit.is_empty() or not _bodies.has(hit.get("collider")):
		return -INF
	return (hit["position"] as Vector3).y


func set_enabled(enabled: bool) -> void:
	visible = enabled
	for body in _bodies:
		body.collision_layer = solid_collision_layer if enabled else 0


func _collect_meshes(node: Node, meshes: Array[MeshInstance3D]) -> void:
	if node is MeshInstance3D:
		meshes.append(node as MeshInstance3D)
	for child in node.get_children():
		_collect_meshes(child, meshes)


func _clear_partial() -> void:
	for placed in _buildings.values():
		(placed as Node3D).free()
	_buildings.clear()
	_bodies.clear()
