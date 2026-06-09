extends Control

const STRUCTURE_REPAIR_COST := {"iron": 5, "biomass": 2}
const SAVE_STATUS_DURATION := 2.5

var _status_label: Label
var _build_label: Label
var _base_label: Label
var _scanner_label: Label
var _objective_label: Label
var _signal_label: Label
var _save_status_label: Label
var _radio_label: Label
var _save_status_time_remaining := 0.0


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_status_label = Label.new()
	_status_label.position = Vector2(10, 88)
	_status_label.size = Vector2(560, 92)
	_status_label.add_theme_font_size_override("font_size", 18)
	add_child(_status_label)

	_build_label = Label.new()
	_build_label.position = Vector2(10, 188)
	_build_label.size = Vector2(920, 48)
	_build_label.add_theme_font_size_override("font_size", 16)
	add_child(_build_label)

	_base_label = Label.new()
	_base_label.position = Vector2(10, 236)
	_base_label.size = Vector2(560, 42)
	_base_label.add_theme_font_size_override("font_size", 16)
	add_child(_base_label)

	_scanner_label = Label.new()
	_scanner_label.position = Vector2(10, 278)
	_scanner_label.size = Vector2(560, 32)
	_scanner_label.add_theme_font_size_override("font_size", 16)
	add_child(_scanner_label)

	_objective_label = Label.new()
	_objective_label.position = Vector2(10, 314)
	_objective_label.size = Vector2(920, 36)
	_objective_label.add_theme_font_size_override("font_size", 16)
	_objective_label.add_theme_color_override("font_color", Color(1.0, 0.88, 0.45))
	add_child(_objective_label)

	_signal_label = Label.new()
	_signal_label.position = Vector2(10, 350)
	_signal_label.size = Vector2(760, 30)
	_signal_label.add_theme_font_size_override("font_size", 16)
	_signal_label.add_theme_color_override("font_color", Color(0.5, 0.95, 0.8))
	add_child(_signal_label)

	_save_status_label = Label.new()
	_save_status_label.position = Vector2(10, 382)
	_save_status_label.size = Vector2(560, 30)
	_save_status_label.add_theme_font_size_override("font_size", 16)
	_save_status_label.add_theme_color_override("font_color", Color(0.55, 0.9, 1.0))
	add_child(_save_status_label)

	_radio_label = Label.new()
	_radio_label.position = Vector2(10, 414)
	_radio_label.size = Vector2(920, 42)
	_radio_label.add_theme_font_size_override("font_size", 15)
	_radio_label.add_theme_color_override("font_color", Color(0.72, 0.9, 1.0))
	add_child(_radio_label)

	if GameManager:
		GameManager.base_health_changed.connect(_on_base_health_changed)
		GameManager.base_shield_changed.connect(_on_base_shield_changed)
		GameManager.wave_spawned.connect(_on_wave_spawned)
		GameManager.wave_direction_changed.connect(_on_wave_direction_changed)
		GameManager.enemies_alive_changed.connect(_on_enemies_alive_changed)
		GameManager.day_started.connect(_refresh)
		GameManager.night_started.connect(_refresh)
	if InventoryManager:
		InventoryManager.resource_changed.connect(_on_resource_changed)
	if TechManager:
		TechManager.tech_unlocked.connect(_on_tech_unlocked)
	if SaveManager:
		SaveManager.save_status_changed.connect(_on_save_status_changed)
	if SignalLogManager:
		SignalLogManager.radio_log_unlocked.connect(_on_radio_log_unlocked)

	var objective_tracker := get_tree().current_scene.get_node_or_null("ObjectiveTracker") if get_tree().current_scene else null
	if objective_tracker:
		objective_tracker.objective_changed.connect(_on_objective_changed)

	_refresh()


func _process(_delta: float) -> void:
	_refresh_build_hint()
	_refresh_base_hint()
	_refresh_scanner_hint()
	_refresh_signal_hint()
	_refresh_radio_log()
	if _save_status_time_remaining > 0.0:
		_save_status_time_remaining = maxf(0.0, _save_status_time_remaining - _delta)
		if is_zero_approx(_save_status_time_remaining):
			_save_status_label.text = ""


func _on_base_health_changed(_health: float) -> void:
	_refresh()


func _on_base_shield_changed(_shield: float, _max_shield: float) -> void:
	_refresh()


func _on_wave_spawned(_wave_number: int) -> void:
	_refresh()


func _on_wave_direction_changed(_direction: String) -> void:
	_refresh()


func _on_enemies_alive_changed(_count: int) -> void:
	_refresh()


func _on_resource_changed(_type: String, _amount: int) -> void:
	_refresh_build_hint()
	_refresh_base_hint()
	_refresh_scanner_hint()
	_refresh_objective_hint()
	_refresh_signal_hint()
	_refresh_radio_log()


func _on_tech_unlocked(_tech_id: String) -> void:
	_refresh_build_hint()
	_refresh_objective_hint()


func _on_objective_changed(_text: String) -> void:
	_refresh_objective_hint()


func _on_save_status_changed(message: String) -> void:
	_save_status_label.text = "Save: %s" % message
	_save_status_time_remaining = SAVE_STATUS_DURATION


func _on_radio_log_unlocked(_log_id: String, _message: String) -> void:
	_refresh_radio_log()


func _refresh() -> void:
	if not GameManager:
		return
	var phase := "Night" if GameManager.is_night else "Day"
	_status_label.text = "Base HP: %d%% | Shield %d/%d\n%s | Wave %d %s | Enemies %d\n%s | From %s" % [
		roundi(GameManager.base_health),
		roundi(GameManager.base_shield),
		roundi(GameManager.max_base_shield),
		phase,
		GameManager.wave_number,
		GameManager.get_wave_variant_label(),
		GameManager.enemies_alive,
		GameManager.get_phase_timer_text(),
		GameManager.last_wave_direction
	]
	_refresh_build_hint()
	_refresh_base_hint()
	_refresh_scanner_hint()
	_refresh_objective_hint()


func _refresh_build_hint() -> void:
	var build_manager := get_tree().current_scene.get_node_or_null("BuildManager") if get_tree().current_scene else null
	if build_manager and build_manager.build_mode:
		if build_manager.recycle_mode:
			_build_label.text = "Recycle | X Build | U Up | R Repair\n%s" % build_manager.get_recycle_status_text()
			return
		if not build_manager.is_selected_unlocked():
			_build_label.text = "Build 1Tur 2O2 3Sh 4Sol 5Res 6Slow 7Sig | Y Unlock | X Rec | U Up | R Repair\n%s locked | %s" % [
				build_manager.get_selected_label(),
				build_manager.get_selected_unlock_status_text()
			]
			return
		var afford := InventoryManager.has_resources(build_manager.get_selected_cost()) if InventoryManager else false
		_build_label.text = "Build 1Tur 2O2 3Sh 4Sol 5Res 6Slow 7Sig | Y Unlock | X Rec | U Up | R Repair\n%s: %s | LMB %s | %s" % [
			build_manager.get_selected_label(),
			build_manager.get_selected_cost_text(),
			"READY" if afford else "NEED RES",
			build_manager.get_structure_action_status_text()
		]
	else:
		_build_label.text = "B Build | 1Tur 2O2 3Sh 4Sol 5Res 6Slow 7Sig | Y Unlock | F6 Save F7 Load"


func _refresh_base_hint() -> void:
	var base_interaction := get_tree().current_scene.get_node_or_null("BaseInteraction") if get_tree().current_scene else null
	var parts: Array[String] = []
	if base_interaction:
		var repair_hint: String = base_interaction.get_repair_hint()
		if repair_hint:
			parts.append(repair_hint)
	var structure_hint := get_structure_damage_hint()
	if structure_hint:
		parts.append(structure_hint)
	if GameManager and not GameManager.is_night:
		parts.append("N start night test")
	_base_label.text = " | ".join(parts)


func _refresh_scanner_hint() -> void:
	var scanner := get_tree().current_scene.get_node_or_null("ResourceScanner") if get_tree().current_scene else null
	_scanner_label.text = scanner.get_scan_hint() if scanner else ""


func _refresh_objective_hint() -> void:
	var objective_tracker := get_tree().current_scene.get_node_or_null("ObjectiveTracker") if get_tree().current_scene else null
	_objective_label.text = objective_tracker.get_objective_text() if objective_tracker else ""


func _refresh_signal_hint() -> void:
	_signal_label.text = get_signal_hint()


func _refresh_radio_log() -> void:
	_radio_label.text = get_radio_log_text()


func get_structure_damage_hint() -> String:
	var damaged_count := 0
	var worst_structure: Node = null
	var worst_health := 1.0
	var worst_max := 1.0
	for structure in get_tree().get_nodes_in_group("built_structures"):
		var structure_node := structure as Node
		if not structure_node or not is_instance_valid(structure_node) or structure_node.is_queued_for_deletion():
			continue
		if not structure_node.has_meta("structure_health"):
			continue
		var max_health: float = float(structure_node.get_meta("structure_max_health", 100.0))
		var current_health: float = float(structure_node.get_meta("structure_health", max_health))
		if current_health >= max_health:
			continue
		damaged_count += 1
		var health_ratio := current_health / maxf(1.0, max_health)
		if not worst_structure or health_ratio < worst_health / maxf(1.0, worst_max):
			worst_structure = structure_node
			worst_health = current_health
			worst_max = max_health
	if damaged_count <= 0:
		return ""

	var repair_state := "READY" if InventoryManager and InventoryManager.has_resources(STRUCTURE_REPAIR_COST) else "NEED RES"
	if damaged_count == 1:
		return "Struct %s %d/%d | B+R %s" % [
			_structure_label(worst_structure),
			roundi(worst_health),
			roundi(worst_max),
			repair_state
		]
	return "Struct dmg x%d | worst %d/%d | B+R %s" % [
		damaged_count,
		roundi(worst_health),
		roundi(worst_max),
		repair_state
	]


func _structure_label(structure: Node) -> String:
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


func get_save_status_text() -> String:
	return _save_status_label.text if _save_status_label else ""


func get_signal_hint() -> String:
	var best_text := ""
	var best_progress := -1.0
	for beacon in get_tree().get_nodes_in_group("signal_beacons"):
		var beacon_node := beacon as Node
		if not beacon_node or not is_instance_valid(beacon_node) or beacon_node.is_queued_for_deletion():
			continue
		var progress: float = float(beacon_node.get("signal_progress"))
		if progress > best_progress:
			best_progress = progress
			best_text = str(beacon_node.call("get_signal_status_text"))
	return best_text


func get_radio_log_text() -> String:
	if not SignalLogManager:
		return ""
	return SignalLogManager.get_latest_message()
