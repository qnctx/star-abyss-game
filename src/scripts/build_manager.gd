extends Node3D

const TURRET_SCENE := preload("res://scenes/turret.tscn")
const O2_STATION_SCRIPT := preload("res://scripts/o2_station.gd")
const SHIELD_GENERATOR_SCRIPT := preload("res://scripts/shield_generator.gd")
const SOLAR_PANEL_SCRIPT := preload("res://scripts/solar_panel.gd")
const RESEARCH_STATION_SCRIPT := preload("res://scripts/research_station.gd")
const TURRET_COST := {"iron": 20, "void_crystal": 5}
const O2_STATION_COST := {"iron": 15, "biomass": 10}
const SHIELD_GENERATOR_COST := {"iron": 25, "void_crystal": 8, "energy_core": 1}
const SOLAR_PANEL_COST := {"iron": 18, "biomass": 6}
const RESEARCH_STATION_COST := {"iron": 20, "void_crystal": 5, "energy": 5}
const PLACEMENT_RANGE: float = 18.0
const BUILD_DISTANCE: float = 6.0
const MIN_BASE_DISTANCE: float = 2.5
const MIN_STRUCTURE_DISTANCE: float = 2.0
const BUILD_TURRET: String = "turret"
const BUILD_O2_STATION: String = "o2_station"
const BUILD_SHIELD_GENERATOR: String = "shield_generator"
const BUILD_SOLAR_PANEL: String = "solar_panel"
const BUILD_RESEARCH_STATION: String = "research_station"

var build_mode: bool = false
var selected_building: String = BUILD_TURRET
var _preview: MeshInstance3D = null
var _preview_material: StandardMaterial3D = null
var _can_place: bool = false
var _position_is_valid: bool = false
var _placement_position: Vector3 = Vector3.ZERO


func _ready() -> void:
	_create_preview()
	set_process(false)


func _input(event: InputEvent) -> void:
	if event.is_action_pressed("build_mode") or (event is InputEventKey and event.pressed and event.physical_keycode == KEY_B):
		_set_build_mode(not build_mode)
		get_viewport().set_input_as_handled()
		return

	if not build_mode:
		return

	if event is InputEventKey and event.pressed and event.physical_keycode == KEY_ESCAPE:
		_set_build_mode(false)
		get_viewport().set_input_as_handled()
	elif event is InputEventKey and event.pressed and event.physical_keycode == KEY_1:
		_select_building(BUILD_TURRET)
		get_viewport().set_input_as_handled()
	elif event is InputEventKey and event.pressed and event.physical_keycode == KEY_2:
		_select_building(BUILD_O2_STATION)
		get_viewport().set_input_as_handled()
	elif event is InputEventKey and event.pressed and event.physical_keycode == KEY_3:
		_select_building(BUILD_SHIELD_GENERATOR)
		get_viewport().set_input_as_handled()
	elif event is InputEventKey and event.pressed and event.physical_keycode == KEY_4:
		_select_building(BUILD_SOLAR_PANEL)
		get_viewport().set_input_as_handled()
	elif event is InputEventKey and event.pressed and event.physical_keycode == KEY_5:
		_select_building(BUILD_RESEARCH_STATION)
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_LEFT:
			_try_place_structure()
			get_viewport().set_input_as_handled()
		elif event.button_index == MOUSE_BUTTON_RIGHT:
			_set_build_mode(false)
			get_viewport().set_input_as_handled()


func _process(_delta: float) -> void:
	_update_preview()


func _set_build_mode(enabled: bool) -> void:
	build_mode = enabled
	set_process(build_mode)
	_refresh_preview_mesh()
	if _preview:
		_preview.visible = build_mode


func _select_building(building_id: String) -> void:
	selected_building = building_id
	_refresh_preview_mesh()


func _create_preview() -> void:
	_preview = MeshInstance3D.new()
	_preview.name = "BuildPreview"
	_preview_material = StandardMaterial3D.new()
	_preview_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_preview_material.albedo_color = Color(0.2, 1.0, 0.45, 0.45)
	_preview.material_override = _preview_material
	_preview.visible = false
	add_child(_preview)
	_refresh_preview_mesh()


func _refresh_preview_mesh() -> void:
	if not _preview:
		return

	var mesh: Mesh
	if selected_building == BUILD_SOLAR_PANEL:
		var solar_mesh := BoxMesh.new()
		solar_mesh.size = Vector3(2.2, 0.25, 1.2)
		mesh = solar_mesh
	elif selected_building == BUILD_RESEARCH_STATION:
		var research_mesh := BoxMesh.new()
		research_mesh.size = Vector3(1.6, 0.9, 1.2)
		mesh = research_mesh
	else:
		var cylinder_mesh := CylinderMesh.new()
		if selected_building == BUILD_SHIELD_GENERATOR:
			cylinder_mesh.top_radius = 0.75
			cylinder_mesh.bottom_radius = 0.95
			cylinder_mesh.height = 1.25
		elif selected_building == BUILD_O2_STATION:
			cylinder_mesh.top_radius = 0.65
			cylinder_mesh.bottom_radius = 0.9
			cylinder_mesh.height = 1.1
		else:
			cylinder_mesh.top_radius = 0.55
			cylinder_mesh.bottom_radius = 0.75
			cylinder_mesh.height = 1.2
		mesh = cylinder_mesh
	_preview.mesh = mesh


func _update_preview() -> void:
	if not _preview:
		return

	var target_pos := _get_build_target_position()
	_placement_position = _snap_to_terrain(target_pos)
	_position_is_valid = _validate_position(_placement_position)
	var has_resources := InventoryManager.has_resources(get_selected_cost())
	_can_place = _position_is_valid and has_resources

	_preview.global_position = _placement_position
	if _can_place:
		_preview_material.albedo_color = Color(0.2, 1.0, 0.45, 0.45)
	elif _position_is_valid:
		_preview_material.albedo_color = Color(1.0, 0.85, 0.15, 0.45)
	else:
		_preview_material.albedo_color = Color(1.0, 0.2, 0.15, 0.45)


func _try_place_structure() -> void:
	if not _can_place:
		return
	var cost := get_selected_cost()
	if not InventoryManager.has_resources(cost):
		return

	InventoryManager.consume_resources(cost)
	var structure := _instantiate_selected_structure()
	get_tree().current_scene.add_child(structure)
	structure.global_position = _placement_position


func _get_build_target_position() -> Vector3:
	var player := get_tree().get_first_node_in_group("player") as Node3D
	if not player:
		return Vector3.ZERO

	var forward := -player.global_transform.basis.z
	forward.y = 0.0
	if forward.length() <= 0.01:
		forward = Vector3.FORWARD
	return player.global_position + forward.normalized() * BUILD_DISTANCE


func _snap_to_terrain(pos: Vector3) -> Vector3:
	var x: float = clamp(pos.x, -50.0, 50.0)
	var z: float = clamp(pos.z, -50.0, 50.0)
	var y: float = 0.0
	if WorldGenerator:
		y = clamp(WorldGenerator.get_height_at(Vector2(x, z)), -5.0, 15.0)
	return Vector3(x, y + 0.75, z)


func _validate_position(pos: Vector3) -> bool:
	var player := get_tree().get_first_node_in_group("player") as Node3D
	if player and player.global_position.distance_to(pos) > PLACEMENT_RANGE:
		return false
	if WorldGenerator and pos.distance_to(WorldGenerator.base_position) < MIN_BASE_DISTANCE:
		return false
	for structure in get_tree().get_nodes_in_group("built_structures"):
		if structure is Node3D and structure.global_position.distance_to(pos) < MIN_STRUCTURE_DISTANCE:
			return false
	return true


func _instantiate_selected_structure() -> Node3D:
	if selected_building == BUILD_RESEARCH_STATION:
		return RESEARCH_STATION_SCRIPT.new()
	if selected_building == BUILD_SOLAR_PANEL:
		return SOLAR_PANEL_SCRIPT.new()
	if selected_building == BUILD_SHIELD_GENERATOR:
		return SHIELD_GENERATOR_SCRIPT.new()
	if selected_building == BUILD_O2_STATION:
		return O2_STATION_SCRIPT.new()

	var turret := TURRET_SCENE.instantiate() as Node3D
	turret.add_to_group("built_turrets")
	turret.add_to_group("built_structures")
	return turret


func get_selected_cost() -> Dictionary:
	if selected_building == BUILD_RESEARCH_STATION:
		return RESEARCH_STATION_COST
	if selected_building == BUILD_SOLAR_PANEL:
		return SOLAR_PANEL_COST
	if selected_building == BUILD_SHIELD_GENERATOR:
		return SHIELD_GENERATOR_COST
	if selected_building == BUILD_O2_STATION:
		return O2_STATION_COST
	return TURRET_COST


func get_selected_label() -> String:
	if selected_building == BUILD_RESEARCH_STATION:
		return "Research Station"
	if selected_building == BUILD_SOLAR_PANEL:
		return "Solar Panel"
	if selected_building == BUILD_SHIELD_GENERATOR:
		return "Shield Generator"
	if selected_building == BUILD_O2_STATION:
		return "O2 Station"
	return "Turret"


func get_selected_cost_text() -> String:
	var parts: Array[String] = []
	for resource_type in get_selected_cost():
		parts.append("%d %s" % [get_selected_cost()[resource_type], _resource_label(resource_type)])
	return " + ".join(parts)


func _resource_label(resource_type: String) -> String:
	if resource_type == "void_crystal":
		return "crystal"
	return resource_type
