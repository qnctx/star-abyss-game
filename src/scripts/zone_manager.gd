extends Node

signal zone_changed(zone_name: String)

enum ZoneType { CRASH, COLD, HEAT, GRAVITY }
var current_zone: int = ZoneType.CRASH

const ZONE_PRESSURE = {
	ZoneType.CRASH: 1.0,
	ZoneType.COLD: 3.0,
	ZoneType.HEAT: 3.5,
	ZoneType.GRAVITY: 4.0
}

var adaptations = {
	ZoneType.CRASH: 0,
	ZoneType.COLD: 0,
	ZoneType.HEAT: 0,
	ZoneType.GRAVITY: 0
}

const ADAPTATION_EFFECTS = [0.0, 0.20, 0.40, 0.70, 1.00]
const ADAPTATION_BONUSES = {
	ZoneType.COLD: {4: {"speed_bonus": 0.15, "immunity": "freeze"}},
	ZoneType.HEAT: {4: {"speed_bonus": 0.10, "immunity": "burn"}},
	ZoneType.GRAVITY: {4: {"speed_bonus": 0.20, "immunity": "crush"}},
	ZoneType.CRASH: {4: {"oxygen_efficiency": 0.7}}
}

const ZONE_NAMES = {
	ZoneType.CRASH: "Crash Zone",
	ZoneType.COLD: "极寒区",
	ZoneType.HEAT: "熔岩区",
	ZoneType.GRAVITY: "重力异常区"
}

func get_oxygen_multiplier() -> float:
	var pressure = ZONE_PRESSURE[current_zone]
	var adaptation = ADAPTATION_EFFECTS[adaptations[current_zone]]
	var mult = pressure * (1.0 - adaptation * 0.9)
	if adaptations[current_zone] == 4 and current_zone == ZoneType.CRASH:
		mult *= 0.7
	return max(mult, 0.3)

func get_zone_name() -> String:
	return ZONE_NAMES.get(current_zone, "Unknown")

func get_speed_bonus() -> float:
	var bonus = ADAPTATION_BONUSES.get(current_zone, {})
	var level_bonus = bonus.get(adaptations[current_zone], {})
	return level_bonus.get("speed_bonus", 0.0)
