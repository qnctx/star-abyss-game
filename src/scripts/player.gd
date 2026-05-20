extends CharacterBody3D

@export var speed: float = 8.0
@export var sprint_speed: float = 12.0
@export var oxygen_drain_rate: float = 1.0
@export var sprint_drain_rate: float = 1.5

var current_oxygen: float = 100.0
var max_oxygen: float = 100.0
var is_dead: bool = false

signal oxygen_changed(current: float, maximum: float)
signal player_died()


func _ready():
	oxygen_changed.emit(current_oxygen, max_oxygen)


func _physics_process(delta):
	if is_dead:
		return

	# Movement
	var input_dir = Input.get_vector("move_left", "move_right", "move_back", "move_forward")
	var is_sprinting = Input.is_action_pressed("sprint")

	var current_speed = sprint_speed if is_sprinting else speed
	var direction = Vector3(input_dir.x, 0, input_dir.y).normalized()

	velocity.x = direction.x * current_speed
	velocity.z = direction.z * current_speed
	move_and_slide()

	# Oxygen drain
	var drain = sprint_drain_rate if is_sprinting else oxygen_drain_rate
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
	current_oxygen = max_oxygen
	position = Vector3(0, 1, 0)  # Respawn at base
	oxygen_changed.emit(current_oxygen, max_oxygen)


func refill_oxygen():
	current_oxygen = max_oxygen
	oxygen_changed.emit(current_oxygen, max_oxygen)
