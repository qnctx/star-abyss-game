extends Node3D
class_name ResearchStation

const ENERGY_COST: int = 5
const BLUEPRINT_REWARD: int = 1
const RESEARCH_INTERVAL: float = 20.0

var _research_timer: float = 0.0


func _ready() -> void:
	add_to_group("research_stations")
	add_to_group("built_structures")
	_create_visuals()
	set_process(true)


func _process(delta: float) -> void:
	if not InventoryManager.has_resources({"energy": ENERGY_COST}):
		return

	_research_timer += delta
	while _research_timer >= RESEARCH_INTERVAL:
		if not InventoryManager.has_resources({"energy": ENERGY_COST}):
			_research_timer = 0.0
			return
		_research_timer -= RESEARCH_INTERVAL
		if not InventoryManager.consume_resources({"energy": ENERGY_COST}):
			_research_timer = 0.0
			return
		InventoryManager.add_resource("blueprint", BLUEPRINT_REWARD)


func _create_visuals() -> void:
	var base := MeshInstance3D.new()
	base.name = "ResearchStationBase"
	var base_mesh := BoxMesh.new()
	base_mesh.size = Vector3(1.5, 0.45, 1.1)
	base.mesh = base_mesh
	base.position = Vector3(0, 0.25, 0)
	base.material_override = _make_material(Color(0.18, 0.2, 0.24), 1.0, false)
	add_child(base)

	var screen := MeshInstance3D.new()
	screen.name = "ResearchStationScreen"
	var screen_mesh := BoxMesh.new()
	screen_mesh.size = Vector3(1.1, 0.08, 0.7)
	screen.mesh = screen_mesh
	screen.position = Vector3(0, 0.75, -0.25)
	screen.rotation_degrees.x = -28.0
	screen.material_override = _make_material(Color(0.1, 0.75, 0.55), 1.0, true)
	add_child(screen)

	var holo := MeshInstance3D.new()
	holo.name = "ResearchStationHologram"
	var holo_mesh := SphereMesh.new()
	holo_mesh.radius = 0.32
	holo_mesh.height = 0.64
	holo.mesh = holo_mesh
	holo.position = Vector3(0, 1.1, 0.2)
	holo.material_override = _make_material(Color(0.35, 1.0, 0.75), 0.35, true)
	add_child(holo)

	var light := OmniLight3D.new()
	light.name = "ResearchStationLight"
	light.light_color = Color(0.35, 1.0, 0.75)
	light.light_energy = 1.2
	light.omni_range = 4.0
	light.position = Vector3(0, 1.0, 0)
	add_child(light)


func _make_material(color: Color, alpha: float, emissive: bool) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(color.r, color.g, color.b, alpha)
	if alpha < 1.0:
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	if emissive:
		mat.emission_enabled = true
		mat.emission = color
		mat.emission_energy_multiplier = 0.55
	return mat
