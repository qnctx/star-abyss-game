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

# Base speed penalty per zone (before adaptation). Lv2+ removes the penalty.
const ZONE_SPEED_PENALTY = {
	ZoneType.CRASH: 1.0,
	ZoneType.COLD: 1.0,
	ZoneType.HEAT: 1.0,
	ZoneType.GRAVITY: 0.7   # -30% speed at Lv0-1
}
const SPEED_PENALTY_IMMUNE_LEVEL := 2

# Structure drain per second per zone (before adaptation). Lv2+ removes drain.
const ZONE_STRUCTURE_DRAIN = {
	ZoneType.CRASH: 0.0,
	ZoneType.COLD: 0.0,
	ZoneType.HEAT: 0.1,     # -0.1 HP/s at Lv0-1 (low to avoid punishing outposts)
	ZoneType.GRAVITY: 0.0
}
const STRUCTURE_DRAIN_IMMUNE_LEVEL := 2

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

func get_speed_multiplier() -> float:
	## Base speed multiplier for the current zone.
	## GRAVITY zone slows the player at Lv0-1; Lv2+ restores normal speed.
	if adaptations[current_zone] >= SPEED_PENALTY_IMMUNE_LEVEL:
		return 1.0
	return ZONE_SPEED_PENALTY.get(current_zone, 1.0)

func get_structure_drain_rate() -> float:
	## HP/s drained from structures in the current zone.
	## HEAT zone damages structures at Lv0-1; Lv2+ makes them immune.
	if adaptations[current_zone] >= STRUCTURE_DRAIN_IMMUNE_LEVEL:
		return 0.0
	return ZONE_STRUCTURE_DRAIN.get(current_zone, 0.0)


func get_recommended_adaptation_level() -> int:
	## Soft-gate hint shown in HUD. CRASH needs no adaptation; the three
	## pressure zones recommend Lv2 (removes speed/structure penalty).
	## Used by combat_hud to render "建议 Lv2+" next to the zone name.
	if current_zone == ZoneType.CRASH:
		return 0
	return max(SPEED_PENALTY_IMMUNE_LEVEL, STRUCTURE_DRAIN_IMMUNE_LEVEL)


func get_current_adaptation_level() -> int:
	## Adaptation level for the current zone (0-4).
	return int(adaptations.get(current_zone, 0))
