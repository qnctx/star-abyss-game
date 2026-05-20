extends CharacterBody3D

@export var speed: float = 3.0
@export var health: float = 30.0
@export var damage: float = 10.0
@export var attack_range: float = 2.0

var target_position: Vector3 = Vector3(0, 0, 0)

signal enemy_died()
signal base_reached(damage: float)


func _ready():
	add_to_group("enemies")


func _physics_process(delta):
	var direction = (target_position - global_position).normalized()
	direction.y = 0
	velocity = direction * speed
	move_and_slide()

	if global_position.distance_to(target_position) < attack_range:
		base_reached.emit(damage)
		die()


func take_damage(amount: float):
	health -= amount
	if health <= 0:
		die()


func die():
	enemy_died.emit()
	var explosion = load("res://scenes/vfx_explosion.tscn").instantiate()
	explosion.global_position = global_position
	get_tree().current_scene.add_child(explosion)
	explosion.emitting = true
	await get_tree().create_timer(0.5).timeout
	if is_instance_valid(explosion):
		explosion.queue_free()
	queue_free()
