extends RefCounted
class_name AimTargeting

const TERRAIN_STEP := 0.35
const TERRAIN_BINARY_STEPS := 8
const WORLD_LIMIT := 50.0


func get_aim_ray(viewport: Viewport, max_distance: float) -> Dictionary:
	if not viewport:
		return {"valid": false}
	var camera := viewport.get_camera_3d()
	if not camera:
		return {"valid": false}
	var center := viewport.get_visible_rect().size * 0.5
	var origin := camera.project_ray_origin(center)
	var direction := camera.project_ray_normal(center).normalized()
	return {
		"valid": true,
		"origin": origin,
		"direction": direction,
		"end": origin + direction * max_distance,
	}


func get_terrain_aim_position(viewport: Viewport, max_distance: float,
		fallback_distance: float) -> Dictionary:
	var ray := get_aim_ray(viewport, max_distance)
	if not bool(ray.get("valid", false)):
		return {"valid": false, "position": Vector3.ZERO, "source": "none"}

	var origin: Vector3 = ray["origin"]
	var direction: Vector3 = ray["direction"]
	var hit := _find_terrain_hit(origin, direction, max_distance)
	if bool(hit.get("valid", false)):
		return hit

	var flat := Vector3(direction.x, 0.0, direction.z)
	if direction.y > 0.12 or flat.length() <= 0.01:
		return {
			"valid": false,
			"position": _snap_to_terrain(origin + flat.normalized() * fallback_distance),
			"source": "sky",
		}

	return {
		"valid": true,
		"position": _snap_to_terrain(origin + flat.normalized() * fallback_distance),
		"source": "horizon",
	}


func find_aimed_group(viewport: Viewport, tree: SceneTree, group_name: String,
		max_distance: float, radius: float, filter: Callable = Callable()) -> Node3D:
	if not tree:
		return null
	var nodes := tree.get_nodes_in_group(group_name)
	return find_aimed_node(viewport, nodes, max_distance, radius, filter)


func find_aimed_node(viewport: Viewport, nodes: Array, max_distance: float,
		radius: float, filter: Callable = Callable()) -> Node3D:
	var ray := get_aim_ray(viewport, max_distance)
	if not bool(ray.get("valid", false)):
		return null

	var origin: Vector3 = ray["origin"]
	var direction: Vector3 = ray["direction"]
	var best: Node3D = null
	var best_score := INF
	for item in nodes:
		var node := item as Node3D
		if not node or not is_instance_valid(node) or node.is_queued_for_deletion():
			continue
		if filter.is_valid() and not bool(filter.call(node)):
			continue
		var to_node := node.global_position - origin
		var along := to_node.dot(direction)
		if along < 0.15 or along > max_distance:
			continue
		var closest := origin + direction * along
		var aim_radius := radius + float(node.get_meta("aim_radius", 0.0))
		var miss_distance := closest.distance_to(node.global_position)
		if miss_distance > aim_radius:
			continue
		var score := along + miss_distance * 2.0
		if score < best_score:
			best_score = score
			best = node
	return best


func _find_terrain_hit(origin: Vector3, direction: Vector3,
		max_distance: float) -> Dictionary:
	if not WorldGenerator:
		return {"valid": false, "position": Vector3.ZERO, "source": "none"}

	var previous_t := 0.0
	var previous_above := _height_above_terrain(origin)
	var t := TERRAIN_STEP
	while t <= max_distance:
		var point := origin + direction * t
		if absf(point.x) > WORLD_LIMIT or absf(point.z) > WORLD_LIMIT:
			break
		var above := _height_above_terrain(point)
		if above <= 0.0 and previous_above >= 0.0:
			var low := previous_t
			var high := t
			for _i in range(TERRAIN_BINARY_STEPS):
				var mid := (low + high) * 0.5
				var mid_point := origin + direction * mid
				if _height_above_terrain(mid_point) <= 0.0:
					high = mid
				else:
					low = mid
			var hit_point := origin + direction * high
			return {
				"valid": true,
				"position": _snap_to_terrain(hit_point),
				"source": "terrain",
			}
		previous_t = t
		previous_above = above
		t += TERRAIN_STEP

	return {"valid": false, "position": Vector3.ZERO, "source": "none"}


func _height_above_terrain(point: Vector3) -> float:
	var terrain_y: float = WorldGenerator.get_height_at(Vector2(point.x, point.z))
	if is_inf(terrain_y) or is_nan(terrain_y):
		terrain_y = 0.0
	return point.y - clamp(terrain_y, -5.0, 15.0)


func _snap_to_terrain(point: Vector3) -> Vector3:
	var x: float = clampf(point.x, -WORLD_LIMIT, WORLD_LIMIT)
	var z: float = clampf(point.z, -WORLD_LIMIT, WORLD_LIMIT)
	var y: float = 0.0
	if WorldGenerator:
		y = clampf(WorldGenerator.get_height_at(Vector2(x, z)), -5.0, 15.0)
	return Vector3(x, y + 0.75, z)
