extends Node3D
class_name SlowField

const RANGE: float = 5.5
const SLOW_MULTIPLIER: float = 0.45

var _source_id: String = ""
var _slowed_enemies: Dictionary = {}


func _ready() -> void:
	add_to_group("slow_fields")
	add_to_group("built_structures")
	_source_id = "slow_field_%s" % get_instance_id()
	_create_visuals()
	set_process(true)


func _process(_delta: float) -> void:
	var seen: Dictionary = {}
	for enemy in get_tree().get_nodes_in_group("enemies"):
		var enemy_node := enemy as Node3D
		if not enemy_node or not enemy_node.has_method("apply_slow"):
			continue
		if _flat_distance(global_position, enemy_node.global_position) <= RANGE:
			enemy_node.apply_slow(_source_id, SLOW_MULTIPLIER)
			seen[enemy_node] = true
			_slowed_enemies[enemy_node] = true

	for enemy in _slowed_enemies.keys():
		if not is_instance_valid(enemy) or not seen.has(enemy):
			if is_instance_valid(enemy) and enemy.has_method("remove_slow"):
				enemy.remove_slow(_source_id)
			_slowed_enemies.erase(enemy)


func _exit_tree() -> void:
	for enemy in _slowed_enemies.keys():
		if is_instance_valid(enemy) and enemy.has_method("remove_slow"):
			enemy.remove_slow(_source_id)
	_slowed_enemies.clear()


func _flat_distance(a: Vector3, b: Vector3) -> float:
	a.y = 0.0
	b.y = 0.0
	return a.distance_to(b)


func _create_visuals() -> void:
	var base := MeshInstance3D.new()
	base.name = "SlowFieldBase"
	var base_mesh := CylinderMesh.new()
	base_mesh.top_radius = 0.65
	base_mesh.bottom_radius = 0.85
	base_mesh.height = 0.65
	base.mesh = base_mesh
	base.position = Vector3(0, 0.3, 0)
	base.material_override = _make_material(Color(0.2, 0.45, 0.95), 0.75)
	add_child(base)

	var core := MeshInstance3D.new()
	core.name = "SlowFieldCore"
	var core_mesh := SphereMesh.new()
	core_mesh.radius = 0.34
	core_mesh.height = 0.68
	core.mesh = core_mesh
	core.position = Vector3(0, 0.8, 0)
	core.material_override = _make_material(Color(0.45, 0.85, 1.0), 0.6)
	add_child(core)

	var field := MeshInstance3D.new()
	field.name = "SlowFieldRadius"
	var field_mesh := SphereMesh.new()
	field_mesh.radius = RANGE
	field_mesh.height = RANGE * 2.0
	field.mesh = field_mesh
	field.scale.y = 0.03
	field.position = Vector3(0, 0.08, 0)
	field.material_override = _make_material(Color(0.25, 0.65, 1.0), 0.08)
	add_child(field)

	var light := OmniLight3D.new()
	light.name = "SlowFieldLight"
	light.light_color = Color(0.4, 0.75, 1.0)
	light.light_energy = 1.0
	light.omni_range = 5.0
	light.position = Vector3(0, 0.9, 0)
	add_child(light)


func _make_material(color: Color, alpha: float) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(color.r, color.g, color.b, alpha)
	mat.emission_enabled = true
	mat.emission = color
	mat.emission_energy_multiplier = 0.5
	if alpha < 1.0:
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	return mat
