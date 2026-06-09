extends Area3D

signal oxygen_plant_collected(amount: float)

const OXYGEN_RESTORE := 45.0


func _ready() -> void:
	add_to_group("oxygen_plants")
	body_entered.connect(_on_body_entered)
	_create_visuals()


func collect(player: Node) -> bool:
	if not player:
		return false
	var current_oxygen := float(player.get("current_oxygen"))
	var max_oxygen := float(player.get("max_oxygen"))
	if current_oxygen >= max_oxygen:
		return false
	player.set("current_oxygen", minf(max_oxygen, current_oxygen + OXYGEN_RESTORE))
	player.emit_signal("oxygen_changed")
	oxygen_plant_collected.emit(OXYGEN_RESTORE)
	queue_free()
	return true


func _on_body_entered(body: Node) -> void:
	if body and body.is_in_group("player"):
		collect(body)


func _create_visuals() -> void:
	var stem := MeshInstance3D.new()
	stem.name = "OxygenPlantStem"
	var stem_mesh := CylinderMesh.new()
	stem_mesh.top_radius = 0.05
	stem_mesh.bottom_radius = 0.08
	stem_mesh.height = 0.65
	stem.mesh = stem_mesh
	stem.position = Vector3(0.0, 0.32, 0.0)
	stem.material_override = _make_material(Color(0.25, 0.9, 0.55), 0.25)
	add_child(stem)

	var bulb := MeshInstance3D.new()
	bulb.name = "OxygenPlantBulb"
	var bulb_mesh := SphereMesh.new()
	bulb_mesh.radius = 0.22
	bulb_mesh.height = 0.44
	bulb.mesh = bulb_mesh
	bulb.position = Vector3(0.0, 0.72, 0.0)
	bulb.material_override = _make_material(Color(0.45, 0.95, 1.0), 0.7)
	add_child(bulb)

	var collision := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = 0.75
	collision.shape = shape
	collision.position = Vector3(0.0, 0.45, 0.0)
	add_child(collision)


func _make_material(color: Color, emission_strength: float) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.emission_enabled = true
	material.emission = color
	material.emission_energy_multiplier = emission_strength
	return material
