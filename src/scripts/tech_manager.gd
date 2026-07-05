extends Node

signal tech_unlocked(tech_id: String)

const BUILD_TURRET: String = "turret"
const BUILD_O2_STATION: String = "o2_station"
const BUILD_SHIELD_GENERATOR: String = "shield_generator"
const BUILD_SOLAR_PANEL: String = "solar_panel"
const BUILD_RESEARCH_STATION: String = "research_station"
const BUILD_SLOW_FIELD: String = "slow_field"
const BUILD_SIGNAL_BEACON: String = "signal_beacon"

const UNLOCK_COSTS := {
	BUILD_SHIELD_GENERATOR: {"blueprint": 1},
	BUILD_SLOW_FIELD: {"blueprint": 2}
}

const LABELS := {
	BUILD_TURRET: "Turret",
	BUILD_O2_STATION: "O2 Station",
	BUILD_SHIELD_GENERATOR: "Shield Generator",
	BUILD_SOLAR_PANEL: "Solar Panel",
	BUILD_RESEARCH_STATION: "Research Station",
	BUILD_SLOW_FIELD: "Slow Field",
	BUILD_SIGNAL_BEACON: "Signal Beacon"
}

var unlocked: Dictionary = {}


func _ready() -> void:
	reset_unlocks()


func reset_unlocks() -> void:
	unlocked = {
		BUILD_TURRET: true,
		BUILD_O2_STATION: true,
		BUILD_SOLAR_PANEL: true,
		BUILD_RESEARCH_STATION: true,
		BUILD_SHIELD_GENERATOR: false,
		BUILD_SLOW_FIELD: false,
		BUILD_SIGNAL_BEACON: true
	}


func is_unlocked(tech_id: String) -> bool:
	return bool(unlocked.get(tech_id, false))


func is_unlockable(tech_id: String) -> bool:
	return UNLOCK_COSTS.has(tech_id) and not is_unlocked(tech_id)


func get_unlock_cost(tech_id: String) -> Dictionary:
	if not UNLOCK_COSTS.has(tech_id):
		return {}
	return UNLOCK_COSTS[tech_id].duplicate()


func can_unlock(tech_id: String) -> bool:
	if not is_unlockable(tech_id):
		return false
	return InventoryManager and InventoryManager.has_resources(get_unlock_cost(tech_id))


func unlock(tech_id: String) -> bool:
	if not can_unlock(tech_id):
		return false
	if not InventoryManager.consume_resources(get_unlock_cost(tech_id)):
		return false
	unlocked[tech_id] = true
	tech_unlocked.emit(tech_id)
	return true


func get_label(tech_id: String) -> String:
	return str(LABELS.get(tech_id, tech_id))
