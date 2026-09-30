extends Node3D
class_name NativeWorld

signal origin_shifted(delta: Vector3, revision: int)
signal surface_deformation_committed(result: Dictionary)

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
const LEGACY_TERRAIN_QUERY_LAYER: int = 32

var planet_enabled: bool = true
var planet_radius: float = 120000.0
# The fixed scene bridge remains centimetre-accurate over this 120 km world.
# Canonical saves never depend on a render shift. Reserved for a coordinated
# whole-scene rebase if a future orbit precision test warrants it.
var origin_revision: int = 0

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
var _height_mutex := Mutex.new()
var _chunks: Dictionary = {}
var _requested: Dictionary = {}
var _pending: Array[Vector2i] = []
var _legacy_route_pins: Dictionary = {}
var _legacy_landing_pins: Dictionary = {}
var _landing_ticket: Dictionary = {}
var _landing_cast_id: String = ""
var _landing_source := Vector3.ZERO
var _landing_expiry: int = 0
var _landing_serial: int = 0
var _deformation_revision: int = 0
var _deformations := NativeSurfaceDeformation.new()
var _impact_worker: Thread
var _impact_job: Dictionary = {}
var _stream_center := Vector2i(-1, -1)
var _terrain_root: Node3D
var _terrain_material: StandardMaterial3D
var _near_terrain_material: ShaderMaterial
var _far_mask_image: Image
var _far_mask_texture: ImageTexture
var _far_mask_dirty: bool = false
var _far_basin_visual: MeshInstance3D
var _far_basin_arrays: Array = []
var _far_basin_base_vertices := PackedVector3Array()
var _far_basin_edge_ids := PackedInt32Array()
var _basin_seam_signature: String = ""
var _initialized: bool = false
var _planet: NativePlanet
var _planet_ecology: NativePlanetEcology
var _planet_regions: Node3D
var _environment: Environment
var _fog_mode: int = -1


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
	_near_terrain_material = ShaderMaterial.new()
	_near_terrain_material.resource_name = "Basin near terrain and high-altitude skirt mask"
	_near_terrain_material.shader = load("res://assets/terrain/basin_near_surface.gdshader") as Shader
	_near_terrain_material.set_shader_parameter("basalt_albedo", _terrain_material.albedo_texture)
	_setup_far_terrain()
	_setup_sky_and_light()
	_planet = NativePlanet.new()
	_planet.name = "ContinuousPlanet"
	add_child(_planet)
	_planet.setup_world(self)
	_planet.field.deformations = _deformations
	_planet_ecology = NativePlanetEcology.new()
	_planet_ecology.name = "PlanetEcology"
	add_child(_planet_ecology)
	_planet_ecology.setup(_planet)
	if _planet_ecology.damage_service != null:
		_planet_ecology.damage_service.connect("surface_impact_requested", Callable(self, "_on_surface_impact_requested"))
	_planet_regions = preload("res://scripts/native_planet_regions_r3.gd").new()
	_planet_regions.name = "PlanetRegionGeologyR3"
	add_child(_planet_regions)
	_planet_regions.setup(_planet)
	update_stream(Vector3(0.0, height_at(0.0, 190.0), 190.0))


func _exit_tree() -> void:
	if _impact_worker != null:
		_impact_worker.wait_to_finish()
		_impact_worker = null


func _process(_delta: float) -> void:
	if _impact_worker == null or _impact_worker.is_alive():
		return
	var result: Dictionary = _impact_worker.wait_to_finish()
	_impact_worker = null
	var job := _impact_job
	_impact_job = {}
	if job.is_empty() or int(job.revision) != _deformation_revision:
		surface_deformation_committed.emit({"applied": false, "reason": "stale_rebuild", "id": job.get("id", "")})
		return
	if not bool(result.get("valid", false)):
		surface_deformation_committed.emit({"applied": false, "reason": result.get("reason", "build_failed"), "id": job.id})
		return
	for key: Vector2i in job.old_keys:
		if not _chunks.has(key) or not result.old.has(key):
			surface_deformation_committed.emit({"applied": false, "reason": "old_support_unloaded", "id": job.id})
			return
	for tile: Dictionary in job.planet_tiles:
		if not _planet._near_tiles.has(NativePlanet._tile_key(tile)) or not result.planet.has(NativePlanet._tile_key(tile)):
			surface_deformation_committed.emit({"applied": false, "reason": "planet_support_unloaded", "id": job.id})
			return
	for key: Vector2i in job.old_keys:
		_commit_impact_chunk(key, result.old[key])
	for tile: Dictionary in job.planet_tiles:
		_planet.commit_impact_tile(tile, result.planet[NativePlanet._tile_key(tile)])
	var stored: Dictionary = _deformations.commit(job.record)
	if not bool(stored.get("valid", false)):
		surface_deformation_committed.emit({"applied": false, "reason": stored.get("reason", "commit_failed"), "id": job.id})
		return
	_deformation_revision += 1
	_cancel_surface_landing_internal()
	call_deferred("_verify_committed_impact", job, stored.record, _deformation_revision)


func _verify_committed_impact(job: Dictionary, record: Dictionary, revision: int) -> void:
	await get_tree().physics_frame
	await get_tree().physics_frame
	if not is_inside_tree() or revision != _deformation_revision:
		surface_deformation_committed.emit({"applied": false, "reason": "stale_commit", "id": job.id})
		return
	var old_basin: bool = Vector3(job.origin).y > -1000.0 and absf(Vector3(job.origin).x) <= HALF_SIZE and absf(Vector3(job.origin).z) <= HALF_SIZE
	var support := _physical_landing_support(job.origin, old_basin)
	var follows_field := false
	if bool(support.get("ready", false)):
		var point: Vector3 = support.point
		if old_basin:
			follows_field = absf(point.y - height_at(point.x, point.z)) < 0.35
		else:
			var direction := NativePlanet.scene_to_canonical(point).normalized()
			var radial_height := (point - NativePlanet.CENTER).length() - NativePlanet.RADIUS
			follows_field = absf(radial_height - float(_planet.field.sample(direction).height)) < 0.35
	if not follows_field:
		restore_deformations(job.before_snapshot)
		surface_deformation_committed.emit({"applied": false, "reason": "collider_commit_failed", "id": job.id})
		return
	if _planet_ecology != null:
		_planet_ecology.invalidate_surface_region(job.origin, float(job.radius) + 2.0)
	surface_deformation_committed.emit({"applied": true, "record": record, "origin": job.origin, "radius": job.radius, "id": job.id})


func height_at(x: float, z: float) -> float:
	var base := base_height_at(x, z)
	if _deformations.count() == 0:
		return base
	var direction := NativePlanet.scene_to_canonical(Vector3(x, base, z)).normalized()
	return base + _deformations.offset_at(direction)


func base_height_at(x: float, z: float) -> float:
	# The original height owner ends at ±3 km; the continuous planet owns
	# travel beyond it. Clamping only keeps legacy interpolation finite.
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


func snapshot_deformations() -> Dictionary:
	return _deformations.snapshot()


func restore_deformations(raw: Variant) -> Dictionary:
	if _impact_worker != null:
		return {"valid": false, "reason": "rebuild_pending"}
	var prior: Dictionary = _deformations.snapshot()
	var result: Dictionary = _deformations.restore(raw)
	if not bool(result.get("valid", false)):
		return result
	_deformation_revision += 1
	_cancel_surface_landing_internal()
	if _planet != null:
		_planet.field.deformations = _deformations
		_planet.invalidate_deformation_tiles()
	for key: Vector2i in _chunks.keys():
		var was_refined := _snapshot_affects_chunk(prior, key)
		if was_refined or _chunk_needs_refine(key):
			var preview: Dictionary = _compute_impact_chunk_data(key, _deformations)
			_commit_impact_chunk(key, preview)
	return result


func _on_surface_impact_requested(query: Dictionary) -> void:
	var result := request_surface_impact(query)
	if not bool(result.get("accepted", false)):
		var impact_id := "%s:%s:%d" % [str(query.get("source", "")), str(query.get("cast_id", "")), int(query.get("phase", 0))]
		surface_deformation_committed.emit({"applied": false, "reason": result.get("reason", "rejected"), "id": impact_id})


func request_surface_impact(query: Dictionary) -> Dictionary:
	if _impact_worker != null:
		return {"accepted": false, "reason": "rebuild_busy"}
	var origin: Vector3 = query.get("origin", Vector3(INF, INF, INF))
	var radius: float = float(query.get("radius", 0.0))
	var power: float = float(query.get("power", 0.0))
	if not origin.is_finite() or not is_finite(radius) or not is_finite(power) or radius < NativeSurfaceDeformation.MIN_RADIUS or radius > NativeSurfaceDeformation.MAX_RADIUS or power < 600.0:
		return {"accepted": false, "reason": "invalid_impact"}
	if str(query.get("world_seed", NativePlanetCoordinates.PLANET_SEED)) != NativePlanetCoordinates.PLANET_SEED:
		return {"accepted": false, "reason": "wrong_planet"}
	var old_basin: bool = origin.y > -1000.0 and absf(origin.x) <= HALF_SIZE and absf(origin.z) <= HALF_SIZE
	var support := _physical_landing_support(origin, old_basin)
	if not bool(support.get("ready", false)):
		return {"accepted": false, "reason": "unready_collider"}
	var actual: Vector3 = support.point
	var up := up_at(actual)
	if origin.distance_to(actual) > 1.5 or float(support.get("water_depth", 0.0)) > 0.15 or absf(Vector3(support.normal).dot(up)) < 0.55:
		return {"accepted": false, "reason": "invalid_ground"}
	var center := NativePlanet.scene_to_canonical(actual).normalized()
	var proposal := _deformations.propose(center, radius, power, str(query.get("source", "")), str(query.get("cast_id", "")), int(query.get("phase", 0)))
	if not bool(proposal.get("valid", false)):
		return {"accepted": false, "reason": proposal.get("reason", "invalid_record")}
	var preview := NativeSurfaceDeformation.new()
	var copied: Dictionary = preview.restore(_deformations.snapshot())
	if not bool(copied.get("valid", false)) or not bool(preview.commit(proposal.record).get("valid", false)):
		return {"accepted": false, "reason": "preview_failed"}
	var old_keys := _affected_legacy_chunks(actual, radius)
	var live_old: Array[Vector2i] = []
	for key: Vector2i in old_keys:
		if _chunks.has(key):
			live_old.append(key)
		elif old_basin:
			return {"accepted": false, "reason": "unready_legacy_chunk"}
	var planet_tiles: Array[Dictionary] = []
	for tile: Dictionary in _planet.affected_near_tiles(center, radius):
		if _planet._near_tiles.has(NativePlanet._tile_key(tile)):
			planet_tiles.append(tile)
		elif not old_basin:
			return {"accepted": false, "reason": "unready_planet_tile"}
	if live_old.is_empty() and planet_tiles.is_empty():
		return {"accepted": false, "reason": "unready_surface"}
	var worker := Thread.new()
	var start: Error = worker.start(Callable(self, "_compute_surface_impact_data").bind(preview, live_old, planet_tiles))
	if start != OK:
		return {"accepted": false, "reason": "worker_failed"}
	_impact_worker = worker
	_impact_job = {"id": proposal.record.id, "record": proposal.record, "before_snapshot": _deformations.snapshot(), "origin": actual, "radius": radius, "revision": _deformation_revision, "old_keys": live_old, "planet_tiles": planet_tiles}
	return {"accepted": true, "pending": true, "id": proposal.record.id}


func _compute_surface_impact_data(preview: NativeSurfaceDeformation, old_keys: Array[Vector2i], planet_tiles: Array[Dictionary]) -> Dictionary:
	var old: Dictionary = {}
	var planet: Dictionary = {}
	for key: Vector2i in old_keys:
		old[key] = _compute_impact_chunk_data(key, preview)
	for tile: Dictionary in planet_tiles:
		planet[NativePlanet._tile_key(tile)] = _planet.compute_impact_tile_data(tile, preview)
	return {"valid": true, "old": old, "planet": planet}


func _affected_legacy_chunks(point: Vector3, radius: float) -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	if point.x + radius < -HALF_SIZE or point.x - radius > HALF_SIZE or point.z + radius < -HALF_SIZE or point.z - radius > HALF_SIZE:
		return result
	var x0 := clampi(floori((point.x - radius + HALF_SIZE) / CHUNK_SIZE), 0, CHUNK_COUNT - 1)
	var x1 := clampi(floori((point.x + radius + HALF_SIZE) / CHUNK_SIZE), 0, CHUNK_COUNT - 1)
	var z0 := clampi(floori((point.z - radius + HALF_SIZE) / CHUNK_SIZE), 0, CHUNK_COUNT - 1)
	var z1 := clampi(floori((point.z + radius + HALF_SIZE) / CHUNK_SIZE), 0, CHUNK_COUNT - 1)
	for z in range(z0, z1 + 1):
		for x in range(x0, x1 + 1):
			result.append(Vector2i(x, z))
	return result


func _chunk_needs_refine(key: Vector2i) -> bool:
	if _deformations.count() == 0:
		return false
	var center_x := clampf(float(key.x) * CHUNK_SIZE - HALF_SIZE + CHUNK_SIZE * 0.5, -HALF_SIZE, HALF_SIZE)
	var center_z := clampf(float(key.y) * CHUNK_SIZE - HALF_SIZE + CHUNK_SIZE * 0.5, -HALF_SIZE, HALF_SIZE)
	var center := NativePlanet.scene_to_canonical(Vector3(center_x, base_height_at(center_x, center_z), center_z)).normalized()
	return _deformations.affects_cap(center, CHUNK_SIZE * 0.72)


func _snapshot_affects_chunk(snapshot: Dictionary, key: Vector2i) -> bool:
	var old := NativeSurfaceDeformation.new()
	if not bool(old.restore(snapshot).get("valid", false)):
		return false
	var center_x := clampf(float(key.x) * CHUNK_SIZE - HALF_SIZE + CHUNK_SIZE * 0.5, -HALF_SIZE, HALF_SIZE)
	var center_z := clampf(float(key.y) * CHUNK_SIZE - HALF_SIZE + CHUNK_SIZE * 0.5, -HALF_SIZE, HALF_SIZE)
	var center := NativePlanet.scene_to_canonical(Vector3(center_x, base_height_at(center_x, center_z), center_z)).normalized()
	return old.affects_cap(center, CHUNK_SIZE * 0.72)


func is_solid_at(p: Vector3, radius: float, height: float) -> bool:
	# p is a foot point. The six-kilometre rectangle is original content,
	# never a solid outer wall; all other points use radial planetary support.
	if not p.is_finite():
		return true
	var r: float = clampf(radius, 0.0, 10.0)
	var support: Dictionary = surface_at(p)
	if not bool(support.get("ready", false)):
		return true
	var up: Vector3 = up_at(p)
	if float(support.agl) < -0.04:
		return true
	if r > 0.0 and float(support.agl) < r + maxf(height, 0.0):
		var tangent_x: Vector3 = Vector3.FORWARD.cross(up).normalized()
		if tangent_x.length_squared() < 0.25:
			tangent_x = Vector3.RIGHT.cross(up).normalized()
		var tangent_z: Vector3 = up.cross(tangent_x).normalized()
		for i in range(8):
			var angle: float = float(i) * TAU / 8.0
			var side: Dictionary = surface_at(p + (tangent_x * cos(angle) + tangent_z * sin(angle)) * r)
			if not bool(side.get("ready", false)):
				return true
			if float(side.agl) < -minf(r, maxf(height, 0.0)) - 0.04:
				return true
	return false


func up_at(scene_position: Vector3) -> Vector3:
	return NativePlanet.radial_up(scene_position)


func surface_at(scene_position: Vector3) -> Dictionary:
	if not scene_position.is_finite():
		return {"ready": false}
	if scene_position.y > -1000.0 and absf(scene_position.x) <= HALF_SIZE and absf(scene_position.z) <= HALF_SIZE:
		var cell := Vector2i(
			clampi(int(floor((scene_position.x + HALF_SIZE) / CHUNK_SIZE)), 0, CHUNK_COUNT - 1),
			clampi(int(floor((scene_position.z + HALF_SIZE) / CHUNK_SIZE)), 0, CHUNK_COUNT - 1)
		)
		var h: float = height_at(scene_position.x, scene_position.z)
		var point := Vector3(scene_position.x, h, scene_position.z)
		var normal := Vector3(height_at(scene_position.x - 1.0, scene_position.z) - height_at(scene_position.x + 1.0, scene_position.z), 2.0, height_at(scene_position.x, scene_position.z - 1.0) - height_at(scene_position.x, scene_position.z + 1.0)).normalized()
		if not _chunks.has(cell):
			return {"ready": false, "point": point, "normal": normal, "agl": scene_position.y - h, "water_depth": 0.0, "spacing": GRID_STEP}
		if bool((_chunks[cell] as Node).get_meta("impact_refined", false)):
			var physical := _physical_landing_support(point, true)
			if not bool(physical.get("ready", false)):
				return {"ready": false, "point": point, "normal": normal, "agl": scene_position.y - h, "water_depth": 0.0, "spacing": 2.0}
			return {"ready": true, "point": physical.point, "normal": physical.normal, "agl": (scene_position - Vector3(physical.point)).dot(up_at(scene_position)), "water_depth": 0.0, "spacing": 2.0}
		return {"ready": true, "point": point, "normal": normal, "agl": scene_position.y - h, "water_depth": 0.0, "spacing": GRID_STEP}
	if _planet == null:
		return {"ready": false}
	# Near the blend apron, an elevated radial ray may meet the old tangent
	# surface a few metres inside ±3 km although the caller's X/Z is outside.
	# That original visual mesh owns the crossing and has its own query layer.
	var radial: Vector3 = up_at(scene_position)
	var ray_from: Vector3 = NativePlanet.CENTER + radial * (planet_radius + 7000.0)
	var ray_to: Vector3 = NativePlanet.CENTER + radial * (planet_radius - 7000.0)
	var legacy_query := PhysicsRayQueryParameters3D.create(ray_from, ray_to, LEGACY_TERRAIN_QUERY_LAYER)
	legacy_query.hit_back_faces = true
	var legacy_hit: Dictionary = get_world_3d().direct_space_state.intersect_ray(legacy_query)
	if not legacy_hit.is_empty() and (legacy_hit.collider as Node).is_in_group("native_terrain"):
		var old_point: Vector3 = legacy_hit.position
		return {"ready": true, "point": old_point, "normal": legacy_hit.normal, "agl": (scene_position - old_point).dot(radial), "water_depth": 0.0, "spacing": GRID_STEP}
	return _planet.surface_at(scene_position)


func sweep(from_scene: Vector3, to_scene: Vector3, radius: float, height: float) -> Dictionary:
	if not from_scene.is_finite() or not to_scene.is_finite():
		return {"ready": false, "clear": false}
	var travel: float = from_scene.distance_to(to_scene)
	var altitude: float = maxf(0.0, (from_scene - NativePlanet.CENTER).length() - planet_radius)
	var step: float = 60.0 if altitude > 100.0 else maxf(1.0, minf(10.0, radius * 4.0))
	var parts: int = maxi(1, ceili(travel / step))
	for i in range(parts + 1):
		var point: Vector3 = from_scene.lerp(to_scene, float(i) / parts)
		var support: Dictionary = surface_at(point)
		if not bool(support.get("ready", false)):
			return {"ready": false, "clear": false}
		if float(support.agl) < -0.05:
			return {"ready": true, "clear": false}
		if altitude < 100.0 and is_solid_at(point, radius, height):
			return {"ready": true, "clear": false}
	return {"ready": true, "clear": true}


func prepare_route(from_scene: Vector3, to_scene: Vector3, radius: float, height: float) -> Dictionary:
	if not from_scene.is_finite() or not to_scene.is_finite() or from_scene.distance_to(to_scene) > 2200.0:
		return {"ready": true, "clear": false}
	var planet_status: Dictionary = _planet.prepare_route(from_scene, to_scene, radius, height)
	var old_keys: Dictionary = {}
	var parts: int = maxi(1, ceili(from_scene.distance_to(to_scene) / 70.0))
	for i in range(parts + 1):
		var point: Vector3 = from_scene.lerp(to_scene, float(i) / parts)
		if point.y <= -1000.0 or absf(point.x) > HALF_SIZE or absf(point.z) > HALF_SIZE:
			continue
		var key := Vector2i(
			clampi(int(floor((point.x + HALF_SIZE) / CHUNK_SIZE)), 0, CHUNK_COUNT - 1),
			clampi(int(floor((point.z + HALF_SIZE) / CHUNK_SIZE)), 0, CHUNK_COUNT - 1)
		)
		old_keys[key] = true
	var expiry: int = Time.get_ticks_msec() + 10000
	var built: int = 0
	for key: Vector2i in old_keys:
		_legacy_route_pins[key] = expiry
		_requested[key] = true
		if not _chunks.has(key) and built < 2:
			_build_chunk(key)
			built += 1
	if not bool(planet_status.get("ready", false)):
		return {"ready": false, "clear": false}
	for key: Vector2i in old_keys:
		if not _chunks.has(key):
			return {"ready": false, "clear": false}
	# The caller's actual blink arc is radially projected and may differ from
	# this straight chord. Clearance is decided by its subsequent segment sweeps;
	# this result certifies that their real triangles have been prepared/pinned.
	return {"ready": true, "clear": true}


func release_prepared_route() -> void:
	_legacy_route_pins.clear()
	if _planet != null:
		_planet.release_prepared_route()
	_stream_center = Vector2i(-1, -1)


func prepare_surface_landing(from_scene: Vector3, max_distance: float, cast_id: String = "") -> Dictionary:
	if _planet == null or not from_scene.is_finite() or not is_finite(max_distance) or max_distance <= 0.0 or max_distance > 180000.0 or cast_id.is_empty():
		return {"ready": true, "clear": false, "reason": "invalid_request"}
	var now := Time.get_ticks_msec()
	if _landing_cast_id != cast_id or _landing_source.distance_to(from_scene) > 8.0:
		_cancel_surface_landing_internal()
		_landing_cast_id = cast_id
		_landing_source = from_scene
		_landing_expiry = now + 10000
	if now >= _landing_expiry:
		_cancel_surface_landing_internal()
		return {"ready": true, "clear": false, "reason": "expired"}
	if not _landing_ticket.is_empty():
		return {"ready": true, "clear": true, "ticket": _landing_ticket.duplicate(true), "target": _landing_ticket.target, "surface": _landing_ticket.surface, "normal": _landing_ticket.normal}
	var canonical: Vector3 = NativePlanet.scene_to_canonical(from_scene)
	if canonical.length_squared() < 1.0:
		return {"ready": true, "clear": false, "reason": "invalid_source"}
	var up: Vector3 = NativePlanet.radial_up(from_scene)
	var estimate: Dictionary = _planet.analytic_surface(from_scene)
	var estimated_point: Vector3 = estimate.point
	var radial_travel: float = (from_scene - estimated_point).dot(up)
	if radial_travel < 4.0 or radial_travel > max_distance + 0.05:
		return {"ready": true, "clear": false, "reason": "out_of_range"}
	if float(estimate.water_depth) > 0.15:
		return {"ready": true, "clear": false, "reason": "water"}
	var old_basin: bool = estimated_point.y > -1000.0 and absf(estimated_point.x) <= HALF_SIZE and absf(estimated_point.z) <= HALF_SIZE
	if old_basin:
		var cell := Vector2i(clampi(floori((estimated_point.x + HALF_SIZE) / CHUNK_SIZE), 0, CHUNK_COUNT - 1), clampi(floori((estimated_point.z + HALF_SIZE) / CHUNK_SIZE), 0, CHUNK_COUNT - 1))
		_legacy_landing_pins[cell] = _landing_expiry
		_requested[cell] = true
		if not _chunks.has(cell):
			_build_chunk(cell)
		if not _chunks.has(cell):
			return {"ready": false, "clear": false, "reason": "streaming"}
	else:
		var pin: Dictionary = _planet.pin_surface_landing(canonical.normalized(), _landing_expiry)
		_planet.update_stream(from_scene)
		if not bool(pin.get("ready", false)):
			return {"ready": false, "clear": false, "reason": "streaming"}
	var support := _physical_landing_support(estimated_point, old_basin)
	if not bool(support.get("ready", false)):
		return {"ready": false, "clear": false, "reason": "unready_collider"}
	var validation := _validate_landing_support(support, from_scene, max_distance, 0.42, 1.72)
	if not bool(validation.get("valid", false)):
		return {"ready": true, "clear": false, "reason": validation.get("reason", "blocked")}
	_landing_serial += 1
	_landing_ticket = {"id": _landing_serial, "cast_id": cast_id, "planet_id": NativePlanetCoordinates.PLANET_ID, "planet_seed": NativePlanetCoordinates.PLANET_SEED, "origin_revision": origin_revision, "deformation_revision": _deformation_revision, "source": from_scene, "surface": support.point, "normal": support.normal, "target": validation.target, "max_distance": max_distance, "expiry": _landing_expiry, "old_basin": old_basin}
	return {"ready": true, "clear": true, "ticket": _landing_ticket.duplicate(true), "target": validation.target, "surface": support.point, "normal": support.normal}


func consume_surface_landing(ticket: Dictionary, current_scene: Vector3, body_radius: float, body_height: float) -> Dictionary:
	if _landing_ticket.is_empty() or not current_scene.is_finite() or int(ticket.get("id", -1)) != int(_landing_ticket.id):
		return {"valid": false, "reason": "invalid_ticket"}
	var issued := _landing_ticket.duplicate(true)
	_cancel_surface_landing_internal()
	if Time.get_ticks_msec() >= int(issued.expiry) or int(issued.origin_revision) != origin_revision or int(issued.deformation_revision) != _deformation_revision:
		return {"valid": false, "reason": "stale_ticket"}
	if issued.planet_id != NativePlanetCoordinates.PLANET_ID or issued.planet_seed != NativePlanetCoordinates.PLANET_SEED or current_scene.distance_to(issued.source) > 8.0:
		return {"valid": false, "reason": "source_moved"}
	var old_basin: bool = bool(issued.old_basin)
	var support := _physical_landing_support(issued.surface, old_basin)
	if not bool(support.get("ready", false)):
		return {"valid": false, "reason": "unready_collider"}
	if Vector3(support.point).distance_to(issued.surface) > 0.5:
		return {"valid": false, "reason": "surface_changed"}
	var validation := _validate_landing_support(support, current_scene, float(issued.max_distance), body_radius, body_height)
	if not bool(validation.get("valid", false)):
		return validation
	if Vector3(validation.target).distance_to(issued.target) > 0.5:
		return {"valid": false, "reason": "target_changed"}
	return {"valid": true, "target": validation.target, "surface": support.point, "normal": support.normal}


func cancel_surface_landing(ticket: Dictionary = {}) -> void:
	if ticket.is_empty() or int(ticket.get("id", -1)) == int(_landing_ticket.get("id", -2)) or str(ticket.get("cast_id", "")) == _landing_cast_id:
		_cancel_surface_landing_internal()


func _cancel_surface_landing_internal() -> void:
	_landing_ticket.clear()
	_landing_cast_id = ""
	_landing_expiry = 0
	_legacy_landing_pins.clear()
	if _planet != null:
		_planet.release_surface_landing()
	_stream_center = Vector2i(-1, -1)


func _physical_landing_support(near_scene: Vector3, old_basin: bool) -> Dictionary:
	var up := up_at(near_scene)
	if old_basin:
		var tangent_a := Vector3.FORWARD.cross(up).normalized()
		if tangent_a.length_squared() < 0.25:
			tangent_a = Vector3.RIGHT.cross(up).normalized()
		var tangent_b := up.cross(tangent_a).normalized()
		for offset: Vector3 in [Vector3.ZERO, tangent_a * 0.05, -tangent_a * 0.05, tangent_b * 0.05, -tangent_b * 0.05, tangent_a * 0.25, -tangent_a * 0.25, tangent_b * 0.25, -tangent_b * 0.25]:
			var ray := PhysicsRayQueryParameters3D.create(near_scene + offset + up * 100.0, near_scene + offset - up * 100.0, LEGACY_TERRAIN_QUERY_LAYER)
			ray.hit_back_faces = true
			var hit: Dictionary = get_world_3d().direct_space_state.intersect_ray(ray)
			if not hit.is_empty() and (hit.collider as Node).is_in_group("native_terrain"):
				return {"ready": true, "point": hit.position, "normal": hit.normal, "water_depth": 0.0}
		return {"ready": false}
	return _planet.surface_at(near_scene + up * 0.8)


func _validate_landing_support(support: Dictionary, source: Vector3, max_distance: float, body_radius: float, body_height: float) -> Dictionary:
	var point: Vector3 = support.point
	var up := up_at(point)
	var normal: Vector3 = support.normal
	if float(support.get("water_depth", 0.0)) > 0.15:
		return {"valid": false, "reason": "water"}
	if absf(normal.dot(up)) < 0.72:
		return {"valid": false, "reason": "slope"}
	var target := point + up * 0.8
	if not target.is_finite() or (source - point).dot(up) < 4.0 or source.distance_to(target) > max_distance + 1.0:
		return {"valid": false, "reason": "out_of_range"}
	if not is_finite(body_radius) or not is_finite(body_height) or body_radius < 0.3 or body_radius > 1.5 or body_height < body_radius * 2.0 or body_height > 3.0:
		return {"valid": false, "reason": "invalid_body"}
	if is_solid_at(target, body_radius, body_height):
		return {"valid": false, "reason": "terrain_blocked"}
	var shape := CapsuleShape3D.new()
	shape.radius = body_radius
	shape.height = body_height
	var query := PhysicsShapeQueryParameters3D.new()
	query.shape = shape
	query.transform = Transform3D(Basis(Quaternion(Vector3.UP, up)), target + up * (body_height * 0.5 + 0.01))
	query.collision_mask = 1
	if not get_world_3d().direct_space_state.intersect_shape(query, 1).is_empty():
		return {"valid": false, "reason": "body_blocked"}
	return {"valid": true, "target": target}


func update_stream(center: Vector3) -> void:
	if not _initialized:
		setup_world()
		return
	if _planet != null:
		_planet.update_stream(center)
		_update_basin_visual_seam()
	if _planet_ecology != null:
		_planet_ecology.update_stream(center)
	if _planet_regions != null:
		_planet_regions.update_stream(center)
	_update_planet_atmosphere(center)
	var now: int = Time.get_ticks_msec()
	for key: Vector2i in _legacy_route_pins.keys():
		if int(_legacy_route_pins[key]) < now:
			_legacy_route_pins.erase(key)
			_stream_center = Vector2i(-1, -1)
	for key: Vector2i in _legacy_landing_pins.keys():
		if int(_legacy_landing_pins[key]) < now:
			_legacy_landing_pins.erase(key)
			_stream_center = Vector2i(-1, -1)
	if center.y < -2000.0 or maxf(absf(center.x), absf(center.z)) > HALF_SIZE + 500.0:
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
		for key: Vector2i in _legacy_route_pins:
			_requested[key] = true
			if not _chunks.has(key):
				_pending.append(key)
		for key: Vector2i in _legacy_landing_pins:
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
	_height_mutex.lock()
	if _height_cache.has(key):
		var cached: float = _height_cache[key]
		_height_mutex.unlock()
		return cached
	var x: float = float(ix) * GRID_STEP - HALF_SIZE
	var z: float = float(iz) * GRID_STEP - HALF_SIZE
	var value: float = _raw_height(x, z)
	_height_cache[key] = value
	_height_mutex.unlock()
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
	if _chunk_needs_refine(key):
		_commit_impact_chunk(key, _compute_impact_chunk_data(key, _deformations))
		return
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
	var surface_indices: PackedInt32Array = indices.duplicate()
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
	mesh.surface_set_material(0, _near_terrain_material)
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
	body.collision_layer = 1 | LEGACY_TERRAIN_QUERY_LAYER
	body.collision_mask = 0
	body.add_to_group("native_terrain")
	chunk.add_child(body)
	var collider := CollisionShape3D.new()
	var collision_faces := PackedVector3Array()
	for index in surface_indices:
		collision_faces.append(vertices[index])
	var terrain_shape := ConcavePolygonShape3D.new()
	terrain_shape.set_faces(collision_faces)
	collider.shape = terrain_shape
	body.add_child(collider)
	_chunks[key] = chunk
	_set_far_mask(key, true)


func _impact_height(x: float, z: float, preview: NativeSurfaceDeformation) -> float:
	var base := base_height_at(x, z)
	var direction := NativePlanet.scene_to_canonical(Vector3(x, base, z)).normalized()
	return base + preview.offset_at(direction)


func _compute_impact_chunk_data(key: Vector2i, preview: NativeSurfaceDeformation) -> Dictionary:
	const REFINEMENT := 5
	var base_ix: int = key.x * CHUNK_CELLS
	var base_iz: int = key.y * CHUNK_CELLS
	var cells_x: int = mini(CHUNK_CELLS, GRID_SEGMENTS - base_ix) * REFINEMENT
	var cells_z: int = mini(CHUNK_CELLS, GRID_SEGMENTS - base_iz) * REFINEMENT
	var origin_x: float = float(base_ix) * GRID_STEP - HALF_SIZE
	var origin_z: float = float(base_iz) * GRID_STEP - HALF_SIZE
	var step: float = GRID_STEP / float(REFINEMENT)
	var vertices := PackedVector3Array()
	var normals := PackedVector3Array()
	var colors := PackedColorArray()
	var uvs := PackedVector2Array()
	var indices := PackedInt32Array()
	for j in range(cells_z + 1):
		for i in range(cells_x + 1):
			var x := origin_x + float(i) * step
			var z := origin_z + float(j) * step
			var h := _impact_height(x, z, preview)
			vertices.append(Vector3(float(i) * step, h, float(j) * step))
			normals.append(Vector3(_impact_height(x - 1.0, z, preview) - _impact_height(x + 1.0, z, preview), 2.0, _impact_height(x, z - 1.0, preview) - _impact_height(x, z + 1.0, preview)).normalized())
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
			indices.append_array(PackedInt32Array([a, d, b, b, d, c]))
	var surface_indices := indices.duplicate()
	_append_near_skirts(vertices, normals, colors, uvs, indices, cells_x, cells_z)
	return {"origin": Vector3(origin_x, 0.0, origin_z), "vertices": vertices, "normals": normals, "colors": colors, "uvs": uvs, "indices": indices, "surface_indices": surface_indices, "spacing": step}


func _commit_impact_chunk(key: Vector2i, data: Dictionary) -> void:
	var arrays: Array = []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = data.vertices
	arrays[Mesh.ARRAY_NORMAL] = data.normals
	arrays[Mesh.ARRAY_COLOR] = data.colors
	arrays[Mesh.ARRAY_TEX_UV] = data.uvs
	arrays[Mesh.ARRAY_INDEX] = data.indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	mesh.surface_set_material(0, _near_terrain_material)
	var chunk := Node3D.new()
	chunk.name = "Terrain_%d_%d" % [key.x, key.y]
	chunk.position = data.origin
	chunk.set_meta("impact_refined", true)
	var visual := MeshInstance3D.new()
	visual.name = "Basalt"
	visual.mesh = mesh
	visual.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	chunk.add_child(visual)
	var body := StaticBody3D.new()
	body.name = "TerrainCollision"
	body.collision_layer = 1 | LEGACY_TERRAIN_QUERY_LAYER
	body.collision_mask = 0
	body.add_to_group("native_terrain")
	chunk.add_child(body)
	var faces := PackedVector3Array()
	for index: int in data.surface_indices:
		faces.append(data.vertices[index])
	var shape := ConcavePolygonShape3D.new()
	shape.backface_collision = true
	shape.set_faces(faces)
	var collider := CollisionShape3D.new()
	collider.shape = shape
	body.add_child(collider)
	var old: Node3D = _chunks.get(key)
	_terrain_root.add_child(chunk)
	_chunks[key] = chunk
	_set_far_mask(key, true)
	if old != null:
		old.queue_free()


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
		var skirt_color: Color = colors[source]
		skirt_color.a = 0.0
		colors.append(skirt_color)
		uvs.append(uvs[source])
	for source in [first, second]:
		vertices.append(vertices[source] - Vector3(0.0, NEAR_SKIRT_DEPTH, 0.0))
		normals.append(side_normal)
		var skirt_color: Color = colors[source]
		skirt_color.a = 0.0
		colors.append(skirt_color)
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
	_far_basin_visual = visual
	_far_basin_arrays = arrays
	_far_basin_base_vertices = vertices.duplicate()
	for j in range(FAR_SEGMENTS + 1):
		for i in range(FAR_SEGMENTS + 1):
			if i == 0 or j == 0 or i == FAR_SEGMENTS or j == FAR_SEGMENTS:
				_far_basin_edge_ids.append(j * (FAR_SEGMENTS + 1) + i)


func _update_basin_visual_seam() -> void:
	# Only the distant visual rim moves. The six-kilometre height field, near
	# vertices and all gameplay collision keep their original heights.
	if _far_basin_visual == null or _planet == null:
		return
	var keys: Array = _basin_boundary_tile_keys(_planet._mid_tiles)
	var near_keys: Array = _basin_boundary_tile_keys(_planet._near_tiles)
	var signature: String = str(keys) + str(near_keys)
	if signature == _basin_seam_signature:
		return
	_basin_seam_signature = signature
	var vertices: PackedVector3Array = _far_basin_base_vertices.duplicate()
	for index: int in _far_basin_edge_ids:
		var point: Vector3 = vertices[index]
		var support: Dictionary = _planet.rendered_visual_surface_at(point, true)
		if bool(support.get("ready", false)):
			point.y = Vector3(support.point).y
			vertices[index] = point
	var arrays: Array = _far_basin_arrays.duplicate()
	arrays[Mesh.ARRAY_VERTEX] = vertices
	var material: Material = _far_basin_visual.mesh.surface_get_material(0)
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	mesh.surface_set_material(0, material)
	_far_basin_visual.mesh = mesh


func _basin_boundary_tile_keys(records: Dictionary) -> Array:
	var keys: Array = []
	for key: String in records:
		var tile: Dictionary = records[key].tile
		if str(tile.face) != "px":
			continue
		var count: int = 1 << int(tile.level)
		# Include a margin for height-dependent spherical projection, but
		# ignore tiles elsewhere on the planet: they cannot change this rim.
		var low: int = floori((0.5 - HALF_SIZE / (2.0 * NativePlanet.RADIUS)) * count) - 1
		var high: int = floori((0.5 + HALF_SIZE / (2.0 * NativePlanet.RADIUS)) * count) + 1
		if int(tile.x) >= low and int(tile.x) <= high and int(tile.y) >= low and int(tile.y) <= high:
			keys.append(key)
	keys.sort()
	return keys


func _set_far_mask(key: Vector2i, loaded: bool) -> void:
	_far_mask_image.set_pixel(key.x, key.y, Color.WHITE if loaded else Color(0.0, 0.0, 0.0, 1.0))
	_far_mask_dirty = true


func _setup_sky_and_light() -> void:
	var environment := Environment.new()
	_environment = environment
	environment.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	# Intel UHD/OpenGL Compatibility rendered the procedural noise sky as
	# hard-edged shards. The panorama samples that same source algorithm once
	# offline, leaving a cheap texture lookup in the shipped game.
	var material := PanoramaSkyMaterial.new()
	material.panorama = load("res://assets/sky/legacy_purple_panorama.png") as Texture2D
	sky.sky_material = material
	environment.sky = sky
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color(0.48, 0.50, 0.58)
	environment.ambient_light_energy = 0.72
	environment.reflected_light_source = Environment.REFLECTION_SOURCE_BG
	environment.fog_enabled = true
	environment.fog_light_color = Color(0.34, 0.32, 0.39)
	environment.fog_density = 0.00010
	environment.fog_sky_affect = 0.0
	var world_environment := WorldEnvironment.new()
	world_environment.name = "LunarPurpleSky"
	world_environment.environment = environment
	add_child(world_environment)
	var moonlight := DirectionalLight3D.new()
	moonlight.name = "Moonlight"
	moonlight.light_color = Color(0.98, 0.95, 0.93)
	moonlight.light_energy = 1.3
	moonlight.rotation_degrees = Vector3(-57.0, -28.0, 0.0)
	moonlight.shadow_enabled = true
	add_child(moonlight)


func _update_planet_atmosphere(scene_position: Vector3) -> void:
	if _environment == null:
		return
	var radial_altitude: float = (scene_position - NativePlanet.CENTER).length() - planet_radius
	var basin: bool = maxf(absf(scene_position.x), absf(scene_position.z)) < 2500.0 and scene_position.y > -1000.0
	# The original ground-level basin haze must not erase the nearby globe
	# when the player is already high above it.
	var mode: int = 2 if radial_altitude > 3000.0 else (0 if basin and radial_altitude < 900.0 else 1)
	if mode == _fog_mode and mode != 0:
		return
	_fog_mode = mode
	if mode == 0:
		_environment.fog_enabled = true
		var haze_fade: float = smoothstep(350.0, 900.0, radial_altitude)
		_environment.fog_density = lerpf(0.00010, 0.000012, haze_fade)
	elif mode == 1:
		_environment.fog_enabled = true
		_environment.fog_density = 0.000012
	else:
		_environment.fog_enabled = false
