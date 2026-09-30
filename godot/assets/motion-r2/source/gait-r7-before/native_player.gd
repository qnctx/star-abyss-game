extends CharacterBody3D
class_name NativePlayer

## The player's origin is at their feet. Model is a visual child; CameraPivot
## remains upright while the whole visible body streamlines during boost.
signal defeated
signal respawned
signal descent_strike_landed(strike_serial: int, point: Vector3, normal: Vector3, speed: float)
signal descent_strike_failed(strike_serial: int, reason: String)

const WORLD_HALF := 2990.0
const MAX_AGL := 2000.0
const PLANET_MAX_AGL := 180000.0
const ORBIT_ENTRY_AGL := 2000.0
const ORBIT_FULL_AGL := 10000.0
const ORBIT_VERTICAL_ACCEL := 500.0
const DESCENT_REFERENCE_AGL := 100.0
const DESCENT_BRAKE_ACCEL := 450.0
const DESCENT_FRAME_MARGIN := 6.0
const STRIKE_MAX_AGL := 160.0
const STRIKE_TIMEOUT := 5.0
const FLIGHT_CLEARANCE := 0.42
const BODY_RADIUS := 0.42
const BODY_HEIGHT := 1.72
const CAMP_STEP_HEIGHT := 0.62
const MAX_ENERGY := 100.0
const LAUNCH_ENERGY := 25.0
const BOOST_MIN_ENERGY := 10.0
const GROUND_ENERGY_RECOVERY := 4.0
const GROUND_ATTACK_SPEED := {"left-jab": 0.5, "right-cross": 0.35, "rising-kick": 0.08}
const GROUND_ATTACK_STEP := {"left-jab": 0.18, "right-cross": 0.18, "rising-kick": 0.0}
const CAMERA_RADIUS := 0.24
const CAMERA_WALL_GAP := 0.12
const CAMERA_ONLY_LAYER := 4
const REALM_CRUISE := {4: 420.0, 5: 460.0, 6: 500.0, 7: 560.0, 8: 640.0, 9: 720.0}
const REALM_BOOST := {4: 600.0, 5: 720.0, 6: 900.0, 7: 1100.0, 8: 1300.0, 9: 1500.0}

@export_range(4, 9, 1) var realm := 4
@export var mouse_sensitivity := 0.0025

var flight_active := false
var boosting := false
var descent_strike_active := false
var guarding := false
var energy := MAX_ENERGY
var horizontal_speed := 0.0
var health := 155520.0
var max_health := 155520.0

var _world: NativeWorld
var _support_provider: Node3D
var _vertical_speed := 0.0
var _ground_vertical_speed := 0.0
var _turn_bank := 0.0
var _hit_impulse := Vector3.ZERO
var _hurt_time := 0.0
var _look_pitch := 0.0
var _first_person := false
var _last_space := false
var _held_g := false
var _held_c := false
var _held_keys: Dictionary = {}
var _flight_input_intent := Vector3.ZERO
var _descent_strike_serial := 0
var _descent_strike_remaining := 0.0
var _defeated := false
var _death_timer := 0.0
var _motion: Dictionary = {}
var _skeleton: Skeleton3D
var _motion_failed := false
var _bone_indices: Array[int] = []
var _arm_alignment: Dictionary = {}
var _native_pelvis := Vector3.ZERO
var _motion_clock := 0.0
var _gait_phase := 0.0
var _boost_weight := 0.0
var _pose_rotations: Array[Quaternion] = []
var _pose_position := Vector3.ZERO
var _attack_name := ""
var _attack_elapsed := 0.0
var _attack_windup := 0.0
var _attack_duration := 0.0
var _attack_cancel_after := 0.0
var _attack_serial := 0
var _attack_step_used := 0.0
var _visual_hitstop := 0.0
var _reaction_name := "impact"
var _cast_active := false
var _cast_elapsed := 0.0
var _cast_windup := 0.0
var _cast_duration := 0.0
var _cast_action := ""
var _cast_release_normalized := 0.0
var combat_serial := 0
var combat_action_id := ""
var _r2: NativeMotionR2
var _planet_frame: Dictionary = NativePlanetCoordinates.tangent_frame()
var _canonical_position: Dictionary = {}
var _last_scene_position := Vector3(INF, INF, INF)
var _last_origin_revision := 0

@onready var _model: Node3D = $Model
@onready var _camera_pivot: Node3D = $CameraPivot
@onready var _camera: Camera3D = $CameraPivot/Camera3D


func set_world(w: NativeWorld) -> void:
	_world = w


func _planet_enabled() -> bool:
	return _world != null and _world.has_method("surface_at") and _world.get("planet_enabled") == true


func flight_ceiling() -> float:
	return PLANET_MAX_AGL if _planet_enabled() else MAX_AGL


func planet_orbit_blend(agl: float) -> float:
	if not _planet_enabled():
		return 0.0
	var t := clampf((agl - ORBIT_ENTRY_AGL) / (ORBIT_FULL_AGL - ORBIT_ENTRY_AGL), 0.0, 1.0)
	return t * t * (3.0 - 2.0 * t)


func _planet_surface(at: Vector3) -> Dictionary:
	return _world.call("surface_at", at) if _planet_enabled() else {}


func _planet_up(at: Vector3) -> Vector3:
	if not _planet_enabled():
		return Vector3.UP
	var value: Variant = _world.call("up_at", at)
	return (value as Vector3).normalized() if value is Vector3 and (value as Vector3).length_squared() > 0.5 else Vector3.UP


func _planet_sweep(from: Vector3, to: Vector3) -> bool:
	if not _planet_enabled() or not _world.has_method("sweep"):
		return false
	var result: Variant = _world.call("sweep", from, to, BODY_RADIUS, BODY_HEIGHT)
	return result is Dictionary and result.get("ready", false) == true and result.get("clear", false) == true


func _planet_origin_revision() -> int:
	var value: Variant = _world.get("origin_revision") if _world != null else 0
	return int(value) if typeof(value) in [TYPE_INT, TYPE_FLOAT] else 0


func _sync_canonical_before_motion() -> void:
	var revision := _planet_origin_revision()
	if revision != _last_origin_revision:
		# A world-owned render/physics rebase changes the scene coordinate, not
		# the authoritative saved location. The world must shift all colliders.
		_last_origin_revision = revision
		_last_scene_position = global_position
		return
	if not NativePlanetCoordinates.valid(_canonical_position) or not _last_scene_position.is_finite() or _last_scene_position.distance_to(global_position) > 0.001:
		_canonical_position = _canonical_from_scene(global_position)
		_last_scene_position = global_position


func _sync_canonical_after_motion() -> void:
	if not NativePlanetCoordinates.valid(_canonical_position):
		_canonical_position = _canonical_from_scene(global_position)
	elif _last_scene_position.is_finite():
		_canonical_position = NativePlanetCoordinates.add(_canonical_position, _direction_scene_to_canonical(global_position - _last_scene_position))
	_last_scene_position = global_position


func _planet_support(at: Vector3) -> Dictionary:
	var sample := _planet_surface(at)
	if sample.get("ready", false) != true or not sample.get("point") is Vector3:
		return {}
	var point: Vector3 = sample["point"]
	var up := _planet_up(at)
	# Existing authored camp floors remain above the original basin terrain.
	if absf(at.x) < WORLD_HALF and absf(at.z) < WORLD_HALF and up.dot(Vector3.UP) > 0.99 and _support_provider != null:
		var camp_y := _support_at(at.x, at.z, at.y + 0.12)
		if camp_y > point.y + 0.02 and camp_y <= at.y + 0.12:
			point = Vector3(at.x, camp_y, at.z)
	sample["point"] = point
	sample["agl"] = (at - point).dot(up)
	return sample


func _planet_flight_floor(support: Dictionary) -> float:
	# The solid seabed is not a flight landing surface. Keep the capsule above
	# the ocean surface when the radial terrain lies below sea level.
	return maxf(FLIGHT_CLEARANCE, float(support.get("water_depth", 0.0)) + FLIGHT_CLEARANCE)


func _align_planet_up(up: Vector3) -> void:
	up_direction = up
	var old_basis := global_transform.basis.orthonormalized()
	var old_up := old_basis.y.normalized()
	if old_up.dot(up) > 0.999999:
		return
	var transported := Basis(Quaternion(old_up, up)) * old_basis
	var forward := (-transported.z).slide(up).normalized()
	if forward.is_zero_approx():
		forward = (-old_basis.z).slide(up).normalized()
	if forward.is_zero_approx():
		forward = up.cross(Vector3.RIGHT).normalized()
	var right := forward.cross(up).normalized()
	var new_transform := global_transform
	new_transform.basis = Basis(right, up, -forward)
	global_transform = new_transform


func set_support_provider(camp: Node3D) -> void:
	_support_provider = camp


func teleport_to_ground(x: float, z: float) -> bool:
	if _planet_enabled():
		# Compatibility entry for old basin call sites and isolated R2 tests.
		if absf(x) > WORLD_HALF or absf(z) > WORLD_HALF:
			return false
		var basin_target := Vector3(x, _world.height_at(x, z), z)
		_world.update_stream(basin_target)
		return teleport_to_surface(basin_target)
	if _world == null or absf(x) > WORLD_HALF or absf(z) > WORLD_HALF:
		return false
	var terrain_y := _world.height_at(x, z)
	var target := Vector3(x, _support_at(x, z, terrain_y + 1.0), z)
	if not _destination_clear(target):
		return false
	cancel_descent_strike("teleport")
	flight_active = false
	boosting = false
	guarding = false
	horizontal_speed = 0.0
	velocity = Vector3.ZERO
	_vertical_speed = 0.0
	_ground_vertical_speed = 0.0
	_turn_bank = 0.0
	_hit_impulse = Vector3.ZERO
	_hurt_time = 0.0
	cancel_combat_action()
	_visual_hitstop = 0.0
	global_position = target
	return true


func teleport_to_surface(scene_position: Vector3) -> bool:
	if not _planet_enabled() or not scene_position.is_finite():
		return false
	var sample := _planet_support(scene_position)
	if sample.is_empty() or float(sample.get("water_depth", 0.0)) > 0.15:
		return false
	var target: Vector3 = sample["point"]
	if not _destination_clear(target):
		return false
	cancel_descent_strike("teleport")
	global_position = target
	_canonical_position = _canonical_from_scene(target)
	_last_scene_position = target
	_last_origin_revision = _planet_origin_revision()
	_align_planet_up(_planet_up(target))
	flight_active = false
	boosting = false
	guarding = false
	horizontal_speed = 0.0
	velocity = Vector3.ZERO
	_vertical_speed = 0.0
	_ground_vertical_speed = 0.0
	_turn_bank = 0.0
	_hit_impulse = Vector3.ZERO
	_hurt_time = 0.0
	cancel_combat_action()
	_visual_hitstop = 0.0
	return true


## The caller owns realm unlocks, cooldown, energy and path validation. The
## destination is checked again here before committing any player state.
func blink_to(target: Vector3) -> bool:
	if _planet_enabled():
		if not target.is_finite() or not _inside_world(target):
			return false
		var support := _planet_support(target)
		if support.is_empty():
			return false
		var agl := float(support["agl"])
		if agl < -0.02 or agl > PLANET_MAX_AGL or agl > 0.15 and agl < _planet_flight_floor(support):
			return false
		if float(support.get("water_depth", 0.0)) > 0.15 and agl <= 0.15:
			return false
		var committed: Vector3 = support["point"] if agl <= 0.15 else target
		if not _destination_clear(committed) or not _planet_blink_route_clear(committed):
			return false
		cancel_descent_strike("blink")
		global_position = committed
		_canonical_position = _canonical_from_scene(committed)
		_last_scene_position = committed
		_last_origin_revision = _planet_origin_revision()
		_align_planet_up(_planet_up(committed))
		flight_active = agl > 0.15
		boosting = false
		guarding = false
		horizontal_speed = 0.0
		velocity = Vector3.ZERO
		_vertical_speed = 0.0
		_ground_vertical_speed = 0.0
		_turn_bank = 0.0
		_hit_impulse = Vector3.ZERO
		cancel_combat_action()
		_visual_hitstop = 0.0
		return true
	if _world == null or not _inside_world(target):
		return false
	if is_nan(target.x) or is_nan(target.y) or is_nan(target.z) or is_inf(target.x) or is_inf(target.y) or is_inf(target.z):
		return false
	var ground_y := _world.height_at(target.x, target.z)
	var agl := target.y - ground_y
	var support_y := _support_at(target.x, target.z, target.y + 0.12)
	var support_agl := target.y - support_y
	if agl < -0.02 or agl > MAX_AGL or support_agl < -0.02 or support_agl > 0.15 and support_agl < FLIGHT_CLEARANCE:
		return false
	var committed := target
	if support_agl <= 0.15:
		committed.y = support_y
	if not _destination_clear(committed):
		return false
	cancel_descent_strike("blink")
	global_position = committed
	flight_active = support_agl > 0.15
	boosting = false
	guarding = false
	horizontal_speed = 0.0
	velocity = Vector3.ZERO
	_vertical_speed = 0.0
	_ground_vertical_speed = 0.0
	_turn_bank = 0.0
	_hit_impulse = Vector3.ZERO
	cancel_combat_action()
	_visual_hitstop = 0.0
	return true


func blink_to_prepared_surface(requested_target: Vector3, ticket: Dictionary) -> bool:
	# A long blink has no traversed flight path. Only World can issue and consume
	# a one-use dry destination ticket; ordinary blink_to keeps its route sweep.
	if not requested_target.is_finite() or not _planet_enabled() or _world == null or not _world.has_method("consume_surface_landing"):
		return false
	var receipt: Dictionary = _world.call("consume_surface_landing", ticket, global_position, BODY_RADIUS, BODY_HEIGHT)
	if receipt.get("valid", false) != true:
		return false
	var target: Vector3 = receipt.get("target", Vector3(INF, INF, INF))
	if not target.is_finite() or target.distance_to(requested_target) > 1.0 or not _inside_world(target):
		return false
	var support := _planet_support(target)
	if support.is_empty() or float(support.get("water_depth", 0.0)) > 0.15 or float(support.get("agl", -INF)) < FLIGHT_CLEARANCE - 0.02:
		return false
	if not _destination_clear(target):
		return false
	cancel_descent_strike("blink")
	global_position = target
	_canonical_position = _canonical_from_scene(target)
	_last_scene_position = target
	_last_origin_revision = _planet_origin_revision()
	_align_planet_up(_planet_up(target))
	# World leaves a capsule-safe 0.8 m arrival gap; ground gravity settles it.
	flight_active = false
	boosting = false
	guarding = false
	horizontal_speed = 0.0
	velocity = Vector3.ZERO
	_vertical_speed = 0.0
	_ground_vertical_speed = 0.0
	_turn_bank = 0.0
	_hit_impulse = Vector3.ZERO
	cancel_combat_action()
	_visual_hitstop = 0.0
	return true


func _planet_blink_route_clear(target: Vector3) -> bool:
	# Long straight chords pass below the globe. Check the actual radial arc,
	# projecting a ground blink onto the loaded solid terrain at each step.
	var from := global_position
	var length := from.distance_to(target)
	var stride := 30.0 if flight_active else 8.0
	var steps := maxi(1, ceili(length / stride))
	if steps > 8192:
		return false
	var centre := Vector3(0.0, -float(_world.get("planet_radius")), 0.0)
	var start_radial := from - centre
	var end_radial := target - centre
	var previous := from
	for i in range(1, steps + 1):
		var t := float(i) / float(steps)
		var point := centre + start_radial.normalized().slerp(end_radial.normalized(), t).normalized() * lerpf(start_radial.length(), end_radial.length(), t)
		var sample := _planet_support(point)
		if sample.is_empty():
			return false
		if not flight_active:
			point = sample["point"]
			if absf((point - previous).dot(_planet_up(previous))) > maxf(1.0, stride * 0.8):
				return false
			sample = _planet_support(point)
			if sample.is_empty():
				return false
		var agl := float(sample["agl"])
		if agl < -0.02 or agl > PLANET_MAX_AGL:
			return false
		if not flight_active and float(sample.get("water_depth", 0.0)) > 0.15:
			return false
		if flight_active and agl < _planet_flight_floor(sample) - 0.02:
			return false
		if not _planet_sweep(previous, point):
			return false
		previous = point
	return true


## Combo indices are 0=jab, 1=cross, 2=kick. Returns the authored contact
## delay so the owning combat system can resolve damage at the animated hit.
func play_attack(combo_index: int) -> float:
	if health <= 0.0 or guarding or _hurt_time > 0.0 or _cast_active:
		return -1.0
	match posmod(combo_index, 3):
		0:
			_attack_name = "left-jab"
			_attack_windup = 0.15
			_attack_duration = 0.42
			_attack_cancel_after = 0.27
		1:
			_attack_name = "right-cross"
			_attack_windup = 0.19
			_attack_duration = 0.50
			_attack_cancel_after = 0.31
		_:
			_attack_name = "rising-kick"
			_attack_windup = 0.27
			_attack_duration = 0.68
			_attack_cancel_after = 0.47
	_attack_elapsed = 0.0
	_attack_step_used = 0.0
	_attack_serial += 1
	combat_serial += 1
	combat_action_id = _attack_name
	_visual_hitstop = 0.0
	if not flight_active:
		var cap: float = GROUND_ATTACK_SPEED[_attack_name]
		var flat := Vector2(velocity.x, velocity.z).limit_length(cap)
		velocity.x = flat.x
		velocity.z = flat.y
	return _attack_windup


## Uses the existing authored launch pose. The damage/ability remains owned by
## Main, which releases the cast at the supplied windup time.
func play_air_cast(windup: float) -> bool:
	if not flight_active:
		return false
	# R2 permits the next cast during the prior cosmetic recovery, once its
	# authoritative release has happened and Main has cleared pending_cast.
	if _cast_active and _cast_elapsed >= _cast_windup:
		cancel_combat_action()
	var profile: Dictionary = NativeMotionR2.cast_profile(realm)
	profile["release_time"] = windup
	# The legacy air-cast caller advances to its next cast after the original
	# 0.24 s recovery; the new R3 entry uses its authored profile duration.
	profile["duration"] = windup + 0.24
	return play_combat_action(profile)


func play_combat_action(profile: Dictionary) -> bool:
	if health <= 0.0 or guarding or _hurt_time > 0.0 or not _attack_name.is_empty() or _cast_active:
		return false
	var action := String(profile.get("action", ""))
	var release_time := float(profile.get("release_time", profile.get("windup", 0.0)))
	var duration := float(profile.get("duration", release_time + 0.24))
	if action.is_empty() or is_nan(release_time) or is_inf(release_time) or is_nan(duration) or is_inf(duration) or release_time <= 0.0 or duration < release_time:
		return false
	_cast_action = action
	_cast_release_normalized = clampf(float(profile.get("release_normalized", release_time / duration)), 0.0, 1.0)
	_cast_windup = release_time
	_cast_duration = duration
	_cast_elapsed = 0.0
	_cast_active = true
	combat_serial += 1
	combat_action_id = action
	return true


func combat_socket_transform_world(socket: String) -> Transform3D:
	if _r2 != null:
		return _r2.socket_transform_world(socket)
	return Transform3D(Basis.IDENTITY, Vector3(INF, INF, INF))


func cancel_combat_action() -> void:
	if not _attack_name.is_empty() or _cast_active:
		combat_serial += 1
	_attack_name = ""
	_attack_step_used = 0.0
	_attack_serial += 1
	_cast_active = false
	_cast_action = ""
	combat_action_id = ""


func begin_visual_hitstop(duration: float) -> void:
	_visual_hitstop = maxf(_visual_hitstop, duration)


func attack_contact_point_world(combo_index: int) -> Vector3:
	return _r2.contact_point_world(combo_index) if _r2 != null else Vector3(INF, INF, INF)


func _ready() -> void:
	_r2 = NativeMotionR2.new()
	_model.add_child(_r2)
	_camera.make_current()
	Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)
	get_window().focus_exited.connect(_clear_flight_key_holds)


func _clear_flight_key_holds() -> void:
	_held_g = false
	_held_c = false
	_held_keys.clear()
	_last_space = false


func _input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.get_mouse_mode() == Input.MOUSE_MODE_CAPTURED:
		rotate_y(-event.relative.x * mouse_sensitivity)
		_look_pitch = clampf(_look_pitch - event.relative.y * mouse_sensitivity, -1.35, 1.35)
		_camera_pivot.rotation.x = _look_pitch
	elif event is InputEventKey:
		var key := event as InputEventKey
		# Keep hold state from the same event path as real keyboard input. Godot's
		# synthetic Input.parse_input_event does not update the OS key polling state.
		if key.physical_keycode in [KEY_W, KEY_A, KEY_S, KEY_D, KEY_SHIFT, KEY_CTRL, KEY_SPACE]:
			_held_keys[key.physical_keycode] = key.pressed
		if key.physical_keycode == KEY_G:
			_held_g = key.pressed
		elif key.physical_keycode == KEY_C:
			_held_c = key.pressed
		if not key.pressed or key.echo:
			return
		if key.physical_keycode == KEY_ESCAPE:
			Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
			_clear_flight_key_holds()
		elif key.physical_keycode == KEY_V:
			_first_person = not _first_person
	elif event is InputEventMouseButton:
		var button := event as InputEventMouseButton
		if button.pressed and button.button_index == MOUSE_BUTTON_LEFT and Input.get_mouse_mode() != Input.MOUSE_MODE_CAPTURED:
			Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)
			get_viewport().set_input_as_handled()


func _physics_process(delta: float) -> void:
	if _world == null:
		return
	var dt := clampf(delta, 0.0, 0.05)
	if dt <= 0.0:
		return
	if health <= 0.0:
		cancel_descent_strike("defeated")
		_death_timer = maxf(0.0, _death_timer - dt)
		velocity = Vector3.ZERO
		boosting = false
		guarding = false
		horizontal_speed = 0.0
		if _death_timer <= 0.0:
			health = max_health
			energy = MAX_ENERGY
			_defeated = false
			teleport_to_ground(0.0, 190.0)
			respawned.emit()
		_update_visual(dt)
		return
	var has_focus := Input.get_mouse_mode() == Input.MOUSE_MODE_CAPTURED and health > 0.0
	var g := has_focus and (Input.is_physical_key_pressed(KEY_G) or _held_g)
	var space := has_focus and _key_held(KEY_SPACE)
	var space_pressed := space and not _last_space
	_last_space = space
	guarding = has_focus and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT) and _attack_name.is_empty() and not _cast_active
	var axes := _movement_axes() if has_focus else Vector2.ZERO
	var shift := has_focus and _key_held(KEY_SHIFT)
	var control := has_focus and _key_held(KEY_CTRL)
	var descend := has_focus and (Input.is_physical_key_pressed(KEY_C) or _held_c)
	_hurt_time = maxf(0.0, _hurt_time - dt)
	if _planet_enabled():
		_sync_canonical_before_motion()
		_align_planet_up(_planet_up(global_position))
		var support := _planet_support(global_position)
		if support.is_empty():
			velocity = Vector3.ZERO
			boosting = false
			horizontal_speed = 0.0
			_update_visual(dt)
			_sync_canonical_after_motion()
			return
		if flight_active and float(support["agl"]) <= 0.16 and _vertical_speed <= 0.0:
			_finish_landing()
		if flight_active:
			_step_flight_planet(dt, axes, g, descend, shift, control)
		elif _try_takeoff(g, descend):
			_step_flight_planet(dt, axes, g, false, shift, control)
		else:
			_step_ground_planet(dt, axes, shift, space_pressed, control)
		_update_visual(dt)
		_sync_canonical_after_motion()
		return
	# A collision can put the capsule back on its feet while flight still says
	# active. Resolve that state before the next G press so lift cannot be
	# permanently rejected by the flight clearance sweep.
	if flight_active and global_position.y <= _foot_support_here() + 0.16 and _vertical_speed <= 0.0:
		_finish_landing()

	if flight_active:
		_step_flight(dt, axes, g, descend, shift, control)
	else:
		# Holding G while recovering from a low-energy landing launches as soon
		# as the displayed threshold is met. C always wins over G on landing.
		if _try_takeoff(g, descend):
			_step_flight(dt, axes, g, false, shift, control)
		else:
			_step_ground(dt, axes, shift, space_pressed, control)
	_update_visual(dt)


func _launch_from_ground() -> bool:
	if _planet_enabled():
		var support := _planet_support(global_position)
		if support.is_empty() or float(support.get("water_depth", 0.0)) > 0.15:
			return false
		var target: Vector3 = support["point"] + _planet_up(global_position) * FLIGHT_CLEARANCE
		if not _destination_clear(target) or not _planet_sweep(global_position, target):
			return false
		global_position = target
		flight_active = true
		_vertical_speed = 8.0
		_ground_vertical_speed = 0.0
		velocity = _planet_up(target) * 8.0
		return true
	var target := global_position
	target.y = maxf(target.y, _foot_support_here() + FLIGHT_CLEARANCE)
	if not _destination_clear(target):
		return false
	global_position = target
	flight_active = true
	_vertical_speed = 8.0
	_ground_vertical_speed = 0.0
	velocity.y = 8.0
	return true


func _try_takeoff(held_g: bool, descend: bool) -> bool:
	if not held_g or descend or energy < LAUNCH_ENERGY - 0.001 or not _on_terrain():
		return false
	# Frame-sized recovery can land a few ulps below 25 while the HUD prints 25.
	energy = maxf(energy, LAUNCH_ENERGY)
	return _launch_from_ground()


func _finish_landing() -> void:
	if descent_strike_active:
		cancel_descent_strike("landed without valid strike contact")
	flight_active = false
	boosting = false
	_flight_input_intent = Vector3.ZERO
	_vertical_speed = 0.0
	_ground_vertical_speed = 0.0
	if _planet_enabled():
		var up := _planet_up(global_position)
		velocity = velocity.slide(up).limit_length(10.0)
		_turn_bank = 0.0
		return
	# Ground locomotion takes over at its own acceleration, without carrying a
	# several-hundred-metre-per-second air velocity across the touchdown.
	var landing_flat := Vector2(velocity.x, velocity.z).limit_length(10.0)
	velocity = Vector3(landing_flat.x, 0.0, landing_flat.y)
	_turn_bank = 0.0


func begin_descent_strike(strike_serial: int) -> bool:
	# The skill owner handles tier, cost, cooldown and the authored windup. The
	# player accepts only the short final dive over a loaded, dry landing point.
	if strike_serial <= 0 or descent_strike_active or not flight_active or realm < 6 or health <= 0.0 or not _planet_enabled():
		return false
	var support := _planet_support(global_position)
	if support.is_empty() or float(support.get("water_depth", 0.0)) > 0.15:
		return false
	var agl := float(support["agl"])
	if agl < 4.0 or agl > STRIKE_MAX_AGL:
		return false
	var up := _planet_up(global_position)
	var landing: Vector3 = support["point"] + up * FLIGHT_CLEARANCE
	if not _destination_clear(landing) or not _planet_sweep(global_position, landing):
		return false
	descent_strike_active = true
	_descent_strike_serial = strike_serial
	_descent_strike_remaining = STRIKE_TIMEOUT
	return true


func cancel_descent_strike(reason: String = "cancelled") -> void:
	if not descent_strike_active:
		return
	var strike_serial := _descent_strike_serial
	_clear_descent_strike()
	descent_strike_failed.emit(strike_serial, reason)


func _clear_descent_strike() -> void:
	descent_strike_active = false
	_descent_strike_serial = 0
	_descent_strike_remaining = 0.0


func _movement_axes() -> Vector2:
	var x := (1.0 if _key_held(KEY_D) else 0.0) - (1.0 if _key_held(KEY_A) else 0.0)
	var z := (1.0 if _key_held(KEY_W) else 0.0) - (1.0 if _key_held(KEY_S) else 0.0)
	return Vector2(x, z).normalized()


func _key_held(code: Key) -> bool:
	return Input.is_physical_key_pressed(code) or _held_keys.get(code, false) == true


func _move_direction(axes: Vector2) -> Vector3:
	if axes.is_zero_approx():
		return Vector3.ZERO
	var forward := -global_transform.basis.z
	var right := global_transform.basis.x
	return (right * axes.x + forward * axes.y).normalized()


func _flight_input_direction(axes: Vector2, lift: bool, descend: bool) -> Vector3:
	# The camera pitches W/S, while A/D continue to strafe in the body's local
	# plane. Normalize after adding G/C so diagonals cannot gain extra speed.
	var forward := -_camera_pivot.global_transform.basis.z
	var right := global_transform.basis.x
	var vertical := -1.0 if descend else 1.0 if lift else 0.0
	var intent := right * axes.x + forward * axes.y + (_planet_up(global_position) if _planet_enabled() else Vector3.UP) * vertical
	return intent.normalized() if not intent.is_zero_approx() else Vector3.ZERO


func _step_ground(dt: float, axes: Vector2, shift: bool, jump_pressed: bool, precision: bool = false) -> void:
	boosting = false
	_turn_bank = lerpf(_turn_bank, 0.0, 1.0 - exp(-7.0 * dt))
	if not _cast_active and not descent_strike_active:
		energy = minf(MAX_ENERGY, energy + GROUND_ENERGY_RECOVERY * dt)
	var direction := _move_direction(axes)
	var speed := 1.6 if precision else 10.0 if shift else 6.8
	if not _attack_name.is_empty():
		speed = float(GROUND_ATTACK_SPEED[_attack_name])
	elif _cast_active:
		speed = 0.25
	elif guarding:
		speed = 1.8
	var desired := direction * speed
	var current := Vector3(velocity.x, 0.0, velocity.z)
	if not _attack_name.is_empty() or _cast_active or guarding:
		current = current.limit_length(speed)
	var flat := current.move_toward(desired, 28.0 * dt)
	if not _attack_name.is_empty() and _attack_elapsed < _attack_windup:
		# The original C2 arm cannot reach a target two metres from the feet.
		# Move the physical capsule with the planted lead-foot step before the
		# contact frame; the normal path check and move_and_slide block walls.
		var step_total := float(GROUND_ATTACK_STEP[_attack_name])
		var step_time := minf(dt, _attack_windup - _attack_elapsed)
		var root_step := minf(step_total - _attack_step_used, step_total * step_time / _attack_windup)
		if root_step > 0.0:
			flat += -global_transform.basis.z * (root_step / dt)
			_attack_step_used += root_step
	var candidate := global_position + flat * dt
	if not _ground_path_clear(global_position, candidate):
		flat = Vector3.ZERO
	var before := global_position
	var stepped := 0.0
	var was_grounded := _on_terrain()
	if not jump_pressed and not flat.is_zero_approx() and _ground_vertical_speed <= 0.0 and global_position.y <= _foot_support_here() + CAMP_STEP_HEIGHT + 0.15:
		# The capsule reaches a riser before its centre reaches the tread. Sample
		# the authored floor a capsule-radius ahead so the feet can clear the lip.
		var ahead := candidate + flat.normalized() * (BODY_RADIUS + 0.12)
		var next_support := maxf(
			_support_at(candidate.x, candidate.z, global_position.y + 1.0),
			_support_at(ahead.x, ahead.z, global_position.y + 1.0)
		)
		var rise := next_support - global_position.y
		if rise > 0.04 and rise <= CAMP_STEP_HEIGHT and not test_move(global_transform, Vector3.UP * (rise + 0.025)):
			stepped = rise + 0.025
			global_position.y += stepped
	velocity.x = flat.x
	velocity.z = flat.z
	if jump_pressed and was_grounded:
		_ground_vertical_speed = 7.5
	else:
		_ground_vertical_speed = maxf(-50.0, _ground_vertical_speed - 22.0 * dt)
	velocity.y = _ground_vertical_speed
	_apply_hit_impulse(dt)
	move_and_slide()
	if not _inside_world(global_position) or _world.is_solid_at(global_position, BODY_RADIUS, BODY_HEIGHT):
		global_position = before
		velocity.x = 0.0
		velocity.z = 0.0
	elif stepped > 0.0 and Vector2(global_position.x - before.x, global_position.z - before.z).length() < 0.02:
		global_position.y = before.y
		velocity.x = 0.0
		velocity.z = 0.0
	var floor_y := _foot_support_here()
	if global_position.y <= floor_y + 0.12 and velocity.y <= 0.0:
		global_position.y = floor_y
		velocity.y = 0.0
		_ground_vertical_speed = 0.0
	horizontal_speed = Vector2(velocity.x, velocity.z).length()


func _step_flight(dt: float, axes: Vector2, lift: bool, descend: bool, shift: bool, precision: bool) -> void:
	var agl := global_position.y - _ground_here()
	var powered := energy > 0.0
	var desired_direction := _flight_input_direction(axes, lift, descend)
	_flight_input_intent = desired_direction
	var wants_boost := powered and shift and not desired_direction.is_zero_approx() and energy >= BOOST_MIN_ENERGY
	var speed_limit := _flight_speed(agl, wants_boost)
	if precision and not wants_boost:
		speed_limit = minf(speed_limit, 5.0)
	var current := Vector2(velocity.x, velocity.z)
	var current_speed := current.length()
	var target_speed := speed_limit * Vector2(desired_direction.x, desired_direction.z).length() if powered else 0.0
	var desired_heading := Vector2(desired_direction.x, desired_direction.z).angle()
	var heading := current.angle() if current_speed > 0.000001 else desired_heading
	var angle := wrapf(desired_heading - heading, -PI, PI) if target_speed > 0.0 else 0.0
	var turn_rate := minf(1.8, 900.0 / maxf(current_speed, 1.0))
	heading += clampf(angle, -turn_rate * dt, turn_rate * dt)
	var acceleration := 300.0 if wants_boost else 165.0
	if precision and not wants_boost:
		acceleration = 30.0
	var speed_rate := 420.0 if target_speed < current_speed else acceleration
	current_speed = move_toward(current_speed, target_speed, speed_rate * dt)
	velocity.x = cos(heading) * current_speed
	velocity.z = sin(heading) * current_speed
	var bank_target := clampf((axes.x * 0.65 if wants_boost else 0.0) - sin(angle) * 0.35, -1.0, 1.0) if target_speed > 0.0 else 0.0
	_turn_bank = lerpf(_turn_bank, bank_target, 1.0 - exp(-5.0 * dt))

	var height_mix := _height_blend(agl)
	var climb := lerpf(24.0, 90.0, height_mix)
	var safe_agl := maxf(0.0, global_position.y - _foot_support_here() - FLIGHT_CLEARANCE)
	var descent_speed := minf(65.0, maxf(2.0, sqrt(12.0 * safe_agl)))
	if wants_boost:
		climb *= 1.8
		descent_speed *= 1.8
	var falling := not powered or agl >= MAX_AGL + 0.01
	var target_vertical := -descent_speed if falling else clampf(desired_direction.y * speed_limit, -descent_speed, climb)
	if not falling:
		target_vertical = minf(target_vertical, sqrt(440.0 * maxf(0.0, MAX_AGL - agl)))
	# Begin braking before a pitched dive reaches the floor. C can still land;
	# pitch alone levels at the flight clearance instead of touching down.
	var vertical_rate := 220.0 if target_vertical <= _vertical_speed else 150.0 if wants_boost else 90.0
	if not descend and powered and target_vertical < 0.0:
		target_vertical = maxf(target_vertical, -sqrt(2.0 * vertical_rate * safe_agl))
	_vertical_speed = move_toward(_vertical_speed, target_vertical, vertical_rate * dt)
	velocity.y = _vertical_speed
	_apply_hit_impulse(dt)

	var before := global_position
	var wanted := before + velocity * dt
	var path_clear := _air_path_clear(before, wanted)
	if not path_clear:
		var vertical_only := Vector3(before.x, wanted.y, before.z)
		if _air_path_clear(before, vertical_only):
			velocity.x = 0.0
			velocity.z = 0.0
			path_clear = true
		else:
			velocity = Vector3.ZERO
			_vertical_speed = 0.0
			path_clear = true
	var expected := before + velocity * dt
	move_and_slide()
	# A full second sweep is needed only if a physics collider changed the path.
	if (not path_clear or global_position.distance_to(expected) > 0.05) and not _air_path_clear(before, global_position):
		global_position = before
		velocity = Vector3.ZERO
		_vertical_speed = 0.0
	var floor_y := _support_at(global_position.x, global_position.z, global_position.y + 0.02)
	if (global_position.y <= floor_y + 0.16 and velocity.y <= 0.0) or ((descend or not powered) and global_position.y <= floor_y + 0.7 and _vertical_speed <= 0.0):
		global_position.y = floor_y
		_finish_landing()
	elif velocity.y < _vertical_speed and is_on_ceiling():
		_vertical_speed = velocity.y
	horizontal_speed = Vector2(velocity.x, velocity.z).length()
	boosting = flight_active and wants_boost and velocity.length() > 0.01
	if powered:
		energy = maxf(0.0, energy - (0.03 + (1.5 if boosting else 0.0)) * dt)


func _step_ground_planet(dt: float, axes: Vector2, shift: bool, jump_pressed: bool, precision: bool) -> void:
	var up := _planet_up(global_position)
	_align_planet_up(up)
	var support := _planet_support(global_position)
	if support.is_empty():
		velocity = Vector3.ZERO
		return
	boosting = false
	_turn_bank = lerpf(_turn_bank, 0.0, 1.0 - exp(-7.0 * dt))
	if not _cast_active and not descent_strike_active:
		energy = minf(MAX_ENERGY, energy + GROUND_ENERGY_RECOVERY * dt)
	var direction := _move_direction(axes).slide(up).normalized()
	var speed := 1.6 if precision else 10.0 if shift else 6.8
	if not _attack_name.is_empty():
		speed = float(GROUND_ATTACK_SPEED[_attack_name])
	elif _cast_active:
		speed = 0.25
	elif guarding:
		speed = 1.8
	var current := velocity.slide(up)
	if not _attack_name.is_empty() or _cast_active or guarding:
		current = current.limit_length(speed)
	var tangent := current.move_toward(direction * speed, 28.0 * dt)
	if not _attack_name.is_empty() and _attack_elapsed < _attack_windup:
		var step_total := float(GROUND_ATTACK_STEP[_attack_name])
		var step_time := minf(dt, _attack_windup - _attack_elapsed)
		var root_step := minf(step_total - _attack_step_used, step_total * step_time / _attack_windup)
		if root_step > 0.0:
			tangent += (-global_transform.basis.z).slide(up).normalized() * (root_step / dt)
			_attack_step_used += root_step
	var before := global_position
	var stepped := 0.0
	if not jump_pressed and not tangent.is_zero_approx() and _ground_vertical_speed <= 0.0 and _support_provider != null and absf(before.x) < WORLD_HALF and absf(before.z) < WORLD_HALF and up.dot(Vector3.UP) > 0.99 and float(support["agl"]) <= CAMP_STEP_HEIGHT + 0.15:
		# Match the authored camp treads: probe ahead of the capsule, then move
		# the real body over only a low riser with tested overhead clearance.
		var candidate := before + tangent * dt
		var ahead := candidate + tangent.normalized() * (BODY_RADIUS + 0.12)
		var next_floor := maxf(
			_support_at(candidate.x, candidate.z, before.y + 1.0),
			_support_at(ahead.x, ahead.z, before.y + 1.0)
		)
		var rise := (Vector3(before.x, next_floor, before.z) - before).dot(up)
		if rise > 0.04 and rise <= CAMP_STEP_HEIGHT and not test_move(global_transform, up * (rise + 0.025)):
			stepped = rise + 0.025
			global_position += up * stepped
	if not tangent.is_zero_approx() and not _planet_sweep(global_position, global_position + tangent * dt):
		tangent = Vector3.ZERO
	if stepped > 0.0 and tangent.is_zero_approx():
		global_position = before
		stepped = 0.0
	var grounded := float(support["agl"]) <= 0.12 or is_on_floor()
	if jump_pressed and grounded:
		_ground_vertical_speed = 7.5
	else:
		_ground_vertical_speed = maxf(-50.0, _ground_vertical_speed - 22.0 * dt)
	velocity = tangent + up * _ground_vertical_speed
	_apply_hit_impulse(dt)
	move_and_slide()
	if stepped > 0.0 and (global_position - before).slide(up).length() < 0.02:
		global_position = before
		velocity = Vector3.ZERO
		_ground_vertical_speed = 0.0
		return
	var after := _planet_support(global_position)
	if after.is_empty():
		global_position = before
		velocity = Vector3.ZERO
		_ground_vertical_speed = 0.0
		return
	var next_up := _planet_up(global_position)
	if float(after["agl"]) <= 0.12 and velocity.dot(next_up) <= 0.0:
		global_position = after["point"]
		velocity = velocity.slide(next_up)
		_ground_vertical_speed = 0.0
	horizontal_speed = velocity.slide(next_up).length()


func _step_flight_planet(dt: float, axes: Vector2, lift: bool, descend: bool, shift: bool, precision: bool) -> void:
	var before := global_position
	var up := _planet_up(before)
	_align_planet_up(up)
	var support := _planet_support(before)
	if support.is_empty():
		cancel_descent_strike("landing terrain is not ready")
		velocity = Vector3.ZERO
		boosting = false
		return
	if descent_strike_active:
		_descent_strike_remaining -= dt
		if _descent_strike_remaining <= 0.0 or _hurt_time > 0.0 or energy <= 0.0:
			cancel_descent_strike("descent interrupted or timed out")
	var agl := float(support["agl"])
	var orbit_mix := planet_orbit_blend(agl)
	var powered := energy > 0.0
	var desired_direction := _flight_input_direction(axes, lift, descend)
	_flight_input_intent = desired_direction
	var wants_boost := powered and shift and not descent_strike_active and not desired_direction.is_zero_approx() and energy >= BOOST_MIN_ENERGY
	var speed_limit := lerpf(_flight_speed(agl, wants_boost), float((REALM_BOOST if wants_boost else REALM_CRUISE).get(realm, 420.0)) * 8.0, orbit_mix)
	if precision and not wants_boost:
		speed_limit = minf(speed_limit, 5.0)
	var desired_tangent := desired_direction.slide(up)
	var current := velocity.slide(up)
	var current_speed := current.length()
	var target_speed := speed_limit * desired_tangent.length() if powered and not descent_strike_active else 0.0
	var forecast := {"clearance": maxf(0.0, agl - _planet_flight_floor(support)), "blocked": false}
	if (descend or descent_strike_active or desired_direction.dot(up) < -0.05 or _vertical_speed < -4.0) and current_speed > 1.0:
		forecast = _planet_descent_forecast(before, support, current, dt)
		if bool(forecast["blocked"]):
			target_speed = 0.0
			if descent_strike_active:
				cancel_descent_strike("forward landing route is blocked")
	var heading := current.normalized() if current_speed > 0.000001 else desired_tangent.normalized()
	var angle := heading.signed_angle_to(desired_tangent.normalized(), up) if target_speed > 0.0 else 0.0
	var turn_rate := minf(1.8, 900.0 / maxf(current_speed, 1.0))
	if target_speed > 0.0:
		heading = heading.rotated(up, clampf(angle, -turn_rate * dt, turn_rate * dt))
	var acceleration := lerpf(300.0 if wants_boost else 165.0, 1800.0, orbit_mix)
	if precision and not wants_boost:
		acceleration = 30.0
	var speed_rate := lerpf(420.0, 2200.0, orbit_mix) if target_speed < current_speed else acceleration
	if descent_strike_active or bool(forecast["blocked"]):
		speed_rate = maxf(speed_rate, 800.0)
	current_speed = move_toward(current_speed, target_speed, speed_rate * dt)
	var tangent_velocity := heading * current_speed
	var bank_target := clampf((axes.x * 0.65 if wants_boost else 0.0) - sin(angle) * 0.35, -1.0, 1.0) if target_speed > 0.0 else 0.0
	_turn_bank = lerpf(_turn_bank, bank_target, 1.0 - exp(-5.0 * dt))
	var height_mix := _height_blend(agl)
	var climb := lerpf(lerpf(24.0, 90.0, height_mix), float((REALM_BOOST if wants_boost else REALM_CRUISE).get(realm, 420.0)) * 8.0, orbit_mix)
	var safe_agl := minf(maxf(0.0, agl - _planet_flight_floor(support)), float(forecast["clearance"]))
	var reference_speed := 65.0 * (1.8 if wants_boost else 1.0)
	# Keep a responsive final approach over water as well as dry ground; the
	# collision floor still owns the actual 0.42 m sea clearance.
	var low_descent := lerpf(3.0, reference_speed, smoothstep(0.0, DESCENT_REFERENCE_AGL, safe_agl))
	# At high speed start braking before the 100 m low approach. The conservative
	# 450 m/s² envelope includes the next physics travel and is below the actual
	# emergency brake authority. Ordinary C retains the 65/117 m/s low limits.
	var planning_agl := maxf(0.0, safe_agl - maxf(DESCENT_FRAME_MARGIN, maxf(0.0, -_vertical_speed) * dt))
	var brake_cap := sqrt(reference_speed * reference_speed + 2.0 * DESCENT_BRAKE_ACCEL * maxf(0.0, planning_agl - DESCENT_REFERENCE_AGL))
	var contact_cap := 2.0 + sqrt(2.0 * DESCENT_BRAKE_ACCEL * maxf(0.0, planning_agl - 0.28))
	var descent_speed := minf(lerpf(low_descent, speed_limit, orbit_mix), minf(brake_cap, contact_cap))
	climb *= lerpf(1.8 if wants_boost else 1.0, 1.0, orbit_mix)
	var falling := not powered
	var target_vertical := -descent_speed if falling else clampf(desired_direction.dot(up) * speed_limit, -descent_speed, climb)
	if descent_strike_active:
		target_vertical = -minf(55.0, maxf(18.0, sqrt(180.0 * safe_agl)))
	if not falling:
		target_vertical = minf(target_vertical, sqrt(2.0 * ORBIT_VERTICAL_ACCEL * maxf(0.0, PLANET_MAX_AGL - agl)))
	var vertical_rate := lerpf(220.0 if target_vertical <= _vertical_speed else 150.0 if wants_boost else 90.0, ORBIT_VERTICAL_ACCEL, orbit_mix)
	if descent_strike_active:
		vertical_rate = maxf(vertical_rate, 180.0)
	# The atmosphere blend lowers the preferred descent speed before touchdown.
	# Keep braking authority above the envelope used for stopping distance.
	if _vertical_speed < -65.0 and target_vertical > _vertical_speed:
		vertical_rate = maxf(vertical_rate, ORBIT_VERTICAL_ACCEL * 1.4)
	if not descend and not descent_strike_active and powered and target_vertical < 0.0:
		target_vertical = maxf(target_vertical, -sqrt(2.0 * vertical_rate * safe_agl))
	_vertical_speed = move_toward(_vertical_speed, target_vertical, vertical_rate * dt)
	velocity = tangent_velocity + up * _vertical_speed
	_apply_hit_impulse(dt)
	# A tangent chord loses altitude around a sphere. Follow the geodesic at
	# the current radius so a long flight can cross the pole and back hemisphere.
	var centre := Vector3(0.0, -float(_world.get("planet_radius")), 0.0)
	var radial := before - centre
	var radius := radial.length()
	var tangent_distance := tangent_velocity.length() * dt
	var arc := tangent_distance / maxf(1.0, radius)
	var direction := radial.normalized() * cos(arc) + tangent_velocity.normalized() * sin(arc) if tangent_distance > 0.0 else radial.normalized()
	var candidate := centre + direction.normalized() * (radius + _vertical_speed * dt)
	var next_support := _planet_support(candidate)
	if next_support.is_empty():
		cancel_descent_strike("landing terrain became unavailable")
		# The next cube-face tile may still be building. Keep momentum while
		# requesting it, then retry the same safe move on a later physics tick.
		_world.call("update_stream", candidate)
		boosting = false
		return
	if descent_strike_active and float(next_support.get("water_depth", 0.0)) > 0.15:
		cancel_descent_strike("water is not a strike landing surface")
	if float(next_support["agl"]) < _planet_flight_floor(next_support):
		candidate = next_support["point"] + _planet_up(candidate) * _planet_flight_floor(next_support)
	if float(next_support["agl"]) > PLANET_MAX_AGL:
		candidate = next_support["point"] + _planet_up(candidate) * PLANET_MAX_AGL
	if not _planet_sweep(before, candidate):
		cancel_descent_strike("landing path is blocked")
		var route: Dictionary = _world.call("sweep", before, candidate, BODY_RADIUS, BODY_HEIGHT)
		if route.get("ready", false) != true:
			_world.call("update_stream", candidate)
			boosting = false
			return
		var vertical_only := before + up * _vertical_speed * dt
		if _planet_sweep(before, vertical_only):
			candidate = vertical_only
		else:
			velocity = Vector3.ZERO
			_vertical_speed = 0.0
			boosting = false
			return
	velocity = (candidate - before) / dt
	move_and_slide()
	var after := _planet_support(global_position)
	if after.is_empty():
		cancel_descent_strike("landing terrain became unavailable")
		global_position = before
		velocity = Vector3.ZERO
		_vertical_speed = 0.0
		return
	var next_up := _planet_up(global_position)
	var dry_contact := float(after.get("water_depth", 0.0)) <= 0.15
	if descent_strike_active and not dry_contact:
		cancel_descent_strike("water is not a strike landing surface")
	if descent_strike_active and dry_contact and float(after["agl"]) <= 0.7 and _vertical_speed <= 0.0:
		var strike_serial := _descent_strike_serial
		var impact_speed := maxf(0.0, -_vertical_speed)
		var contact_point: Vector3 = after["point"]
		var contact_normal: Vector3 = after.get("normal", next_up)
		_clear_descent_strike()
		global_position = contact_point
		_finish_landing()
		descent_strike_landed.emit(strike_serial, contact_point, contact_normal, impact_speed)
	elif (descend or not powered) and float(after["agl"]) <= 0.7 and _vertical_speed <= 0.0 and dry_contact:
		global_position = after["point"]
		_finish_landing()
	else:
		_vertical_speed = velocity.dot(next_up)
	horizontal_speed = velocity.slide(next_up).length()
	boosting = flight_active and wants_boost and velocity.length() > 0.01
	if powered:
		energy = maxf(0.0, energy - (0.03 + (lerpf(1.5, 0.15, orbit_mix) if boosting else 0.0)) * dt)


func _planet_descent_forecast(at: Vector3, support: Dictionary, tangent: Vector3, dt: float) -> Dictionary:
	var clearance := maxf(0.0, float(support["agl"]) - _planet_flight_floor(support))
	var result := {"clearance": clearance, "blocked": false}
	var speed := tangent.length()
	if clearance > 2500.0 or speed <= 1.0:
		return result
	# Sweep the actual geodesic travel horizon rather than a flat-world y probe.
	# This catches rising terrain and the sea surface before the capsule reaches
	# them; the final physical sweep remains the authority for contact.
	var horizon := clampf(speed * speed / (2.0 * 420.0) + speed * dt * 2.0, 10.0, 600.0)
	var centre := Vector3(0.0, -float(_world.get("planet_radius")), 0.0)
	var radial := at - centre
	var radius := radial.length()
	for fraction in [0.5, 1.0]:
		var arc := horizon * float(fraction) / maxf(1.0, radius)
		var direction := radial.normalized() * cos(arc) + tangent.normalized() * sin(arc)
		var probe := centre + direction.normalized() * radius
		var ahead := _planet_support(probe)
		if ahead.is_empty():
			_world.call("update_stream", probe)
			return {"clearance": 0.0, "blocked": true}
		var ahead_clearance := float(ahead["agl"]) - _planet_flight_floor(ahead)
		result["clearance"] = minf(float(result["clearance"]), maxf(0.0, ahead_clearance))
		if ahead_clearance < 1.2 or _world.is_solid_at(probe, BODY_RADIUS, BODY_HEIGHT):
			result["blocked"] = true
	return result


func _height_blend(agl: float) -> float:
	var t := clampf(agl / 350.0, 0.0, 1.0)
	return t * t * (3.0 - 2.0 * t)


func _flight_speed(agl: float, boosted: bool) -> float:
	var high := float(REALM_BOOST.get(realm, 600.0)) if boosted else float(REALM_CRUISE.get(realm, 420.0))
	return lerpf(48.0, high, _height_blend(agl))


func _air_path_clear(from: Vector3, to: Vector3) -> bool:
	if _planet_enabled():
		var sample := _planet_support(to)
		return not sample.is_empty() and float(sample["agl"]) >= _planet_flight_floor(sample) - 0.02 and float(sample["agl"]) <= PLANET_MAX_AGL + 0.01 and _planet_sweep(from, to)
	var distance := from.distance_to(to)
	var steps := maxi(1, ceili(distance / 1.25))
	if steps > 128:
		return false
	for i in range(1, steps + 1):
		var p := from.lerp(to, float(i) / float(steps))
		if not _inside_world(p):
			return false
		var terrain_y := _world.height_at(p.x, p.z)
		var support_y := _support_at(p.x, p.z, p.y + 0.02)
		if p.y < support_y + FLIGHT_CLEARANCE - 0.02 or p.y > terrain_y + MAX_AGL + 0.01:
			return false
		if _world.is_solid_at(p, BODY_RADIUS, BODY_HEIGHT):
			return false
	return true


func _ground_path_clear(from: Vector3, to: Vector3) -> bool:
	if _planet_enabled():
		return not _planet_support(to).is_empty() and _planet_sweep(from, to)
	var distance := Vector2(from.x - to.x, from.z - to.z).length()
	var steps := maxi(1, ceili(distance / 0.5))
	var start_floor := _support_at(from.x, from.z, from.y + 0.12)
	var previous_floor := start_floor
	for i in range(1, steps + 1):
		var p := from.lerp(to, float(i) / float(steps))
		if not _inside_world(p):
			return false
		var floor_y := _support_at(p.x, p.z, previous_floor + 1.0)
		if floor_y - previous_floor > CAMP_STEP_HEIGHT or floor_y - start_floor > distance * 0.65 + CAMP_STEP_HEIGHT:
			return false
		p.y = maxf(p.y, floor_y)
		if _world.is_solid_at(p, BODY_RADIUS, BODY_HEIGHT):
			return false
		previous_floor = floor_y
	return true


func _apply_hit_impulse(_dt: float) -> void:
	# Knockback is a single velocity impulse. Re-adding a decaying impulse every
	# frame accumulated a guarded shove into a 16 m/s slide and broke foot locks.
	if _hit_impulse.is_zero_approx():
		return
	velocity += _hit_impulse
	var up := _planet_up(global_position) if _planet_enabled() else Vector3.UP
	if _hit_impulse.dot(up) > 0.0:
		if flight_active:
			_vertical_speed = velocity.dot(up)
		else:
			_ground_vertical_speed = velocity.dot(up)
	_hit_impulse = Vector3.ZERO


func _ground_here() -> float:
	if _planet_enabled():
		var support := _planet_support(global_position)
		return global_position.y - float(support.get("agl", 0.0))
	return _world.height_at(global_position.x, global_position.z)


func _foot_support_here() -> float:
	if _planet_enabled():
		var support := _planet_support(global_position)
		return global_position.y - float(support.get("agl", 0.0))
	return _support_at(global_position.x, global_position.z, global_position.y + 0.12)


func _support_at(x: float, z: float, max_y: float) -> float:
	var terrain_y := _world.height_at(x, z)
	if _support_provider == null or not is_instance_valid(_support_provider) or not _support_provider.has_method("support_height_at"):
		return terrain_y
	var camp_y := float(_support_provider.support_height_at(x, z, max_y))
	if is_nan(camp_y) or is_inf(camp_y) or camp_y < terrain_y - 0.02 or camp_y > max_y + 0.02:
		return terrain_y
	return maxf(terrain_y, camp_y)


func _destination_clear(target: Vector3) -> bool:
	if _planet_enabled() and _planet_support(target).is_empty():
		return false
	if _world.is_solid_at(target, BODY_RADIUS, BODY_HEIGHT):
		return false
	var shape_node := get_node_or_null("CollisionShape3D") as CollisionShape3D
	if shape_node == null or shape_node.shape == null or not is_inside_tree():
		return false
	var query := PhysicsShapeQueryParameters3D.new()
	query.shape = shape_node.shape
	var shape_transform := shape_node.global_transform
	if _planet_enabled():
		var old_up := global_transform.basis.y.normalized()
		var destination_up := _planet_up(target)
		shape_transform.basis = Basis(Quaternion(old_up, destination_up)) * shape_transform.basis
	shape_transform.origin += target - global_position + (_planet_up(target) if _planet_enabled() else Vector3.UP) * 0.01
	query.transform = shape_transform
	query.collision_mask = collision_mask
	query.exclude = [get_rid()]
	return get_world_3d().direct_space_state.intersect_shape(query, 1).is_empty()


func _on_terrain() -> bool:
	if _planet_enabled():
		var support := _planet_support(global_position)
		return not support.is_empty() and (is_on_floor() or float(support["agl"]) <= 0.15)
	return is_on_floor() or global_position.y <= _foot_support_here() + 0.15


func _inside_world(p: Vector3) -> bool:
	if _planet_enabled():
		return p.is_finite() and (p - Vector3(0.0, -float(_world.get("planet_radius")), 0.0)).length() > 1000.0
	return absf(p.x) <= WORLD_HALF and absf(p.z) <= WORLD_HALF


func _update_visual(dt: float) -> void:
	# One visual clock: R2 owns poses and action progress; the old retargeter
	# remains dormant while the original motion data is retained for migration.
	var frozen := minf(dt, _visual_hitstop)
	_visual_hitstop -= frozen
	_r2.update_from_player(dt - frozen, self)
	if _attack_name.is_empty() and not _cast_active:
		combat_action_id = ""
	_model.rotation = Vector3.ZERO
	var desired_camera := Vector3.ZERO if _first_person else Vector3(0.0, 1.25, 5.0)
	var safe_camera := _safe_camera_offset(desired_camera)
	# Set the safe position directly: interpolating from an obstructed previous
	# position can leave the near plane inside a wall for several frames.
	_camera.position = safe_camera
	_camera.near = 0.05
	if _planet_enabled():
		var support := _planet_support(global_position)
		var agl := maxf(0.0, float(support.get("agl", 0.0)))
		var radius := float(_world.get("planet_radius"))
		var horizon := sqrt(agl * (2.0 * radius + agl))
		_camera.far = minf(500000.0, maxf(maxf(8000.0, horizon * 1.2), (2.0 * radius + agl) * planet_orbit_blend(agl)))
	_model.visible = not _first_person and safe_camera.length() >= 0.8
	_camera.fov = lerpf(_camera.fov, 79.0 if boosting else 70.0, 1.0 - exp(-5.0 * dt))


func _safe_camera_offset(desired: Vector3) -> Vector3:
	if desired.is_zero_approx() or not is_inside_tree():
		return desired
	var anchor := _camera_pivot.global_position
	if _camera_shape_overlaps(anchor, CAMERA_ONLY_LAYER):
		# Godot's cast_motion may report a full safe fraction when its starting
		# sphere is already inside the creature's camera-only shape. Find the
		# first clear point behind the character, without passing a world wall.
		for i in range(21):
			var candidate := desired.normalized() * (desired.length() + 0.25 * float(i))
			var global_candidate := _camera_pivot.to_global(candidate)
			if _camera_shape_overlaps(global_candidate, collision_mask | CAMERA_ONLY_LAYER):
				continue
			if _camera_world_sweep_clear(anchor, global_candidate):
				return candidate
		return Vector3.ZERO
	var motion := _camera_pivot.global_basis * desired
	var query := PhysicsShapeQueryParameters3D.new()
	var sphere := SphereShape3D.new()
	sphere.radius = CAMERA_RADIUS
	query.shape = sphere
	query.transform = Transform3D(Basis.IDENTITY, _camera_pivot.global_position)
	query.motion = motion
	query.collision_mask = collision_mask | CAMERA_ONLY_LAYER
	query.exclude = [get_rid()]
	var sweep := get_world_3d().direct_space_state.cast_motion(query)
	if sweep.size() < 1:
		return desired
	var safe_fraction := clampf(float(sweep[0]) - CAMERA_WALL_GAP / motion.length(), 0.0, 1.0)
	return desired * safe_fraction


func _camera_shape_overlaps(at: Vector3, mask: int) -> bool:
	var query := PhysicsShapeQueryParameters3D.new()
	var sphere := SphereShape3D.new()
	sphere.radius = CAMERA_RADIUS
	query.shape = sphere
	query.transform = Transform3D(Basis.IDENTITY, at)
	query.collision_mask = mask
	query.exclude = [get_rid()]
	return not get_world_3d().direct_space_state.intersect_shape(query, 1).is_empty()


func _camera_world_sweep_clear(from: Vector3, to: Vector3) -> bool:
	var query := PhysicsShapeQueryParameters3D.new()
	var sphere := SphereShape3D.new()
	sphere.radius = CAMERA_RADIUS
	query.shape = sphere
	query.transform = Transform3D(Basis.IDENTITY, from)
	query.motion = to - from
	query.collision_mask = collision_mask
	query.exclude = [get_rid()]
	var sweep := get_world_3d().direct_space_state.cast_motion(query)
	return sweep.size() > 0 and float(sweep[0]) >= 0.999


func _update_bone_motion(dt: float) -> void:
	if _motion_failed or _skeleton == null and not _prepare_native_skeleton():
		return
	_motion_clock += dt
	var pose: Dictionary
	if flight_active:
		var hover: Dictionary = _sample_key_pose(_motion["flightClips"]["hover"], _motion_clock, "time", false)
		var boost: Dictionary = _sample_key_pose(_motion["combatClips"]["boost"], fposmod(_motion_clock, 2.0) / 2.0, "progress", true)
		_boost_weight = lerpf(_boost_weight, 1.0 if boosting else 0.0, 1.0 - exp(-7.0 * dt))
		pose = _mix_pose(hover, boost, _boost_weight)
		var rotations: Array = pose["rotations"]
		rotations[0] = Quaternion(Vector3.BACK, _turn_bank * 0.23 * clampf(horizontal_speed / 120.0, 0.0, 1.0)) * rotations[0]
	else:
		_boost_weight = lerpf(_boost_weight, 0.0, 1.0 - exp(-7.0 * dt))
		var gait := "idle"
		if horizontal_speed > 0.15:
			gait = "walk" if horizontal_speed < 2.5 else "jog" if horizontal_speed < 8.0 else "sprint"
			var ground_clip: Dictionary = _motion["groundClips"][gait]
			_gait_phase = fposmod(_gait_phase + dt * horizontal_speed / maxf(0.25, float(ground_clip["stride"])), 1.0)
			pose = _sample_ground_pose(ground_clip, _gait_phase)
		else:
			var idle_clip: Dictionary = _motion["groundClips"]["idle"]
			pose = _sample_ground_pose(idle_clip, fposmod(_motion_clock, float(idle_clip["duration"])) / float(idle_clip["duration"]))
			# Match the browser's planted idle: breathing stays in the torso and arms,
			# while pelvis and both feet keep their first authored contact pose.
			var planted: Dictionary = _sample_ground_pose(idle_clip, 0.0)
			var breathing_rotations: Array = pose["rotations"]
			var planted_rotations: Array = planted["rotations"]
			for index in [0, 13, 14, 15, 16, 17, 18]:
				breathing_rotations[index] = planted_rotations[index]
			pose["position"] = planted["position"]
	var ground_base: Dictionary = pose
	var is_attacking := not _attack_name.is_empty()
	if is_attacking:
		_attack_elapsed += dt
		var progress := 0.0
		if _attack_elapsed <= _attack_windup:
			progress = 0.45 * clampf(_attack_elapsed / _attack_windup, 0.0, 1.0)
		else:
			progress = 0.45 + 0.55 * clampf((_attack_elapsed - _attack_windup) / maxf(0.01, _attack_duration - _attack_windup), 0.0, 1.0)
		pose = _sample_key_pose(_motion["combatClips"][_attack_name], progress, "progress", true)
		if not flight_active:
			_preserve_ground_support(pose, ground_base, _attack_name)
		if _attack_elapsed >= _attack_duration:
			_attack_name = ""
	elif _cast_active:
		_cast_elapsed += dt
		var progress := 0.5 * clampf(_cast_elapsed / _cast_windup, 0.0, 1.0)
		if _cast_elapsed > _cast_windup:
			progress = 0.5 + 0.5 * clampf((_cast_elapsed - _cast_windup) / 0.24, 0.0, 1.0)
		pose = _sample_key_pose(_motion["combatClips"]["launch"], progress, "progress", true)
		if _cast_elapsed >= _cast_duration:
			_cast_active = false
	elif guarding:
		pose = _sample_key_pose(_motion["combatClips"]["air-guard"], 0.5, "progress", true)
		if not flight_active:
			_preserve_ground_support(pose, ground_base, "air-guard")
	if _hurt_time > 0.0:
		pose = _sample_key_pose(_motion["combatClips"][_reaction_name], clampf(1.0 - _hurt_time / 0.35, 0.0, 1.0), "progress", true)
		if not flight_active:
			_preserve_ground_support(pose, ground_base, "impact")
	var target_rotations: Array = pose["rotations"]
	_retarget_arm_rotations(target_rotations)
	var target_position: Vector3 = pose["position"]
	var ease := 1.0 - exp(-(40.0 if is_attacking or _cast_active or guarding or _hurt_time > 0.0 else 9.0) * dt)
	if _pose_rotations.is_empty():
		for q in target_rotations:
			_pose_rotations.append(q)
		_pose_position = target_position
	else:
		for i in range(_bone_indices.size()):
			_pose_rotations[i] = _pose_rotations[i].slerp(target_rotations[i], ease).normalized()
		_pose_position = _pose_position.lerp(target_position, ease)
	for i in range(_bone_indices.size()):
		_skeleton.set_bone_pose_rotation(_bone_indices[i], _pose_rotations[i])
	_skeleton.set_bone_pose_position(_bone_indices[0], _native_pelvis + _pose_position)


func _prepare_native_skeleton() -> bool:
	var source := _find_skeleton(_model)
	if source == null:
		return false
	if _motion.is_empty():
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://assets/c2-motion.json"))
		if not parsed is Dictionary:
			return _motion_error("C2 authored motion file is missing or invalid")
		_motion = parsed as Dictionary
	var names: Array = _motion.get("boneNames", [])
	var parents: Array = _motion.get("boneParents", [])
	var positions: Array = _motion.get("nativePositions", [])
	if names.size() != 19 or parents.size() != 19 or positions.size() != 19 or source.get_bone_count() != 19:
		return _motion_error("C2 skeleton does not match authored 19-joint motion")
	_bone_indices.clear()
	var native_by_name: Dictionary = {}
	for i in range(names.size()):
		var name := String(names[i])
		var bone := source.find_bone(name)
		if bone < 0:
			return _motion_error("C2 authored bone missing: " + name)
		var parent := int(parents[i])
		if parent >= 0 and source.get_bone_name(source.get_bone_parent(bone)) != String(names[parent]):
			return _motion_error("C2 authored bone parent mismatch: " + name)
		_bone_indices.append(bone)
		native_by_name[name] = _vec3(positions[i])
	var meshes: Array[MeshInstance3D] = []
	_collect_skinned_meshes(_model, meshes)
	if meshes.is_empty() or meshes[0].skin == null:
		return _motion_error("C2 skin is missing")
	var imported_skin := meshes[0].skin
	if imported_skin.get_bind_count() != 19:
		return _motion_error("C2 skin bind count changed")
	for mesh in meshes:
		if mesh.skin.get_bind_count() != imported_skin.get_bind_count():
			return _motion_error("C2 mesh skin bind count differs")
		for i in range(imported_skin.get_bind_count()):
			if mesh.skin.get_bind_name(i) != imported_skin.get_bind_name(i):
				return _motion_error("C2 mesh skin bind order differs")
	var canonical_skin := Skin.new()
	for i in range(imported_skin.get_bind_count()):
		var bind_name := String(imported_skin.get_bind_name(i))
		if not native_by_name.has(bind_name):
			return _motion_error("C2 skin bind name mismatch: " + bind_name)
		canonical_skin.add_named_bind(bind_name, Transform3D(Basis.IDENTITY, -native_by_name[bind_name]))
	for i in range(names.size()):
		var local: Vector3 = native_by_name[String(names[i])]
		var parent := int(parents[i])
		if parent >= 0:
			local -= native_by_name[String(names[parent])]
		source.set_bone_rest(_bone_indices[i], Transform3D(Basis.IDENTITY, local))
	# The C2 bind arms are angled out. Match the browser retargeter's static
	# shoulder/elbow/wrist alignment so authored punches reach forward cleanly.
	_arm_alignment.clear()
	for first in [6, 10]:
		for joint in range(first, first + 3):
			var next := joint + 1 if joint < first + 2 else joint
			var from := joint if next != joint else joint - 1
			var direction: Vector3 = native_by_name[String(names[next])] - native_by_name[String(names[from])]
			_arm_alignment[joint] = Quaternion(direction.normalized(), Vector3.DOWN)
	source.reset_bone_poses()
	for mesh in meshes:
		mesh.skin = canonical_skin
	_native_pelvis = native_by_name["pelvis"]
	_skeleton = source
	return true


func _motion_error(problem: String) -> bool:
	_motion_failed = true
	push_error(problem)
	return false


func _find_skeleton(node: Node) -> Skeleton3D:
	if node is Skeleton3D:
		return node as Skeleton3D
	for child in node.get_children():
		var found := _find_skeleton(child)
		if found != null:
			return found
	return null


func _collect_skinned_meshes(node: Node, result: Array[MeshInstance3D]) -> void:
	if node is MeshInstance3D and (node as MeshInstance3D).skin != null:
		result.append(node as MeshInstance3D)
	for child in node.get_children():
		_collect_skinned_meshes(child, result)


func _sample_key_pose(clip: Dictionary, t: float, axis: String, smooth: bool) -> Dictionary:
	var keys: Array = clip["keys"]
	var sample_time := t
	if axis == "time":
		sample_time = fposmod(t, float(clip["duration"]))
	else:
		sample_time = clampf(t, 0.0, 1.0)
	var index := 0
	while index < keys.size() - 2 and float(keys[index + 1][axis]) < sample_time:
		index += 1
	var a: Dictionary = keys[index]
	var b: Dictionary = keys[index + 1]
	var fraction := clampf((sample_time - float(a[axis])) / maxf(0.000001, float(b[axis]) - float(a[axis])), 0.0, 1.0)
	if smooth:
		fraction = fraction * fraction * (3.0 - 2.0 * fraction)
	var rotations: Array[Quaternion] = []
	for i in range(_bone_indices.size()):
		rotations.append(_quat(a["rotations"][i]).slerp(_quat(b["rotations"][i]), fraction).normalized())
	return {"position": _vec3(a["position"]).lerp(_vec3(b["position"]), fraction), "rotations": rotations}


func _sample_ground_pose(clip: Dictionary, phase: float) -> Dictionary:
	var frames: Array = clip["frames"]
	var index_float := clampf(phase, 0.0, 1.0) * float(frames.size() - 1)
	var index := mini(int(floor(index_float)), frames.size() - 2)
	var fraction := index_float - float(index)
	var a: Array = frames[index]
	var b: Array = frames[index + 1]
	var rotations: Array[Quaternion] = []
	for i in range(_bone_indices.size()):
		var offset := 3 + i * 4
		rotations.append(_quat(a.slice(offset, offset + 4)).slerp(_quat(b.slice(offset, offset + 4)), fraction).normalized())
	var position := Vector3(lerpf(float(a[0]), float(b[0]), fraction), lerpf(float(a[1]), float(b[1]), fraction) - float(clip["floor"]), lerpf(float(a[2]), float(b[2]), fraction))
	return {"position": position, "rotations": rotations}


func _mix_pose(a: Dictionary, b: Dictionary, weight: float) -> Dictionary:
	var rotations: Array[Quaternion] = []
	var aq: Array = a["rotations"]
	var bq: Array = b["rotations"]
	for i in range(_bone_indices.size()):
		rotations.append(aq[i].slerp(bq[i], weight).normalized())
	var ap: Vector3 = a["position"]
	var bp: Vector3 = b["position"]
	return {"position": ap.lerp(bp, weight), "rotations": rotations}


func _preserve_ground_support(target: Dictionary, ground: Dictionary, clip: String) -> void:
	var target_rotations: Array = target["rotations"]
	var ground_rotations: Array = ground["rotations"]
	var end := 15 if clip == "rising-kick" else 18
	for i in range(13, end + 1):
		target_rotations[i] = ground_rotations[i]


func _retarget_arm_rotations(rotations: Array) -> void:
	for first in [6, 10]:
		var shoulder: Quaternion = _arm_alignment[first]
		var elbow: Quaternion = _arm_alignment[first + 1]
		var wrist: Quaternion = _arm_alignment[first + 2]
		rotations[first] = (rotations[first] * shoulder).normalized()
		rotations[first + 1] = (shoulder.inverse() * rotations[first + 1] * elbow).normalized()
		rotations[first + 2] = (elbow.inverse() * rotations[first + 2] * wrist).normalized()


func _vec3(values: Array) -> Vector3:
	return Vector3(float(values[0]), float(values[1]), float(values[2]))


func _quat(values: Array) -> Quaternion:
	return Quaternion(float(values[0]), float(values[1]), float(values[2]), float(values[3])).normalized()


func apply_hit(direction: Vector3, amount: float) -> void:
	receive_combat_hit({"direction": direction, "damage": amount})


func receive_combat_hit(event: Dictionary) -> Dictionary:
	var amount := maxf(0.0, float(event.get("damage", 0.0)))
	if health <= 0.0 or amount <= 0.0:
		return {"landed": false, "damage_applied": 0.0, "blocked": false, "guard_broken": false, "interrupted": false, "defeated": health <= 0.0}
	var guard_broken := guarding and bool(event.get("guard_break", false))
	var blocked := guarding and not guard_broken
	var damage := amount * (0.25 if blocked else 1.0)
	health = maxf(0.0, health - damage)
	var raw_direction: Variant = event.get("direction", Vector3.ZERO)
	var direction: Vector3 = raw_direction if raw_direction is Vector3 else Vector3.ZERO
	var raw_source: Variant = event.get("source", Vector3.ZERO)
	if direction.is_zero_approx() and raw_source is Vector3:
		direction = global_position - raw_source
	var local_up := _planet_up(global_position) if _planet_enabled() else Vector3.UP
	var push := direction.normalized() if direction.length_squared() > 0.000001 else -global_transform.basis.z
	var raw_knockback: Variant = event.get("knockback", Vector3.ZERO)
	var authored_knockback := raw_knockback is Vector3 and not (raw_knockback as Vector3).is_zero_approx()
	if authored_knockback:
		_hit_impulse = raw_knockback * (0.25 if blocked else 1.0)
	else:
		var strength := clampf(4.0 + amount / 500.0, 4.0, 28.0) * (0.25 if blocked else 1.0)
		var launch := not blocked and strength > 8.0
		if not launch:
			push = push.slide(local_up)
			push = push.normalized() if push.length_squared() > 0.000001 else -global_transform.basis.z
		_hit_impulse = push * strength + (local_up * minf(8.0, strength * 0.42) if launch else Vector3.ZERO)
	var launch_hit := _hit_impulse.dot(local_up) > 0.01
	var interrupted := not _attack_name.is_empty() or _cast_active or descent_strike_active
	_hurt_time = maxf(0.8 if guard_broken else 0.35, float(event.get("stagger", 0.0)))
	_reaction_name = "launch" if launch_hit else "impact"
	guarding = false if guard_broken else guarding
	cancel_descent_strike("hit interrupted descent")
	cancel_combat_action()
	begin_visual_hitstop(0.045 if blocked else 0.055)
	if health <= 0.0 and not _defeated:
		_defeated = true
		_death_timer = 3.0
		defeated.emit()
	return {"landed": true, "damage_applied": damage, "blocked": blocked, "guard_broken": guard_broken, "interrupted": interrupted, "defeated": health <= 0.0}


func _canonical_from_scene(scene_position: Vector3) -> Dictionary:
	if _world != null and _world.has_method("canonical_from_scene"):
		var value: Variant = _world.call("canonical_from_scene", scene_position)
		return value if value is Dictionary and NativePlanetCoordinates.valid(value) else {}
	if _world != null and int(_world.get("origin_revision")) != 0:
		return {}
	return NativePlanetCoordinates.local_to_canonical(scene_position, _planet_frame)


func _scene_from_canonical(canonical: Dictionary) -> Vector3:
	if _world != null and _world.has_method("scene_from_canonical"):
		var value: Variant = _world.call("scene_from_canonical", canonical)
		return value if value is Vector3 else Vector3(INF, INF, INF)
	if _world != null and int(_world.get("origin_revision")) != 0:
		return Vector3(INF, INF, INF)
	return NativePlanetCoordinates.canonical_to_local(canonical, _planet_frame)


func _direction_scene_to_canonical(direction: Vector3) -> Dictionary:
	return NativePlanetCoordinates.point(float(direction.y), -float(direction.z), -float(direction.x))


func _direction_canonical_to_scene(direction: Dictionary) -> Vector3:
	return Vector3(-float(direction["z"]), float(direction["x"]), -float(direction["y"]))


func snapshot_canonical() -> Dictionary:
	_sync_canonical_before_motion()
	var position := _canonical_position.duplicate()
	if position.is_empty():
		return {}
	return {"version": NativePlanetCoordinates.PLANET_VERSION, "id": NativePlanetCoordinates.PLANET_ID,
		"seed": NativePlanetCoordinates.PLANET_SEED, "radius": NativePlanetCoordinates.DEFAULT_RADIUS,
		"position": position, "forward": _direction_scene_to_canonical(-global_transform.basis.z),
		"velocity": _direction_scene_to_canonical(velocity)}


func restore_canonical(player_data: Dictionary, planet_data: Dictionary) -> bool:
	if not _planet_enabled() or planet_data.get("version") != NativePlanetCoordinates.PLANET_VERSION or planet_data.get("id") != NativePlanetCoordinates.PLANET_ID or planet_data.get("seed") != NativePlanetCoordinates.PLANET_SEED or planet_data.get("radius") != NativePlanetCoordinates.DEFAULT_RADIUS:
		return false
	var raw_position: Variant = planet_data.get("position", {})
	if not raw_position is Dictionary or not NativePlanetCoordinates.valid(raw_position):
		return false
	var scene_position := _scene_from_canonical(raw_position)
	if not scene_position.is_finite():
		return false
	var support := _planet_support(scene_position)
	if support.is_empty():
		return false
	var agl := float(support["agl"])
	if agl < -0.02 or agl > PLANET_MAX_AGL or float(support.get("water_depth", 0.0)) > 0.15 and agl < _planet_flight_floor(support) - 0.02:
		return false
	var target: Vector3 = support["point"] if agl <= 0.15 else scene_position
	if not _destination_clear(target):
		return false
	var restored := player_data.duplicate()
	# The legacy restore still checks a planar terrain height. Load its player
	# stats at the current safe pose, then apply the validated planet pose below.
	restored["x"] = global_position.x
	restored["y"] = global_position.y
	restored["z"] = global_position.z
	restore(restored)
	global_position = target
	_canonical_position = raw_position.duplicate() if target.distance_to(scene_position) <= 0.001 else _canonical_from_scene(target)
	_last_scene_position = target
	_last_origin_revision = _planet_origin_revision()
	var up := _planet_up(target)
	_align_planet_up(up)
	var raw_forward: Variant = planet_data.get("forward", {})
	if raw_forward is Dictionary and NativePlanetCoordinates.valid(raw_forward):
		var forward := _direction_canonical_to_scene(raw_forward).slide(up).normalized()
		if not forward.is_zero_approx():
			var basis := Basis(forward.cross(up).normalized(), up, -forward)
			var placed := global_transform
			placed.basis = basis
			global_transform = placed
	var raw_velocity: Variant = planet_data.get("velocity", {})
	if raw_velocity is Dictionary and NativePlanetCoordinates.valid(raw_velocity):
		velocity = _direction_canonical_to_scene(raw_velocity).limit_length(6500.0)
	flight_active = player_data.get("flight_active", false) == true and agl > 0.15
	_vertical_speed = clampf(velocity.dot(up), -6500.0, 6500.0) if flight_active else 0.0
	_ground_vertical_speed = velocity.dot(up) if not flight_active else 0.0
	horizontal_speed = velocity.slide(up).length()
	boosting = false
	cancel_combat_action()
	return true


func snapshot() -> Dictionary:
	return {
		"x": global_position.x, "y": global_position.y, "z": global_position.z,
		"yaw": rotation.y, "pitch": _look_pitch,
		"flight_active": flight_active, "energy": energy, "health": health,
		"realm": clampi(realm, 4, 9),
		"first_person": _first_person,
		"vx": velocity.x, "vy": velocity.y, "vz": velocity.z,
		"vertical_speed": _vertical_speed
	}


func restore(data: Dictionary) -> void:
	if data.is_empty():
		return
	cancel_descent_strike("restore")
	var x := _saved_number(data, "x", global_position.x)
	var y := _saved_number(data, "y", global_position.y)
	var z := _saved_number(data, "z", global_position.z)
	var desired := Vector3(x, y, z)
	if _world != null and _inside_world(desired):
		var ground_y := _world.height_at(x, z)
		if desired.y >= ground_y - 0.02 and desired.y <= ground_y + MAX_AGL and not _world.is_solid_at(desired, BODY_RADIUS, BODY_HEIGHT):
			global_position = desired
	rotation.y = _saved_number(data, "yaw", rotation.y)
	_look_pitch = clampf(_saved_number(data, "pitch", 0.0), -1.35, 1.35)
	_camera_pivot.rotation.x = _look_pitch
	energy = clampf(_saved_number(data, "energy", MAX_ENERGY), 0.0, MAX_ENERGY)
	realm = clampi(int(_saved_number(data, "realm", float(realm))), 4, 9)
	health = clampf(_saved_number(data, "health", max_health), 0.0, max_health)
	_defeated = health <= 0.0
	_death_timer = 3.0 if _defeated else 0.0
	_first_person = data.get("first_person", false) == true
	flight_active = data.get("flight_active", false) == true and _world != null and global_position.y > _ground_here() + 0.15
	velocity = Vector3(_saved_number(data, "vx", 0.0), _saved_number(data, "vy", 0.0), _saved_number(data, "vz", 0.0))
	if velocity.length() > 1500.0:
		velocity = Vector3.ZERO
	_vertical_speed = clampf(_saved_number(data, "vertical_speed", 0.0), -65.0, 90.0) if flight_active else 0.0
	_ground_vertical_speed = velocity.y if not flight_active else 0.0
	boosting = false
	_turn_bank = 0.0
	_hit_impulse = Vector3.ZERO


func _saved_number(data: Dictionary, key: String, fallback: float) -> float:
	var value: Variant = data.get(key, fallback)
	if typeof(value) != TYPE_FLOAT and typeof(value) != TYPE_INT:
		return fallback
	var number := float(value)
	return fallback if is_nan(number) or is_inf(number) else number
