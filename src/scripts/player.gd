extends CharacterBody3D

@export var speed: float = 8.0
@export var sprint_speed: float = 12.0
@export var oxygen_drain_rate: float = 0.3
@export var sprint_drain_rate: float = 0.6

var current_oxygen: float = 100.0
var max_oxygen: float = 100.0
var is_dead: bool = false
var _grace_timer: float = 10.0  # 开局安全期，氧气不消耗

signal oxygen_changed(current: float, maximum: float)
signal player_died()


func _ready():
	oxygen_changed.emit(current_oxygen, max_oxygen)


func _physics_process(delta):
	if is_dead:
		return

	# Teleport
	if Input.is_action_just_pressed("teleport"):
		_try_teleport()

	# Movement
	var input_dir = Input.get_vector("move_left", "move_right", "move_back", "move_forward")
	var is_sprinting = Input.is_action_pressed("sprint")

	var current_speed = sprint_speed if is_sprinting else speed
	var direction = Vector3(input_dir.x, 0, input_dir.y).normalized()

	velocity.x = direction.x * current_speed
	velocity.z = direction.z * current_speed
	move_and_slide()

	# Oxygen drain (grace period protects new players)
	if _grace_timer > 0:
		_grace_timer -= delta
	else:
		var mult = ZoneManager.get_oxygen_multiplier() if ZoneManager else 1.0
		var drain = (sprint_drain_rate if is_sprinting else oxygen_drain_rate) * mult
		current_oxygen -= drain * delta
		current_oxygen = max(current_oxygen, 0.0)
		oxygen_changed.emit(current_oxygen, max_oxygen)

	if current_oxygen <= 0:
		die()


func die():
	is_dead = true
	player_died.emit()
	# Respawn after 2 seconds
	await get_tree().create_timer(2.0).timeout
	respawn()


func respawn():
	is_dead = false
	_grace_timer = 5.0  # 每次复活给 5 秒 grace
	current_oxygen = max_oxygen
	position = WorldGenerator.base_position if WorldGenerator else Vector3(0, 1, 0)
	oxygen_changed.emit(current_oxygen, max_oxygen)


func refill_oxygen():
	current_oxygen = max_oxygen
	oxygen_changed.emit(current_oxygen, max_oxygen)


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
