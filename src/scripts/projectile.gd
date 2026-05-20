extends Area3D

@export var speed: float = 10.0
var target: Node3D = null
var damage: float = 15.0


func _physics_process(delta):
	if not target or not is_instance_valid(target):
		queue_free()
		return

	var direction = (target.global_position - global_position).normalized()
	global_position += direction * speed * delta

	var bolt_node = get_node_or_null("ProjectileBolt")
	if bolt_node:
		bolt_node.rotate_z(10.0 * delta)

	if global_position.distance_to(target.global_position) < 0.5:
		if target.has_method("take_damage"):
			target.take_damage(damage)
		queue_free()
