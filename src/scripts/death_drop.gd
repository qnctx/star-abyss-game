extends Area3D

var payload: Dictionary = {}


func _ready() -> void:
	add_to_group("death_drops")
	body_entered.connect(_on_body_entered)
	_create_visuals()


func setup(drop_payload: Dictionary) -> void:
	payload = drop_payload.duplicate(true)


func collect() -> bool:
	if not DeathDropManager:
		return false
	return DeathDropManager.collect_active_drop()


func _on_body_entered(body: Node) -> void:
	if body and body.is_in_group("player"):
		collect()


func _create_visuals() -> void:
	var mesh_instance := MeshInstance3D.new()
	mesh_instance.name = "DeathDropCrate"
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.9, 0.45, 0.9)
	mesh_instance.mesh = mesh
	mesh_instance.position = Vector3(0.0, 0.25, 0.0)
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(0.95, 0.55, 0.18)
	material.emission_enabled = true
	material.emission = Color(0.95, 0.36, 0.08)
	material.emission_energy_multiplier = 0.35
	mesh_instance.material_override = material
	add_child(mesh_instance)

	var collision := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = 1.1
	collision.shape = shape
	collision.position = Vector3(0.0, 0.4, 0.0)
	add_child(collision)
