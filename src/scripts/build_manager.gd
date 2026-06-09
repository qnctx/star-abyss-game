extends Node3D

const TURRET_SCENE := preload("res://scenes/turret.tscn")
const O2_STATION_SCRIPT := preload("res://scripts/o2_station.gd")
const SHIELD_GENERATOR_SCRIPT := preload("res://scripts/shield_generator.gd")
const SOLAR_PANEL_SCRIPT := preload("res://scripts/solar_panel.gd")
const RESEARCH_STATION_SCRIPT := preload("res://scripts/research_station.gd")
const SLOW_FIELD_SCRIPT := preload("res://scripts/slow_field.gd")
const SIGNAL_BEACON_SCRIPT := preload("res://scripts/signal_beacon.gd")
const TURRET_COST := {"iron": 20, "void_crystal": 5}
const O2_STATION_COST := {"iron": 15, "biomass": 10}
const SHIELD_GENERATOR_COST := {"iron": 25, "void_crystal": 8, "energy_core": 1}
const SOLAR_PANEL_COST := {"iron": 18, "biomass": 6}
const RESEARCH_STATION_COST := {"iron": 20, "void_crystal": 5, "energy": 5}
const SLOW_FIELD_COST := {"iron": 15, "biomass": 8, "energy": 4}
const SIGNAL_BEACON_COST := {"iron": 30, "void_crystal": 10, "energy": 10, "blueprint": 2}
const PLACEMENT_RANGE: float = 18.0
const BUILD_DISTANCE: float = 6.0
const MIN_BASE_DISTANCE: float = 2.5
const MIN_STRUCTURE_DISTANCE: float = 2.0
const RECYCLE_DISTANCE: float = 2.8
const REFUND_RATE: float = 0.5
const UPGRADE_DISTANCE: float = 2.8
const REPAIR_DISTANCE: float = 2.8
const MAX_UPGRADE_LEVEL: int = 3
const TURRET_UPGRADE_COST := {"iron": 10, "energy": 5, "blueprint": 1}
const STRUCTURE_REPAIR_COST := {"iron": 5, "biomass": 2}
const STRUCTURE_MAX_HEALTH: float = 100.0
const STRUCTURE_REPAIR_AMOUNT: float = 35.0
const BUILD_TURRET: String = "turret"
const BUILD_O2_STATION: String = "o2_station"
const BUILD_SHIELD_GENERATOR: String = "shield_generator"
const BUILD_SOLAR_PANEL: String = "solar_panel"
const BUILD_RESEARCH_STATION: String = "research_station"
const BUILD_SLOW_FIELD: String = "slow_field"
const BUILD_SIGNAL_BEACON: String = "signal_beacon"

var build_mode: bool = false
var recycle_mode: bool = false
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
	elif event.is_action_pressed("recycle_mode") or (event is InputEventKey and event.pressed and event.physical_keycode == KEY_X):
		recycle_mode = not recycle_mode
		_refresh_preview_mesh()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("upgrade_structure") or (event is InputEventKey and event.pressed and event.physical_keycode == KEY_U):
		_try_upgrade_structure()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("repair_structure") or (event is InputEventKey and event.pressed and event.physical_keycode == KEY_R):
		_try_repair_structure()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("unlock_tech") or (event is InputEventKey and event.pressed and event.physical_keycode == KEY_Y):
		unlock_selected_tech()
		_refresh_preview_mesh()
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
	elif event is InputEventKey and event.pressed and event.physical_keycode == KEY_6:
		_select_building(BUILD_SLOW_FIELD)
		get_viewport().set_input_as_handled()
	elif event is InputEventKey and event.pressed and event.physical_keycode == KEY_7:
		_select_building(BUILD_SIGNAL_BEACON)
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
	if not build_mode:
		recycle_mode = false
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
	elif selected_building == BUILD_SIGNAL_BEACON:
		var beacon_mesh := CylinderMesh.new()
		beacon_mesh.top_radius = 0.55
		beacon_mesh.bottom_radius = 0.9
		beacon_mesh.height = 1.8
		mesh = beacon_mesh
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
		elif selected_building == BUILD_SLOW_FIELD:
			cylinder_mesh.top_radius = 0.85
			cylinder_mesh.bottom_radius = 1.05
			cylinder_mesh.height = 0.85
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
	if recycle_mode:
		_position_is_valid = _find_recycle_target(_placement_position) != null
		_can_place = _position_is_valid
	else:
		_position_is_valid = _validate_position(_placement_position)
		var has_resources := InventoryManager.has_resources(get_selected_cost())
		var unlocked := is_selected_unlocked()
		_can_place = _position_is_valid and has_resources and unlocked

	_preview.global_position = _placement_position
	if recycle_mode and _can_place:
		_preview_material.albedo_color = Color(0.25, 0.85, 1.0, 0.45)
	elif recycle_mode:
		_preview_material.albedo_color = Color(1.0, 0.2, 0.15, 0.45)
	elif _can_place:
		_preview_material.albedo_color = Color(0.2, 1.0, 0.45, 0.45)
	elif _position_is_valid and not is_selected_unlocked():
		_preview_material.albedo_color = Color(0.65, 0.35, 1.0, 0.45)
	elif _position_is_valid:
		_preview_material.albedo_color = Color(1.0, 0.85, 0.15, 0.45)
	else:
		_preview_material.albedo_color = Color(1.0, 0.2, 0.15, 0.45)


func _try_place_structure() -> void:
	if recycle_mode:
		_try_recycle_structure()
		return
	if not _can_place:
		return
	if not is_selected_unlocked():
		return
	var cost := get_selected_cost()
	if not InventoryManager.has_resources(cost):
		return

	InventoryManager.consume_resources(cost)
	var structure := _instantiate_selected_structure()
	get_tree().current_scene.add_child(structure)
	structure.global_position = _placement_position
	structure.add_to_group("built_structures")
	structure.set_meta("build_id", selected_building)
	structure.set_meta("build_cost", cost.duplicate())
	structure.set_meta("build_label", get_selected_label())
	ensure_structure_health(structure)


func _try_recycle_structure() -> void:
	var target := _find_recycle_target(_placement_position)
	if target:
		recycle_structure(target)


func recycle_structure(structure: Node3D) -> bool:
	if not structure or not is_instance_valid(structure):
		return false
	if not structure.is_in_group("built_structures"):
		return false

	var cost: Dictionary = structure.get_meta("build_cost", {})
	for resource_type in cost:
		var resource_name := str(resource_type)
		var refund: int = max(1, floori(float(cost[resource_type]) * REFUND_RATE))
		InventoryManager.add_resource(resource_name, refund)
	structure.queue_free()
	return true


func _try_upgrade_structure() -> void:
	var target := _find_upgrade_target(_placement_position)
	if target:
		upgrade_structure(target)


func _try_repair_structure() -> void:
	var target := _find_repair_target(_placement_position)
	if target:
		repair_structure(target)


func upgrade_structure(structure: Node3D) -> bool:
	if not structure or not is_instance_valid(structure):
		return false
	if not structure.is_in_group("built_structures"):
		return false
	var current_level: int = int(structure.get_meta("upgrade_level", 0))
	if current_level >= MAX_UPGRADE_LEVEL:
		return false
	if not InventoryManager.has_resources(TURRET_UPGRADE_COST):
		return false
	if not _apply_turret_upgrade(structure, current_level + 1):
		return false

	InventoryManager.consume_resources(TURRET_UPGRADE_COST)
	structure.set_meta("upgrade_level", current_level + 1)
	return true


func repair_structure(structure: Node3D) -> bool:
	if not structure or not is_instance_valid(structure):
		return false
	if not structure.is_in_group("built_structures"):
		return false
	ensure_structure_health(structure)
	var max_health: float = float(structure.get_meta("structure_max_health", STRUCTURE_MAX_HEALTH))
	var current_health: float = float(structure.get_meta("structure_health", max_health))
	if current_health >= max_health:
		return false
	if not InventoryManager.has_resources(STRUCTURE_REPAIR_COST):
		return false

	InventoryManager.consume_resources(STRUCTURE_REPAIR_COST)
	structure.set_meta("structure_health", minf(max_health, current_health + STRUCTURE_REPAIR_AMOUNT))
	return true


func get_recycle_status_text() -> String:
	var target := _find_recycle_target(_placement_position)
	if not target:
		return "No recycle target"
	return "Target %s | Refund %s | LMB recycle" % [
		get_structure_label(target),
		get_refund_text(target)
	]


func get_upgrade_status_text() -> String:
	var target := _find_upgrade_target(_placement_position)
	if not target:
		return "Up: aim near turret"
	var current_level: int = int(target.get_meta("upgrade_level", 0))
	if current_level >= MAX_UPGRADE_LEVEL:
		return "Up %s Lv %d/%d MAX" % [
			get_structure_label(target),
			current_level,
			MAX_UPGRADE_LEVEL
		]
	var afford := InventoryManager.has_resources(TURRET_UPGRADE_COST) if InventoryManager else false
	return "Up %s Lv %d/%d | U %s" % [
		get_structure_label(target),
		current_level,
		MAX_UPGRADE_LEVEL,
		"READY" if afford else "NEED RES"
	]


func get_structure_action_status_text() -> String:
	var repair_target := _find_repair_target(_placement_position)
	if repair_target:
		return get_repair_status_text()
	return get_upgrade_status_text()


func is_selected_unlocked() -> bool:
	return not TechManager or TechManager.is_unlocked(selected_building)


func can_unlock_selected() -> bool:
	return TechManager and TechManager.can_unlock(selected_building)


func unlock_selected_tech() -> bool:
	return TechManager and TechManager.unlock(selected_building)


func get_selected_unlock_status_text() -> String:
	if is_selected_unlocked():
		return "Unlocked"
	if not TechManager or not TechManager.is_unlockable(selected_building):
		return "Locked"
	var afford := TechManager.can_unlock(selected_building)
	return "Unlock %s | Y %s" % [
		get_selected_unlock_cost_text(),
		"READY" if afford else "NEED BLUEPRINT"
	]


func get_repair_status_text() -> String:
	var target := _find_repair_target(_placement_position)
	if not target:
		return "Repair: aim damaged structure"
	var current_health: float = float(target.get_meta("structure_health", STRUCTURE_MAX_HEALTH))
	var max_health: float = float(target.get_meta("structure_max_health", STRUCTURE_MAX_HEALTH))
	var afford := InventoryManager.has_resources(STRUCTURE_REPAIR_COST) if InventoryManager else false
	return "Repair %s HP %d/%d | R %s" % [
		get_structure_label(target),
		roundi(current_health),
		roundi(max_health),
		"READY" if afford else "NEED RES"
	]


func get_repair_cost_text() -> String:
	var parts: Array[String] = []
	for resource_type in STRUCTURE_REPAIR_COST:
		parts.append("%d %s" % [STRUCTURE_REPAIR_COST[resource_type], _resource_label(str(resource_type))])
	return " + ".join(parts)


func ensure_structure_health(structure: Node) -> void:
	if not structure:
		return
	if not structure.has_meta("structure_max_health"):
		structure.set_meta("structure_max_health", STRUCTURE_MAX_HEALTH)
	if not structure.has_meta("structure_health"):
		structure.set_meta("structure_health", float(structure.get_meta("structure_max_health", STRUCTURE_MAX_HEALTH)))


func get_structure_label(structure: Node) -> String:
	if not structure:
		return "Structure"
	var label: String = str(structure.get_meta("build_label", ""))
	if not label.is_empty():
		return label
	if structure.is_in_group("built_turrets") or structure.get("damage") != null:
		return "Turret"
	if not structure.name.is_empty():
		return str(structure.name)
	return "Structure"


func get_refund_text(structure: Node) -> String:
	if not structure:
		return "none"
	var cost: Dictionary = structure.get_meta("build_cost", {})
	if cost.is_empty():
		return "none"
	var parts: Array[String] = []
	for resource_type in cost:
		var refund: int = max(1, floori(float(cost[resource_type]) * REFUND_RATE))
		parts.append("%d %s" % [refund, _resource_label(str(resource_type))])
	return " + ".join(parts)


func _apply_turret_upgrade(structure: Node3D, new_level: int) -> bool:
	var damage_value: Variant = structure.get("damage")
	var fire_rate_value: Variant = structure.get("fire_rate")
	if damage_value == null or fire_rate_value == null:
		return false

	structure.set("damage", float(damage_value) + 5.0)
	structure.set("fire_rate", float(fire_rate_value) + 0.25)
	structure.scale = Vector3.ONE * (1.0 + float(new_level) * 0.08)
	return true


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


func _find_recycle_target(pos: Vector3) -> Node3D:
	var nearest: Node3D = null
	var nearest_distance := RECYCLE_DISTANCE
	for structure in get_tree().get_nodes_in_group("built_structures"):
		var structure_node := structure as Node3D
		if not structure_node or not is_instance_valid(structure_node):
			continue
		var distance := structure_node.global_position.distance_to(pos)
		if distance < nearest_distance:
			nearest_distance = distance
			nearest = structure_node
	return nearest


func _find_upgrade_target(pos: Vector3) -> Node3D:
	var nearest: Node3D = null
	var nearest_distance := UPGRADE_DISTANCE
	for structure in get_tree().get_nodes_in_group("built_structures"):
		var structure_node := structure as Node3D
		if not structure_node or not is_instance_valid(structure_node):
			continue
		if structure_node.get("damage") == null:
			continue
		var distance := structure_node.global_position.distance_to(pos)
		if distance < nearest_distance:
			nearest_distance = distance
			nearest = structure_node
	return nearest


func _find_repair_target(pos: Vector3) -> Node3D:
	var nearest: Node3D = null
	var nearest_distance := REPAIR_DISTANCE
	for structure in get_tree().get_nodes_in_group("built_structures"):
		var structure_node := structure as Node3D
		if not structure_node or not is_instance_valid(structure_node):
			continue
		if not structure_node.has_meta("structure_health"):
			continue
		var max_health: float = float(structure_node.get_meta("structure_max_health", STRUCTURE_MAX_HEALTH))
		var current_health: float = float(structure_node.get_meta("structure_health", max_health))
		if current_health >= max_health:
			continue
		var distance := structure_node.global_position.distance_to(pos)
		if distance < nearest_distance:
			nearest_distance = distance
			nearest = structure_node
	return nearest


func _instantiate_selected_structure() -> Node3D:
	if selected_building == BUILD_SIGNAL_BEACON:
		return SIGNAL_BEACON_SCRIPT.new()
	if selected_building == BUILD_SLOW_FIELD:
		return SLOW_FIELD_SCRIPT.new()
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
	if selected_building == BUILD_SIGNAL_BEACON:
		return SIGNAL_BEACON_COST
	if selected_building == BUILD_SLOW_FIELD:
		return SLOW_FIELD_COST
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
	if selected_building == BUILD_SIGNAL_BEACON:
		return "Signal Beacon"
	if selected_building == BUILD_SLOW_FIELD:
		return "Slow Field"
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
	return _cost_text(get_selected_cost())


func get_selected_unlock_cost_text() -> String:
	if not TechManager:
		return "none"
	return _cost_text(TechManager.get_unlock_cost(selected_building))


func _cost_text(cost: Dictionary) -> String:
	if cost.is_empty():
		return "none"
	var parts: Array[String] = []
	for resource_type in cost:
		parts.append("%d %s" % [cost[resource_type], _resource_label(str(resource_type))])
	return " + ".join(parts)


func _resource_label(resource_type: String) -> String:
	if resource_type == "void_crystal":
		return "crystal"
	return resource_type
