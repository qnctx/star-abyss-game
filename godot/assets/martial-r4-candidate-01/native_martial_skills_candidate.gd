extends Node
## R4 native martial slice. Combat authority, never a visual damage callback.
const VFX = preload("res://assets/martial-r4-candidate-01/native_vfx_martial_candidate.gd")
const ORDER := ["fist", "slash", "break", "descent"]
const RULES := {
	"fist": {"name": "崩拳", "realm": 0, "windup": 0.25, "recovery": 0.40, "cost": 5.0, "cooldown": 5.0, "reach": 1.8, "radius": 0.18, "speed": 0.0, "power": 35.0, "type": "blunt"},
	"slash": {"name": "风刃", "realm": 1, "windup": 0.30, "recovery": 0.30, "cost": 6.0, "cooldown": 6.0, "reach": 22.0, "radius": 0.28, "speed": 32.0, "power": 80.0, "type": "slash"},
	"break": {"name": "蓄力破岩", "realm": 0, "windup": 1.25, "recovery": 0.70, "cost": 9.0, "cooldown": 9.0, "reach": 2.5, "radius": 0.42, "speed": 12.0, "power": 150.0, "type": "blast"},
	"descent": {"name": "坠岳冲击", "realm": 6, "windup": 0.35, "recovery": 0.90, "cost": 18.0, "cooldown": 16.0, "reach": 12.0, "radius": 6.0, "speed": 0.0, "power": 900.0, "type": "blast"},
}
var game: Node
var player: NativePlayer
var selected := "fist"
var cooldowns: Dictionary = {}
var current: Dictionary = {}
var last_result: Dictionary = {}
var serial := 0
var epoch := ""
var held := false
var effect: Node3D
var _shape := SphereShape3D.new()
var _deformation_results: Dictionary = {}

func setup(owner_game: Node) -> void:
	game = owner_game
	player = game.player
	process_physics_priority = 5 # Read this frame's final skinned hand transform.
	epoch = "%d-%s" % [Time.get_unix_time_from_system() * 1000000, Crypto.new().generate_random_bytes(8).hex_encode()]
	get_window().focus_exited.connect(_focus_lost)
	if player.has_signal("descent_strike_landed"):
		player.connect("descent_strike_landed", _descent_landed)
	if player.has_signal("descent_strike_failed"):
		player.connect("descent_strike_failed", _descent_failed)
	if game.world.has_signal("surface_deformation_committed"):
		game.world.connect("surface_deformation_committed", _deformation_resolved)

func _focus_lost() -> void:
	held = false
	if not current.is_empty() and current.phase in ["charge", "windup", "descent"]:
		cancel("失去窗口焦点，蓄势取消")

func select_next() -> void:
	if not current.is_empty() or player._cast_active or game.mounted:
		return
	var index := ORDER.find(selected)
	for step in range(1, ORDER.size() + 1):
		var next: String = ORDER[(index + step) % ORDER.size()]
		if player.realm >= int(RULES[next].realm):
			selected = next
			game._notice("武技：" + String(RULES[next].name) + (" · 按住R蓄力，松开释放" if next == "break" else " · R施放"))
			return

func press() -> bool:
	held = true
	if not current.is_empty() or player._cast_active or player.health <= 0.0 or player._hurt_time > 0.0 or player.guarding or game.mounted or game.attack_ready > 0.0:
		return false
	var rule: Dictionary = RULES[selected]
	if selected == "descent" and (not player.flight_active or not player.has_method("begin_descent_strike")):
		game._notice("坠岳冲击需要R6御空，并准备安全落点")
		return false
	if player.realm < int(rule.realm):
		game._notice("此武技需要R%d" % int(rule.realm))
		return false
	if float(cooldowns.get(selected, 0.0)) > 0.0:
		game._notice("%s冷却 %.1f 秒" % [rule.name, cooldowns[selected]])
		return false
	if player.energy < float(rule.cost):
		game._notice("灵息不足")
		return false
	if player._r2 == null or not player._r2.names.has("cast_martial_" + selected):
		game._notice("武技动画库尚未就绪")
		return false
	var socket := _socket()
	if not socket.origin.is_finite():
		return false
	var profile := {"action": "cast_martial_" + selected, "release_time": rule.windup, "duration": float(rule.windup) + float(rule.recovery), "release_normalized": 0.5}
	if not player.play_combat_action(profile):
		return false
	serial += 1
	if selected != "descent":
		player.energy -= float(rule.cost)
		cooldowns[selected] = float(rule.cooldown)
	var rank := clampi(player.realm, 0, 9)
	current = {"kind": selected, "rule": rule, "phase": "charge" if selected == "break" else "windup", "age": 0.0, "charge": 0.0, "serial": player.combat_serial, "rank": rank, "air": player.flight_active, "cast_id": epoch + ":" + str(serial), "origin": socket.origin, "direction": _aim(), "travelled": 0.0, "hits": [], "environment_hits": 0, "power": float(rule.power)}
	game.attack_ready = float(profile.duration)
	effect = VFX.new()
	game.ascension.add_child(effect)
	effect.begin(selected, socket, _aim(), _up(socket.origin))
	_emit("start", false)
	game._notice(String(rule.name) + (" · 蓄势：松开R释放，右键取消" if selected == "break" else " · 起手"))
	for enemy in game._combat_targets():
		if enemy.has_method("observe_public_threat"):
			enemy.observe_public_threat({"phase": "windup", "shape": "line", "origin": socket.origin, "direction": _aim(), "range": rule.reach, "radius": rule.radius, "release_remaining": rule.windup})
	return true

func release_button() -> void:
	held = false
	if not current.is_empty() and current.kind == "descent":
		cancel("松开R，坠地冲击取消")
		return
	if current.is_empty() or current.phase != "charge":
		return
	if float(current.age) < 0.35:
		cancel("蓄力不足，已收势")
	else:
		_finish_charge()

func _finish_charge() -> void:
	current.charge = clampf((float(current.age) - 0.35) / 0.75, 0.0, 1.0)
	current.phase = "windup"
	# Continue from the held chamber into the authored drive, never skip contact.
	var progress_ratio := player._cast_elapsed / player._cast_windup
	player._cast_elapsed = progress_ratio * 0.95
	player._cast_windup = 0.95
	player._cast_duration = 1.65
	game.attack_ready = maxf(game.attack_ready, 0.9)
	var tier := clampf(float(current.rank) / 6.0, 0.0, 1.0)
	current.power = lerpf(75.0, lerpf(150.0, 1200.0, tier), float(current.charge))
	# A fresh, visible hip/shoulder drive cue follows the held chamber.
	for enemy in game._combat_targets():
		if enemy.has_method("observe_public_threat"):
			enemy.observe_public_threat({"phase": "windup", "shape": "line", "origin": _socket().origin, "direction": _aim(), "range": current.rule.reach, "radius": current.rule.radius, "release_remaining": player._cast_windup - player._cast_elapsed})

func cancel(reason := "武技已中断") -> void:
	if current.is_empty():
		return
	if current.phase == "travel":
		return # A projectile already released remains a physical threat.
	if current.phase == "cancelling":
		return
	var cancelled_phase := String(current.phase)
	var cancelled_kind := String(current.kind)
	current.phase = "cancelling"
	if current.kind == "descent" and player.has_method("cancel_descent_strike"):
		player.call("cancel_descent_strike", reason)
	_emit("cancel", false)
	if is_instance_valid(effect):
		effect.cancel()
	player.cancel_combat_action()
	if player.health > 0.0 and player._hurt_time <= 0.0 and not game.mounted:
		if cancelled_kind == "descent":
			if cancelled_phase == "descent":
				player.play_combat_action({"action": "cast_martial_descent_cancel", "release_time": 0.20, "duration": 0.40, "release_normalized": 0.5})
		else:
			player.play_combat_action({"action": "cast_martial_cancel", "release_time": 0.15, "duration": 0.30, "release_normalized": 0.5})
	game.attack_ready = maxf(0.30, minf(game.attack_ready, 0.45))
	current.clear()
	game._notice(reason)

func _physics_process(delta: float) -> void:
	if game == null or not game.initialized:
		return
	var dt := minf(delta, 0.05)
	for key in cooldowns:
		cooldowns[key] = maxf(0.0, float(cooldowns[key]) - dt)
	if current.is_empty():
		return
	current.age += dt
	if current.phase in ["charge", "windup"]:
		if player.health <= 0.0 or player._hurt_time > 0.0 or game.mounted or player.combat_serial != int(current.serial) or not player._cast_active or player.realm != int(current.rank):
			cancel("受击或状态变化，武技中断")
			return
		if player.guarding:
			cancel("已取消蓄势并收势")
			return
		var socket := _socket()
		if not socket.origin.is_finite():
			cancel("手部骨点不可用")
			return
		if is_instance_valid(effect):
			effect.follow(socket, _aim(), clampf(float(current.age) / 1.1, 0.0, 1.0))
		if current.phase == "charge":
			player._cast_elapsed = minf(0.75, float(current.age) * 2.0)
			game.attack_ready = maxf(game.attack_ready, 0.8)
			if float(current.age) >= 1.1:
				_finish_charge()
		elif player._cast_elapsed + 0.000001 >= player._cast_windup:
			if current.kind == "descent":
				_begin_descent()
			else:
				_launch(socket)
	elif current.phase == "travel":
		_travel(dt)
	elif current.phase == "descent":
		if player.health <= 0.0 or player._hurt_time > 0.0 or game.mounted or not player.flight_active or not held or player.get("descent_strike_active") != true:
			cancel("坠地冲击中止，恢复御空")
			return
		# Motion maps elapsed beyond windup over an infinite recovery to the
		# sampled release key, holding the same dive pose until real contact.
		player._cast_elapsed = player._cast_windup
		game.attack_ready = maxf(game.attack_ready, 0.4)
		if is_instance_valid(effect):
			effect.follow_descent_anchors(player, _up(player.global_position))

func _begin_descent() -> void:
	current.strike_serial = Time.get_ticks_usec() + serial
	if not held or player.energy < float(current.rule.cost) or not player.call("begin_descent_strike", int(current.strike_serial)):
		cancel("落点尚未就绪或不适合冲击")
		return
	player.energy -= float(current.rule.cost)
	cooldowns.descent = float(current.rule.cooldown)
	current.phase = "descent"
	# Preserve the exact progress already applied by Motion this frame. Its
	# contact mapping is release + (1-release)*(elapsed-windup)/(duration-windup).
	# An unbounded recovery holds that sampled key without returning to windup.
	player._cast_release_normalized = clampf(player._r2._action_progress, 0.0, 1.0)
	player._cast_elapsed = player._cast_windup
	player._cast_duration = INF
	if is_instance_valid(effect):
		effect.release(_socket().origin, -_up(player.global_position))
		effect.follow_descent_anchors(player, _up(player.global_position))
	_emit("descent", false)

func _descent_failed(cast_serial: int, reason: String) -> void:
	if not current.is_empty() and current.phase != "cancelling" and int(current.get("strike_serial", -1)) == cast_serial:
		cancel("坠地冲击取消：" + reason)

func _descent_landed(cast_serial: int, point: Vector3, normal: Vector3, speed: float) -> void:
	if current.is_empty() or current.kind != "descent" or current.phase != "descent" or int(current.get("strike_serial", -1)) != cast_serial:
		return
	if not held or player.health <= 0.0 or player._hurt_time > 0.0 or game.mounted or player.realm != int(current.rank):
		cancel("触地前状态变化，冲击取消")
		return
	var rank := int(current.rank)
	var radius := lerpf(6.0, 12.0, clampf((rank - 6.0) / 3.0, 0.0, 1.0))
	var power := lerpf(900.0, 1800.0, clampf((rank - 6.0) / 3.0, 0.0, 1.0)) * clampf(speed / 25.0, 0.7, 1.0)
	var origin := point + normal * 0.2
	current.phase = "contact" # Reentrant duplicate land signal cannot hit twice.
	current.origin = origin
	var environment := get_tree().get_first_node_in_group("native_environment_damage")
	var terrain_result: Dictionary = {}
	var deformation_id := "player:%s:0" % String(current.cast_id)
	_deformation_results[deformation_id] = {"pending": true}
	if _deformation_results.size() > 4:
		_deformation_results.erase(_deformation_results.keys()[0])
	if environment != null:
		terrain_result = environment.damage({"origin": point, "radius": radius, "power": power, "damage_type": "blast", "source": "player", "cast_id": current.cast_id, "phase": 0, "occlusion_origin": origin, "exclude_rids": [player.get_rid()], "falloff": "linear", "max_targets": 24, "deform_surface": true, "depth": lerpf(1.0, 2.5, (radius - 6.0) / 6.0), "normal": normal})
		current.environment_hits = terrain_result.get("hits", []).size()
	for enemy in game._combat_targets():
		if enemy.mode == "dead":
			continue
		var body: Vector3 = enemy.global_position + _up(enemy.global_position) * 1.2
		var distance: float = enemy.body_contact_distance(origin)
		if distance >= radius:
			continue
		var ray := PhysicsRayQueryParameters3D.create(origin, body, 17, [player.get_rid()])
		var block := player.get_world_3d().direct_space_state.intersect_ray(ray)
		if not block.is_empty() and block.get("collider") != enemy:
			continue
		var strength := 1.0 - distance / radius
		var impulse: Vector3 = (body - origin).normalized() * 7.0 * strength
		var result: Dictionary = enemy.receive_combat_hit({"action_id": "cast_martial_descent", "cast_id": current.cast_id, "source": origin, "damage": 12.0 * pow(6.0, rank) * 1.8 * strength, "stagger": 0.4 * strength, "guard_break": strength > 0.5, "knockback": impulse, "hitstop": 0.06})
		if result.get("landed", false):
			current.hits.append(enemy.get_instance_id())
	if is_instance_valid(effect):
		effect.shock(point + normal * 0.08, normal, radius)
	last_result = {"kind": "descent", "cast_id": current.cast_id, "point": point, "speed": speed, "environment_hits": current.environment_hits, "enemy_hits": current.hits.duplicate(), "deformation_requested": terrain_result.has("deformation_request")}
	last_result["deformation"] = _deformation_results[deformation_id].duplicate()
	_emit("impact", true)
	player.cancel_combat_action()
	player.play_combat_action({"action": "cast_martial_landing", "release_time": 0.18, "duration": 0.9, "release_normalized": 0.18})
	game.attack_ready = 0.9
	game._notice("坠岳冲击触地 · 环境命中%d · %s" % [int(current.environment_hits), _deformation_message(last_result.deformation)])
	current.clear()

func _deformation_message(result: Dictionary) -> String:
	if result.get("pending", false):
		return "地形正在重建"
	if result.get("applied", false):
		return "冲击坑已形成"
	var reasons := {"budget_exhausted": "地形记录已达上限", "budget": "地形记录已达上限", "overlap": "此处已有冲击坑", "rebuild_busy": "地形正在处理另一冲击", "invalid_ground": "此处地表不适合成坑"}
	return String(reasons.get(String(result.get("reason", "")), "地形未变形，原碰撞已保留"))

func _deformation_resolved(result: Dictionary) -> void:
	var id := String(result.get("id", ""))
	if not _deformation_results.has(id):
		return
	_deformation_results[id] = result.duplicate(true)
	if not last_result.is_empty() and id == "player:%s:0" % String(last_result.get("cast_id", "")):
		last_result["deformation"] = result.duplicate(true)
		game._notice(_deformation_message(result))

func _launch(socket: Transform3D) -> void:
	current.phase = "travel"
	current.origin = socket.origin
	current.position = socket.origin
	current.direction = _aim() # Lock a finite direction at release, no homing.
	current.release_body = player.global_position
	_emit("release", false)
	if is_instance_valid(effect):
		effect.release(socket.origin, current.direction)
	# A skinned hand may extend into/through a wall although the body is clear.
	# Resolve that body-to-hand obstruction before any projectile may depart.
	var chest := player.global_position + _up(player.global_position) * 1.25
	var socket_ray := PhysicsRayQueryParameters3D.create(chest, socket.origin, 17, [player.get_rid()])
	var socket_block := player.get_world_3d().direct_space_state.intersect_ray(socket_ray)
	if not socket_block.is_empty():
		_contact_segment(chest, socket_block.position, true)
		return
	if current.kind == "fist":
		# Skin contact only: 1.8m is an upper bound, never a fictitious long fist.
		_contact_segment(socket.origin - current.direction * 0.12, socket.origin + current.direction * 0.14, true)
	else:
		_travel(0.0)

func _travel(dt: float) -> void:
	var rule: Dictionary = current.rule
	var remaining := float(rule.reach) - float(current.travelled)
	var stride := minf(remaining, float(rule.speed) * dt)
	if stride <= 0.0:
		return
	var from: Vector3 = current.position
	var to: Vector3 = from + current.direction * stride
	current.travelled += stride
	_contact_segment(from, to, false)
	if current.is_empty():
		return
	current.position = to
	if is_instance_valid(effect):
		effect.travel(to)
	if float(current.travelled) >= float(rule.reach) - 0.0001:
		_end(to, Vector3.UP, false)

func _contact_segment(from: Vector3, to: Vector3, melee: bool) -> void:
	var rule: Dictionary = current.rule
	var radius := float(rule.radius)
	var solid := _sweep_solid(from, to, radius)
	var stop: Vector3 = solid.get("center", to)
	var surface_point: Vector3 = solid.get("point", stop)
	var closest: NativeEnemyR3 = null
	var closest_t := INF
	var closest_point := stop
	for enemy in game._combat_targets():
		if solid.get("initial_overlap", false):
			break # A world solid already overlaps the swept volume; never reach through it.
		if enemy.mode == "dead":
			continue
		var body: Vector3 = enemy.global_position + _up(enemy.global_position) * 1.2
		var contact := Geometry3D.get_closest_point_to_segment(body, from, stop)
		var gap: float = enemy.body_contact_distance(contact)
		if gap > radius:
			continue
		if melee and enemy.body_contact_distance(current.release_body + _up(player.global_position)) > float(rule.reach):
			continue
		if not _target_visible(from, body, enemy):
			continue
		var distance := from.distance_squared_to(contact)
		if distance < closest_t:
			closest = enemy
			closest_t = distance
			closest_point = contact
	if closest != null:
		var rank := int(current.rank)
		# D3-19 native level-one base attack; no hidden mastery or weapon bonus.
		var base := 12.0 * pow(6.0, rank)
		var damage := (5.0 * pow(6.0, rank) + 1.25 * base) if current.kind == "fist" else (4.0 * pow(6.0, rank) + 1.25 * base)
		if current.kind == "break":
			damage = base * lerpf(1.0, 1.8, float(current.charge))
		var result: Dictionary = closest.receive_combat_hit({"action_id": "cast_martial_" + String(current.kind), "cast_id": current.cast_id, "damage": damage, "stagger": 0.32 if current.kind == "break" else 0.18, "guard_break": current.kind == "break" and float(current.charge) > 0.8, "knockback": current.direction * (4.0 if current.kind == "break" else 1.5), "hitstop": 0.045, "source": from})
		if result.get("landed", false):
			current.hits.append(closest.get_instance_id())
		_end(closest_point, -current.direction, result.get("landed", false))
		return
	var environment := get_tree().get_first_node_in_group("native_environment_damage")
	if environment != null:
		# Enemy/visual stop remains the safe center. The same cast's bounded unsafe
		# center includes actual contact; contact_rid restricts environmental
		# candidates to the authoritative first body, never a target behind it.
		var environment_stop: Vector3 = solid.get("unsafe_center", stop)
		var segment := environment_stop - from
		var query := {"origin": from, "radius": radius, "direction": segment.normalized() if not segment.is_zero_approx() else current.direction, "reach": segment.length(), "power": current.power, "damage_type": rule.type, "source": "player", "cast_id": current.cast_id, "phase": 0, "occlusion_origin": current.origin, "exclude_rids": [player.get_rid()], "max_targets": 1, "stop_on_first": true}
		if not solid.is_empty():
			query["contact_rid"] = solid.get("rid", RID())
			query["contact_point"] = surface_point
			query["contact_normal"] = solid.get("normal", Vector3.ZERO)
			query["contact_shape"] = solid.get("shape", -1)
		var response: Dictionary = environment.damage(query)
		current["contact"] = {"from": from, "to": to, "safe": stop, "unsafe": environment_stop, "surface": surface_point, "radius": radius, "solid": solid.duplicate(), "query": query.duplicate(), "response": response.duplicate(true)}
		if response.get("budget_exhausted", false):
			_end(surface_point, -current.direction, false)
			game._notice("环境记录已达预算，未破坏新的目标")
			return
		var hits: Array = response.get("hits", [])
		if not hits.is_empty():
			var hit: Dictionary = hits[0]
			current.environment_hits += hits.size()
			_end(hit.get("point", stop), hit.get("normal", -current.direction), true)
			return
	if not solid.is_empty():
		_end(surface_point, solid.get("normal", -current.direction), true)
	elif melee:
		_end(to, -current.direction, false)

func _target_visible(from: Vector3, body: Vector3, enemy: NativeEnemyR3) -> bool:
	var ray := PhysicsRayQueryParameters3D.create(from, body, 17, [player.get_rid()])
	var hit := player.get_world_3d().direct_space_state.intersect_ray(ray)
	if hit.is_empty():
		return true
	var node: Node = hit.get("collider") as Node
	while node != null:
		if node == enemy:
			return true
		node = node.get_parent()
	return false

func _sweep_solid(from: Vector3, to: Vector3, radius: float) -> Dictionary:
	_shape.radius = radius
	var query := PhysicsShapeQueryParameters3D.new()
	query.shape = _shape
	query.transform = Transform3D(Basis.IDENTITY, from)
	query.motion = to - from
	query.collision_mask = 17
	query.exclude = [player.get_rid()]
	var space := player.get_world_3d().direct_space_state
	# cast_motion intentionally ignores initial overlap; inspect it explicitly.
	var initial_motion := query.motion
	query.motion = Vector3.ZERO
	var overlap := space.intersect_shape(query, 32)
	if not overlap.is_empty():
		var initial_rest := space.get_rest_info(query)
		var initial_rid: RID = initial_rest.get("rid", RID())
		var unambiguous := initial_rid.is_valid()
		for hit: Dictionary in overlap:
			if hit.get("rid", RID()) != initial_rid:
				unambiguous = false
		# Contact proof must be one coherent body/shape/point/normal. Several
		# overlapping bodies have no unique first impact: stop, without damage.
		return {"initial_overlap": true, "ambiguous_overlap": not unambiguous, "overlap_count": overlap.size(), "center": from, "unsafe_center": from, "point": initial_rest.get("point", from), "normal": initial_rest.get("normal", -current.direction), "shape": initial_rest.get("shape", -1), "rid": initial_rid if unambiguous else RID()}
	query.motion = initial_motion
	var fraction := space.cast_motion(query)
	if fraction.size() >= 2 and fraction[0] < 1.0:
		var point := from.lerp(to, fraction[0])
		var unsafe_center := from.lerp(to, clampf(fraction[1], 0.0, 1.0))
		query.transform.origin = unsafe_center
		query.motion = Vector3.ZERO
		var rest := space.get_rest_info(query)
		return {"center": point, "unsafe_center": unsafe_center, "shape": rest.get("shape", -1), "point": rest.get("point", point), "normal": rest.get("normal", -(to - from).normalized()), "rid": rest.get("rid", RID())}
	var ray := PhysicsRayQueryParameters3D.create(from, to, 17, [player.get_rid()])
	var hit := space.intersect_ray(ray)
	return {"center": hit.position, "unsafe_center": hit.position, "shape": hit.get("shape", -1), "point": hit.position, "normal": hit.normal, "rid": hit.rid} if not hit.is_empty() else {}

func _end(at: Vector3, normal: Vector3, landed: bool) -> void:
	last_result = {"kind": current.kind, "cast_id": current.cast_id, "landed": landed, "enemy_hits": current.hits.duplicate(), "environment_hits": current.environment_hits, "point": at, "power": current.power, "contact": current.get("contact", {})}
	if is_instance_valid(effect):
		effect.impact(at, normal, landed, 0.62 if current.kind == "break" else 0.35)
	_emit("impact" if landed else "miss", landed)
	game._notice(String(current.rule.name) + (" · 命中" if landed else " · 落空"))
	current.clear()

func _socket() -> Transform3D:
	var right := player.combat_socket_transform_world("hand_r")
	if (not current.is_empty() and current.kind == "break") or (current.is_empty() and selected == "break"):
		var left := player.combat_socket_transform_world("hand_l")
		if left.origin.is_finite() and right.origin.is_finite():
			right.origin = right.origin.lerp(left.origin, 0.5)
	return right

func _aim() -> Vector3:
	var camera: Camera3D = player.get_node("CameraPivot/Camera3D")
	return -camera.global_basis.z.normalized()

func _up(at: Vector3) -> Vector3:
	return game.world.up_at(at) if game.world.planet_enabled else Vector3.UP

func _emit(phase: String, hit: bool) -> void:
	game.combat_event.emit({"phase": phase, "action": "cast_martial_" + String(current.kind), "cast_id": current.cast_id, "hit": hit, "time": game.time, "physics_delta": game.last_combat_physics_delta, "player_position": player.global_position})

func hint() -> String:
	var rule: Dictionary = RULES[selected]
	var cd := float(cooldowns.get(selected, 0.0))
	return "%s · 灵息%d · %s" % [rule.name, int(rule.cost), "冷却%.1fs" % cd if cd > 0.0 else ("按住R" if selected in ["break", "descent"] else "就绪")]

func snapshot() -> Dictionary:
	return {"version": 1, "selected": selected, "cooldowns": cooldowns.duplicate()}

func restore(data: Dictionary) -> void:
	selected = String(data.get("selected", "fist"))
	if not RULES.has(selected) or player.realm < int(RULES.get(selected, {}).get("realm", 0)):
		selected = "fist"
	var saved: Dictionary = data.get("cooldowns", {}) if data.get("cooldowns", {}) is Dictionary else {}
	for key in RULES:
		cooldowns[key] = clampf(float(saved.get(key, 0.0)), 0.0, float(RULES[key].cooldown))
