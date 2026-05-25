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
var _collision_shape: CollisionShape3D = null

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
	# Correct initial spawn Y so player doesn't start underground
	_correct_spawn_y()


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


var _debug_frames: int = 0

func _physics_process(delta):
	if is_dead:
		return

	_debug_frames += 1

	# ── Input ──────────────────────────────────────────────────────────────────
	var input_dir := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var move_vec := Vector3(input_dir.x, 0, input_dir.y)
	var direction := (transform.basis * move_vec).normalized()

	# ── Crouch / prone ───────────────────────────────────────────────────────
	var crouch_pressed := Input.is_action_pressed("crouch")
	var prone_pressed := Input.is_action_pressed("prone")

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
	if _movement_state == 2:
		current_speed = prone_speed
	elif _movement_state == 1:
		current_speed = crouch_speed
	elif Input.is_action_pressed("sprint") and _movement_state == 0:
		current_speed = sprint_speed

	var horizontal_speed := current_speed if direction.length() > 0 else 0.0

	# ── Velocity ──────────────────────────────────────────────────────────
	velocity.x = direction.x * horizontal_speed
	velocity.z = direction.z * horizontal_speed

	# ── Jump: only allow re-jump when on floor ──────────────────────────────
	if Input.is_action_just_pressed("jump") and _movement_state == 0 and not _is_jumping:
		velocity.y = jump_force
		_is_jumping = true

	# Apply gravity each frame (only when airborne)
	if _is_jumping:
		velocity.y -= 20.0 * delta
		# Clamp fall speed so we don't accelerate forever, but allow downward motion
		velocity.y = maxf(velocity.y, -50.0)

	# ── Debug output every 0.5s when moving ──────────────────────────────────
	if _debug_frames % 30 == 0 and input_dir.length() > 0.05:
		print("DEBUG pos=%.2f,%.2f,%.2f vel=%.2f,%.2f,%.2f jumping=%s" % [
			global_position.x, global_position.y, global_position.z,
			velocity.x, velocity.y, velocity.z, _is_jumping
		])

	# ── Move ───────────────────────────────────────────────────────────────
	move_and_slide()

	# ── Manual terrain height snap (THE RELIABLE SOLUTION) ─────────────────
	if WorldGenerator:
		var tx := global_position.x
		var tz := global_position.z
		# _raw_height matches what terrain mesh uses — no StaticBody needed
		var ty: float = _raw_terrain_height(tx, tz)
		var target_y := ty + _target_eye_height

		if _is_jumping:
			# In air: check if we've dropped back to terrain level
			if global_position.y <= target_y + 0.1:
				global_position.y = target_y
				velocity.y = 0.0
				_is_jumping = false
		else:
			# On ground: lock to terrain surface
			global_position.y = target_y
			velocity.y = 0.0

	# ── Clamp to world boundary ───────────────────────────────────────────
	global_position.x = clamp(global_position.x, -WORLD_HALF, WORLD_HALF)
	global_position.z = clamp(global_position.z, -WORLD_HALF, WORLD_HALF)

	# ── Oxygen drain ───────────────────────────────────────────────────────
	if _grace_timer > 0:
		_grace_timer -= delta
	else:
		var mult := ZoneManager.get_oxygen_multiplier() if ZoneManager else 1.0
		var drain := oxygen_drain_rate * mult
		if Input.is_action_pressed("sprint") and _movement_state == 0:
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
