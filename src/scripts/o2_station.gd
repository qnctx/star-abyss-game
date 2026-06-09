extends Node3D
class_name O2Station

const REFILL_RADIUS: float = 4.5
const REFILL_RATE: float = 28.0

var _radius_mesh: MeshInstance3D


func _ready() -> void:
	add_to_group("o2_stations")
	add_to_group("built_structures")
	_create_visuals()
	set_process(true)


func _process(delta: float) -> void:
	var player: Node = get_tree().get_first_node_in_group("player")
	if not player:
		return
	if global_position.distance_to(player.global_position) > REFILL_RADIUS:
		return
	var current_oxygen: float = player.get("current_oxygen")
	var max_oxygen: float = player.get("max_oxygen")
	if current_oxygen >= max_oxygen:
		return

	player.set("current_oxygen", minf(max_oxygen, current_oxygen + REFILL_RATE * delta))
	player.emit_signal("oxygen_changed")


func _create_visuals() -> void:
	var base := MeshInstance3D.new()
	base.name = "O2StationBase"
	var base_mesh := CylinderMesh.new()
	base_mesh.top_radius = 0.55
	base_mesh.bottom_radius = 0.75
	base_mesh.height = 1.1
	base.mesh = base_mesh
	base.material_override = _make_material(Color(0.18, 0.75, 0.85), 0.15)
	add_child(base)

	var core := MeshInstance3D.new()
	core.name = "O2StationCore"
	var core_mesh := SphereMesh.new()
	core_mesh.radius = 0.35
	core_mesh.height = 0.7
	core.mesh = core_mesh
	core.position = Vector3(0, 0.7, 0)
	core.material_override = _make_material(Color(0.45, 1.0, 0.95), 0.35)
	add_child(core)

	_radius_mesh = MeshInstance3D.new()
	_radius_mesh.name = "O2StationRange"
	var range_mesh := SphereMesh.new()
	range_mesh.radius = REFILL_RADIUS
	range_mesh.height = REFILL_RADIUS * 2.0
	_radius_mesh.mesh = range_mesh
	_radius_mesh.scale.y = 0.04
	_radius_mesh.position = Vector3(0, 0.08, 0)
	_radius_mesh.material_override = _make_material(Color(0.25, 0.9, 0.85), 0.08)
	add_child(_radius_mesh)

	var light := OmniLight3D.new()
	light.name = "O2StationLight"
	light.light_color = Color(0.45, 1.0, 0.95)
	light.light_energy = 1.6
	light.omni_range = 5.0
	light.position = Vector3(0, 1.1, 0)
	add_child(light)


func _make_material(color: Color, alpha: float) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(color.r, color.g, color.b, alpha)
	mat.emission_enabled = true
	mat.emission = color
	mat.emission_energy_multiplier = 0.6
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	return mat
