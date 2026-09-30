extends CharacterBody3D
class_name NativePlayer

## The player's origin is at their feet. Model is a visual child; CameraPivot
## remains upright while the whole visible body streamlines during boost.
signal defeated
signal respawned

const WORLD_HALF := 2990.0
const MAX_AGL := 2000.0
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

@onready var _model: Node3D = $Model
@onready var _camera_pivot: Node3D = $CameraPivot
@onready var _camera: Camera3D = $CameraPivot/Camera3D


func set_world(w: NativeWorld) -> void:
	_world = w


func set_support_provider(camp: Node3D) -> void:
	_support_provider = camp


func teleport_to_ground(x: float, z: float) -> bool:
	if _world == null or absf(x) > WORLD_HALF or absf(z) > WORLD_HALF:
		return false
	var terrain_y := _world.height_at(x, z)
	var target := Vector3(x, _support_at(x, z, terrain_y + 1.0), z)
	if not _destination_clear(target):
		return false
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


## The caller owns realm unlocks, cooldown, energy and path validation. The
## destination is checked again here before committing any player state.
func blink_to(target: Vector3) -> bool:
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


func _input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.get_mouse_mode() == Input.MOUSE_MODE_CAPTURED:
		rotate_y(-event.relative.x * mouse_sensitivity)
		_look_pitch = clampf(_look_pitch - event.relative.y * mouse_sensitivity, -1.35, 1.35)
		_camera_pivot.rotation.x = _look_pitch
	elif event is InputEventKey:
		var key := event as InputEventKey
		if not key.pressed or key.echo:
			return
		if key.physical_keycode == KEY_ESCAPE:
			Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
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
	var g := has_focus and Input.is_physical_key_pressed(KEY_G)
	var space := has_focus and Input.is_physical_key_pressed(KEY_SPACE)
	var space_pressed := space and not _last_space
	_last_space = space
	guarding = has_focus and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT) and _attack_name.is_empty() and not _cast_active
	var axes := _movement_axes() if has_focus else Vector2.ZERO
	var shift := has_focus and Input.is_physical_key_pressed(KEY_SHIFT)
	var control := has_focus and Input.is_physical_key_pressed(KEY_CTRL)
	var descend := has_focus and Input.is_physical_key_pressed(KEY_C)
	_hurt_time = maxf(0.0, _hurt_time - dt)
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
	flight_active = false
	boosting = false
	_vertical_speed = 0.0
	_ground_vertical_speed = 0.0
	# Ground locomotion takes over at its own acceleration, without carrying a
	# several-hundred-metre-per-second air velocity across the touchdown.
	var landing_flat := Vector2(velocity.x, velocity.z).limit_length(10.0)
	velocity = Vector3(landing_flat.x, 0.0, landing_flat.y)
	_turn_bank = 0.0


func _movement_axes() -> Vector2:
	var x := (1.0 if Input.is_physical_key_pressed(KEY_D) else 0.0) - (1.0 if Input.is_physical_key_pressed(KEY_A) else 0.0)
	var z := (1.0 if Input.is_physical_key_pressed(KEY_W) else 0.0) - (1.0 if Input.is_physical_key_pressed(KEY_S) else 0.0)
	return Vector2(x, z).normalized()


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
	var intent := right * axes.x + forward * axes.y + Vector3.UP * vertical
	return intent.normalized() if not intent.is_zero_approx() else Vector3.ZERO


func _step_ground(dt: float, axes: Vector2, shift: bool, jump_pressed: bool, precision: bool = false) -> void:
	boosting = false
	_turn_bank = lerpf(_turn_bank, 0.0, 1.0 - exp(-7.0 * dt))
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


func _height_blend(agl: float) -> float:
	var t := clampf(agl / 350.0, 0.0, 1.0)
	return t * t * (3.0 - 2.0 * t)


func _flight_speed(agl: float, boosted: bool) -> float:
	var high := float(REALM_BOOST.get(realm, 600.0)) if boosted else float(REALM_CRUISE.get(realm, 420.0))
	return lerpf(48.0, high, _height_blend(agl))


func _air_path_clear(from: Vector3, to: Vector3) -> bool:
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
	if _hit_impulse.y > 0.0:
		if flight_active:
			_vertical_speed = velocity.y
		else:
			_ground_vertical_speed = velocity.y
	_hit_impulse = Vector3.ZERO


func _ground_here() -> float:
	return _world.height_at(global_position.x, global_position.z)


func _foot_support_here() -> float:
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
	if _world.is_solid_at(target, BODY_RADIUS, BODY_HEIGHT):
		return false
	var shape_node := get_node_or_null("CollisionShape3D") as CollisionShape3D
	if shape_node == null or shape_node.shape == null or not is_inside_tree():
		return false
	var query := PhysicsShapeQueryParameters3D.new()
	query.shape = shape_node.shape
	var shape_transform := shape_node.global_transform
	shape_transform.origin += target - global_position + Vector3.UP * 0.01
	query.transform = shape_transform
	query.collision_mask = collision_mask
	query.exclude = [get_rid()]
	return get_world_3d().direct_space_state.intersect_shape(query, 1).is_empty()


func _on_terrain() -> bool:
	return is_on_floor() or global_position.y <= _foot_support_here() + 0.15


func _inside_world(p: Vector3) -> bool:
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
	var push := direction.normalized() if direction.length_squared() > 0.000001 else -global_transform.basis.z
	var raw_knockback: Variant = event.get("knockback", Vector3.ZERO)
	var authored_knockback := raw_knockback is Vector3 and not (raw_knockback as Vector3).is_zero_approx()
	if authored_knockback:
		_hit_impulse = raw_knockback * (0.25 if blocked else 1.0)
	else:
		var strength := clampf(4.0 + amount / 500.0, 4.0, 28.0) * (0.25 if blocked else 1.0)
		var launch := not blocked and strength > 8.0
		if not launch:
			push.y = 0.0
			push = push.normalized() if push.length_squared() > 0.000001 else -global_transform.basis.z
		_hit_impulse = push * strength + (Vector3.UP * minf(8.0, strength * 0.42) if launch else Vector3.ZERO)
	var launch_hit := _hit_impulse.y > 0.01
	var interrupted := not _attack_name.is_empty() or _cast_active
	_hurt_time = maxf(0.8 if guard_broken else 0.35, float(event.get("stagger", 0.0)))
	_reaction_name = "launch" if launch_hit else "impact"
	guarding = false if guard_broken else guarding
	cancel_combat_action()
	begin_visual_hitstop(0.045 if blocked else 0.055)
	if health <= 0.0 and not _defeated:
		_defeated = true
		_death_timer = 3.0
		defeated.emit()
	return {"landed": true, "damage_applied": damage, "blocked": blocked, "guard_broken": guard_broken, "interrupted": interrupted, "defeated": health <= 0.0}


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
