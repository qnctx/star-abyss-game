extends CharacterBody3D

@export var speed: float = 3.0
@export var health: float = 30.0
@export var damage: float = 10.0
@export var attack_range: float = 2.0
@export var structure_target_range: float = 3.5
@export var structure_attack_interval: float = 1.0

var target_position: Vector3 = Vector3(0, 0, 0)
var _has_died: bool = false
var _slow_sources: Dictionary = {}
var _structure_target: Node3D = null
var _structure_attack_cooldown: float = 0.0

signal enemy_died(should_reward: bool)
signal base_reached(damage: float, hit_position: Vector3)


func _ready():
	add_to_group("enemies")
	# Use WorldGenerator base if set, otherwise fall back to center
	# where the base pod is placed (Vector3(0, h+0.1, 0))
	var wp: Vector3 = WorldGenerator.base_position if WorldGenerator else Vector3.ZERO
	target_position = wp if wp != Vector3.ZERO else Vector3(0, 1, 0)


func _physics_process(delta):
	if _has_died:
		return
	_structure_attack_cooldown = maxf(0.0, _structure_attack_cooldown - delta)

	_structure_target = find_structure_target()
	if _structure_target:
		var structure_distance := _flat_distance(global_position, _structure_target.global_position)
		if structure_distance <= attack_range:
			velocity = Vector3.ZERO
			move_and_slide()
			if _structure_attack_cooldown <= 0.0:
				damage_structure(_structure_target, damage)
				_structure_attack_cooldown = structure_attack_interval
			return
		_move_toward(_structure_target.global_position)
		return

	_move_toward(target_position)

	if _flat_distance(global_position, target_position) < attack_range:
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


func find_structure_target() -> Node3D:
	if _structure_target and is_instance_valid(_structure_target) and not _structure_target.is_queued_for_deletion():
		if _structure_target.is_in_group("built_structures") and _flat_distance(global_position, _structure_target.global_position) <= structure_target_range:
			return _structure_target

	var nearest: Node3D = null
	var nearest_distance := structure_target_range
	for structure in get_tree().get_nodes_in_group("built_structures"):
		var structure_node := structure as Node3D
		if not structure_node or not is_instance_valid(structure_node) or structure_node.is_queued_for_deletion():
			continue
		var current_health := _ensure_structure_health(structure_node)
		if current_health <= 0.0:
			continue
		var distance := _flat_distance(global_position, structure_node.global_position)
		if distance < nearest_distance:
			nearest_distance = distance
			nearest = structure_node
	return nearest


func damage_structure(structure: Node3D, amount: float) -> bool:
	if not structure or not is_instance_valid(structure) or structure.is_queued_for_deletion():
		return false
	if not structure.is_in_group("built_structures"):
		return false
	var current_health := _ensure_structure_health(structure)
	var next_health := maxf(0.0, current_health - amount)
	structure.set_meta("structure_health", next_health)
	if next_health <= 0.0:
		if structure == _structure_target:
			_structure_target = null
		structure.queue_free()
	return true


func _move_toward(pos: Vector3) -> void:
	var direction := pos - global_position
	direction.y = 0.0
	if direction.length() <= 0.01:
		velocity = Vector3.ZERO
	else:
		velocity = direction.normalized() * get_effective_speed()
	move_and_slide()


func _ensure_structure_health(structure: Node) -> float:
	if not structure.has_meta("structure_max_health"):
		structure.set_meta("structure_max_health", 100.0)
	if not structure.has_meta("structure_health"):
		structure.set_meta("structure_health", float(structure.get_meta("structure_max_health", 100.0)))
	return float(structure.get_meta("structure_health", structure.get_meta("structure_max_health", 100.0)))


func _flat_distance(a: Vector3, b: Vector3) -> float:
	var delta := a - b
	delta.y = 0.0
	return delta.length()


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
