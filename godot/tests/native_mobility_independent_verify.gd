extends SceneTree

# Independent native mobility probe. Never loads or writes the normal player save.
const SLOT := "user://star_abyss_native_mobility_independent_verify.json"
var findings: Dictionary = {}


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var absolute_slot := ProjectSettings.globalize_path(SLOT)
	if FileAccess.file_exists(SLOT):
		DirAccess.remove_absolute(absolute_slot)
	var game := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = SLOT
	root.add_child(game)
	await physics_frame
	await physics_frame
	game.set_physics_process(false)
	game.beast.set_physics_process(false)
	var player := game.player
	player.set_physics_process(false)
	findings["camp_camera"] = _probe_camp_camera(game)
	findings["camp_walls"] = await _probe_camp_walls(game)
	findings["fast_flight_wall"] = await _probe_fast_flight_wall(game)
	findings["c2_mesh"] = _probe_mesh(game)
	findings["riftwing_mesh"] = _probe_riftwing(game)
	findings["riftwing_camera"] = _probe_riftwing_camera(game)
	findings["physics"] = await _probe_physics(game)
	findings["capture"] = _probe_capture(game)
	var failures: Array[String] = []
	var camp_camera: Dictionary = findings["camp_camera"]
	if int(camp_camera["desired_camera_camp_occlusions"]) < 1 or int(camp_camera["actual_camera_camp_occlusions"]) != 0 or int(camp_camera["actual_camera_inside_solid"]) != 0:
		failures.append("camp camera occlusion")
	var beast_camera: Dictionary = findings["riftwing_camera"]
	if int(beast_camera["camera_only_proxy_count"]) < 1 or int(beast_camera["desired_ray_hits_proxy"]) < 1 or int(beast_camera["actual_ray_hits_proxy"]) != 0 or int(beast_camera["actual_camera_inside_proxy"]) != 0:
		failures.append("Riftwing camera occlusion")
	var physics: Dictionary = findings["physics"]
	if not bool(physics["blocked_at_21"]) or not bool(physics["relaunched"]) or int(physics["held_g_launch_frame_at_21"]) < 0 or float(physics["at_40_near_command_wall"]["height_above_start"]) < 5.0:
		failures.append("flight landing and recovery")
	var fast_wall: Dictionary = findings["fast_flight_wall"]
	for case in fast_wall["cases"]:
		if bool(case["crossed_wall"]) or int(case["overlap_frames"]) > 0 or float(case["gap"]) < 0.35:
			failures.append("fast flight through " + str(case["side"]) + " wall")
	var c2_mesh: Dictionary = findings["c2_mesh"]
	for pose in ["ground_skinned_bounds", "hover_skinned_bounds", "boost_skinned_bounds"]:
		var bound: Dictionary = c2_mesh[pose]
		var extent: Array = bound["extent"]
		if int(bound["invalid"]) != 0 or int(bound["vertices"]) < 1000 or maxf(maxf(float(extent[0]), float(extent[1])), float(extent[2])) > 10.0:
			failures.append("C2 skin pose " + pose)
	var beast_mesh: Dictionary = findings["riftwing_mesh"]
	for clip in beast_mesh["sampled_animation_extents"].keys():
		var extent: Array = beast_mesh["sampled_animation_extents"][clip]
		if maxf(maxf(float(extent[0]), float(extent[1])), float(extent[2])) > 12.0:
			failures.append("Riftwing skin clip " + str(clip))
	findings["failures"] = failures
	print("NATIVE_MOBILITY_INDEPENDENT_JSON=" + JSON.stringify(findings))
	game.initialized = false
	game.queue_free()
	await process_frame
	if FileAccess.file_exists(SLOT):
		DirAccess.remove_absolute(absolute_slot)
	quit(0 if failures.is_empty() else 1)


func _probe_camp_camera(game: NativeMain) -> Dictionary:
	var player := game.player
	var pivot := player.get_node("CameraPivot") as Node3D
	var camera := player.get_node("CameraPivot/Camera3D") as Camera3D
	var tested := 0
	var occluded := 0
	var actual_occluded := 0
	var actual_inside := 0
	var best: Dictionary = {}
	for x in range(-32, 33):
		for z in range(155, 194):
			if (x + z) % 2 != 0:
				continue
			var floor_y := game.world.height_at(float(x), float(z))
			var foot := Vector3(float(x), floor_y, float(z))
			player.global_position = foot
			if not player._destination_clear(foot):
				continue
			for yaw in [0.0, PI * 0.5, PI, PI * 1.5]:
				player.rotation.y = yaw
				camera.position = Vector3(0.0, 1.25, 5.0)
				var query := PhysicsRayQueryParameters3D.create(pivot.global_position, camera.global_position)
				query.collision_mask = 1
				query.exclude = [player.get_rid()]
				var hit := player.get_world_3d().direct_space_state.intersect_ray(query)
				tested += 1
				if not hit.is_empty() and hit.get("collider") in game.camp._bodies:
					occluded += 1
					if best.is_empty():
						best = {"foot": [foot.x, foot.y, foot.z], "yaw": yaw, "pivot": [pivot.global_position.x, pivot.global_position.y, pivot.global_position.z], "camera": [camera.global_position.x, camera.global_position.y, camera.global_position.z], "hit": [hit["position"].x, hit["position"].y, hit["position"].z], "body": (hit["collider"] as Node).get_parent().name}
					player._update_visual(0.5)
					var actual_query := PhysicsRayQueryParameters3D.create(pivot.global_position, camera.global_position)
					actual_query.collision_mask = 1
					actual_query.exclude = [player.get_rid()]
					var actual_hit := player.get_world_3d().direct_space_state.intersect_ray(actual_query)
					if not actual_hit.is_empty() and actual_hit.get("collider") in game.camp._bodies:
						actual_occluded += 1
					var sphere := SphereShape3D.new()
					sphere.radius = 0.05
					var shape_query := PhysicsShapeQueryParameters3D.new()
					shape_query.shape = sphere
					shape_query.transform = Transform3D(Basis.IDENTITY, camera.global_position)
					shape_query.collision_mask = 1
					shape_query.exclude = [player.get_rid()]
					if not player.get_world_3d().direct_space_state.intersect_shape(shape_query, 1).is_empty():
						actual_inside += 1
	return {"tested_accessible_orientations": tested, "desired_camera_camp_occlusions": occluded, "actual_camera_camp_occlusions": actual_occluded, "actual_camera_inside_solid": actual_inside, "example": best}


func _probe_camp_walls(game: NativeMain) -> Dictionary:
	var player := game.player
	player.rotation.y = 0.0
	var cases: Array[Dictionary] = []
	for side in ["west", "east", "north", "south"]:
		for lateral in [-4.0, 0.0, 4.0]:
			var start := Vector3(-30.0, 1.0, 174.0 + lateral)
			var end := Vector3(-17.0, 1.0, 174.0 + lateral)
			if side == "east":
				start.x = -4.0
			elif side == "north":
				start = Vector3(-17.0 + lateral, 1.0, 160.0)
				end = Vector3(-17.0 + lateral, 1.0, 174.0)
			elif side == "south":
				start = Vector3(-17.0 + lateral, 1.0, 188.0)
				end = Vector3(-17.0 + lateral, 1.0, 174.0)
			var query := PhysicsRayQueryParameters3D.create(start, end)
			query.collision_mask = 1
			query.exclude = [player.get_rid()]
			var hit := player.get_world_3d().direct_space_state.intersect_ray(query)
			if hit.is_empty() or not hit.get("collider") in game.camp._bodies:
				continue
			var direction := (end - start).normalized()
			var hit_position: Vector3 = hit["position"]
			var foot := hit_position - direction * 2.5
			foot.y = game.world.height_at(foot.x, foot.z)
			if not player.teleport_to_ground(foot.x, foot.z):
				continue
			var start_foot := player.global_position
			var axes := Vector2(direction.x, -direction.z)
			var ever_inside := false
			var overlap_counts: Dictionary = {}
			var first_overlap: Dictionary = {}
			for frame in range(90):
				await physics_frame
				player._step_ground(1.0 / 60.0, axes, false, false)
				var overlaps := _player_shape_overlaps(player)
				if not overlaps.is_empty():
					ever_inside = true
					if first_overlap.is_empty():
						first_overlap = {"frame": frame, "position": [player.global_position.x, player.global_position.y, player.global_position.z], "colliders": overlaps}
					for collider in overlaps:
						overlap_counts[collider] = int(overlap_counts.get(collider, 0)) + 1
			var gap := (hit_position - player.global_position).dot(direction)
			cases.append({"side": side, "lateral": lateral, "hit": [hit_position.x, hit_position.y, hit_position.z], "start": [start_foot.x, start_foot.y, start_foot.z], "final": [player.global_position.x, player.global_position.y, player.global_position.z], "stop_gap": gap, "ever_inside": ever_inside, "overlap_counts": overlap_counts, "first_overlap": first_overlap})
			break
	return {"tested_sides": cases.size(), "cases": cases}


func _player_shape_overlaps(player: NativePlayer) -> Array[String]:
	var result: Array[String] = []
	var shape_node := player.get_node("CollisionShape3D") as CollisionShape3D
	var query := PhysicsShapeQueryParameters3D.new()
	query.shape = shape_node.shape
	query.transform = shape_node.global_transform.translated(Vector3.UP * 0.01)
	query.collision_mask = player.collision_mask
	query.exclude = [player.get_rid()]
	for hit in player.get_world_3d().direct_space_state.intersect_shape(query, 10):
		result.append(str((hit["collider"] as Node).get_path()))
	return result


func _probe_fast_flight_wall(game: NativeMain) -> Dictionary:
	var player := game.player
	var cases: Array[Dictionary] = []
	for side in ["west", "east"]:
		var start_x := -30.0 if side == "west" else -4.0
		var direction := 1.0 if side == "west" else -1.0
		var wall_x := -20.49 if side == "west" else -13.51
		var z := 174.0
		player.teleport_to_ground(start_x, z)
		player.global_position.y += NativePlayer.FLIGHT_CLEARANCE + 0.1
		player.flight_active = true
		player.energy = 100.0
		player.velocity = Vector3(direction * 500.0, 0.0, 0.0)
		player._vertical_speed = 0.0
		player.rotation.y = 0.0
		var furthest := player.global_position.x
		var overlaps := 0
		for frame in range(8):
			await physics_frame
			player._step_flight(1.0 / 60.0, Vector2(direction, 0.0), false, false, true, false)
			furthest = maxf(furthest, player.global_position.x) if direction > 0.0 else minf(furthest, player.global_position.x)
			if not _player_shape_overlaps(player).is_empty():
				overlaps += 1
		cases.append({"side": side, "furthest_x": furthest, "wall_x": wall_x, "gap": absf(furthest - wall_x), "crossed_wall": furthest * direction > wall_x * direction, "overlap_frames": overlaps, "end_y": player.global_position.y})
	return {"cases": cases}


func _probe_mesh(game: NativeMain) -> Dictionary:
	var root_model := game.player.get_node("Model") as Node3D
	var meshes: Array[MeshInstance3D] = []
	_collect_meshes(root_model, meshes)
	var entries: Array[Dictionary] = []
	for mesh in meshes:
		var bounds := mesh.get_aabb()
		entries.append({"name": str(mesh.get_path()), "aabb_center": [bounds.get_center().x, bounds.get_center().y, bounds.get_center().z], "aabb_size": [bounds.size.x, bounds.size.y, bounds.size.z], "surfaces": mesh.mesh.get_surface_count() if mesh.mesh != null else 0, "skin": mesh.skin != null})
	var player := game.player
	player.flight_active = false
	player.boosting = false
	player._update_visual(0.5)
	var ground_bounds := _skinned_bounds(meshes)
	player.flight_active = true
	player.boosting = false
	player._update_visual(0.5)
	var hover_bounds := _skinned_bounds(meshes)
	player.boosting = true
	player._update_visual(0.5)
	var boost_bounds := _skinned_bounds(meshes)
	return {"count": meshes.size(), "meshes": entries, "ground_skinned_bounds": ground_bounds, "hover_skinned_bounds": hover_bounds, "boost_skinned_bounds": boost_bounds}


func _skinned_bounds(meshes: Array[MeshInstance3D]) -> Dictionary:
	var low := Vector3(INF, INF, INF)
	var high := Vector3(-INF, -INF, -INF)
	var vertices := 0
	var invalid := 0
	for mesh in meshes:
		var skeleton := mesh.get_parent() as Skeleton3D
		var skin := mesh.skin
		if skeleton == null or skin == null or mesh.mesh == null:
			continue
		for surface in range(mesh.mesh.get_surface_count()):
			var arrays := mesh.mesh.surface_get_arrays(surface)
			var points: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
			var bones: PackedInt32Array = arrays[Mesh.ARRAY_BONES]
			var weights: PackedFloat32Array = arrays[Mesh.ARRAY_WEIGHTS]
			if points.is_empty() or bones.is_empty() or weights.is_empty():
				continue
			var influences := bones.size() / points.size()
			for vertex_index in range(points.size()):
				var point := Vector3.ZERO
				var weight_sum := 0.0
				for influence in range(influences):
					var flat_index := vertex_index * influences + influence
					var weight := weights[flat_index]
					if weight <= 0.0:
						continue
					var bind := bones[flat_index]
					if bind < 0 or bind >= skin.get_bind_count():
						invalid += 1
						continue
					var bone := skin.get_bind_bone(bind)
					if bone < 0:
						bone = skeleton.find_bone(skin.get_bind_name(bind))
					if bone < 0 or bone >= skeleton.get_bone_count():
						invalid += 1
						continue
					point += (skeleton.get_bone_global_pose(bone) * skin.get_bind_pose(bind) * points[vertex_index]) * weight
					weight_sum += weight
				if weight_sum <= 0.0 or not point.is_finite():
					invalid += 1
					continue
				vertices += 1
				low = low.min(point)
				high = high.max(point)
	return {"vertices": vertices, "invalid": invalid, "min": [low.x, low.y, low.z], "max": [high.x, high.y, high.z], "extent": [high.x - low.x, high.y - low.y, high.z - low.z]}


func _collect_meshes(node: Node, meshes: Array[MeshInstance3D]) -> void:
	if node is MeshInstance3D:
		meshes.append(node as MeshInstance3D)
	for child in node.get_children():
		_collect_meshes(child, meshes)


func _probe_riftwing(game: NativeMain) -> Dictionary:
	var beast := game.beast
	var meshes: Array[MeshInstance3D] = []
	_collect_meshes(beast.get_node("Model"), meshes)
	var low := Vector3(INF, INF, INF)
	var high := Vector3(-INF, -INF, -INF)
	var entries: Array[Dictionary] = []
	for mesh in meshes:
		var box := mesh.get_aabb()
		for corner in range(8):
			var point := beast.to_local(mesh.to_global(box.get_endpoint(corner)))
			low = low.min(point)
			high = high.max(point)
		entries.append({"name": str(mesh.name), "size": [box.size.x, box.size.y, box.size.z], "skin": mesh.skin != null})
	var collisions: Array[String] = []
	_collect_collision_objects(beast, collisions)
	var sampled_clips: Dictionary = {}
	var animation := beast.visual_animation
	if animation != null:
		for clip in animation.get_animation_list():
			if not (str(clip).ends_with("ground-idle") or str(clip).ends_with("ground-walk") or str(clip).ends_with("ground-claw") or str(clip).ends_with("flight") or str(clip).ends_with("dive") or str(clip).ends_with("sweep") or str(clip).ends_with("hit")):
				continue
			var resource := animation.get_animation(clip)
			var biggest := Vector3.ZERO
			for fraction in [0.0, 0.25, 0.5, 0.75, 0.99]:
				animation.play(clip)
				animation.seek(resource.length * fraction, true)
				animation.advance(0.0)
				var bounds := _skinned_bounds(meshes)
				var extent: Array = bounds["extent"]
				biggest = biggest.max(Vector3(float(extent[0]), float(extent[1]), float(extent[2])))
			sampled_clips[str(clip)] = [biggest.x, biggest.y, biggest.z]
	return {"home": [beast.global_position.x, beast.global_position.y, beast.global_position.z], "meshes": entries, "visual_local_min": [low.x, low.y, low.z], "visual_local_max": [high.x, high.y, high.z], "visual_local_extent": [high.x - low.x, high.y - low.y, high.z - low.z], "collision_objects": collisions, "skinned_bounds": _skinned_bounds(meshes), "sampled_animation_extents": sampled_clips}


func _collect_collision_objects(node: Node, result: Array[String]) -> void:
	if node is CollisionObject3D:
		result.append(str(node.get_path()) + " layer=" + str((node as CollisionObject3D).collision_layer))
	for child in node.get_children():
		_collect_collision_objects(child, result)


func _probe_riftwing_camera(game: NativeMain) -> Dictionary:
	var beast := game.beast
	var player := game.player
	var pivot := player.get_node("CameraPivot") as Node3D
	var camera := player.get_node("CameraPivot/Camera3D") as Camera3D
	var proxy_count := 0
	for child in beast.get_children():
		if child is CollisionObject3D and ((child as CollisionObject3D).collision_layer & 4) != 0:
			proxy_count += 1
	var desired_hits := 0
	var actual_hits := 0
	var actual_inside := 0
	var anchor_inside := 0
	var inside_anchor_camera_inside := 0
	var inside_anchor_example: Dictionary = {}
	var example: Dictionary = {}
	for dx in range(-6, 7):
		for dz in range(-6, 7):
			if dx * dx + dz * dz < 6 or (dx + dz) % 2 != 0:
				continue
			var x := beast.global_position.x + float(dx)
			var z := beast.global_position.z + float(dz)
			var foot := Vector3(x, game.world.height_at(x, z), z)
			player.global_position = foot
			if not player._destination_clear(foot):
				continue
			for yaw in [0.0, PI * 0.5, PI, PI * 1.5]:
				for pitch in [0.0, 0.3, -0.3]:
					player.rotation.y = yaw
					pivot.rotation.x = pitch
					camera.position = Vector3(0.0, 1.25, 5.0)
					var query := PhysicsRayQueryParameters3D.create(pivot.global_position, camera.global_position)
					query.collision_mask = 4
					query.exclude = [player.get_rid()]
					var hit := player.get_world_3d().direct_space_state.intersect_ray(query)
					var anchor_sphere := SphereShape3D.new()
					anchor_sphere.radius = 0.05
					var anchor_query := PhysicsShapeQueryParameters3D.new()
					anchor_query.shape = anchor_sphere
					anchor_query.transform = Transform3D(Basis.IDENTITY, pivot.global_position)
					anchor_query.collision_mask = 4
					anchor_query.exclude = [player.get_rid()]
					var starts_inside := not player.get_world_3d().direct_space_state.intersect_shape(anchor_query, 1).is_empty()
					if starts_inside:
						anchor_inside += 1
					if hit.is_empty() and not starts_inside:
						continue
					if not hit.is_empty():
						desired_hits += 1
					if example.is_empty() and not hit.is_empty():
						example = {"foot": [foot.x, foot.y, foot.z], "yaw": yaw, "pitch": pitch, "desired_camera": [camera.global_position.x, camera.global_position.y, camera.global_position.z], "hit": [hit["position"].x, hit["position"].y, hit["position"].z]}
					player._update_visual(0.5)
					var safe_query := PhysicsRayQueryParameters3D.create(pivot.global_position, camera.global_position)
					safe_query.collision_mask = 4
					safe_query.exclude = [player.get_rid()]
					if not player.get_world_3d().direct_space_state.intersect_ray(safe_query).is_empty():
						actual_hits += 1
					var sphere := SphereShape3D.new()
					sphere.radius = 0.05
					var shape_query := PhysicsShapeQueryParameters3D.new()
					shape_query.shape = sphere
					shape_query.transform = Transform3D(Basis.IDENTITY, camera.global_position)
					shape_query.collision_mask = 4
					shape_query.exclude = [player.get_rid()]
					if not player.get_world_3d().direct_space_state.intersect_shape(shape_query, 1).is_empty():
						actual_inside += 1
						if starts_inside:
							inside_anchor_camera_inside += 1
							if inside_anchor_example.is_empty():
								inside_anchor_example = {"foot": [foot.x, foot.y, foot.z], "yaw": yaw, "pitch": pitch, "anchor": [pivot.global_position.x, pivot.global_position.y, pivot.global_position.z], "actual_camera": [camera.global_position.x, camera.global_position.y, camera.global_position.z]}
	pivot.rotation.x = 0.0
	return {"camera_only_proxy_count": proxy_count, "desired_ray_hits_proxy": desired_hits, "actual_ray_hits_proxy": actual_hits, "actual_camera_inside_proxy": actual_inside, "anchor_inside_proxy_samples": anchor_inside, "inside_anchor_camera_inside": inside_anchor_camera_inside, "inside_anchor_example": inside_anchor_example, "example": example}


func _probe_physics(game: NativeMain) -> Dictionary:
	var player := game.player
	player.teleport_to_ground(-24.0, 174.0)
	var floor_y := player.global_position.y
	player.global_position.y += NativePlayer.FLIGHT_CLEARANCE
	player.flight_active = true
	player._vertical_speed = 8.0
	player.energy = 40.0
	player.velocity = Vector3.ZERO
	for i in range(40):
		await physics_frame
		player._step_flight(1.0 / 60.0, Vector2.ZERO, true, false, false, false)
	var after_40 := {"flight": player.flight_active, "height_above_start": player.global_position.y - floor_y, "energy": player.energy}
	player.teleport_to_ground(0.0, 190.0)
	player.energy = 21.0
	var blocked_at_21 := not player._try_takeoff(true, false)
	var launch_frame := -1
	for i in range(120):
		await physics_frame
		if player._try_takeoff(true, false):
			launch_frame = i
			player._step_flight(1.0 / 60.0, Vector2.ZERO, true, false, false, false)
			break
		player._step_ground(1.0 / 60.0, Vector2.ZERO, false, false)
	var recovered_energy := player.energy
	return {"at_40_near_command_wall": after_40, "blocked_at_21": blocked_at_21, "held_g_launch_frame_at_21": launch_frame, "energy_at_relaunch": recovered_energy, "relaunched": player.flight_active}


func _probe_capture(game: NativeMain) -> Dictionary:
	if DisplayServer.get_name() == "headless":
		return {"status": "headless renderer has no image; visible process deferred to avoid disrupting active play"}
	var example: Dictionary = findings["camp_camera"].get("example", {})
	if example.is_empty():
		return {"status": "no camera occlusion example"}
	var player := game.player
	var foot: Array = example["foot"]
	player.global_position = Vector3(float(foot[0]), float(foot[1]), float(foot[2]))
	player.rotation.y = float(example["yaw"])
	var camera := player.get_node("CameraPivot/Camera3D") as Camera3D
	camera.position = Vector3(0.0, 1.25, 5.0)
	var image := root.get_viewport().get_texture().get_image()
	if image == null:
		return {"status": "no image from headless renderer"}
	var path := "user://native_mobility_independent_camera.png"
	var error := image.save_png(path)
	return {"status": "saved" if error == OK else "save error", "path": ProjectSettings.globalize_path(path), "width": image.get_width(), "height": image.get_height(), "sample": image.get_pixel(image.get_width() / 2, image.get_height() / 2).to_html() if image.get_width() > 0 and image.get_height() > 0 else "none"}
