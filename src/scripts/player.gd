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

var current_oxygen: float = 180.0
var max_oxygen: float = 180.0
var is_dead: bool = false
var _grace_timer: float = 10.0  # 开局安全期，氧气不消耗

# Movement states: 0=normal, 1=crouching, 2=prone
var _movement_state: int = 0
var _crouch_transition: float = 0.0  # 0=fully normal, 1=fully crouched/prone
var _target_eye_height: float = EYE_HEIGHT_NORMAL
var _is_jumping: bool = false

# Oxygen and death signals
signal oxygen_changed()
signal player_died()


func _ready():
	oxygen_changed.emit()
	# Capture mouse for first-person look
	Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)


func _input(event: InputEvent):
	# Mouse look — rotate player body around Y axis
	if event is InputEventMouseMotion and Input.get_mouse_mode() == Input.MOUSE_MODE_CAPTURED:
		rotate_y(-event.relative.x * mouse_sensitivity)

	# Release mouse cursor when ESC is pressed
	if event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
		Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)

	# Re-capture mouse when clicking inside the game window
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		if Input.get_mouse_mode() == Input.MOUSE_MODE_VISIBLE:
			Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)


func _physics_process(delta):
	if is_dead:
		return

	# Teleport
	if Input.is_action_just_pressed("teleport"):
		_try_teleport()

	# Handle crouch/prone state transitions
	var crouch_pressed = Input.is_action_pressed("crouch")
	var prone_pressed = Input.is_action_pressed("prone")

	if prone_pressed:
		_movement_state = 2
		_target_eye_height = EYE_HEIGHT_PRONE
	elif crouch_pressed:
		_movement_state = 1
		_target_eye_height = EYE_HEIGHT_CROUCH
	else:
		_movement_state = 0
		_target_eye_height = EYE_HEIGHT_NORMAL

	_crouch_transition = lerp(_crouch_transition, 1.0 if _movement_state > 0 else 0.0, delta * 10.0)

	# Movement
	var input_dir = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var is_sprinting = Input.is_action_pressed("sprint") and _movement_state == 0
	var is_crouching = _movement_state == 1
	var is_proning = _movement_state == 2

	# Determine current speed
	var current_speed: float
	if is_proning:
		current_speed = prone_speed
	elif is_crouching:
		current_speed = crouch_speed
	elif is_sprinting:
		current_speed = sprint_speed
	else:
		current_speed = speed

	# Compute camera-relative horizontal direction
	var move_vec := Vector3(input_dir.x, 0, input_dir.y)
	var direction = (transform.basis * move_vec).normalized()

	# Build velocity — horizontal from input only (no gravity)
	var horizontal_speed := current_speed if direction.length() > 0 else 0.0
	velocity.x = direction.x * horizontal_speed
	velocity.z = direction.z * horizontal_speed

	# Manual height tracking — no gravity, no is_on_floor() dependency
	var terrain_y: float = 0.0
	if WorldGenerator:
		terrain_y = WorldGenerator.get_height_at(Vector2(global_position.x, global_position.z))

	var target_y: float = terrain_y + _target_eye_height

	# Jump: give upward impulse, track height manually
	if Input.is_action_just_pressed("jump") and not _is_jumping and _movement_state == 0:
		velocity.y = jump_force
		_is_jumping = true

	# If jumping, integrate vertical velocity
	if _is_jumping:
		target_y = global_position.y + velocity.y * delta
		# Check if we've landed (height dropped back to terrain level or below)
		if global_position.y + velocity.y * delta <= terrain_y + _target_eye_height:
			target_y = terrain_y + _target_eye_height
			velocity.y = 0.0
			_is_jumping = false
	else:
		# Not jumping — stay locked to terrain surface
		velocity.y = 0.0

	# Force snap to terrain (no physics push-through)
	global_position.y = target_y

	# Move using Godot physics on XZ plane only
	move_and_slide()

	# Re-sync Y after move_and_slide (which may have modified it)
	if WorldGenerator:
		terrain_y = WorldGenerator.get_height_at(Vector2(global_position.x, global_position.z))
	if not _is_jumping:
		global_position.y = terrain_y + _target_eye_height

	# Clamp to world boundary — prevent player from leaving 100x100 terrain
	global_position.x = clamp(global_position.x, -WORLD_HALF, WORLD_HALF)
	global_position.z = clamp(global_position.z, -WORLD_HALF, WORLD_HALF)

	# Oxygen drain (grace period protects new players)
	if _grace_timer > 0:
		_grace_timer -= delta
	else:
		var mult = ZoneManager.get_oxygen_multiplier() if ZoneManager else 1.0
		var drain = (sprint_drain_rate if is_sprinting else oxygen_drain_rate) * mult
		current_oxygen -= drain * delta
		current_oxygen = max(current_oxygen, 0.0)
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
	var base_pos = WorldGenerator.base_position if WorldGenerator else Vector3(0, 1, 0)
	# Place player on terrain surface, not underground
	var spawn_y: float = 0.0
	if WorldGenerator:
		spawn_y = WorldGenerator.get_height_at(Vector2(base_pos.x, base_pos.z))
	else:
		spawn_y = base_pos.y
	# Offset spawn position away from base pod to avoid collision overlap.
	# Random angle ensures player doesn't always spawn in the same direction.
	var spawn_offset: float = 3.5
	var angle := randf() * TAU
	var spawn_x: float = base_pos.x + cos(angle) * spawn_offset
	var spawn_z: float = base_pos.z + sin(angle) * spawn_offset
	# Re-sample terrain height at the offset position
	if WorldGenerator:
		spawn_y = WorldGenerator.get_height_at(Vector2(spawn_x, spawn_z))
	global_position = Vector3(spawn_x, spawn_y + EYE_HEIGHT_NORMAL, spawn_z)
	oxygen_changed.emit()


func refill_oxygen():
	current_oxygen = max_oxygen
	oxygen_changed.emit()


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
