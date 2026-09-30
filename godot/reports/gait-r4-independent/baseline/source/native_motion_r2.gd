class_name NativeMotionR2
extends Node3D
## Visual-only adapter. Never rewrites skeleton rest or skin inverse binds.
## Call step() once per frame; authoritative movement/damage stay in NativePlayer.
const MODEL = preload("res://assets/motion-r2/c2-motion-r2.glb")
var model: Node3D
var player: AnimationPlayer
var names: Dictionary = {}
var current := ""
var gait_name := "idle"
var playback_rate := 1.0
var gait_phase := 0.0
var _rig: Skeleton3D
var _base_rig: Skeleton3D
var _base_player: AnimationPlayer
var _previous: Array[Transform3D] = []
var _blend_from: Array[Transform3D] = []
var _blend_age := 1.0
var _blend_key := ""
var _combat_hold := 0.0
var _foot_anchors: Dictionary = {}
var _support_key := ""
var _action_progress := 0.0
const GAIT_SPEED := {"walk":1.6,"jog":6.8,"sprint":10.0}
const GAIT_STRIDE := {"walk":1.2,"jog":3.0,"sprint":4.0}

## R3 shared contract. Damage/cost/cooldown remain owned by NativeMain.
static func cast_profile(realm: int, variant: String = "") -> Dictionary:
	var tier := clampi(realm,4,9)
	var actions := {4:"cast_fist",5:"cast_palm",6:"cast_sweep",7:"cast_sweep",8:"cast_cleave",9:"cast_skyfall"}
	var windups := {4:0.50,5:0.42,6:0.65,7:0.65,8:1.8,9:2.2}
	var recoveries := {4:0.36,5:0.40,6:0.48,7:0.48,8:0.62,9:0.72}
	var action: String = actions[tier]
	if variant in ["cast_fist","cast_palm","cast_sweep","cast_cleave","cast_skyfall"]:
		action = variant
	var windup: float = windups[tier]
	var recovery: float = recoveries[tier]
	return {"action":action,"windup":windup,"release_time":windup,"duration":windup+recovery,"recovery":recovery,"socket":"hand_l" if action == "cast_palm" else "hand_r","gesture":"fist" if action == "cast_fist" else "palm","release_normalized":0.50}

func socket_transform_world(socket: String) -> Transform3D:
	if _rig == null:
		return Transform3D(Basis.IDENTITY,Vector3(INF,INF,INF))
	var bone_name: String = {"hand_l":"palmL","hand_r":"palmR","foot_l":"ankleL","foot_r":"ankleR"}.get(socket,socket)
	var bone := _rig.find_bone(bone_name)
	if bone < 0 and socket in ["hand_l","hand_r"]:
		bone = _rig.find_bone("wristL" if socket == "hand_l" else "wristR")
	if bone < 0:
		return Transform3D(Basis.IDENTITY,Vector3(INF,INF,INF))
	return _rig.global_transform * _rig.get_bone_global_pose(bone)

func contact_point_world(combo_index: int) -> Vector3:
	# Wrist/ankle pivots, not fictional extended reach. The caller includes the
	# glove/boot surface radius and decides damage; this accessor never seeks.
	if _rig == null:
		return Vector3(INF,INF,INF)
	var bone_name: String = ["wristL","wristR","ankleR"][posmod(combo_index,3)]
	var bone := _rig.find_bone(bone_name)
	if bone < 0:
		return Vector3(INF,INF,INF)
	return _rig.global_transform*_rig.get_bone_global_pose(bone).origin

func update_from_player(dt: float, owner_player: Node) -> void:
	# Replaces the old _update_bone_motion call, including its visual action clocks.
	# Do NOT call both drivers. Health, hit resolution and flight remain authoritative.
	var physical_air := false
	if owner_player._world != null and owner_player.is_inside_tree():
		physical_air = owner_player.global_position.y - owner_player._foot_support_here() > 0.08
	var state := {"airborne":owner_player.flight_active or physical_air,"boost":owner_player.boosting,"speed":owner_player.horizontal_speed,"bank":owner_player._turn_bank,"first_person":owner_player._first_person,"guard":owner_player.guarding}
	state["local_velocity"] = owner_player.basis.inverse() * owner_player.velocity
	if not String(owner_player._attack_name).is_empty():
		owner_player._attack_elapsed += dt
		state["action"] = owner_player._attack_name
		state["progress"] = _contact_progress(owner_player._attack_elapsed,owner_player._attack_windup,owner_player._attack_duration)
		if owner_player._attack_elapsed >= owner_player._attack_duration:
			owner_player._attack_name = ""
	elif owner_player._cast_active:
		owner_player._cast_elapsed += dt
		var profile := cast_profile(owner_player.realm)
		var cast_action: String = str(owner_player.get("_cast_action"))
		state["action"] = cast_action if not cast_action.is_empty() and cast_action != "<null>" else profile["action"]
		var release: Variant = owner_player.get("_cast_release_normalized")
		state["progress"] = _contact_progress(owner_player._cast_elapsed,owner_player._cast_windup,owner_player._cast_duration,float(profile["release_normalized"]) if release == null else float(release))
		if owner_player._cast_elapsed >= owner_player._cast_duration:
			owner_player._cast_active = false
	if owner_player._hurt_time > 0.0 and not owner_player.guarding:
		state["action"] = "hit"
		state["progress"] = clampf(1.0 - owner_player._hurt_time / 0.35,0.0,1.0)
	step(dt,state)

func _contact_progress(elapsed: float, windup: float, duration: float, release: float = 0.38) -> float:
	if elapsed <= windup:
		return release * clampf(elapsed / maxf(0.001,windup),0.0,1.0)
	return release + (1.0-release) * clampf((elapsed-windup) / maxf(0.001,duration-windup),0.0,1.0)

func _ready() -> void:
	model = MODEL.instantiate()
	add_child(model)
	player = _find_player(model)
	player.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	_rig = _find_rig(model)
	var base: Node3D = MODEL.instantiate()
	base.name = "LocomotionSampler"
	add_child(base)
	base.visible = false
	_base_rig = _find_rig(base)
	_base_player = _find_player(base)
	_base_player.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	_remove_meshes(base)
	for key in player.get_animation_list():
		var short_name := String(key).get_slice("/", String(key).get_slice_count("/") - 1)
		names[short_name] = key
		if short_name in ["idle", "walk", "jog", "sprint", "cruise", "boost", "guard", "air_guard", "combat_ready"]:
			player.get_animation(key).loop_mode = Animation.LOOP_LINEAR

func _find_rig(node: Node) -> Skeleton3D:
	if node is Skeleton3D:
		return node
	for child in node.get_children():
		var result := _find_rig(child)
		if result != null:
			return result
	return null

func _remove_meshes(node: Node) -> void:
	for child in node.get_children():
		if child is MeshInstance3D:
			child.free()
		else:
			_remove_meshes(child)

func _find_player(node: Node) -> AnimationPlayer:
	if node is AnimationPlayer:
		return node
	for child in node.get_children():
		var result := _find_player(child)
		if result != null:
			return result
	return null

func step(dt: float, state: Dictionary) -> void:
	if player == null:
		return
	var airborne := bool(state.get("airborne", false))
	var speed := float(state.get("speed", 0.0))
	gait_name = "idle" if speed <= 0.15 else "walk" if speed < 2.5 else "jog" if speed < 8.0 else "sprint"
	var desired := "boost" if airborne and state.get("boost", false) else "cruise" if airborne else gait_name
	var action := String(state.get("action", ""))
	_action_progress = float(state.get("progress",0.0))
	var aliases := {"left-jab": "jab", "right-cross": "cross", "rising-kick": "kick", "air-guard": "guard", "impact": "hit", "launch": "hit", "palm":"cast_palm", "sweep":"cast_sweep", "cleave":"cast_cleave"}
	action = aliases.get(action, action)
	# The profile API can be integrated before the newly authored GLB is imported.
	if action.begins_with("cast_") and not names.has(action):
		action = "cast"
	if bool(state.get("guard", false)):
		desired = "guard"
	if not action.is_empty() and names.has(action):
		desired = action
	var layered := desired in ["jab","cross","kick","cast","guard","hit"] or desired.begins_with("cast_")
	if layered:
		_combat_hold = 0.8
	else:
		_combat_hold = maxf(0.0,_combat_hold-dt)
		if _combat_hold > 0.0:
			if airborne:
				desired = "air_guard"
			elif gait_name == "idle":
				desired = "combat_ready"
	var combat_action := desired
	if airborne and layered:
		desired = "air_" + desired
	var base_name := "cruise" if airborne else gait_name
	var local: Vector3 = state.get("local_velocity",Vector3(0,0,-speed))
	var reverse := not airborne and local.z > 0.1
	var direction_yaw := 0.0
	if not airborne and speed > 0.15:
		direction_yaw = atan2(-local.x,-local.z)
		if reverse:
			direction_yaw = wrapf(direction_yaw + PI,-PI,PI)
		gait_phase = fposmod(gait_phase + dt * speed / float(GAIT_STRIDE[gait_name]) * (-1.0 if reverse else 1.0),1.0)
	playback_rate = speed / float(GAIT_SPEED[gait_name]) if gait_name != "idle" else 1.0
	if desired != current:
		player.play(names[desired], 0.0)
		current = desired
	player.speed_scale = 1.0
	# Imported clips omit constant tracks. Reset pose (never rest/binds) so yaw and
	# layer overrides cannot accumulate on those unkeyed channels.
	_rig.reset_bone_poses()
	if not action.is_empty() and state.has("progress"):
		player.seek(clampf(float(state["progress"]), 0.0, 1.0) * player.current_animation_length, true)
	elif not airborne and not layered and gait_name != "idle":
		player.seek(gait_phase * player.current_animation_length,true)
	else:
		player.advance(dt)
	# Only travelling guard/cast use a locomotion lower-body mask. Punches and
	# kicks retain authored hip drive and footwork, including at zero speed.
	var moving_layer := not airborne and speed > 0.6 and combat_action in ["guard","cast"]
	if moving_layer:
		_base_rig.reset_bone_poses()
		_base_player.play(names[base_name],0.0)
		_base_player.seek(gait_phase * _base_player.current_animation_length,true)
		for i in range(_rig.get_bone_count()):
			var bone := String(_rig.get_bone_name(i))
			if bone == "pelvis" or bone.begins_with("hip") or bone.begins_with("knee") or bone.begins_with("ankle"):
				if desired == "kick" and bone in ["hipR","kneeR","ankleR"]:
					continue
				_rig.set_bone_pose(i,_base_rig.get_bone_pose(_base_rig.find_bone(bone)))
	var turn_ease := 1.0-exp(-10.0*dt)
	rotation.y = lerp_angle(rotation.y,0.0 if airborne or layered else direction_yaw,turn_ease)
	if moving_layer:
		var pelvis := _rig.find_bone("pelvis")
		var waist := _rig.find_bone("waist")
		# Yaw in the imported bone's parent space, then cancel at the waist.
		var yaw := Quaternion(Vector3.UP,direction_yaw-rotation.y)
		var pelvis_q := _rig.get_bone_pose_rotation(pelvis)
		_rig.set_bone_pose_rotation(pelvis,yaw*pelvis_q)
		_rig.set_bone_pose_rotation(waist,pelvis_q.inverse()*yaw.inverse()*pelvis_q*_rig.get_bone_pose_rotation(waist))
	var key := desired + (":air" if airborne else ":ground")
	if key != _blend_key:
		_blend_from = _previous.duplicate()
		_blend_age = 0.0
		_blend_key = key
	_blend_age += dt
	var weight := smoothstep(0.0,0.16 if airborne else 0.10 if layered else 0.15,_blend_age)
	_previous.clear()
	for i in range(_rig.get_bone_count()):
		var target := _rig.get_bone_pose(i)
		if _blend_from.size() == _rig.get_bone_count() and weight < 1.0:
			target = _blend_from[i].interpolate_with(target,weight)
			_rig.set_bone_pose(i,target)
		_previous.append(target)
	_lock_support_feet(combat_action,airborne,moving_layer)
	rotation.z = lerp_angle(rotation.z, clampf(float(state.get("bank", 0.0)), -1.0, 1.0) * 0.23 if airborne else 0.0, 1.0 - exp(-7.0 * dt))
	visible = not bool(state.get("first_person", false))

func _lock_support_feet(action: String, airborne: bool, travelling: bool) -> void:
	var gait := action in ["walk","jog","sprint"]
	var grounded_attack := not airborne and not travelling and (gait or action in ["jab","cross","kick","guard","hit","combat_ready"] or action.begins_with("cast_"))
	if not grounded_attack:
		_foot_anchors.clear()
		_support_key = ""
		return
	# Capture in world space so decelerating player motion cannot drag planted feet.
	# Re-anchor only on entering combat, or after a kick has set its rear foot down.
	if _support_key == "kick" and action != "kick":
		_foot_anchors.clear()
		_support_key = ""
	if gait and _support_key != action:
		_foot_anchors.clear()
		_support_key = ""
	if _support_key.is_empty() and _blend_age < 0.09:
		return
	_support_key = action
	var supporting := {"L":true,"R":true}
	if action == "jab" and ((_action_progress > 0.06 and _action_progress < 0.34) or _action_progress > 0.70):
		supporting["L"] = false
		_foot_anchors.erase("L")
	if gait:
		var stance: float = {"walk":0.52,"jog":0.25,"sprint":0.21}[action]
		for side in ["L","R"]:
			var phase := fposmod(gait_phase+(0.0 if side == "L" else 0.5),1.0)
			supporting[side] = phase < stance
			if not supporting[side]:
				_foot_anchors.erase(side)
	var pelvis_drop := 0.0
	var authored_ankles := {}
	for side in ["L","R"]:
		authored_ankles[side] = _rig.get_bone_global_pose(_rig.find_bone("ankle"+side)).origin
	for side in _foot_anchors:
		if action == "kick" and side == "R":
			continue
		var h := _rig.get_bone_global_pose(_rig.find_bone("hip"+side)).origin
		var k := _rig.get_bone_global_pose(_rig.find_bone("knee"+side)).origin
		var a := _rig.get_bone_global_pose(_rig.find_bone("ankle"+side)).origin
		var target: Vector3 = _rig.global_transform.affine_inverse()*Vector3(_foot_anchors[side])
		var reach := h.distance_to(k)+k.distance_to(a)-0.003
		var horizontal := Vector2(h.x-target.x,h.z-target.z).length()
		var reachable_y := target.y+sqrt(maxf(0.0,reach*reach-horizontal*horizontal))
		if h.y-reachable_y > 0.14 or horizontal >= reach:
			_foot_anchors[side] = _rig.global_transform*a
			continue
		pelvis_drop = maxf(pelvis_drop,h.y-reachable_y)
	# Bend into a short advancing strike instead of straightening the rear leg
	# beyond its length. Long travelling attacks still require controller braking.
	if pelvis_drop > 0.0:
		var pelvis := _rig.find_bone("pelvis")
		var transform := _rig.get_bone_global_pose(pelvis)
		transform.origin.y -= minf(pelvis_drop,0.14)
		_rig.set_bone_global_pose(pelvis,transform)
	for side in ["L","R"]:
		if not supporting[side]:
			continue
		var ankle := _rig.find_bone("ankle"+side)
		if not _foot_anchors.has(side):
			_foot_anchors[side] = _rig.global_transform * _rig.get_bone_global_pose(ankle).origin
		if action == "kick" and side == "R":
			continue
		var hip := _rig.find_bone("hip"+side)
		var knee := _rig.find_bone("knee"+side)
		var h := _rig.get_bone_global_pose(hip)
		var k := _rig.get_bone_global_pose(knee)
		var a := _rig.get_bone_global_pose(ankle)
		var target: Vector3 = _rig.global_transform.affine_inverse() * Vector3(_foot_anchors[side])
		var upper := k.origin-h.origin
		var lower := a.origin-k.origin
		# A knocked-back or teleported root can outrun the finite stance. Never
		# clamp a distant ground target along a rising ray: that lifts both soles
		# into a seated hover. Release that contact and replant the authored foot.
		if target.distance_to(h.origin) > upper.length()+lower.length()+0.005:
			target = Vector3(authored_ankles[side])
			_foot_anchors[side] = _rig.global_transform*target
		var delta := target-h.origin
		var length := clampf(delta.length(),0.05,upper.length()+lower.length()-0.002)
		var axis := delta.normalized()
		target = h.origin+axis*length
		var along := (upper.length_squared()-lower.length_squared()+length*length)/(2.0*length)
		var pole := Vector3.FORWARD
		pole = (pole-axis*pole.dot(axis)).normalized()
		var joint := h.origin+axis*along+pole*sqrt(maxf(0.0,upper.length_squared()-along*along))
		h.basis = Basis(Quaternion(upper.normalized(),(joint-h.origin).normalized()))*h.basis
		k.basis = Basis(Quaternion(lower.normalized(),(target-joint).normalized()))*k.basis
		k.origin = joint
		a.origin = target
		_rig.set_bone_global_pose(hip,h)
		_rig.set_bone_global_pose(knee,k)
		_rig.set_bone_global_pose(ankle,a)
