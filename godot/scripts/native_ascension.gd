extends Node3D
class_name NativeAscension

signal blink_resolved(result: Dictionary)

## Native mirror of the existing R6-R9 blink distances, costs and cooldowns.
## Geometry comes from the image-first ascension GLBs already used by the web game.
const RULES := {
	6: {"short": 12.0, "long": 60.0, "short_cd": 8.0, "long_cd": 20.0},
	7: {"short": 30.0, "long": 180.0, "short_cd": 7.0, "long_cd": 18.0},
	8: {"short": 80.0, "long": 600.0, "short_cd": 6.0, "long_cd": 16.0},
	9: {"short": 200.0, "long": 1800.0, "short_cd": 5.0, "long_cd": 14.0},
}
const EFFECTS := {
	6: "res://assets/ascension/blink-aperture.glb",
	7: "res://assets/ascension/domain-gate.glb",
	9: "res://assets/ascension/dao-gate.glb",
}
const CAPSULE_RADIUS := 0.42
const CAPSULE_HEIGHT := 1.72
const SWEEP_STEP := 1.25

var world: NativeWorld
var player: NativePlayer
var ability_time := 0.0
var cooldown_until := 0.0
var serial := 0
var _effects: Array[Dictionary] = []
var _effect_cache: Dictionary = {}
var _query_shape := CapsuleShape3D.new()
var _active_cast_vfx: NativeVfxR2
var _active_cast_contact_time := 0.0
var _r3_cast_vfx: Variant = null
var _pending_blink: Dictionary = {}
var surface_blink: Node
var _surface_aperture: Node3D

func setup(w: NativeWorld, p: NativePlayer) -> void:
	world = w
	player = p
	_query_shape.radius = CAPSULE_RADIUS
	_query_shape.height = CAPSULE_HEIGHT
	surface_blink = preload("res://scripts/native_surface_blink.gd").new()
	add_child(surface_blink)
	surface_blink.setup(self, world, player)
	surface_blink.resolved.connect(_surface_blink_resolved)

func _physics_process(delta: float) -> void:
	ability_time += minf(delta, 0.05)
	if surface_blink != null:
		surface_blink.advance(minf(delta, 0.05))
	if not _pending_blink.is_empty():
		_poll_pending_blink()
	for i in range(_effects.size() - 1, -1, -1):
		var effect: Dictionary = _effects[i]
		effect["age"] = float(effect["age"]) + delta
		var age := float(effect["age"])
		var duration := float(effect.get("duration", 1.05))
		var node: Node3D = effect["node"]
		if age >= duration:
			node.queue_free()
			_effects.remove_at(i)
		else:
			var size := lerpf(0.65, 1.15, clampf(age / duration, 0.0, 1.0))
			node.scale = Vector3.ONE * size * float(effect["base_scale"])
			if effect.has("travel_from"):
				node.global_position = (effect["travel_from"] as Vector3).lerp(effect["travel_to"] as Vector3, clampf(age / float(effect["travel_time"]), 0.0, 1.0))
			_effects[i] = effect

func try_blink(mode: String) -> Dictionary:
	if mode == "surface":
		if not _pending_blink.is_empty():
			cancel_pending_blink()
		return surface_blink.try_start()
	if surface_blink != null and surface_blink.is_pending():
		surface_blink.cancel("切换瞬移，地表准备已取消")
	if not _pending_blink.is_empty():
		_pending_blink.clear()
		_release_prepared_route()
		return _fail("瞬移准备已取消")
	var result := _attempt_blink(mode, true)
	if result.get("pending", false) != true:
		_release_prepared_route()
	return result

func cancel_pending_blink() -> void:
	if surface_blink != null:
		surface_blink.cancel()
	if _pending_blink.is_empty():
		return
	_pending_blink.clear()
	_release_prepared_route()
	blink_resolved.emit(_fail("瞬移准备已取消"))

func _release_prepared_route() -> void:
	if world != null and world.has_method("release_prepared_route"):
		world.call("release_prepared_route")

func _poll_pending_blink() -> void:
	if player == null or world == null or not is_instance_valid(player):
		cancel_pending_blink()
		return
	var saved: Dictionary = _pending_blink
	var origin: Vector3 = saved["origin"]
	var camera := player.get_node("CameraPivot/Camera3D") as Camera3D
	var look: Vector3 = -camera.global_transform.basis.z
	if not player.flight_active:
		var up: Vector3 = world.up_at(player.global_position)
		look = look.slide(up)
	var aimed := look.normalized() if look.length_squared() > 0.000001 else Vector3.ZERO
	var cancelled := ""
	if player.health <= 0.0 or player._hurt_time > 0.0:
		cancelled = "受击后瞬移准备已取消"
	elif player.guarding or not player.visible or player.realm != int(saved["realm"]) or player.flight_active != (saved["flight"] == true):
		cancelled = "状态变化，瞬移准备已取消"
	elif player.global_position.distance_to(origin) > 0.45:
		cancelled = "角色移动，瞬移准备已取消"
	elif aimed.dot(saved["direction"]) < 0.985:
		cancelled = "朝向变化，瞬移准备已取消"
	elif ability_time > float(saved["expires"]):
		cancelled = "瞬移路径加载超时"
	if not cancelled.is_empty():
		_pending_blink.clear()
		_release_prepared_route()
		blink_resolved.emit(_fail(cancelled))
		return
	var result := _attempt_blink(String(saved["mode"]), false)
	if result.get("pending", false) == true:
		return
	_pending_blink.clear()
	_release_prepared_route()
	blink_resolved.emit(result)

func _attempt_blink(mode: String, allow_pending: bool) -> Dictionary:
	if world == null or player == null:
		return _fail("世界尚未载入")
	if player.health <= 0.0:
		return _fail("受击倒地时不能瞬移")
	if not RULES.has(player.realm):
		return _fail("炼虚 R6 后才可瞬移")
	if mode != "short" and mode != "long":
		return _fail("瞬移模式无效")
	var rule: Dictionary = RULES[player.realm]
	var cost := 12.0 if mode == "short" else 25.0
	if player.energy < cost:
		return _fail("灵息不足")
	if ability_time + 0.000001 < cooldown_until:
		return _fail("瞬移冷却剩余 %.1f 秒" % (cooldown_until - ability_time))
	var camera := player.get_node("CameraPivot/Camera3D") as Camera3D
	var look: Vector3 = -camera.global_transform.basis.z
	if not player.flight_active:
		if world.get("planet_enabled") == true:
			var up: Vector3 = world.up_at(player.global_position)
			look -= up * look.dot(up)
		else:
			look.y = 0.0
	if look.length_squared() < 0.000001:
		return _fail("当前方向无效")
	var distance := float(rule[mode])
	var origin := player.global_position
	var direction: Vector3 = look.normalized()
	if world.get("planet_enabled") == true and world.has_method("prepare_route"):
		var route: Dictionary = world.call("prepare_route", origin, origin + direction * distance, CAPSULE_RADIUS, CAPSULE_HEIGHT)
		if route.get("ready", false) != true:
			if allow_pending:
				_pending_blink = {"origin": origin, "direction": direction, "realm": player.realm, "flight": player.flight_active, "mode": mode, "expires": ability_time + 4.0}
			return {"ok": false, "pending": true, "reason": "正在加载瞬移路径 · 移动或受击会取消"}
		if route.get("clear", false) != true:
			return _fail("路径被地形阻挡")
	var preview := _preview(origin, direction, distance)
	if not preview.get("ok", false):
		if world.get("planet_enabled") == true and String(preview.get("reason", "")) in ["路径地形尚未加载", "路径碰撞尚未加载"]:
			if allow_pending:
				_pending_blink = {"origin": origin, "direction": direction, "realm": player.realm, "flight": player.flight_active, "mode": mode, "expires": ability_time + 4.0}
			return {"ok": false, "pending": true, "reason": "正在加载瞬移路径 · 移动或受击会取消"}
		return preview
	var target: Vector3 = preview["target"]
	# Commit only after the complete route is checked. Failed attempts spend nothing.
	if not player.blink_to(target):
		return _fail("终点被阻挡")
	player.energy -= cost
	cooldown_until = ability_time + float(rule[mode + "_cd"])
	serial += 1
	_spawn_pair(origin, target, player.realm, mode)
	world.update_stream(target)
	return {"ok": true, "reason": "瞬移完成", "distance": distance, "cost": cost, "target": target}

func _preview(origin: Vector3, direction: Vector3, distance: float) -> Dictionary:
	if world.get("planet_enabled") == true:
		return _preview_planet(origin, direction, distance)
	var previous := origin
	var travelled := 0.0
	while travelled < distance - 0.0001:
		# Far above all ground-level structures, the route can be sampled more
		# coarsely; return to the full 1.25m body sweep before approaching terrain.
		var clearance := previous.y - world.height_at(previous.x, previous.z)
		var stride := 8.0 if player.flight_active and clearance > 64.0 else SWEEP_STEP
		travelled = minf(distance, travelled + stride)
		var point := origin + direction * travelled
		if not player.flight_active:
			point.y = world.height_at(point.x, point.z)
			if absf(point.y - previous.y) > 1.0:
				return _fail("地形落差过大")
		if absf(point.x) > NativePlayer.WORLD_HALF or absf(point.z) > NativePlayer.WORLD_HALF:
			return _fail("超出盆地边界")
		var floor_y := world.height_at(point.x, point.z)
		if point.y < floor_y - 0.02 or point.y > floor_y + NativePlayer.MAX_AGL:
			return _fail("路径高度不安全")
		if world.is_solid_at(point, CAPSULE_RADIUS, CAPSULE_HEIGHT):
			return _fail("路径被地形阻挡")
		if point.y - floor_y < 8.0 and _hits_scene_solid(point):
			return _fail("路径被建筑阻挡")
		previous = point
	return {"ok": true, "target": previous}

func _preview_planet(origin: Vector3, direction: Vector3, distance: float) -> Dictionary:
	var previous := origin
	var travelled := 0.0
	while travelled < distance - 0.0001:
		var previous_surface: Dictionary = world.surface_at(previous)
		if previous_surface.get("ready", false) != true:
			return _fail("路径地形尚未加载")
		var clearance := float(previous_surface.get("agl", -INF))
		var stride := 8.0 if player.flight_active and clearance > 64.0 else SWEEP_STEP
		travelled = minf(distance, travelled + stride)
		var candidate := origin + direction * travelled
		var surface: Dictionary = world.surface_at(candidate)
		if surface.get("ready", false) != true:
			return _fail("路径地形尚未加载")
		var water_depth := float(surface.get("water_depth", 0.0))
		if not player.flight_active and water_depth > 0.15:
			return _fail("海域没有安全落脚点")
		var point: Vector3 = candidate
		if not player.flight_active:
			point = surface.get("point", Vector3(INF, INF, INF))
			if not point.is_finite():
				return _fail("路径地形无效")
			var radial_rise := (point - previous).dot(world.up_at(previous))
			if absf(radial_rise) > 1.0:
				return _fail("地形落差过大")
			# The surface point may differ from the candidate after the radial
			# projection. Validate the actual body position, not the tangent ray.
			surface = world.surface_at(point)
			if surface.get("ready", false) != true:
				return _fail("路径地形尚未加载")
		var agl := float(surface.get("agl", -INF))
		var ceiling := float(player.call("flight_ceiling")) if player.has_method("flight_ceiling") else NativePlayer.MAX_AGL
		var minimum_agl := maxf(NativePlayer.FLIGHT_CLEARANCE, water_depth + NativePlayer.FLIGHT_CLEARANCE) if player.flight_active else 0.0
		if agl < minimum_agl - 0.02 or agl > ceiling:
			return _fail("路径高度不安全")
		var sweep: Dictionary = world.sweep(previous, point, CAPSULE_RADIUS, CAPSULE_HEIGHT)
		if sweep.get("ready", false) != true:
			return _fail("路径碰撞尚未加载")
		if sweep.get("clear", false) != true or world.is_solid_at(point, CAPSULE_RADIUS, CAPSULE_HEIGHT):
			return _fail("路径被地形阻挡")
		if agl < 8.0 and _hits_scene_solid(point):
			return _fail("路径被建筑阻挡")
		previous = point
	return {"ok": true, "target": previous}

func _hits_scene_solid(point: Vector3) -> bool:
	var query := PhysicsShapeQueryParameters3D.new()
	query.shape = _query_shape
	var up: Vector3 = world.up_at(point) if world.get("planet_enabled") == true else Vector3.UP
	query.transform = Transform3D(Basis(Quaternion(Vector3.UP, up)), point + up * (CAPSULE_HEIGHT * 0.5 + 0.06))
	query.collision_mask = 1
	query.exclude = [player.get_rid()]
	for hit in get_world_3d().direct_space_state.intersect_shape(query, 16):
		var body: Object = hit.get("collider")
		if body is Node and not (body as Node).is_in_group("native_terrain") and not (body as Node).is_in_group("native_planet_terrain"):
			return true
	return false

func _spawn_pair(origin: Vector3, target: Vector3, realm: int, mode: String) -> void:
	var effect_realm := 9 if realm >= 9 else (7 if realm >= 7 else 6)
	var path: String = EFFECTS[effect_realm]
	var scene: Variant = _effect_scene(path)
	if not scene is PackedScene:
		push_error("Blink GLB missing: " + path)
		return
	for point in [origin, target]:
		var node := (scene as PackedScene).instantiate() as Node3D
		if node == null:
			continue
		add_child(node)
		var up: Vector3 = world.up_at(point) if world.get("planet_enabled") == true else Vector3.UP
		node.global_position = point + up
		if world.get("planet_enabled") == true:
			var forward: Vector3 = (-player.global_transform.basis.z).slide(up).normalized()
			if forward.length_squared() > 0.001:
				node.global_basis = Basis.looking_at(forward, up)
		else:
			node.rotation.y = player.rotation.y
		var base_scale := 1.15 if mode == "long" else 0.8
		node.scale = Vector3.ONE * base_scale * 0.65
		_effects.append({"node": node, "age": 0.0, "base_scale": base_scale})

func spawn_air_cast(realm: int, origin: Vector3, aim: Vector3, windup: float) -> bool:
	var tier := 9 if realm >= 9 else (8 if realm >= 8 else (6 if realm >= 6 else 4))
	var effect := NativeVfxR2.new()
	add_child(effect)
	effect.launch_tier(tier, origin, aim, windup)
	_active_cast_vfx = effect
	_active_cast_contact_time = windup
	return true


func resolve_air_cast(hit: bool) -> void:
	if _active_cast_vfx == null or not is_instance_valid(_active_cast_vfx):
		return
	var remaining := maxf(0.0, _active_cast_contact_time - _active_cast_vfx.age)
	if remaining > 0.0:
		_active_cast_vfx.advance(remaining)
	if hit:
		_active_cast_vfx.impact()
	_active_cast_vfx = null

func cancel_air_cast() -> void:
	if _active_cast_vfx != null and is_instance_valid(_active_cast_vfx):
		_active_cast_vfx.impact()
	_active_cast_vfx = null

func start_r3_cast(realm: int, profile: Dictionary, socket: Transform3D, target: Vector3) -> bool:
	if not socket.origin.is_finite():
		return false
	if _r3_cast_vfx != null and is_instance_valid(_r3_cast_vfx):
		_r3_cast_vfx.cancel()
	var script: Variant = load("res://scripts/native_vfx_r3.gd")
	if not script is Script:
		return false
	var effect: Variant = (script as Script).new()
	if not effect is Node3D:
		return false
	add_child(effect)
	_r3_cast_vfx = effect
	effect.begin_cast(realm, profile, socket, target)
	return true

func follow_r3_cast(socket: Transform3D) -> void:
	if _r3_cast_vfx != null and is_instance_valid(_r3_cast_vfx) and socket.origin.is_finite():
		_r3_cast_vfx.follow_socket(socket)

func release_r3_cast(socket: Transform3D, target: Vector3, travel_seconds: float) -> void:
	if _r3_cast_vfx != null and is_instance_valid(_r3_cast_vfx):
		_r3_cast_vfx.release(socket, target, travel_seconds)

func impact_r3_cast(at: Vector3, hit := true) -> void:
	if _r3_cast_vfx != null and is_instance_valid(_r3_cast_vfx):
		var up: Vector3 = world.up_at(at) if world != null and world.get("planet_enabled") == true else Vector3.UP
		_r3_cast_vfx.impact(at, up, hit)
	_r3_cast_vfx = null

func cancel_r3_cast() -> void:
	if _r3_cast_vfx != null and is_instance_valid(_r3_cast_vfx):
		_r3_cast_vfx.cancel()
	_r3_cast_vfx = null

func _effect_scene(path: String) -> Variant:
	if not _effect_cache.has(path):
		_effect_cache[path] = load(path)
	return _effect_cache[path]

func snapshot() -> Dictionary:
	return {"time": ability_time, "cooldown_until": cooldown_until, "serial": serial, "surface_blink": surface_blink.snapshot() if surface_blink != null else {}}

func restore(data: Dictionary) -> void:
	ability_time = maxf(0.0, float(data.get("time", 0.0)))
	cooldown_until = maxf(0.0, float(data.get("cooldown_until", 0.0)))
	serial = maxi(0, int(data.get("serial", 0)))
	if surface_blink != null and data.get("surface_blink") is Dictionary:
		surface_blink.restore(data.surface_blink)

func _surface_blink_resolved(result: Dictionary) -> void:
	if is_instance_valid(_surface_aperture):
		_surface_aperture.visible = false
	if result.get("ok", false):
		surface_blink_vfx(result.get("target", player.global_position), "arrival")
	blink_resolved.emit(result)

func surface_blink_vfx(at: Vector3, phase: String) -> void:
	var resource: PackedScene = load("res://assets/martial-r4/aperture.glb")
	if resource == null:
		return
	var node := resource.instantiate() as Node3D
	add_child(node)
	var up := world.up_at(at)
	node.global_position = at + up * 1.0
	var forward := (-player.global_basis.z).slide(up).normalized()
	if forward.length_squared() < 0.01:
		forward = Vector3.RIGHT.slide(up).normalized()
	node.global_basis = Basis.looking_at(forward, up)
	for mesh in node.find_children("*", "MeshInstance3D", true, false):
		var material := ShaderMaterial.new()
		material.shader = preload("res://assets/vfx-r3/qi_ribbon.gdshader")
		material.set_shader_parameter("tint", Vector3(0.45, 0.65, 1.0))
		material.set_shader_parameter("intensity", 0.75)
		mesh.material_override = material
		mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_effects.append({"node": node, "age": 0.0, "base_scale": 1.0, "duration": 0.85 if phase == "start" else 0.65})
	if phase == "start":
		_surface_aperture = node

func _fail(reason: String) -> Dictionary:
	return {"ok": false, "reason": reason}
