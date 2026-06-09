extends CharacterBody3D

@export var speed: float = 8.0
@export var sprint_speed: float = 12.0
@export var crouch_speed: float = 4.0
@export var prone_speed: float = 2.0
@export var jump_force: float = 10.0
@export var oxygen_drain_rate: float = 0.556  # 基础耗氧：180秒耗尽
@export var sprint_drain_rate: float = 0.778   # 冲刺耗氧：约130秒耗尽
@export var mouse_sensitivity: float = 0.003

const WORLD_HALF: float = 50.0  # 100x100 terrain boundary (half of 100)
const STUCK_VELOCITY_THRESHOLD: float = 0.5  # Below this velocity считается "застрял"
const EYE_HEIGHT_NORMAL: float = 0.5
const EYE_HEIGHT_CROUCH: float = 0.25
const EYE_HEIGHT_PRONE: float = 0.1
const GRAVITY: float = 24.0
const GROUND_STICK_FORCE: float = -2.0
const LANDING_EPSILON: float = 0.14
const CAMERA_FOV_NORMAL: float = 50.0
const CAMERA_FOV_SPRINT: float = 58.0
const STUCK_RECOVERY_DELAY: float = 0.35
const STUCK_RECOVERY_NUDGE: float = 0.45

var current_oxygen: float = 180.0
var max_oxygen: float = 180.0
var is_dead: bool = false
var _grace_timer: float = 10.0  # 开局安全期，氧气不消耗

# Movement states: 0=normal, 1=crouching, 2=prone
var _movement_state: int = 0
var _crouch_transition: float = 0.0  # 0=fully normal, 1=fully crouched/prone
var _target_eye_height: float = EYE_HEIGHT_NORMAL
var _is_jumping: bool = false
var _collision_shape: CollisionShape3D = null
var _camera: Camera3D = null
var _head_bob_phase: float = 0.0
var _last_horizontal_speed: float = 0.0
var _last_is_sprinting: bool = false
var _stuck_timer: float = 0.0

# Oxygen and death signals
signal oxygen_changed()
signal player_died()


func _ready():
	oxygen_changed.emit()
	# Capture mouse for first-person look
	Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)
	# Cache the collision shape for crouch transitions
	for child in get_children():
		if child is CollisionShape3D:
			_collision_shape = child
			break
	_camera = get_node_or_null("Camera3D")
	# Correct initial spawn Y so player doesn't start underground
	_correct_spawn_y()


func _input(event: InputEvent):
	# Mouse look — rotate player body around Y axis
	if event is InputEventMouseMotion and Input.get_mouse_mode() == Input.MOUSE_MODE_CAPTURED:
		rotate_y(-event.relative.x * mouse_sensitivity)

	# Release mouse cursor when ESC is pressed
	if event is InputEventKey and event.pressed and event.physical_keycode == KEY_ESCAPE:
		Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)

	# Crouch / prone: handled exclusively in _physics_process via action system

	# Re-capture mouse when clicking inside the game window
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		if Input.get_mouse_mode() == Input.MOUSE_MODE_VISIBLE:
			Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)


var _debug_frames: int = 0

func _physics_process(delta):
	if is_dead:
		return

	_debug_frames += 1

	# ── Input ──────────────────────────────────────────────────────────────────
	var input_dir := _get_movement_input()
	var move_vec := Vector3(input_dir.x, 0, input_dir.y)
	var direction := (transform.basis * move_vec).normalized()

	# ── Crouch / prone ───────────────────────────────────────────────────────
	var crouch_pressed := _is_pressed_loose("crouch", [KEY_CTRL])
	var prone_pressed := _is_pressed_loose("prone", [KEY_Z])

	if prone_pressed:
		_movement_state = 2
	elif crouch_pressed:
		_movement_state = 1
	else:
		_movement_state = 0

	# Update eye height target (collision shape scaling disabled — caused physics glitches)
	if _movement_state == 2:
		_target_eye_height = EYE_HEIGHT_PRONE
	elif _movement_state == 1:
		_target_eye_height = EYE_HEIGHT_CROUCH
	else:
		_target_eye_height = EYE_HEIGHT_NORMAL

	# ── Speed selection ─────────────────────────────────────────────────────
	var current_speed: float = speed
	var is_sprinting := false
	if _movement_state == 2:
		current_speed = prone_speed
	elif _movement_state == 1:
		current_speed = crouch_speed
	elif _is_pressed_loose("sprint", [KEY_SHIFT]) and _movement_state == 0:
		current_speed = sprint_speed
		is_sprinting = true

	if ZoneManager:
		current_speed *= 1.0 + ZoneManager.get_speed_bonus()

	var horizontal_speed := current_speed if direction.length() > 0 else 0.0
	_last_horizontal_speed = horizontal_speed
	_last_is_sprinting = is_sprinting

	# ── Velocity ──────────────────────────────────────────────────────────
	velocity.x = direction.x * horizontal_speed
	velocity.z = direction.z * horizontal_speed

	# ── Jump: only allow re-jump when on floor ──────────────────────────────
	var ground_y := _get_player_ground_y()
	var grounded_on_terrain := global_position.y <= ground_y + LANDING_EPSILON and velocity.y <= 0.0
	if Input.is_action_just_pressed("jump") and _movement_state == 0 and not _is_jumping and grounded_on_terrain:
		velocity.y = jump_force
		_is_jumping = true

	# Keep the body pressed onto the procedural terrain so down-slopes are visible.
	if _is_jumping or not grounded_on_terrain:
		velocity.y -= 20.0 * delta
		velocity.y -= (GRAVITY - 20.0) * delta
		velocity.y = maxf(velocity.y, -50.0)
	else:
		velocity.y = GROUND_STICK_FORCE

	# ── Move ───────────────────────────────────────────────────────────────
	var before_move := global_position
	move_and_slide()
	_follow_terrain(delta)

	# ── Landing detection ─────────────────────────────────────────────────
	# Reset _is_jumping when player lands to stop gravity accumulation
	if is_on_floor() or (velocity.y <= 0.0 and global_position.y <= _get_player_ground_y() + LANDING_EPSILON):
		_is_jumping = false
		velocity.y = 0

	# ── Clamp to world boundary ───────────────────────────────────────────
	global_position.x = clamp(global_position.x, -WORLD_HALF, WORLD_HALF)
	global_position.z = clamp(global_position.z, -WORLD_HALF, WORLD_HALF)
	_recover_if_stuck(delta, before_move, direction, horizontal_speed)
	_update_camera_motion(delta)

	# ── Oxygen drain ───────────────────────────────────────────────────────
	if _grace_timer > 0:
		_grace_timer -= delta
	else:
		var mult := ZoneManager.get_oxygen_multiplier() if ZoneManager else 1.0
		var drain := oxygen_drain_rate * mult
		if _is_pressed_loose("sprint", [KEY_SHIFT]) and _movement_state == 0:
			drain = sprint_drain_rate * mult
		current_oxygen -= drain * delta
		current_oxygen = maxf(current_oxygen, 0.0)
		oxygen_changed.emit()

	if current_oxygen <= 0:
		die()


func die():
	is_dead = true
	player_died.emit()
	# Respawn after 2 seconds
	await get_tree().create_timer(2.0).timeout
	respawn()


func respawn() -> void:
	is_dead = false
	_grace_timer = 5.0  # 每次复活给 5 秒 grace
	current_oxygen = max_oxygen
	_correct_spawn_y()
	oxygen_changed.emit()


func _correct_spawn_y() -> void:
	## Snap player to terrain surface on spawn / respawn.
	## Handles the case where WorldGenerator hasn't been ready yet
	## or terrain noise returns wrong values at scene load time.
	if not WorldGenerator:
		return
	# Defer so WorldGenerator.generate_world.call_deferred() has finished
	# before we sample the height map.
	get_tree().create_timer(0.0, true, false, true).timeout.connect(_do_correct_spawn_y)

func _do_correct_spawn_y() -> void:
	var spawn_pos := Vector2(global_position.x, global_position.z)
	var raw_y := WorldGenerator.get_height_at(spawn_pos)
	# Reject bad values
	if is_inf(raw_y) or is_nan(raw_y):
		raw_y = 0.0
	var safe_y: float = clamp(raw_y, -5.0, 15.0)
	global_position.y = safe_y + EYE_HEIGHT_NORMAL


func refill_oxygen():
	current_oxygen = max_oxygen
	oxygen_changed.emit()


# ============================================================================
# Terrain height helper — mirrors WorldGenerator._raw_height() exactly
# This is the ONLY reliable way to get the terrain surface Y
# ============================================================================
const _NOISE_AMPLITUDE := 10.0
const _CRASH_RADIUS := 15.0
const _TERRAIN_SHIFT := 3.0

func _raw_terrain_height(x: float, z: float) -> float:
	## Use WorldGenerator's own API — the same one that built the terrain mesh
	var y: float = 0.0
	if WorldGenerator:
		y = WorldGenerator.get_height_at(Vector2(x, z))
	# Guard against bad values
	if is_inf(y) or is_nan(y):
		y = 0.0
	return y


func _get_player_ground_y() -> float:
	var raw_y := _raw_terrain_height(global_position.x, global_position.z)
	return clamp(raw_y, -5.0, 15.0) + EYE_HEIGHT_NORMAL


func _follow_terrain(delta: float) -> void:
	var target_y := _get_player_ground_y()
	if _is_jumping:
		if velocity.y <= 0.0 and global_position.y <= target_y + LANDING_EPSILON:
			global_position.y = target_y
			velocity.y = 0.0
			_is_jumping = false
		return

	var follow_speed := 18.0 if _last_horizontal_speed > 0.0 else 28.0
	global_position.y = move_toward(global_position.y, target_y, follow_speed * delta)


func _update_camera_motion(delta: float) -> void:
	if not _camera:
		return

	var bob_amplitude := 0.0
	var bob_speed := 0.0
	if _last_horizontal_speed > 0.1 and not _is_jumping:
		if _movement_state == 2:
			bob_amplitude = 0.01
			bob_speed = 5.0
		elif _movement_state == 1:
			bob_amplitude = 0.025
			bob_speed = 7.0
		elif _last_is_sprinting:
			bob_amplitude = 0.075
			bob_speed = 13.0
		else:
			bob_amplitude = 0.045
			bob_speed = 9.0
		_head_bob_phase += delta * bob_speed
	else:
		_head_bob_phase = lerpf(_head_bob_phase, 0.0, minf(delta * 8.0, 1.0))

	var bob := sin(_head_bob_phase) * bob_amplitude
	var target_camera_y := _target_eye_height + bob
	_camera.position.y = lerpf(_camera.position.y, target_camera_y, minf(delta * 12.0, 1.0))
	var target_fov := CAMERA_FOV_SPRINT if _last_is_sprinting and _last_horizontal_speed > 0.1 else CAMERA_FOV_NORMAL
	_camera.fov = lerpf(_camera.fov, target_fov, minf(delta * 7.0, 1.0))


func _get_movement_input() -> Vector2:
	var input_dir := Vector2.ZERO
	if _is_pressed_loose("move_left", [KEY_A, KEY_LEFT]):
		input_dir.x -= 1.0
	if _is_pressed_loose("move_right", [KEY_D, KEY_RIGHT]):
		input_dir.x += 1.0
	if _is_pressed_loose("move_forward", [KEY_W, KEY_UP]):
		input_dir.y -= 1.0
	if _is_pressed_loose("move_back", [KEY_S, KEY_DOWN]):
		input_dir.y += 1.0
	if input_dir.length() > 1.0:
		input_dir = input_dir.normalized()
	return input_dir


func _is_pressed_loose(action_name: String, physical_keys: Array[int]) -> bool:
	if Input.is_action_pressed(action_name):
		return true
	for key in physical_keys:
		if Input.is_physical_key_pressed(key):
			return true
	return false


func _recover_if_stuck(delta: float, before_move: Vector3, direction: Vector3, horizontal_speed: float) -> void:
	if horizontal_speed <= 0.1 or direction.length() <= 0.01 or _is_jumping:
		_stuck_timer = 0.0
		return

	var horizontal_delta := Vector2(
		global_position.x - before_move.x,
		global_position.z - before_move.z
	).length()
	var expected_delta := horizontal_speed * delta
	if horizontal_delta >= expected_delta * 0.12:
		_stuck_timer = 0.0
		return

	_stuck_timer += delta
	if _stuck_timer < STUCK_RECOVERY_DELAY:
		return

	var nudge := -direction.normalized() * STUCK_RECOVERY_NUDGE
	global_position.x = clamp(global_position.x + nudge.x, -WORLD_HALF, WORLD_HALF)
	global_position.z = clamp(global_position.z + nudge.z, -WORLD_HALF, WORLD_HALF)
	global_position.y = _get_player_ground_y()
	velocity = Vector3.ZERO
	_stuck_timer = 0.0


func _try_teleport():
	var tm = get_tree().current_scene.get_node_or_null("TeleportManager")
	if not tm:
		return
	var zone = ZoneManager.ZONE_NAMES.get(ZoneManager.current_zone, "crash") if ZoneManager else "crash"
	var base_pos = WorldGenerator.base_position if WorldGenerator else Vector3(0, 1, 0)
	if not tm.beacons.is_empty():
		if position.distance_to(base_pos) < 3.0:
			# At base — teleport to first beacon
			tm.teleport_to_beacon(self, zone)
		else:
			# In the field — teleport to base
			tm.teleport_to_base(self, zone)
