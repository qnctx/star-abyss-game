extends Node
## Image-first R8/R9 radial return. World owns preparation/route geometry;
## Player owns final body-volume validation and the actual position commit.
## Main must call advance(game_dt) once per physics frame. No second clock.

signal resolved(result: Dictionary)

const RULES := {
	8: {"distance": 75000.0, "cost": 25.0, "cooldown": 20.0},
	9: {"distance": 180000.0, "cost": 35.0, "cooldown": 25.0},
}
const PREPARE_TIMEOUT := 12.0
const PREPARE_INTERVAL := 0.10
const MOVEMENT_TOLERANCE := 0.45
const AIM_DOT_MIN := 0.985
const DOWNWARD_DOT_MIN := 0.60
const BLINK_DURATION := 0.80
const ARRIVAL_DURATION := 0.65
const ACTION := "cast_martial_blink"
const ARRIVAL_ACTION := "cast_martial_arrival"

var ascension: Node
var world: Node3D
var player: Node3D
var cooldown_remaining := 0.0
var serial := 0
var epoch := ""
var current: Dictionary = {}
var last_result: Dictionary = {}
var _owns_route := false
var _route_token: Dictionary = {}


func setup(owner_ascension: Node, owner_world: Node3D, owner_player: Node3D) -> void:
	_discard_pending()
	ascension = owner_ascension
	world = owner_world
	player = owner_player
	epoch = "%d-%s" % [Time.get_unix_time_from_system() * 1000000, Crypto.new().generate_random_bytes(8).hex_encode()]
	set_physics_process(false)
	if is_inside_tree() and not get_window().focus_exited.is_connected(_focus_lost):
		get_window().focus_exited.connect(_focus_lost)


func try_start() -> Dictionary:
	if not current.is_empty():
		cancel()
		return last_result.duplicate(true)
	var failure := _start_failure()
	if not failure.is_empty():
		return _fail(failure)
	var realm := int(player.get("realm"))
	var rule: Dictionary = RULES[realm]
	var origin := player.global_position
	var direction := _aim()
	var up := _up(origin)
	if not origin.is_finite() or up.is_zero_approx() or direction.is_zero_approx():
		return _fail("当前朝向无效")
	if direction.dot(-up) < DOWNWARD_DOT_MIN:
		return _fail("请朝向脚下星球地表，再按 Ctrl+Q")
	serial += 1
	current = {
		"phase": "prepare", "origin": origin, "direction": direction,
		"realm": realm, "flight": player.get("flight_active") == true,
		"health": float(player.get("health")),
		"origin_revision": _origin_revision(),
		"combat_serial": int(player.get("combat_serial")),
		"age": 0.0, "poll_remaining": 0.0, "serial": serial,
		"cast_id": epoch + ":" + str(serial),
		"cost": float(rule.cost), "max_distance": float(rule.distance),
		"cooldown": float(rule.cooldown),
	}
	var route := _prepare()
	if route.get("ready", false) == true:
		failure = _route_failure(route)
		if failure.is_empty():
			failure = _pending_failure()
		if not failure.is_empty():
			_discard_pending()
			return _fail(failure)
		if not _begin_action(route):
			_discard_pending()
			return _fail("当前动作尚未结束，无法瞬移")
	return {"ok": false, "pending": true, "phase": current.phase,
		"reason": "正在准备地表落点 · 移动、转向或受击会取消" if current.phase == "prepare" else "地表瞬移起手 · 移动或受击会取消"}


func advance(dt: float) -> void:
	if not is_finite(dt) or dt <= 0.0:
		return
	cooldown_remaining = maxf(0.0, cooldown_remaining - dt)
	if current.is_empty():
		return
	current.age = float(current.age) + dt
	var failure := _pending_failure()
	if not failure.is_empty():
		cancel(failure)
		return
	if current.phase == "windup":
		# Player's one animation clock includes visual hitstop. An unrelated
		# elapsed timer must never teleport before the authored action finishes.
		if float(player.get("_cast_elapsed")) + 0.000001 >= BLINK_DURATION:
			_commit()
		return
	current.poll_remaining = float(current.poll_remaining) - dt
	if float(current.poll_remaining) > 0.0:
		return
	current.poll_remaining = PREPARE_INTERVAL
	var route := _prepare()
	if route.get("ready", false) != true:
		return
	failure = _route_failure(route)
	if failure.is_empty():
		failure = _pending_failure()
	if not failure.is_empty():
		cancel(failure)
	elif not _begin_action(route):
		cancel("当前动作尚未结束，无法瞬移")


func cancel(reason := "地表瞬移已取消") -> void:
	if current.is_empty():
		return
	var attempt := int(current.serial)
	_discard_pending()
	last_result = _fail(reason)
	last_result["serial"] = attempt
	last_result["cancelled"] = true
	resolved.emit(last_result.duplicate(true))


func is_pending() -> bool:
	return not current.is_empty()


func snapshot() -> Dictionary:
	# Waiting destinations/scene positions never survive load or origin rebases.
	return {"version": 1, "cooldown_remaining": cooldown_remaining, "serial": serial}


func restore(data: Dictionary) -> void:
	_discard_pending()
	var value: Variant = data.get("cooldown_remaining", 0.0)
	cooldown_remaining = clampf(float(value), 0.0, 25.0) if _finite_number(value) else 0.0
	value = data.get("serial", 0)
	serial = clampi(int(value), 0, 2147483646) if _finite_number(value) else 0
	last_result.clear()


func _start_failure() -> String:
	if not is_instance_valid(world) or not is_instance_valid(player):
		return "世界尚未载入"
	if world.get("planet_enabled") != true:
		return "地表瞬移需要星球世界"
	if not world.has_method("prepare_surface_landing") or not world.has_method("cancel_surface_landing"):
		return "地表落点准备接口尚未就绪"
	if not world.has_method("surface_at") or not world.has_method("up_at"):
		return "地表碰撞信息尚未就绪"
	if not player.has_method("play_combat_action") or not player.has_method("blink_to_prepared_surface"):
		return "角色瞬移接口尚未就绪"
	if not RULES.has(int(player.get("realm"))):
		return "地表瞬移需要星劫 R8 或道源 R9"
	if float(player.get("health")) <= 0.0 or float(player.get("_hurt_time")) > 0.0:
		return "受击时不能准备瞬移"
	if player.get("flight_active") != true:
		return "请先升空，再选择脚下干燥地表"
	if player.get("guarding") == true or not player.visible:
		return "当前状态不能瞬移"
	if player.get("_cast_active") == true or not String(player.get("combat_action_id")).is_empty():
		return "请先完成当前动作"
	if is_instance_valid(ascension):
		var pending: Variant = ascension.get("_pending_blink")
		if pending is Dictionary and not pending.is_empty():
			return "另一瞬移路径正在准备"
	if cooldown_remaining > 0.000001:
		return "地表瞬移冷却剩余 %.1f 秒" % cooldown_remaining
	if not _finite_number(player.get("energy")) or float(player.get("energy")) < float(RULES[int(player.get("realm"))].cost):
		return "灵息不足"
	var motion: Variant = player.get("_r2")
	if not is_instance_valid(motion):
		return "瞬移动画库尚未就绪"
	var names: Variant = motion.get("names")
	if not names is Dictionary or not names.has("air_" + ACTION) or not names.has(ARRIVAL_ACTION) or not names.has("air_" + ARRIVAL_ACTION):
		return "瞬移动画库尚未就绪"
	return ""


func _pending_failure() -> String:
	if not is_instance_valid(player) or not is_instance_valid(world):
		return "世界状态变化，瞬移取消"
	if float(player.get("health")) <= 0.0 or float(player.get("_hurt_time")) > 0.0 or float(player.get("health")) < float(current.health):
		return "受击后地表瞬移已取消"
	if player.get("guarding") == true or not player.visible:
		return "状态变化，地表瞬移已取消"
	if int(player.get("realm")) != int(current.realm) or (player.get("flight_active") == true) != bool(current.flight):
		return "境界或飞行状态变化，瞬移取消"
	if _origin_revision() != int(current.origin_revision):
		return "世界坐标已更新，请重新准备瞬移"
	if not player.global_position.is_finite() or player.global_position.distance_to(current.origin) > MOVEMENT_TOLERANCE:
		return "角色移动，地表瞬移已取消"
	if _aim().dot(current.direction) < AIM_DOT_MIN:
		return "朝向变化，地表瞬移已取消"
	if int(player.get("combat_serial")) != int(current.combat_serial):
		return "动作被打断，地表瞬移已取消"
	if current.phase == "windup" and player.get("_cast_active") != true and float(player.get("_cast_elapsed")) + 0.000001 < BLINK_DURATION:
		return "瞬移起手未完成，已取消"
	if not _finite_number(player.get("energy")) or float(player.get("energy")) < float(current.cost):
		return "灵息不足，地表瞬移已取消"
	if float(current.age) > PREPARE_TIMEOUT:
		return "地表落点加载超时，请稍后重试"
	return ""


func _prepare() -> Dictionary:
	_owns_route = true
	_route_token = {"cast_id": current.cast_id}
	var response: Variant = world.call("prepare_surface_landing", current.origin, float(current.max_distance), String(current.cast_id))
	if not response is Dictionary:
		return {"ready": true, "clear": false, "reason": "地表落点返回无效"}
	if response.get("ticket") is Dictionary:
		_route_token = response.ticket.duplicate(true)
	return response


func _route_failure(route: Dictionary) -> String:
	if route.get("ready", false) != true:
		return "落点碰撞尚未就绪，请重新准备"
	if route.get("clear", false) != true:
		var reason := String(route.get("reason", ""))
		var messages := {"out_of_range": "脚下地表超出此境界返地距离", "water": "海域没有干燥落脚点", "slope": "地表坡度不适合安全落脚", "terrain_blocked": "落点被地形阻挡", "body_blocked": "落点空间被实体占据", "expired": "地表准备已超时，请重新施放", "invalid_request": "当前状态不能准备地表瞬移", "invalid_source": "当前坐标不能准备地表瞬移"}
		return String(messages.get(reason, reason)) if not reason.is_empty() else "地表路径或落点被阻挡"
	# Opaque one-use authorization; only Player/World may validate and consume it.
	if not route.get("ticket") is Dictionary or (route.ticket as Dictionary).is_empty():
		return "地表路径授权尚未就绪"
	var target_value: Variant = route.get("target")
	var normal_value: Variant = route.get("normal")
	if not target_value is Vector3 or not normal_value is Vector3:
		return "落点位置或法线无效"
	var target: Vector3 = target_value
	var normal: Vector3 = normal_value
	if not target.is_finite() or not normal.is_finite() or normal.length_squared() < 0.5:
		return "落点位置或法线无效"
	var travel: Vector3 = target - (current.origin as Vector3)
	var distance := travel.length()
	var up := _up(current.origin)
	if distance < 3.0 or distance > float(current.max_distance) + 0.01:
		return "地表落点超出此境界瞬移距离"
	# Same radial hemisphere, inward only: never accept a far-side chord or an
	# arbitrary lateral destination from a stale/malformed preparation result.
	if travel.dot(up) >= 0.0 or travel.slide(up).length() > 0.5 or _up(target).dot(up) < 0.99999:
		return "地表落点不在脚下同一径向"
	if normal.normalized().dot(_up(target)) < 0.70:
		return "地表坡度不适合安全落脚"
	var raw_surface: Variant = world.call("surface_at", target)
	if not raw_surface is Dictionary:
		return "落点地形信息无效"
	var surface: Dictionary = raw_surface
	if surface.get("ready", false) != true:
		return "落点碰撞尚未就绪"
	if not _finite_number(surface.get("water_depth")) or float(surface.water_depth) > 0.15:
		return "海域没有干燥落脚点"
	if not _finite_number(surface.get("agl")) or float(surface.agl) < 0.65 or float(surface.agl) > 1.20:
		return "落点必须位于实体地表上方安全高度"
	return ""


func _begin_action(route: Dictionary) -> bool:
	var profile := {"action": ACTION, "release_time": 0.40,
		"duration": BLINK_DURATION, "release_normalized": 0.5}
	if player.call("play_combat_action", profile) != true:
		return false
	current.phase = "windup"
	current.target = route.target
	current.normal = route.normal
	current.combat_serial = int(player.get("combat_serial"))
	if is_instance_valid(ascension) and ascension.has_method("surface_blink_vfx"):
		ascension.call("surface_blink_vfx", current.origin, "start")
	return true


func _commit() -> void:
	# Revalidate after the complete source animation. The world must keep real
	# colliders pinned; loading, a changed target or a new obstacle aborts freely.
	var route := _prepare()
	var failure := _route_failure(route)
	if failure.is_empty():
		failure = _pending_failure()
	if failure.is_empty() and (route.target as Vector3).distance_to(current.target) > 0.10:
		failure = "准备中的地表发生变化，请重新选择落点"
	if not failure.is_empty():
		cancel(failure)
		return
	var target: Vector3 = route.target
	var saved := current.duplicate(true)
	if player.call("blink_to_prepared_surface", target, route.ticket) != true:
		cancel("落点体积或路径被阻挡，瞬移已取消")
		return
	# Commit once, only after Player accepts the exact position. Player clears
	# the source action. Do not call discard_pending here and cancel arrival.
	player.set("energy", maxf(0.0, float(player.get("energy")) - float(saved.cost)))
	cooldown_remaining = float(saved.cooldown)
	current.clear()
	if world.has_method("update_stream"):
		world.call("update_stream", player.global_position)
	_release_route()
	var arrival_started: bool = player.call("play_combat_action", {
		"action": ARRIVAL_ACTION, "release_time": 0.325,
		"duration": ARRIVAL_DURATION, "release_normalized": 0.5,
	}) == true
	last_result = {"ok": true, "pending": false, "reason": "地表瞬移完成",
		"origin": saved.origin, "target": player.global_position,
		"normal": route.normal, "distance": (saved.origin as Vector3).distance_to(player.global_position),
		"cost": saved.cost, "cooldown": cooldown_remaining,
		"serial": saved.serial, "arrival_started": arrival_started}
	resolved.emit(last_result.duplicate(true))


func _discard_pending() -> void:
	if not current.is_empty() and current.get("phase") == "windup" and is_instance_valid(player):
		if int(player.get("combat_serial")) == int(current.combat_serial) and player.has_method("cancel_combat_action"):
			player.call("cancel_combat_action")
	current.clear()
	_release_route()


func _release_route() -> void:
	if _owns_route and is_instance_valid(world) and world.has_method("cancel_surface_landing"):
		world.call("cancel_surface_landing", _route_token)
	_owns_route = false
	_route_token.clear()


func _aim() -> Vector3:
	var camera := player.get_node_or_null("CameraPivot/Camera3D") as Camera3D
	if camera == null:
		return Vector3.ZERO
	var direction := -camera.global_basis.z
	return direction.normalized() if direction.is_finite() else Vector3.ZERO


func _up(at: Vector3) -> Vector3:
	var value: Variant = world.call("up_at", at)
	return (value as Vector3).normalized() if value is Vector3 and (value as Vector3).is_finite() else Vector3.ZERO


func _origin_revision() -> int:
	var value: Variant = world.get("origin_revision")
	return int(value) if _finite_number(value) else 0


func _finite_number(value: Variant) -> bool:
	return (value is int or value is float) and is_finite(float(value))


func _focus_lost() -> void:
	cancel("失去窗口焦点，地表瞬移已取消")


func _exit_tree() -> void:
	_discard_pending()


func _fail(reason: String) -> Dictionary:
	return {"ok": false, "pending": false, "reason": reason}
