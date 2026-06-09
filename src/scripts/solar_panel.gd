extends Node3D
class_name SolarPanel

const ENERGY_PER_TICK: int = 1
const ENERGY_INTERVAL: float = 5.0

var _energy_timer: float = 0.0


func _ready() -> void:
	add_to_group("solar_panels")
	add_to_group("built_structures")
	_create_visuals()
	set_process(true)


func _process(delta: float) -> void:
	if GameManager and GameManager.is_night:
		return

	_energy_timer += delta
	while _energy_timer >= ENERGY_INTERVAL:
		_energy_timer -= ENERGY_INTERVAL
		InventoryManager.add_resource("energy", ENERGY_PER_TICK)


func _create_visuals() -> void:
	var mast := MeshInstance3D.new()
	mast.name = "SolarPanelMast"
	var mast_mesh := CylinderMesh.new()
	mast_mesh.top_radius = 0.12
	mast_mesh.bottom_radius = 0.16
	mast_mesh.height = 0.9
	mast.mesh = mast_mesh
	mast.position = Vector3(0, 0.45, 0)
	mast.material_override = _make_material(Color(0.45, 0.48, 0.5), 1.0, false)
	add_child(mast)

	var panel := MeshInstance3D.new()
	panel.name = "SolarPanelArray"
	var panel_mesh := BoxMesh.new()
	panel_mesh.size = Vector3(2.2, 0.12, 1.2)
	panel.mesh = panel_mesh
	panel.position = Vector3(0, 1.05, 0)
	panel.rotation_degrees.x = -18.0
	panel.material_override = _make_material(Color(0.08, 0.18, 0.42), 1.0, true)
	add_child(panel)

	var rim := MeshInstance3D.new()
	rim.name = "SolarPanelRim"
	var rim_mesh := BoxMesh.new()
	rim_mesh.size = Vector3(2.35, 0.08, 1.35)
	rim.mesh = rim_mesh
	rim.position = Vector3(0, 1.02, 0)
	rim.rotation_degrees.x = -18.0
	rim.material_override = _make_material(Color(0.18, 0.2, 0.22), 1.0, false)
	add_child(rim)

	var light := OmniLight3D.new()
	light.name = "SolarPanelChargeLight"
	light.light_color = Color(1.0, 0.85, 0.3)
	light.light_energy = 0.7
	light.omni_range = 3.0
	light.position = Vector3(0, 1.15, 0)
	add_child(light)


func _make_material(color: Color, alpha: float, emissive: bool) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(color.r, color.g, color.b, alpha)
	if emissive:
		mat.emission_enabled = true
		mat.emission = color
		mat.emission_energy_multiplier = 0.35
	return mat
