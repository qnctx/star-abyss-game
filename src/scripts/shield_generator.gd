extends Node3D
class_name ShieldGenerator

const SHIELD_AMOUNT: float = 50.0

var _registered: bool = false


func _ready() -> void:
	add_to_group("shield_generators")
	add_to_group("built_structures")
	_create_visuals()
	GameManager.register_base_shield(SHIELD_AMOUNT)
	_registered = true


func _exit_tree() -> void:
	if _registered and GameManager:
		GameManager.unregister_base_shield(SHIELD_AMOUNT)
		_registered = false


func _create_visuals() -> void:
	var pedestal := MeshInstance3D.new()
	pedestal.name = "ShieldGeneratorPedestal"
	var pedestal_mesh := CylinderMesh.new()
	pedestal_mesh.top_radius = 0.55
	pedestal_mesh.bottom_radius = 0.9
	pedestal_mesh.height = 1.0
	pedestal.mesh = pedestal_mesh
	pedestal.material_override = _make_material(Color(0.35, 0.55, 1.0), 0.45)
	add_child(pedestal)

	var core := MeshInstance3D.new()
	core.name = "ShieldGeneratorCore"
	var core_mesh := SphereMesh.new()
	core_mesh.radius = 0.42
	core_mesh.height = 0.84
	core.mesh = core_mesh
	core.position = Vector3(0, 0.85, 0)
	core.material_override = _make_material(Color(0.65, 0.9, 1.0), 0.75)
	add_child(core)

	var field := MeshInstance3D.new()
	field.name = "ShieldGeneratorField"
	var field_mesh := SphereMesh.new()
	field_mesh.radius = 2.2
	field_mesh.height = 4.4
	field.mesh = field_mesh
	field.scale.y = 0.45
	field.position = Vector3(0, 0.8, 0)
	field.material_override = _make_material(Color(0.35, 0.7, 1.0), 0.12)
	add_child(field)

	var light := OmniLight3D.new()
	light.name = "ShieldGeneratorLight"
	light.light_color = Color(0.55, 0.85, 1.0)
	light.light_energy = 1.8
	light.omni_range = 6.0
	light.position = Vector3(0, 1.2, 0)
	add_child(light)


func _make_material(color: Color, alpha: float) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(color.r, color.g, color.b, alpha)
	mat.emission_enabled = true
	mat.emission = color
	mat.emission_energy_multiplier = 0.75
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	return mat
