extends Node3D
class_name NativeEnemyR3

signal defeated
signal enemy_attack_requested(event: Dictionary)
signal enemy_skill_event(event: Dictionary)
signal enemy_defeated(event: Dictionary)

const MAX_HP := 311040.0
const HOME_X := 1370.0
const HOME_Z := -1030.0
# Gameplay seconds; aim is committed before the active motion begins.
const MOVES := {
	"claw": {"windup": 0.48, "active": 0.14, "recovery": 0.82, "cooldown": 2.1, "reach": 0.75, "radius": 0.63, "damage": 4200.0, "clip": "ground-claw", "contact": 0.4, "bone": "RF_Foot", "speed": 0.0, "guard_break": false},
	"lunge": {"windup": 0.82, "active": 0.36, "recovery": 1.18, "cooldown": 5.2, "reach": 0.8, "radius": 0.68, "damage": 6221.0, "clip": "r3-lunge", "contact": 0.82, "bone": "RF_Foot", "speed": 13.0, "guard_break": false},
	"tail": {"windup": 0.72, "active": 0.22, "recovery": 1.0, "cooldown": 4.2, "reach": 0.55, "radius": 0.75, "damage": 4600.0, "clip": "r3-tail", "contact": 0.72, "bone": "Tail02", "speed": 0.0, "guard_break": false},
	"rise": {"windup": 0.86, "active": 0.30, "recovery": 1.18, "cooldown": 6.0, "reach": 1.0, "radius": 0.8, "damage": 6100.0, "clip": "r3-rise", "contact": 0.86, "bone": "RF_Foot", "speed": 4.0, "guard_break": false},
	"shard": {"windup": 1.05, "active": 0.12, "recovery": 1.05, "cooldown": 5.8, "reach": 32.0, "radius": 0.52, "damage": 4800.0, "clip": "r3-shard", "contact": 1.05, "bone": "Head", "speed": 0.0, "guard_break": false},
	"sweep": {"windup": 0.65, "active": 0.20, "recovery": 1.1, "cooldown": 3.4, "reach": 0.7, "radius": 0.85, "damage": 5600.0, "clip": "sweep", "contact": 0.45, "bone": "Wing_R_Tip", "speed": 1.8, "guard_break": false},
	"dive": {"windup": 0.95, "active": 0.50, "recovery": 1.40, "cooldown": 6.5, "reach": 0.8, "radius": 0.78, "damage": 7000.0, "clip": "dive", "contact": 0.50, "bone": "Head", "speed": 18.0, "guard_break": true},
}

var world: NativeWorld
var target: NativePlayer
var hp := MAX_HP
var max_hp := MAX_HP
var variant := "elite"
var home := Vector3(HOME_X, 0.0, HOME_Z)
var mode := "ground"
var phase := "idle"
var tactic := "watch"
var clock := 0.0
var mode_since := 0.0
var phase_since := 0.0
var aggro_until := 0.0
var attack_kind := ""
var contacted := false
var loot_left := 0
var visual_animation: AnimationPlayer
var current_clip := ""
var last_physics_delta := 0.0
var total_physics_time := 0.0
var attack_serial := 0
var cooldowns: Dictionary = {}
var _hitstop_left := 0.0
var _body_mesh: MeshInstance3D
var _skeleton: Skeleton3D
var _locked_direction := Vector3.FORWARD
var _locked_point := Vector3.ZERO
var _last_seen := Vector3.ZERO
var _next_sense := 0.0
var _perceived := false
var _ai := NativeAIDecision.new()
var _evade_until := 0.0
var _evade_goal := Vector3.ZERO
var _returning := false
var _attack_elapsed := 0.0
var _decision_ready := 0.0
var _orbit_side := 1.0
var _stuck_time := 0.0
var _hurt_left := 0.0
var _impulse := Vector3.ZERO
var _shot: Dictionary = {}
var _shot_visual: Node3D
var _probe := SphereShape3D.new()
var _last_attack_result := -1
var _authored_r3 := false
var _land_after_attack := false

func configure_variant(kind: String, spawn: Vector3) -> void:
	variant = "ground" if kind == "ground" else "elite"
	max_hp = 86400.0 if variant == "ground" else MAX_HP
	hp = max_hp
	home = spawn
	_orbit_side = -1.0 if variant == "ground" else 1.0

func setup(w: NativeWorld, p: NativePlayer) -> void:
	world = w
	target = p
	_ai.reset()
	home.y = world.height_at(home.x, home.z)
	global_position = home
	visual_animation = _find_animation(self)
	for node in find_children("*", "Skeleton3D", true, false):
		_skeleton = node as Skeleton3D
		break
	for mesh in find_children("*", "MeshInstance3D", true, false):
		if "Body" in String(mesh.name) or "Prowler" in String(mesh.name):
			_body_mesh = mesh as MeshInstance3D
			break
	_probe.radius = 0.68
	if visual_animation != null:
		visual_animation.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
		_authored_r3 = not _clip_name("r3-lunge").is_empty()
	_play("ground-idle")
	_animate(0.0)

func _find_animation(node: Node) -> AnimationPlayer:
	if node is AnimationPlayer:
		return node as AnimationPlayer
	for child in node.get_children():
		var found := _find_animation(child)
		if found != null:
			return found
	return null

func _clip_name(clip: String) -> String:
	if visual_animation == null:
		return ""
	for item in visual_animation.get_animation_list():
		if String(item) == clip or String(item).ends_with("/" + clip):
			return String(item)
	return ""

func _play(clip: String, restart := false) -> void:
	if current_clip == clip and not restart:
		return
	var name := _clip_name(clip)
	if name.is_empty():
		name = _clip_name({"ground-idle": "idle", "ground-walk": "walk", "ground-claw": "attack"}.get(clip, clip))
	if name.is_empty():
		return
	current_clip = clip
	visual_animation.play(name, 0.10)
	visual_animation.advance(0.0)

func _animate(dt: float) -> void:
	if visual_animation == null:
		return
	var speed := 1.0
	if not _authored_r3 and phase in ["windup", "active", "recovery"] and MOVES.has(attack_kind):
		var move: Dictionary = MOVES[attack_kind]
		speed = float(move["contact"]) / float(move["windup"])
	visual_animation.advance(dt * speed)
	if _skeleton != null:
		_skeleton.force_update_all_bone_transforms()

func body_contact_distance(point: Vector3) -> float:
	if _body_mesh == null or not point.is_finite():
		return INF
	var local := _body_mesh.to_local(point)
	var box := _body_mesh.get_aabb()
	var nearest := Vector3(clampf(local.x, box.position.x, box.end.x), clampf(local.y, box.position.y, box.end.y), clampf(local.z, box.position.z, box.end.z))
	return point.distance_to(_body_mesh.to_global(nearest))

func _bone_point(bone: String) -> Vector3:
	if _skeleton != null:
		var index := _skeleton.find_bone(bone)
		if index >= 0:
			return _skeleton.to_global(_skeleton.get_bone_global_pose(index).origin)
	return Vector3(INF, INF, INF)

func _physics_process(delta: float) -> void:
	last_physics_delta = delta
	total_physics_time += delta
	if world == null or not is_instance_valid(target) or delta <= 0.0:
		return
	# Preserve the engine's actual timestep, including slow physical frames.
	var dt := delta
	var frozen := minf(dt, _hitstop_left)
	_hitstop_left -= frozen
	dt -= frozen
	_step_projectile(delta)
	if dt <= 0.0:
		return
	clock += dt
	if mode == "dead":
		_animate(dt)
		_settle(dt, 14.0)
		return
	_sense()
	if mode == "air" and _perceived and clock - mode_since > 2.5:
		_land_after_attack = _last_seen.y - world.height_at(_last_seen.x, _last_seen.z) < 1.0
	if _impulse.length_squared() > 0.001:
		_move_step(_impulse * dt, true)
		_impulse = _impulse.move_toward(Vector3.ZERO, 24.0 * dt)
	if phase == "hurt":
		_animate(dt)
		_hurt_left -= dt
		if mode == "ground":
			_settle(dt, 8.0)
		if _hurt_left <= 0.0:
			phase = "idle"
			phase_since = clock
			_decision_ready = clock + 0.28
		return
	if _returning:
		_step_return(dt)
		_animate(dt)
		return
	if phase in ["windup", "active", "recovery"]:
		_step_attack(dt)
		return
	if mode == "takeoff":
		_animate(dt)
		_move_step(Vector3.UP * 4.0 * dt, true)
		if clock - mode_since >= 1.2:
			_mode("air")
		return
	if mode == "landing":
		_animate(dt)
		_settle(dt, 7.5)
		if clock - mode_since >= 1.3 and global_position.y <= world.height_at(global_position.x, global_position.z) + 0.06:
			_mode("ground")
			_decision_ready = clock + 0.7
		return
	if clock >= aggro_until:
		tactic = "watch"
		_play("ground-idle")
		_animate(dt)
		return
	if _perceived and clock >= _decision_ready and clock >= _evade_until:
		var evade := _ai.evade_goal(clock, global_position + Vector3.UP, _orbit_side)
		if not evade.is_empty():
			var candidate: Vector3 = evade["goal"]
			if _clear_step(global_position.move_toward(candidate, 0.35), mode == "air"):
				_evade_goal = candidate
				_evade_until = clock + 0.48
				_decision_ready = _evade_until + 0.24
			else:
				_orbit_side *= -1.0
	if clock < _evade_until:
		tactic = "evade"
		_move_to(_evade_goal, 8.0 if mode == "air" else 3.8, dt, mode == "air")
		_face_target(_last_seen, dt)
		_play("flight" if mode == "air" else "ground-walk")
		_animate(dt)
		return
	var offset := _last_seen - global_position
	var distance := Vector2(offset.x, offset.z).length()
	var target_agl := _last_seen.y - world.height_at(_last_seen.x, _last_seen.z)
	if variant == "elite" and mode == "ground" and target_agl > 3.0 and clock - mode_since > 2.0:
		if distance < 6.0 and offset.y < 7.0 and _available("rise"):
			_attack("rise")
		elif _clear_step(global_position + Vector3.UP * 1.5, true):
			_mode("takeoff")
		return
	if mode == "air" and target_agl < 1.0 and clock - mode_since > 2.5:
		if distance < 9.0 and _available("dive"):
			_attack("dive")
		else:
			_mode("landing")
		return
	if _perceived and clock >= _decision_ready and not _ai.cautious(clock):
		var choice := _choose_attack(distance, offset.y)
		if not choice.is_empty():
			_attack(choice)
			return
	# Decisions read sensed position only, never input, guarding or player CDs.
	var toward := Vector3(offset.x, 0.0, offset.z).normalized()
	var side := Vector3(-toward.z, 0.0, toward.x) * _orbit_side
	var desired := _last_seen
	var speed := 9.5 if mode == "air" else 3.8
	if _perceived and _ai.should_withdraw(clock, hp / max_hp):
		tactic = "withdraw"
		desired = global_position - toward * 5.0 + side * 2.0
		speed = 7.0 if mode == "air" else 4.2
	elif distance < 1.55:
		tactic = "retreat"
		desired = global_position - toward * 2.0 + side
		speed = 2.4
	elif distance < 5.0 and (clock < _decision_ready or _ai.cautious(clock)):
		tactic = "circle"
		desired = global_position + side * 2.0
		speed = 2.0
	else:
		tactic = "pursue"
	if mode == "air":
		desired.y = minf(_last_seen.y + 0.3, home.y + 64.0)
	_move_to(desired, speed, dt, mode == "air", 1.8 if tactic == "pursue" else 0.0)
	_face_target(_last_seen, dt)
	_play("flight" if mode == "air" else "ground-walk")
	_animate(dt)

func _sense() -> void:
	if clock < _next_sense:
		return
	_next_sense = clock + 0.22
	var home_distance := Vector2(global_position.x - home.x, global_position.z - home.z).length()
	var target_home := Vector2(target.global_position.x - home.x, target.global_position.z - home.z).length()
	if home_distance > 112.0 or target_home > 130.0 or absf(target.global_position.y - home.y) > 72.0 or target.health <= 0.0:
		_begin_return()
		return
	var offset := target.global_position - global_position
	var sense_range := 65.0 if clock < aggro_until else 42.0
	_perceived = offset.length() <= sense_range and _line_clear(global_position + Vector3.UP * 1.25, target.global_position + Vector3.UP * 0.85)
	_ai.observe(clock, target.global_position, _perceived)
	if _perceived and not _returning:
		_last_seen = _ai.last_seen
		aggro_until = clock + 4.5
	elif clock >= aggro_until and global_position.distance_to(home) > 1.5:
		_begin_return()

func _begin_return() -> void:
	if _returning:
		return
	_cancel_attack("leash")
	_returning = true
	_perceived = false
	aggro_until = 0.0
	tactic = "return"
	if mode in ["air", "takeoff"]:
		_mode("landing")

func _step_return(dt: float) -> void:
	if mode == "landing":
		_settle(dt, 7.5)
		if global_position.y <= world.height_at(global_position.x, global_position.z) + 0.06:
			_mode("ground")
		return
	_move_to(home, 4.5, dt, false, 0.35)
	_play("ground-walk")
	if global_position.distance_to(home) < 0.65:
		_returning = false
		tactic = "watch"
		_decision_ready = clock + 1.0
		# Returning does not heal away the player's damage.
		_play("ground-idle")

func _available(kind: String) -> bool:
	if kind == "shard" and not ResourceLoader.exists("res://assets/enemy-r3/rift-shard-r3.glb"):
		return false
	return clock >= float(cooldowns.get(kind, 0.0)) and not _clip_name(String(MOVES[kind]["clip"])).is_empty()

func _choose_attack(distance: float, height: float) -> String:
	var toward := Vector3(_last_seen.x - global_position.x, 0.0, _last_seen.z - global_position.z).normalized()
	var facing := (-global_basis.z).dot(toward)
	if mode == "ground" and facing < 0.35 and distance < 2.8 and absf(height) < 1.8 and _available("tail"):
		return "tail"
	if facing < 0.7:
		return ""
	if mode == "air":
		if distance <= 7.5 and height < -1.5 and _available("dive"):
			return "dive"
		if distance < 3.4 and absf(height) < 2.4 and _available("sweep"):
			return "sweep"
		if distance > 8.0 and distance < 29.0 and _available("shard"):
			return "shard"
	else:
		if height > 2.0 and height < 6.5 and distance < 4.6 and _available("rise"):
			return "rise"
		if absf(height) < 2.2:
			if distance < 2.5 and _available("claw"):
				return "claw"
			if distance > 4.3 and distance < 8.5 and _available("lunge"):
				return "lunge"
		if distance > 9.0 and distance < 29.0 and _available("shard"):
			return "shard"
	return ""

func _attack(kind: String) -> void:
	if mode == "dead" or not MOVES.has(kind) or not _available(kind):
		return
	attack_kind = kind
	attack_serial += 1
	contacted = false
	_attack_elapsed = 0.0
	phase = "windup"
	phase_since = clock
	tactic = "attack"
	# Lead uses two visible position samples. Teleports and lost sight clear velocity.
	_locked_point = (_ai.predict(clock, float(MOVES[kind]["windup"]) * 0.5) if _perceived and kind in ["lunge", "dive", "shard"] else _last_seen) + Vector3.UP * 0.85
	_locked_direction = (_locked_point - (global_position + Vector3.UP * 1.0)).normalized()
	if kind not in ["dive", "shard", "rise"]:
		_locked_direction.y = 0.0
		_locked_direction = _locked_direction.normalized()
	cooldowns[kind] = clock + float(MOVES[kind]["cooldown"])
	_play(String(MOVES[kind]["clip"]), true)
	enemy_skill_event.emit(_phase_event("start"))

func _step_attack(dt: float) -> void:
	var move: Dictionary = MOVES[attack_kind]
	var windup := float(move["windup"])
	var active := float(move["active"])
	var previous := _attack_elapsed
	_attack_elapsed += dt
	if phase == "windup" and attack_kind != "tail" and _attack_elapsed < windup * 0.48:
		_face_target(_locked_point, dt)
	var active_dt := maxf(0.0, minf(_attack_elapsed, windup + active) - maxf(previous, windup))
	if active_dt > 0.0:
		var travel := _locked_direction * float(move["speed"]) * active_dt
		if attack_kind == "rise":
			travel.y += 9.0 * active_dt
		_move_step(travel, mode == "air" or attack_kind in ["rise", "dive"])
	_animate(dt)
	if phase == "windup" and _attack_elapsed >= windup:
		phase = "active"
		phase_since = clock
		enemy_skill_event.emit(_phase_event("release"))
	var contact_at := windup + (active * 0.65 if attack_kind in ["lunge", "dive", "rise"] else 0.0)
	if not contacted and _attack_elapsed >= contact_at:
		contacted = true
		if attack_kind == "shard":
			_launch_shard()
		else:
			_request_contact()
	if _attack_elapsed >= windup + active and phase != "recovery":
		phase = "recovery"
		phase_since = clock
		enemy_skill_event.emit(_phase_event("recovery"))
	if phase == "recovery" and attack_kind in ["rise", "dive"] and mode != "air":
		_settle(dt, 7.5)
	if _attack_elapsed >= windup + active + float(move["recovery"]):
		phase = "idle"
		phase_since = clock
		_decision_ready = clock + 0.32
		_orbit_side *= -1.0
		enemy_skill_event.emit(_phase_event("end"))
		if mode == "air" and _land_after_attack:
			_land_after_attack = false
			_mode("landing")
		else:
			_play("flight" if mode == "air" else "ground-idle")

func _phase_event(which: String) -> Dictionary:
	return {"enemy": self, "source_id": get_instance_id(), "attack_id": attack_kind, "phase": which, "serial": attack_serial, "position": global_position, "direction": _locked_direction, "clock": clock}

func _contact_event(origin: Vector3, reach := -1.0) -> Dictionary:
	var move: Dictionary = MOVES[attack_kind]
	return {"enemy": self, "source_id": get_instance_id(), "attack_id": attack_kind, "serial": attack_serial,
		"origin": origin, "direction": _locked_direction, "reach": float(move["reach"]) if reach < 0.0 else reach,
		"radius": float(move["radius"]), "damage": float(move["damage"]) * (0.62 if variant == "ground" else 1.0),
		"stagger": 0.42, "guard_break": bool(move["guard_break"]), "knockback": _locked_direction * (9.0 if attack_kind == "dive" else 5.0) + (Vector3.UP * 5.0 if attack_kind == "rise" else Vector3.ZERO)}

func _request_contact() -> void:
	var point := _bone_point(String(MOVES[attack_kind]["bone"]))
	if point.is_finite():
		_dispatch_attack(_contact_event(point))

func _dispatch_attack(event: Dictionary) -> void:
	if enemy_attack_requested.get_connections().is_empty():
		# R2 standalone scenes stay playable; integrated R3 owns its damage.
		var origin: Vector3 = event["origin"]
		var end: Vector3 = origin + (event["direction"] as Vector3) * float(event["reach"])
		var center := target.global_position + Vector3.UP * 0.86
		var nearest := Geometry3D.get_closest_point_to_segment(center, origin, end)
		if nearest.distance_to(center) <= float(event["radius"]) + 0.48 and _line_clear(origin, center):
			target.apply_hit(event["direction"], float(event["damage"]))
			acknowledge_attack_result(int(event["serial"]), true, target.guarding)
	else:
		enemy_attack_requested.emit(event)

func acknowledge_attack_result(serial: int, landed: bool, blocked := false) -> void:
	if serial != attack_serial or serial == _last_attack_result or not landed:
		return
	_last_attack_result = serial
	begin_hitstop(0.045 if blocked else 0.055)
	if blocked:
		_decision_ready = maxf(_decision_ready, clock + 0.65)

func _launch_shard() -> void:
	var point := _bone_point("Head")
	if not point.is_finite():
		return
	_shot = {"position": point, "direction": _locked_direction, "life": 1.4, "event": _contact_event(point, 0.0)}
	var path := "res://assets/enemy-r3/rift-shard-r3.glb"
	if ResourceLoader.exists(path):
		_shot_visual = (load(path) as PackedScene).instantiate() as Node3D
		get_parent().add_child(_shot_visual)
		_shot_visual.global_position = point

func _step_projectile(dt: float) -> void:
	if _shot.is_empty():
		return
	var start: Vector3 = _shot["position"]
	var direction: Vector3 = _shot["direction"]
	var end := start + direction * 23.0 * dt
	_shot["life"] = float(_shot["life"]) - dt
	if not _line_clear(start, end) or float(_shot["life"]) <= 0.0:
		_clear_shot()
		return
	var center := target.global_position + Vector3.UP * 0.86
	var near := Geometry3D.get_closest_point_to_segment(center, start, end)
	if near.distance_to(center) < 1.0:
		var event: Dictionary = _shot["event"]
		event["origin"] = start
		event["reach"] = start.distance_to(end)
		_dispatch_attack(event)
		_clear_shot()
		return
	_shot["position"] = end
	if is_instance_valid(_shot_visual):
		_shot_visual.global_position = end
		_shot_visual.look_at(end + direction)

func _clear_shot() -> void:
	_shot.clear()
	if is_instance_valid(_shot_visual):
		_shot_visual.queue_free()
	_shot_visual = null

func _mode(next_mode: String) -> void:
	if mode == next_mode:
		return
	mode = next_mode
	mode_since = clock
	phase = "dead" if mode == "dead" else "idle"
	phase_since = clock
	if mode == "takeoff":
		_play("takeoff", true)
	elif mode == "landing":
		_play("land", true)
	elif mode == "dead":
		_play("death", true)

func _move_to(goal: Vector3, speed: float, dt: float, airborne: bool, standoff := 0.0) -> void:
	var flat := Vector3(goal.x - global_position.x, 0.0, goal.z - global_position.z)
	var step := flat.normalized() * minf(speed * dt, maxf(0.0, flat.length() - standoff))
	if airborne:
		step.y = clampf(goal.y - global_position.y, -8.0 * dt, 8.0 * dt)
	if not _move_step(step, airborne):
		_stuck_time += dt
		_move_step(Vector3(-step.z, step.y, step.x) * _orbit_side, airborne)
		if _stuck_time > 1.2:
			_orbit_side *= -1.0
			_stuck_time = 0.0
	else:
		_stuck_time = maxf(0.0, _stuck_time - dt)
	_face_target(goal, dt)

func _move_step(step: Vector3, airborne: bool) -> bool:
	if step.length_squared() < 0.000001:
		return true
	var pieces := maxi(1, ceili(step.length() / 0.35))
	for i in range(pieces):
		var next := global_position + step / float(pieces)
		next.y = maxf(next.y, world.height_at(next.x, next.z)) if airborne else world.height_at(next.x, next.z)
		if not _clear_step(next, airborne):
			return false
		global_position = next
	return true

func _clear_step(next: Vector3, airborne: bool) -> bool:
	if world.is_solid_at(next, 0.75, 2.0):
		return false
	if not airborne and absf(next.y - global_position.y) > 0.65:
		return false
	var query := PhysicsShapeQueryParameters3D.new()
	query.shape = _probe
	query.collision_mask = 1
	query.transform = Transform3D(Basis.IDENTITY, next + Vector3.UP * 1.1)
	return get_world_3d().direct_space_state.intersect_shape(query, 1).is_empty()

func _line_clear(start: Vector3, end: Vector3) -> bool:
	if not start.is_finite() or not end.is_finite():
		return false
	var query := PhysicsRayQueryParameters3D.create(start, end, 1)
	return get_world_3d().direct_space_state.intersect_ray(query).is_empty()

func _settle(dt: float, speed: float) -> void:
	var ground := world.height_at(global_position.x, global_position.z)
	_move_step(Vector3.DOWN * minf(maxf(0.0, global_position.y - ground), speed * dt), true)

func _face_target(goal: Vector3, dt: float) -> void:
	var toward := goal - global_position
	if Vector2(toward.x, toward.z).length_squared() > 0.000001:
		rotation.y = rotate_toward(rotation.y, atan2(-toward.x, -toward.z), dt * 3.8)

func _cancel_attack(reason: String) -> void:
	if phase in ["windup", "active", "recovery"]:
		var event := _phase_event("cancel")
		event["reason"] = reason
		enemy_skill_event.emit(event)
	phase = "idle"
	contacted = true

func receive_hit(damage: float, hitstop := 0.0) -> void:
	receive_combat_hit({"damage": damage, "hitstop": hitstop, "stagger": 0.36})

func receive_combat_hit(hit: Dictionary) -> Dictionary:
	var amount := float(hit.get("damage", 0.0))
	if mode == "dead" or not is_finite(amount) or amount <= 0.0:
		return {"landed": false, "damage_applied": 0.0, "interrupted": false, "defeated": mode == "dead"}
	var applied := minf(hp, amount)
	hp -= applied
	_ai.register_hit(clock, hp / max_hp)
	var interrupted := phase in ["windup", "active"]
	_cancel_attack("hit")
	begin_hitstop(clampf(float(hit.get("hitstop", 0.0)), 0.0, 0.16))
	var push: Vector3 = hit.get("knockback", Vector3.ZERO)
	if push.is_finite():
		_impulse = push.limit_length(16.0)
	if hp <= 0.0:
		_clear_shot()
		loot_left = 1 if variant == "ground" else 2
		_mode("dead")
		defeated.emit()
		enemy_defeated.emit({"enemy": self, "variant": variant, "position": global_position, "loot_left": loot_left})
	else:
		phase = "hurt"
		phase_since = clock
		_hurt_left = clampf(float(hit.get("stagger", 0.36)), 0.12, 1.4)
		_play("hit", true)
		if is_instance_valid(target) and _line_clear(global_position + Vector3.UP * 1.25, target.global_position + Vector3.UP * 0.85):
			_last_seen = target.global_position
			_ai.observe(clock, _last_seen, true)
		else:
			# A hit reveals danger, not the exact position of an unseen attacker.
			_last_seen = global_position
		aggro_until = clock + 5.0
	return {"landed": true, "damage_applied": applied, "interrupted": interrupted, "defeated": hp <= 0.0}

func observe_public_threat(cue: Dictionary) -> bool:
	# The combat bridge may offer a visible windup; a wall suppresses awareness.
	if mode == "dead" or world == null or not _perceived:
		return false
	var origin: Variant = cue.get("origin")
	if not origin is Vector3 or not origin.is_finite():
		return false
	if global_position.distance_to(origin) > 65.0 or not _line_clear(global_position + Vector3.UP * 1.25, origin):
		return false
	return _ai.observe_public_threat(clock, cue)

func begin_hitstop(duration: float) -> void:
	_hitstop_left = maxf(_hitstop_left, clampf(duration, 0.0, 0.16))

func get_combat_snapshot() -> Dictionary:
	return {"variant": variant, "hp": hp, "max_hp": max_hp, "mode": mode, "phase": phase, "tactic": tactic,
		"attack_id": attack_kind, "serial": attack_serial, "attack_elapsed": _attack_elapsed, "clock": clock,
		"phase_elapsed": clock - phase_since, "cooldowns": cooldowns.duplicate(), "home": home, "aggro": clock < aggro_until,
		"perceived": _perceived, "returning": _returning, "locked_direction": _locked_direction,
		"last_seen": _ai.last_seen, "last_seen_at": _ai.last_seen_at, "evading": clock < _evade_until,
		"delta": last_physics_delta, "physics_time": total_physics_time, "clip": current_clip, "projectile": not _shot.is_empty()}

func snapshot() -> Dictionary:
	return {"hp": hp, "mode": mode, "position": [global_position.x, global_position.y, global_position.z], "loot_left": loot_left, "variant": variant}

func restore(data: Dictionary) -> void:
	_hitstop_left = 0.0
	_ai.reset()
	_evade_until = 0.0
	_evade_goal = Vector3.ZERO
	_clear_shot()
	_impulse = Vector3.ZERO
	_returning = false
	_land_after_attack = false
	cooldowns.clear()
	var saved_hp := float(data.get("hp", max_hp))
	hp = clampf(saved_hp, 0.0, max_hp) if is_finite(saved_hp) else max_hp
	var p: Array = data.get("position", [])
	if p.size() == 3:
		var restored := Vector3(float(p[0]), float(p[1]), float(p[2]))
		if restored.is_finite() and absf(restored.x) <= 2998.0 and absf(restored.z) <= 2998.0:
			global_position = restored
	mode = String(data.get("mode", "ground"))
	if mode not in ["ground", "takeoff", "air", "landing", "dead"]:
		mode = "ground"
	if hp <= 0.0:
		mode = "dead"
	elif mode == "dead":
		mode = "ground"
	if variant == "ground" and mode != "dead":
		mode = "ground"
	loot_left = clampi(int(data.get("loot_left", 0)), 0, 1 if variant == "ground" else 2)
	if mode != "dead":
		loot_left = 0
	phase = "dead" if mode == "dead" else "idle"
	phase_since = clock
	mode_since = clock
	_play("death" if mode == "dead" else "flight" if mode == "air" else "ground-idle", true)
