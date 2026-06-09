extends Node

signal objective_changed(text: String)

const TURRET_COST := {"iron": 20, "void_crystal": 5}
const O2_STATION_COST := {"iron": 15, "biomass": 10}
const SOLAR_PANEL_COST := {"iron": 18, "biomass": 6}
const SHIELD_GENERATOR_COST := {"iron": 25, "void_crystal": 8, "energy_core": 1}
const RESEARCH_STATION_COST := {"iron": 20, "void_crystal": 5, "energy": 5}
const SLOW_FIELD_COST := {"iron": 15, "biomass": 8, "energy": 4}
const TURRET_UPGRADE_COST := {"iron": 10, "energy": 5, "blueprint": 1}
const BASE_REPAIR_COST := {"iron": 10, "biomass": 5}
const STRUCTURE_REPAIR_COST := {"iron": 5, "biomass": 2}
const SHIELD_UNLOCK_COST := {"blueprint": 1}
const SLOW_FIELD_UNLOCK_COST := {"blueprint": 2}
const SIGNAL_BEACON_COST := {"iron": 30, "void_crystal": 10, "energy": 10, "blueprint": 2}
const SIGNAL_POWER_COST := {"energy": 1}
const LOW_OXYGEN_RATIO := 0.25

var _last_text: String = ""
var _refresh_timer: float = 0.0


func _ready() -> void:
	if InventoryManager:
		InventoryManager.resource_changed.connect(_on_resource_changed)
	if GameManager:
		GameManager.night_started.connect(_refresh)
		GameManager.day_started.connect(_refresh)
		GameManager.enemies_alive_changed.connect(_on_enemies_alive_changed)
		GameManager.base_health_changed.connect(_on_base_health_changed)
	if TechManager:
		TechManager.tech_unlocked.connect(_on_tech_unlocked)
	if SignalLogManager:
		SignalLogManager.extraction_holdout_started.connect(_on_extraction_changed)
		SignalLogManager.extraction_holdout_completed.connect(_refresh)
	if DeathDropManager:
		DeathDropManager.death_drop_spawned.connect(_refresh)
		DeathDropManager.death_drop_collected.connect(_refresh)
	set_process(true)
	_refresh()


func _process(delta: float) -> void:
	_refresh_timer += delta
	if _refresh_timer >= 0.5:
		_refresh_timer = 0.0
		_refresh()


func get_objective_text() -> String:
	if SignalLogManager and SignalLogManager.is_extraction_complete():
		return SignalLogManager.get_extraction_objective_text()

	if SignalLogManager and SignalLogManager.is_extraction_active():
		if GameManager and GameManager.enemies_alive > 0:
			return "Objective: Defend extraction zone | Enemies %d | %s" % [
				GameManager.enemies_alive,
				SignalLogManager.get_extraction_time_text()
			]
		return SignalLogManager.get_extraction_objective_text()

	var oxygen_text := _oxygen_objective_text()
	if not oxygen_text.is_empty():
		return oxygen_text

	if GameManager and GameManager.is_night:
		if GameManager.enemies_alive > 0:
			return "Objective: Defend base | Enemies %d" % GameManager.enemies_alive
		return "Objective: Hold the night, repair and rebuild at daybreak"

	if GameManager and GameManager.base_health < GameManager.MAX_BASE_HEALTH:
		if InventoryManager.has_resources(BASE_REPAIR_COST):
			return "Objective: Repair base at pod (E)"
		return "Objective: Gather %s for base repair" % get_missing_resources_text(BASE_REPAIR_COST)

	var damaged_structures := _damaged_structure_count()
	if damaged_structures > 0:
		if InventoryManager and InventoryManager.has_resources(STRUCTURE_REPAIR_COST):
			return "Objective: Repair damaged structure (B, R)"
		return "Objective: Gather %s for structure repair" % get_missing_resources_text(STRUCTURE_REPAIR_COST)

	if DeathDropManager and DeathDropManager.has_active_drop():
		var drop_hint := DeathDropManager.get_drop_hint()
		return "Objective: Recover dropped resources | %s" % drop_hint if not drop_hint.is_empty() else "Objective: Recover dropped resources"

	if _active_signal_cache_count() > 0:
		var cache_hint := SignalLogManager.get_cache_hint() if SignalLogManager else ""
		return "Objective: Locate signal cache | %s" % cache_hint if not cache_hint.is_empty() else "Objective: Locate signal cache"

	if _count_group("built_turrets") <= 0:
		return _build_or_gather("Build first Turret (B, 1)", TURRET_COST)

	if _count_group("o2_stations") <= 0:
		return _build_or_gather("Build O2 Station (B, 2)", O2_STATION_COST)

	if _count_group("solar_panels") <= 0:
		return _build_or_gather("Build Solar Panel (B, 4)", SOLAR_PANEL_COST)

	if _count_group("research_stations") <= 0:
		return _build_or_gather("Build Research Station (B, 5)", RESEARCH_STATION_COST)

	if TechManager and not TechManager.is_unlocked("shield_generator"):
		return _unlock_or_gather("Unlock Shield Generator (B, 3, Y)", SHIELD_UNLOCK_COST)

	if _count_group("shield_generators") <= 0:
		return _build_or_gather("Build Shield Generator (B, 3)", SHIELD_GENERATOR_COST)

	if TechManager and not TechManager.is_unlocked("slow_field"):
		return _unlock_or_gather("Unlock Slow Field (B, 6, Y)", SLOW_FIELD_UNLOCK_COST)

	if _count_group("slow_fields") <= 0:
		return _build_or_gather("Build Slow Field (B, 6)", SLOW_FIELD_COST)

	if _has_upgradeable_turret():
		return _build_or_gather("Upgrade a Turret (B, U)", TURRET_UPGRADE_COST)

	if _count_group("signal_beacons") <= 0:
		return _build_or_gather("Build Signal Beacon (B, 7)", SIGNAL_BEACON_COST)

	var signal_progress := _best_signal_progress()
	if signal_progress < 100.0:
		if InventoryManager and InventoryManager.has_resources(SIGNAL_POWER_COST):
			return "Objective: Power Signal Beacon | %d/100" % roundi(signal_progress)
		return "Objective: Gather 1 energy for Signal Beacon"

	return "Objective: Signal locked | survive and expand defenses"


func get_missing_resources_text(cost: Dictionary) -> String:
	var parts: Array[String] = []
	for resource_type in cost:
		var needed: int = int(cost[resource_type])
		var owned: int = int(InventoryManager.resources.get(resource_type, 0)) if InventoryManager else 0
		var missing: int = max(0, needed - owned)
		if missing > 0:
			parts.append("%d %s" % [missing, _resource_label(str(resource_type))])
	return " + ".join(parts)


func _build_or_gather(build_text: String, cost: Dictionary) -> String:
	if InventoryManager and InventoryManager.has_resources(cost):
		return "Objective: %s" % build_text
	return "Objective: Gather %s" % get_missing_resources_text(cost)


func _unlock_or_gather(unlock_text: String, cost: Dictionary) -> String:
	if InventoryManager and InventoryManager.has_resources(cost):
		return "Objective: %s" % unlock_text
	return "Objective: Research %s" % get_missing_resources_text(cost)


func _has_upgradeable_turret() -> bool:
	for turret in get_tree().get_nodes_in_group("built_turrets"):
		var turret_node := turret as Node
		if not turret_node or not is_instance_valid(turret_node):
			continue
		if int(turret_node.get_meta("upgrade_level", 0)) < 3:
			return true
	return false


func _oxygen_objective_text() -> String:
	var player := _oxygen_player()
	if not player or player.get("is_dead") == true:
		return ""
	var max_oxygen := float(player.get("max_oxygen"))
	if max_oxygen <= 0.0:
		return ""
	var current_oxygen := float(player.get("current_oxygen"))
	var ratio := current_oxygen / max_oxygen
	if ratio > LOW_OXYGEN_RATIO:
		return ""
	var percent := roundi(ratio * 100.0)
	if InventoryManager and int(InventoryManager.resources.get("oxygen_canister", 0)) > 0:
		return "Objective: Use O2 Kit (Q) | O2 %d%%" % percent
	if OxygenCanisterManager and InventoryManager and InventoryManager.has_resources(OxygenCanisterManager.CRAFT_COST):
		return "Objective: Craft O2 Kit (H) | O2 %d%%" % percent
	return "Objective: Find O2 Plant or return to base | O2 %d%%" % percent


func _oxygen_player() -> Node:
	var best_player: Node = null
	var best_ratio := INF
	for node in get_tree().get_nodes_in_group("player"):
		var player_node := node as Node
		if not player_node or not is_instance_valid(player_node) or player_node.is_queued_for_deletion():
			continue
		if player_node.get("is_dead") == true:
			continue
		var max_oxygen_value = player_node.get("max_oxygen")
		var current_oxygen_value = player_node.get("current_oxygen")
		if max_oxygen_value == null or current_oxygen_value == null:
			continue
		var max_oxygen := float(max_oxygen_value)
		if max_oxygen <= 0.0:
			continue
		var ratio := float(current_oxygen_value) / max_oxygen
		if ratio < best_ratio:
			best_ratio = ratio
			best_player = player_node
	return best_player


func _count_group(group_name: String) -> int:
	var count := 0
	for node in get_tree().get_nodes_in_group(group_name):
		if is_instance_valid(node):
			count += 1
	return count


func _damaged_structure_count() -> int:
	var count := 0
	for structure in get_tree().get_nodes_in_group("built_structures"):
		var structure_node := structure as Node
		if not structure_node or not is_instance_valid(structure_node) or structure_node.is_queued_for_deletion():
			continue
		if not structure_node.has_meta("structure_health"):
			continue
		var max_health: float = float(structure_node.get_meta("structure_max_health", 100.0))
		var current_health: float = float(structure_node.get_meta("structure_health", max_health))
		if current_health < max_health:
			count += 1
	return count


func _active_signal_cache_count() -> int:
	var count := 0
	for cache in get_tree().get_nodes_in_group("signal_caches"):
		if cache and is_instance_valid(cache) and not cache.is_queued_for_deletion():
			count += 1
	return count


func _best_signal_progress() -> float:
	var best_progress := 0.0
	for beacon in get_tree().get_nodes_in_group("signal_beacons"):
		var beacon_node := beacon as Node
		if not beacon_node or not is_instance_valid(beacon_node) or beacon_node.is_queued_for_deletion():
			continue
		best_progress = maxf(best_progress, float(beacon_node.get("signal_progress")))
	return best_progress


func _refresh() -> void:
	var text := get_objective_text()
	if text == _last_text:
		return
	_last_text = text
	objective_changed.emit(text)


func _on_resource_changed(_type: String, _amount: int) -> void:
	_refresh()


func _on_enemies_alive_changed(_count: int) -> void:
	_refresh()


func _on_base_health_changed(_health: float) -> void:
	_refresh()


func _on_tech_unlocked(_tech_id: String) -> void:
	_refresh()


func _on_extraction_changed(_duration: float) -> void:
	_refresh()


func _resource_label(resource_type: String) -> String:
	if resource_type == "void_crystal":
		return "crystal"
	return resource_type
