extends Node3D

const TURRET_SCENE := preload("res://scenes/turret.tscn")
const O2_STATION_SCRIPT := preload("res://scripts/o2_station.gd")
const SHIELD_GENERATOR_SCRIPT := preload("res://scripts/shield_generator.gd")
const SOLAR_PANEL_SCRIPT := preload("res://scripts/solar_panel.gd")
const RESEARCH_STATION_SCRIPT := preload("res://scripts/research_station.gd")
const SLOW_FIELD_SCRIPT := preload("res://scripts/slow_field.gd")
const SIGNAL_BEACON_SCRIPT := preload("res://scripts/signal_beacon.gd")
const AIM_TARGETING := preload("res://scripts/aim_targeting.gd")
const TURRET_COST := {"iron": 20, "void_crystal": 5}
const O2_STATION_COST := {"iron": 15, "biomass": 10}
const SHIELD_GENERATOR_COST := {"iron": 25, "void_crystal": 8, "energy_core": 1}
const SOLAR_PANEL_COST := {"iron": 18, "biomass": 6}
const RESEARCH_STATION_COST := {"iron": 20, "void_crystal": 5, "energy": 5}
const SLOW_FIELD_COST := {"iron": 15, "biomass": 8, "energy": 4}
const SIGNAL_BEACON_COST := {"iron": 30, "void_crystal": 10, "energy": 10, "blueprint": 2}
const PLACEMENT_RANGE: float = 18.0
const BUILD_DISTANCE: float = 6.0
const BUILD_CURSOR_SENSITIVITY: float = 0.035
const MIN_BUILD_CURSOR_DISTANCE: float = 2.2
const MIN_BASE_DISTANCE: float = 2.5
const MIN_STRUCTURE_DISTANCE: float = 2.0
const RECYCLE_DISTANCE: float = 2.8
const REFUND_RATE: float = 0.5
const UPGRADE_DISTANCE: float = 2.8
const REPAIR_DISTANCE: float = 2.8
const AIM_STRUCTURE_RANGE: float = 8.0
const AIM_STRUCTURE_RADIUS: float = 1.35
const MAX_UPGRADE_LEVEL: int = 3
const TURRET_UPGRADE_COST := {"iron": 10, "energy": 5, "blueprint": 1}
const STRUCTURE_REPAIR_COST := {"iron": 5, "biomass": 2}
const STRUCTURE_MAX_HEALTH: float = 100.0
const STRUCTURE_REPAIR_AMOUNT: float = 35.0
const MIN_PLAYER_BUILD_DISTANCE: float = 2.8
const BUILD_TURRET: String = "turret"
const BUILD_O2_STATION: String = "o2_station"
const BUILD_SHIELD_GENERATOR: String = "shield_generator"
const BUILD_SOLAR_PANEL: String = "solar_panel"
const BUILD_RESEARCH_STATION: String = "research_station"
const BUILD_SLOW_FIELD: String = "slow_field"
const BUILD_SIGNAL_BEACON: String = "signal_beacon"
const BUILD_ORDER := [
	BUILD_TURRET,
	BUILD_O2_STATION,
	BUILD_SHIELD_GENERATOR,
	BUILD_SOLAR_PANEL,
	BUILD_RESEARCH_STATION,
	BUILD_SLOW_FIELD,
	BUILD_SIGNAL_BEACON,
]

var build_mode: bool = false
var recycle_mode: bool = false
var selected_building: String = BUILD_TURRET
var _preview: MeshInstance3D = null
var _preview_material: StandardMaterial3D = null
var _preview_label: Label3D = null
var _can_place: bool = false
var _position_is_valid: bool = false
var _placement_position: Vector3 = Vector3.ZERO
var _build_cursor_offset: Vector3 = Vector3.ZERO
var _build_aim_valid: bool = true


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
	elif event is InputEventKey and event.pressed and event.physical_keycode == KEY_TAB:
		_cycle_selected_building(-1 if event.shift_pressed else 1)
		get_viewport().set_input_as_handled()
	elif event is InputEventKey and event.pressed and event.shift_pressed and event.physical_keycode == KEY_1:
		_select_building(BUILD_TURRET)
		get_viewport().set_input_as_handled()
	elif event is InputEventKey and event.pressed and event.shift_pressed and event.physical_keycode == KEY_2:
		_select_building(BUILD_O2_STATION)
		get_viewport().set_input_as_handled()
	elif event is InputEventKey and event.pressed and event.shift_pressed and event.physical_keycode == KEY_3:
		_select_building(BUILD_SHIELD_GENERATOR)
		get_viewport().set_input_as_handled()
	elif event is InputEventKey and event.pressed and event.shift_pressed and event.physical_keycode == KEY_4:
		_select_building(BUILD_SOLAR_PANEL)
		get_viewport().set_input_as_handled()
	elif event is InputEventKey and event.pressed and event.shift_pressed and event.physical_keycode == KEY_5:
		_select_building(BUILD_RESEARCH_STATION)
		get_viewport().set_input_as_handled()
	elif event is InputEventKey and event.pressed and event.shift_pressed and event.physical_keycode == KEY_6:
		_select_building(BUILD_SLOW_FIELD)
		get_viewport().set_input_as_handled()
	elif event is InputEventKey and event.pressed and event.shift_pressed and event.physical_keycode == KEY_7:
		_select_building(BUILD_SIGNAL_BEACON)
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_LEFT:
			_try_place_structure()
			get_viewport().set_input_as_handled()
		elif event.button_index == MOUSE_BUTTON_RIGHT:
			_set_build_mode(false)
			get_viewport().set_input_as_handled()


func _process(delta: float) -> void:
	_update_preview()


func _set_build_mode(enabled: bool) -> void:
	build_mode = enabled
	if not build_mode:
		recycle_mode = false
	else:
		_reset_build_cursor()
	set_process(build_mode)
	_refresh_preview_mesh()
	if _preview:
		_preview.visible = build_mode


func _select_building(building_id: String) -> void:
	selected_building = building_id
	_refresh_preview_mesh()


func _cycle_selected_building(direction: int) -> void:
	# 诊断日志：记录 Tab 切换前后 inventory 状态，用于定位"Tab 后资源消失"bug。
	# 如果切换前后数字不一致，说明 Tab 触发了非预期消耗。
	var _bp_before := int(InventoryManager.resources.get("blueprint", -1)) if InventoryManager else -1
	var _iron_before := int(InventoryManager.resources.get("iron", -1)) if InventoryManager else -1
	var index := BUILD_ORDER.find(selected_building)
	if index < 0:
		index = 0
	index = wrapi(index + direction, 0, BUILD_ORDER.size())
	_select_building(str(BUILD_ORDER[index]))
	var _bp_after := int(InventoryManager.resources.get("blueprint", -1)) if InventoryManager else -1
	var _iron_after := int(InventoryManager.resources.get("iron", -1)) if InventoryManager else -1
	if _bp_before != _bp_after or _iron_before != _iron_after:
		push_warning("[BuildManager] Tab 切换异常消耗资源！blueprint %d->%d, iron %d->%d" % [_bp_before, _bp_after, _iron_before, _iron_after])
	print("[BuildManager] Tab 切换 -> %s | bp %d->%d | iron %d->%d" % [selected_building, _bp_before, _bp_after, _iron_before, _iron_after])


func _create_preview() -> void:
	_preview = MeshInstance3D.new()
	_preview.name = "BuildPreview"
	_preview_material = StandardMaterial3D.new()
	_preview_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_preview_material.albedo_color = Color(0.2, 1.0, 0.45, 0.45)
	_preview.material_override = _preview_material
	_preview.visible = false
	add_child(_preview)
	_preview_label = Label3D.new()
	_preview_label.name = "BuildPreviewLabel"
	_preview_label.position = Vector3(0.0, 1.25, 0.0)
	_preview_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_preview_label.font_size = 34
	_preview_label.pixel_size = 0.009
	_preview_label.modulate = Color(1.0, 0.95, 0.68)
	_preview_label.outline_size = 8
	_preview_label.outline_modulate = Color(0.02, 0.02, 0.02, 0.95)
	_preview.add_child(_preview_label)
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
	if _preview_label:
		_preview_label.text = get_selected_label().to_upper()
		if selected_building == BUILD_SOLAR_PANEL:
			_preview_label.position.y = 1.05
		elif selected_building == BUILD_SIGNAL_BEACON:
			_preview_label.position.y = 1.65
		else:
			_preview_label.position.y = 1.25


func _update_preview() -> void:
	if not _preview:
		return

	var target_data := _get_build_target_data()
	_build_aim_valid = bool(target_data.get("valid", true))
	_placement_position = _snap_to_terrain(target_data.get("position", Vector3.ZERO))
	if recycle_mode:
		var recycle_target := _find_recycle_target(_placement_position)
		if recycle_target:
			_placement_position = recycle_target.global_position
		_position_is_valid = recycle_target != null
		_can_place = _position_is_valid
	elif not _build_aim_valid:
		_position_is_valid = false
		_can_place = false
	else:
		_position_is_valid = _validate_position(_placement_position)
		var has_resources := InventoryManager.has_resources(get_selected_cost())
		var unlocked := is_selected_unlocked()
		_can_place = _position_is_valid and has_resources and unlocked

	_preview.global_position = _placement_position
	_preview.visible = build_mode and (_build_aim_valid or recycle_mode)
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

	if not InventoryManager.consume_resources(cost):
		return
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

	if not InventoryManager.consume_resources(TURRET_UPGRADE_COST):
		return false
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

	if not InventoryManager.consume_resources(STRUCTURE_REPAIR_COST):
		return false
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
	return _get_build_target_data().get("position", Vector3.ZERO)


func _get_build_target_data() -> Dictionary:
	var targeting = AIM_TARGETING.new()
	var ray := targeting.get_aim_ray(get_viewport(), PLACEMENT_RANGE)
	if bool(ray.get("valid", false)):
		var aim := targeting.get_terrain_aim_position(get_viewport(), PLACEMENT_RANGE, BUILD_DISTANCE)
		var aim_position: Vector3 = aim.get("position", Vector3.ZERO)
		if bool(aim.get("valid", false)):
			aim_position = _keep_target_outside_player(aim_position)
		return {
			"valid": bool(aim.get("valid", false)),
			"position": aim_position,
		}

	var player := get_tree().get_first_node_in_group("player") as Node3D
	if not player:
		return {"valid": true, "position": Vector3.ZERO}
	if _build_cursor_offset.length() <= 0.01:
		_reset_build_cursor()
	return {"valid": true, "position": player.global_position + _build_cursor_offset}


func _reset_build_cursor() -> void:
	var player := get_tree().get_first_node_in_group("player") as Node3D
	if not player:
		_build_cursor_offset = Vector3.FORWARD * BUILD_DISTANCE
		return
	_build_cursor_offset = _player_flat_forward(player) * BUILD_DISTANCE


func _move_build_cursor(relative: Vector2) -> void:
	var player := get_tree().get_first_node_in_group("player") as Node3D
	if not player:
		return
	var forward := _player_flat_forward(player)
	var right := _player_flat_right(player)
	_build_cursor_offset += right * relative.x * BUILD_CURSOR_SENSITIVITY
	_build_cursor_offset -= forward * relative.y * BUILD_CURSOR_SENSITIVITY
	_build_cursor_offset.y = 0.0
	var distance := _build_cursor_offset.length()
	if distance <= 0.01:
		_build_cursor_offset = forward * MIN_BUILD_CURSOR_DISTANCE
		return
	if distance > PLACEMENT_RANGE:
		_build_cursor_offset = _build_cursor_offset.normalized() * PLACEMENT_RANGE
	elif distance < MIN_BUILD_CURSOR_DISTANCE:
		_build_cursor_offset = _build_cursor_offset.normalized() * MIN_BUILD_CURSOR_DISTANCE


func _player_flat_forward(player: Node3D) -> Vector3:
	var forward := -player.global_transform.basis.z
	forward.y = 0.0
	if forward.length() <= 0.01:
		forward = Vector3.FORWARD
	return forward.normalized()


func _player_flat_right(player: Node3D) -> Vector3:
	var right := player.global_transform.basis.x
	right.y = 0.0
	if right.length() <= 0.01:
		right = Vector3.RIGHT
	return right.normalized()


func _snap_to_terrain(pos: Vector3) -> Vector3:
	var x: float = clamp(pos.x, -50.0, 50.0)
	var z: float = clamp(pos.z, -50.0, 50.0)
	var y: float = 0.0
	if WorldGenerator:
		y = clamp(WorldGenerator.get_height_at(Vector2(x, z)), -5.0, 15.0)
	return Vector3(x, y + 0.75, z)


func _keep_target_outside_player(pos: Vector3) -> Vector3:
	var player := get_tree().get_first_node_in_group("player") as Node3D
	if not player:
		return pos
	var flat_offset := Vector3(pos.x - player.global_position.x, 0.0, pos.z - player.global_position.z)
	if flat_offset.length() >= MIN_PLAYER_BUILD_DISTANCE:
		return pos
	var forward := _player_flat_forward(player)
	if flat_offset.length() > 0.1:
		forward = flat_offset.normalized()
	return player.global_position + forward * MIN_PLAYER_BUILD_DISTANCE


func _validate_position(pos: Vector3) -> bool:
	var player := get_tree().get_first_node_in_group("player") as Node3D
	if player:
		var flat_distance := Vector2(player.global_position.x, player.global_position.z).distance_to(Vector2(pos.x, pos.z))
		if flat_distance < MIN_PLAYER_BUILD_DISTANCE - 0.05:
			return false
		if player.global_position.distance_to(pos) > PLACEMENT_RANGE:
			return false
	if WorldGenerator and pos.distance_to(WorldGenerator.base_position) < MIN_BASE_DISTANCE:
		return false
	for structure in get_tree().get_nodes_in_group("built_structures"):
		if structure is Node3D and structure.global_position.distance_to(pos) < MIN_STRUCTURE_DISTANCE:
			return false
	return true


func _find_recycle_target(pos: Vector3) -> Node3D:
	var aimed := _find_aimed_structure(RECYCLE_DISTANCE, AIM_STRUCTURE_RADIUS, func(_structure: Node3D) -> bool:
		return true
	)
	if aimed:
		return aimed

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
	var aimed := _find_aimed_structure(UPGRADE_DISTANCE, AIM_STRUCTURE_RADIUS, func(structure: Node3D) -> bool:
		return structure.get("damage") != null
	)
	if aimed:
		return aimed

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
	var aimed := _find_aimed_structure(REPAIR_DISTANCE, AIM_STRUCTURE_RADIUS, func(structure: Node3D) -> bool:
		return _is_repair_target(structure)
	)
	if aimed:
		return aimed

	var nearest: Node3D = null
	var nearest_distance := REPAIR_DISTANCE
	for structure in get_tree().get_nodes_in_group("built_structures"):
		var structure_node := structure as Node3D
		if not structure_node or not is_instance_valid(structure_node):
			continue
		if not _is_repair_target(structure_node):
			continue
		var distance := structure_node.global_position.distance_to(pos)
		if distance < nearest_distance:
			nearest_distance = distance
			nearest = structure_node
	return nearest


func _find_aimed_structure(max_distance: float, radius: float, filter: Callable) -> Node3D:
	return AIM_TARGETING.new().find_aimed_group(
		get_viewport(),
		get_tree(),
		"built_structures",
		maxf(max_distance, AIM_STRUCTURE_RANGE),
		radius,
		filter
	)


func _is_repair_target(structure_node: Node3D) -> bool:
	if not structure_node or not is_instance_valid(structure_node):
		return false
	if not structure_node.has_meta("structure_health"):
		return false
	var max_health: float = float(structure_node.get_meta("structure_max_health", STRUCTURE_MAX_HEALTH))
	var current_health: float = float(structure_node.get_meta("structure_health", max_health))
	return current_health < max_health


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
