extends Node

signal objective_changed(text: String)

const TURRET_COST := {"iron": 20, "void_crystal": 5}
const O2_STATION_COST := {"iron": 15, "biomass": 10}
const SOLAR_PANEL_COST := {"iron": 18, "biomass": 6}
const RESEARCH_STATION_COST := {"iron": 20, "void_crystal": 5, "energy": 5}
const SLOW_FIELD_COST := {"iron": 15, "biomass": 8, "energy": 4}
const TURRET_UPGRADE_COST := {"iron": 10, "energy": 5, "blueprint": 1}
const BASE_REPAIR_COST := {"iron": 10, "biomass": 5}

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
	set_process(true)
	_refresh()


func _process(delta: float) -> void:
	_refresh_timer += delta
	if _refresh_timer >= 0.5:
		_refresh_timer = 0.0
		_refresh()


func get_objective_text() -> String:
	if GameManager and GameManager.is_night:
		if GameManager.enemies_alive > 0:
			return "Objective: Defend base | Enemies %d" % GameManager.enemies_alive
		return "Objective: Hold the night, repair and rebuild at daybreak"

	if GameManager and GameManager.base_health < GameManager.MAX_BASE_HEALTH:
		if InventoryManager.has_resources(BASE_REPAIR_COST):
			return "Objective: Repair base at pod (E)"
		return "Objective: Gather %s for base repair" % get_missing_resources_text(BASE_REPAIR_COST)

	if _count_group("built_turrets") <= 0:
		return _build_or_gather("Build first Turret (B, 1)", TURRET_COST)

	if _count_group("o2_stations") <= 0:
		return _build_or_gather("Build O2 Station (B, 2)", O2_STATION_COST)

	if _count_group("solar_panels") <= 0:
		return _build_or_gather("Build Solar Panel (B, 4)", SOLAR_PANEL_COST)

	if _count_group("research_stations") <= 0:
		return _build_or_gather("Build Research Station (B, 5)", RESEARCH_STATION_COST)

	if _count_group("slow_fields") <= 0:
		return _build_or_gather("Build Slow Field (B, 6)", SLOW_FIELD_COST)

	if _has_upgradeable_turret():
		return _build_or_gather("Upgrade a Turret (B, U)", TURRET_UPGRADE_COST)

	return "Objective: Survive waves, scan resources (G), expand defenses"


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


func _has_upgradeable_turret() -> bool:
	for turret in get_tree().get_nodes_in_group("built_turrets"):
		var turret_node := turret as Node
		if not turret_node or not is_instance_valid(turret_node):
			continue
		if int(turret_node.get_meta("upgrade_level", 0)) < 3:
			return true
	return false


func _count_group(group_name: String) -> int:
	var count := 0
	for node in get_tree().get_nodes_in_group(group_name):
		if is_instance_valid(node):
			count += 1
	return count


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


func _resource_label(resource_type: String) -> String:
	if resource_type == "void_crystal":
		return "crystal"
	return resource_type
