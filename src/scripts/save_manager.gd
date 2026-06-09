extends Node

signal save_status_changed(message: String)

const SAVE_PATH := "user://star_abyss_save.json"
const SAVE_VERSION: int = 1

const BUILD_TURRET: String = "turret"
const BUILD_O2_STATION: String = "o2_station"
const BUILD_SHIELD_GENERATOR: String = "shield_generator"
const BUILD_SOLAR_PANEL: String = "solar_panel"
const BUILD_RESEARCH_STATION: String = "research_station"
const BUILD_SLOW_FIELD: String = "slow_field"

const TURRET_SCENE := preload("res://scenes/turret.tscn")
const O2_STATION_SCRIPT := preload("res://scripts/o2_station.gd")
const SHIELD_GENERATOR_SCRIPT := preload("res://scripts/shield_generator.gd")
const SOLAR_PANEL_SCRIPT := preload("res://scripts/solar_panel.gd")
const RESEARCH_STATION_SCRIPT := preload("res://scripts/research_station.gd")
const SLOW_FIELD_SCRIPT := preload("res://scripts/slow_field.gd")
const ENEMY_SCENE := preload("res://scenes/enemy.tscn")

var last_status: String = ""


func _ready() -> void:
	_ensure_input_action("quick_save", KEY_F6)
	_ensure_input_action("quick_load", KEY_F7)


func _input(event: InputEvent) -> void:
	if event.is_action_pressed("quick_save"):
		save_game()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("quick_load"):
		load_game()
		get_viewport().set_input_as_handled()


func save_game(path: String = SAVE_PATH) -> bool:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if not file:
		_set_status("Save failed")
		return false
	file.store_string(JSON.stringify(capture_save_data(), "\t"))
	file.close()
	_set_status("Saved")
	return true


func load_game(path: String = SAVE_PATH) -> bool:
	if not FileAccess.file_exists(path):
		_set_status("No save file")
		return false
	var file := FileAccess.open(path, FileAccess.READ)
	if not file:
		_set_status("Load failed")
		return false
	var text := file.get_as_text()
	file.close()
	var data: Variant = JSON.parse_string(text)
	if typeof(data) != TYPE_DICTIONARY:
		_set_status("Save data invalid")
		return false
	if not apply_save_data(data):
		_set_status("Load failed")
		return false
	_set_status("Loaded")
	return true


func capture_save_data() -> Dictionary:
	return {
		"version": SAVE_VERSION,
		"inventory": InventoryManager.resources.duplicate(true) if InventoryManager else {},
		"tech": TechManager.unlocked.duplicate(true) if TechManager else {},
		"game": _capture_game_state(),
		"structures": _capture_structures(),
		"enemies": _capture_enemies()
	}


func apply_save_data(data: Dictionary) -> bool:
	if int(data.get("version", 0)) != SAVE_VERSION:
		return false
	_clear_runtime_nodes()
	_apply_inventory(data.get("inventory", {}))
	_apply_tech(data.get("tech", {}))
	_restore_structures(data.get("structures", []))
	var restored_enemy_count := _restore_enemies(data.get("enemies", []))
	_apply_game_state(data.get("game", {}), restored_enemy_count)
	return true


func _capture_game_state() -> Dictionary:
	if not GameManager:
		return {}
	return {
		"is_night": GameManager.is_night,
		"wave_number": GameManager.wave_number,
		"base_health": GameManager.base_health,
		"base_shield": GameManager.base_shield,
		"max_base_shield": GameManager.max_base_shield,
		"phase_time_remaining": GameManager.phase_time_remaining,
		"last_wave_direction": GameManager.last_wave_direction,
		"enemies_alive": GameManager.enemies_alive
	}


func _capture_structures() -> Array[Dictionary]:
	var structures: Array[Dictionary] = []
	for structure in get_tree().get_nodes_in_group("built_structures"):
		var structure_node := structure as Node3D
		if not structure_node or not is_instance_valid(structure_node) or structure_node.is_queued_for_deletion():
			continue
		structures.append(_capture_structure(structure_node))
	return structures


func _capture_structure(structure: Node3D) -> Dictionary:
	var data := {
		"build_id": _get_structure_build_id(structure),
		"position": _vector_to_array(structure.global_position),
		"scale": _vector_to_array(structure.scale),
		"build_cost": structure.get_meta("build_cost", {}),
		"build_label": str(structure.get_meta("build_label", "")),
		"structure_health": float(structure.get_meta("structure_health", 100.0)),
		"structure_max_health": float(structure.get_meta("structure_max_health", 100.0)),
		"upgrade_level": int(structure.get_meta("upgrade_level", 0))
	}
	if structure.get("damage") != null:
		data["damage"] = float(structure.get("damage"))
	if structure.get("fire_rate") != null:
		data["fire_rate"] = float(structure.get("fire_rate"))
	return data


func _capture_enemies() -> Array[Dictionary]:
	var enemies: Array[Dictionary] = []
	for enemy in get_tree().get_nodes_in_group("enemies"):
		var enemy_node := enemy as Node3D
		if not enemy_node or not is_instance_valid(enemy_node) or enemy_node.is_queued_for_deletion():
			continue
		enemies.append(_capture_enemy(enemy_node))
	return enemies


func _capture_enemy(enemy: Node3D) -> Dictionary:
	return {
		"position": _vector_to_array(enemy.global_position),
		"scale": _vector_to_array(enemy.scale),
		"name": enemy.name,
		"speed": float(enemy.get("speed")),
		"health": float(enemy.get("health")),
		"damage": float(enemy.get("damage")),
		"attack_range": float(enemy.get("attack_range")),
		"structure_target_range": float(enemy.get("structure_target_range")),
		"structure_attack_interval": float(enemy.get("structure_attack_interval")),
		"wave_variant": str(enemy.get_meta("wave_variant", "normal")),
		"wave_variant_label": str(enemy.get_meta("wave_variant_label", "Normal"))
	}


func _apply_inventory(data: Variant) -> void:
	if not InventoryManager or typeof(data) != TYPE_DICTIONARY:
		return
	for resource_type in InventoryManager.resources:
		var amount: int = int(data.get(resource_type, 0))
		InventoryManager.resources[resource_type] = amount
		InventoryManager.resource_changed.emit(str(resource_type), amount)


func _apply_tech(data: Variant) -> void:
	if not TechManager or typeof(data) != TYPE_DICTIONARY:
		return
	TechManager.reset_unlocks()
	for tech_id in data:
		TechManager.unlocked[str(tech_id)] = bool(data[tech_id])
		if bool(data[tech_id]):
			TechManager.tech_unlocked.emit(str(tech_id))


func _apply_game_state(data: Variant, restored_enemy_count: int = 0) -> void:
	if not GameManager or typeof(data) != TYPE_DICTIONARY:
		return
	GameManager.is_night = bool(data.get("is_night", false))
	GameManager.wave_number = int(data.get("wave_number", 0))
	GameManager.enemies_alive = restored_enemy_count
	GameManager.base_health = float(data.get("base_health", GameManager.MAX_BASE_HEALTH))
	GameManager.base_shield = float(data.get("base_shield", 0.0))
	GameManager.max_base_shield = float(data.get("max_base_shield", 0.0))
	GameManager.phase_time_remaining = float(data.get("phase_time_remaining", GameManager.DAY_DURATION))
	GameManager.last_wave_direction = str(data.get("last_wave_direction", "--"))
	GameManager.base_health_changed.emit(GameManager.base_health)
	GameManager.base_shield_changed.emit(GameManager.base_shield, GameManager.max_base_shield)
	GameManager.enemies_alive_changed.emit(GameManager.enemies_alive)
	GameManager.wave_direction_changed.emit(GameManager.last_wave_direction)


func _restore_structures(data: Variant) -> void:
	if typeof(data) != TYPE_ARRAY or not get_tree().current_scene:
		return
	for item in data:
		if typeof(item) != TYPE_DICTIONARY:
			continue
		var structure := _instantiate_structure(str(item.get("build_id", BUILD_TURRET)))
		if not structure:
			continue
		get_tree().current_scene.add_child(structure)
		structure.global_position = _array_to_vector(item.get("position", [0.0, 0.0, 0.0]))
		structure.scale = _array_to_vector(item.get("scale", [1.0, 1.0, 1.0]))
		structure.add_to_group("built_structures")
		structure.set_meta("build_id", str(item.get("build_id", BUILD_TURRET)))
		structure.set_meta("build_cost", item.get("build_cost", {}))
		structure.set_meta("build_label", str(item.get("build_label", _label_for_build_id(str(item.get("build_id", BUILD_TURRET))))))
		structure.set_meta("structure_health", float(item.get("structure_health", 100.0)))
		structure.set_meta("structure_max_health", float(item.get("structure_max_health", 100.0)))
		structure.set_meta("upgrade_level", int(item.get("upgrade_level", 0)))
		if item.has("damage") and structure.get("damage") != null:
			structure.set("damage", float(item["damage"]))
		if item.has("fire_rate") and structure.get("fire_rate") != null:
			structure.set("fire_rate", float(item["fire_rate"]))


func _restore_enemies(data: Variant) -> int:
	if typeof(data) != TYPE_ARRAY or not get_tree().current_scene:
		return 0
	var restored_count := 0
	for item in data:
		if typeof(item) != TYPE_DICTIONARY:
			continue
		var enemy := _restore_enemy(item)
		if enemy:
			restored_count += 1
	return restored_count


func _restore_enemy(item: Dictionary) -> Node3D:
	var enemy := ENEMY_SCENE.instantiate() as Node3D
	if not enemy:
		return null
	get_tree().current_scene.add_child(enemy)
	enemy.global_position = _array_to_vector(item.get("position", [0.0, 0.0, 0.0]))
	enemy.scale = _array_to_vector(item.get("scale", [1.0, 1.0, 1.0]))
	enemy.name = str(item.get("name", "Enemy_Restored"))
	enemy.set("speed", float(item.get("speed", enemy.get("speed"))))
	enemy.set("health", float(item.get("health", enemy.get("health"))))
	enemy.set("damage", float(item.get("damage", enemy.get("damage"))))
	enemy.set("attack_range", float(item.get("attack_range", enemy.get("attack_range"))))
	enemy.set("structure_target_range", float(item.get("structure_target_range", enemy.get("structure_target_range"))))
	enemy.set("structure_attack_interval", float(item.get("structure_attack_interval", enemy.get("structure_attack_interval"))))
	var variant := str(item.get("wave_variant", "normal"))
	enemy.set_meta("wave_variant", variant)
	enemy.set_meta("wave_variant_label", str(item.get("wave_variant_label", "Normal")))
	if GameManager:
		GameManager._apply_enemy_variant_visual(enemy, variant)
		enemy.enemy_died.connect(GameManager._on_enemy_died.bind(enemy))
		enemy.base_reached.connect(GameManager._on_base_reached)
	return enemy


func _instantiate_structure(build_id: String) -> Node3D:
	match build_id:
		BUILD_O2_STATION:
			return O2_STATION_SCRIPT.new()
		BUILD_SHIELD_GENERATOR:
			return SHIELD_GENERATOR_SCRIPT.new()
		BUILD_SOLAR_PANEL:
			return SOLAR_PANEL_SCRIPT.new()
		BUILD_RESEARCH_STATION:
			return RESEARCH_STATION_SCRIPT.new()
		BUILD_SLOW_FIELD:
			return SLOW_FIELD_SCRIPT.new()
		_:
			var turret := TURRET_SCENE.instantiate() as Node3D
			turret.add_to_group("built_turrets")
			return turret


func _clear_runtime_nodes() -> void:
	for enemy in get_tree().get_nodes_in_group("enemies"):
		if enemy and is_instance_valid(enemy):
			enemy.free()
	for structure in get_tree().get_nodes_in_group("built_structures"):
		if structure and is_instance_valid(structure):
			structure.free()


func _get_structure_build_id(structure: Node) -> String:
	var build_id := str(structure.get_meta("build_id", ""))
	if not build_id.is_empty():
		return build_id
	var label := str(structure.get_meta("build_label", ""))
	match label:
		"O2 Station":
			return BUILD_O2_STATION
		"Shield Generator":
			return BUILD_SHIELD_GENERATOR
		"Solar Panel":
			return BUILD_SOLAR_PANEL
		"Research Station":
			return BUILD_RESEARCH_STATION
		"Slow Field":
			return BUILD_SLOW_FIELD
		_:
			return BUILD_TURRET


func _label_for_build_id(build_id: String) -> String:
	match build_id:
		BUILD_O2_STATION:
			return "O2 Station"
		BUILD_SHIELD_GENERATOR:
			return "Shield Generator"
		BUILD_SOLAR_PANEL:
			return "Solar Panel"
		BUILD_RESEARCH_STATION:
			return "Research Station"
		BUILD_SLOW_FIELD:
			return "Slow Field"
		_:
			return "Turret"


func _vector_to_array(value: Vector3) -> Array[float]:
	return [value.x, value.y, value.z]


func _array_to_vector(value: Variant) -> Vector3:
	if typeof(value) != TYPE_ARRAY or value.size() < 3:
		return Vector3.ZERO
	return Vector3(float(value[0]), float(value[1]), float(value[2]))


func _ensure_input_action(action_name: String, key: Key) -> void:
	if not InputMap.has_action(action_name):
		InputMap.add_action(action_name)
	for event in InputMap.action_get_events(action_name):
		var key_event := event as InputEventKey
		if key_event and key_event.physical_keycode == key:
			return
	var input_event := InputEventKey.new()
	input_event.physical_keycode = key
	InputMap.action_add_event(action_name, input_event)


func _set_status(message: String) -> void:
	last_status = message
	save_status_changed.emit(message)
	print("SaveManager: %s" % message)
