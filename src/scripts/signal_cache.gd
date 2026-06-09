extends Area3D

var cache_id := ""
var rewards: Dictionary = {}


func _ready() -> void:
	add_to_group("signal_caches")
	body_entered.connect(_on_body_entered)
	_create_collision()
	_create_visuals()


func setup(id: String, reward_data: Dictionary) -> void:
	cache_id = id
	rewards = reward_data.duplicate(true)


func collect() -> bool:
	if cache_id.is_empty():
		return false
	for resource_type in rewards:
		InventoryManager.add_resource(str(resource_type), int(rewards[resource_type]))
	if SignalLogManager:
		SignalLogManager.mark_cache_collected(cache_id)
	queue_free()
	return true


func get_cache_label() -> String:
	return "Signal Cache"


func _on_body_entered(body: Node3D) -> void:
	if body.is_in_group("player"):
		collect()


func _create_collision() -> void:
	var collision := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = 1.2
	collision.shape = shape
	add_child(collision)


func _create_visuals() -> void:
	var crate := MeshInstance3D.new()
	crate.name = "SignalCacheCrate"
	var crate_mesh := BoxMesh.new()
	crate_mesh.size = Vector3(1.2, 0.55, 0.9)
	crate.mesh = crate_mesh
	crate.position.y = 0.25
	crate.material_override = _make_material(Color(0.35, 0.85, 1.0))
	add_child(crate)

	var marker := MeshInstance3D.new()
	marker.name = "SignalCacheMarker"
	var marker_mesh := CylinderMesh.new()
	marker_mesh.top_radius = 0.08
	marker_mesh.bottom_radius = 0.18
	marker_mesh.height = 1.2
	marker.mesh = marker_mesh
	marker.position.y = 0.95
	marker.material_override = _make_material(Color(1.0, 0.85, 0.25))
	add_child(marker)


func _make_material(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.emission_enabled = true
	material.emission = color * 0.3
	return material
