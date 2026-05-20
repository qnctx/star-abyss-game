extends StaticBody3D

@export var range: float = 8.0
@export var fire_rate: float = 1.0
@export var damage: float = 15.0

var can_fire: bool = true
var current_target: Node3D = null


func _ready():
	add_to_group("turrets")
	var area = Area3D.new()
	var col_shape = CollisionShape3D.new()
	var sphere = SphereShape3D.new()
	sphere.radius = range
	col_shape.shape = sphere
	area.add_child(col_shape)
	add_child(area)
	area.body_entered.connect(_on_body_entered)
	area.body_exited.connect(_on_body_exited)


func _process(delta):
	if not current_target or not is_instance_valid(current_target):
		current_target = find_nearest_enemy()
		return

	if not can_fire:
		return

	look_at(current_target.global_position, Vector3.UP)
	fire_projectile()
	can_fire = false
	await get_tree().create_timer(1.0 / fire_rate).timeout
	can_fire = true


func find_nearest_enemy() -> Node3D:
	var enemies = get_tree().get_nodes_in_group("enemies")
	var nearest: Node3D = null
	var nearest_dist = range

	for enemy in enemies:
		var dist = global_position.distance_to(enemy.global_position)
		if dist < nearest_dist:
			nearest_dist = dist
			nearest = enemy

	return nearest


func fire_projectile():
	var proj_scene = load("res://scenes/projectile.tscn")
	var proj = proj_scene.instantiate()
	proj.global_position = global_position + Vector3(0, 0.5, 0)
	proj.target = current_target
	proj.damage = damage
	get_tree().current_scene.add_child(proj)

	var flash = load("res://scenes/vfx_muzzle_flash.tscn").instantiate()
	flash.global_position = global_position + Vector3(0, 0.85, 0) + (-global_transform.basis.z * 1.3)
	get_tree().current_scene.add_child(flash)
	flash.emitting = true
	await get_tree().create_timer(0.3).timeout
	if is_instance_valid(flash):
		flash.queue_free()


func _on_body_entered(body):
	if body.is_in_group("enemies"):
		if not current_target or not is_instance_valid(current_target):
			current_target = body


func _on_body_exited(body):
	if body == current_target:
		current_target = find_nearest_enemy()
