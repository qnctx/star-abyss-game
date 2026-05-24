extends CharacterBody3D

@export var speed: float = 8.0
@export var sprint_speed: float = 12.0
@export var oxygen_drain_rate: float = 0.556  # 基础耗氧：180秒耗尽
@export var sprint_drain_rate: float = 0.778   # 冲刺耗氧：约130秒耗尽

const WORLD_HALF: float = 50.0  # 100x100 terrain boundary (half of 100)
const STUCK_VELOCITY_THRESHOLD: float = 0.5  # Below this velocity считается "застрял"

var current_oxygen: float = 180.0
var max_oxygen: float = 180.0
var is_dead: bool = false
var _grace_timer: float = 10.0  # 开局安全期，氧气不消耗

# Oxygen and death signals
signal oxygen_changed()
signal player_died()


func _ready():
	oxygen_changed.emit()


func _physics_process(delta):
	if is_dead:
		return

	# Teleport
	if Input.is_action_just_pressed("teleport"):
		_try_teleport()

	# Movement — freeze Y so player stays on terrain plane
	var input_dir = Input.get_vector("move_left", "move_right", "move_back", "move_forward")
	var is_sprinting = Input.is_action_pressed("sprint")

	var current_speed = sprint_speed if is_sprinting else speed
	var direction = Vector3(input_dir.x, 0, input_dir.y).normalized()

	var fixed_y = global_position.y
	velocity.x = direction.x * current_speed
	velocity.y = 0.0
	velocity.z = direction.z * current_speed
	move_and_slide()
	global_position.y = fixed_y
	velocity.y = 0.0

	# Detect stuck state: input present but velocity near zero after move_and_slide()
	# This commonly happens with ConcavePolygonShape3D terrain
	var is_stuck = (input_dir.length() > 0.1) and (velocity.length() < STUCK_VELOCITY_THRESHOLD)
	if is_stuck:
		# Manual override: directly update position to bypass physics stuck
		global_position.x += direction.x * current_speed * delta
		global_position.z += direction.z * current_speed * delta

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
	global_position = Vector3(spawn_x, spawn_y + 0.5, spawn_z)
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
