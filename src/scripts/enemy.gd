extends CharacterBody3D

@export var speed: float = 3.0
@export var health: float = 30.0
@export var damage: float = 10.0
@export var attack_range: float = 2.0

var target_position: Vector3 = Vector3(0, 0, 0)
var _has_died: bool = false
var _slow_sources: Dictionary = {}

signal enemy_died(should_reward: bool)
signal base_reached(damage: float, hit_position: Vector3)


func _ready():
	add_to_group("enemies")
	# Use WorldGenerator base if set, otherwise fall back to center
	# where the base pod is placed (Vector3(0, h+0.1, 0))
	var wp: Vector3 = WorldGenerator.base_position if WorldGenerator else Vector3.ZERO
	target_position = wp if wp != Vector3.ZERO else Vector3(0, 1, 0)


func _physics_process(_delta):
	var direction = (target_position - global_position).normalized()
	direction.y = 0
	velocity = direction * get_effective_speed()
	move_and_slide()

	if global_position.distance_to(target_position) < attack_range:
		base_reached.emit(damage, global_position)
		die(false)


func take_damage(amount: float):
	health -= amount
	if health <= 0:
		die()


func apply_slow(source_id: String, multiplier: float) -> void:
	_slow_sources[source_id] = clampf(multiplier, 0.1, 1.0)


func remove_slow(source_id: String) -> void:
	_slow_sources.erase(source_id)


func get_effective_speed() -> float:
	var slow_multiplier := 1.0
	for source_id in _slow_sources:
		slow_multiplier = minf(slow_multiplier, _slow_sources[source_id])
	return speed * slow_multiplier


func die(should_reward: bool = true):
	if _has_died:
		return
	_has_died = true
	enemy_died.emit(should_reward)
	var ExplosionScene = preload("res://scenes/vfx_explosion.tscn")
	if ExplosionScene:
		var explosion = ExplosionScene.instantiate()
		get_tree().current_scene.add_child(explosion)
		explosion.global_position = global_position
		explosion.emitting = true
		await get_tree().create_timer(0.5).timeout
		if is_instance_valid(explosion):
			explosion.queue_free()
	else:
		push_warning("Enemy: failed to preload vfx_explosion.tscn")
	queue_free()
