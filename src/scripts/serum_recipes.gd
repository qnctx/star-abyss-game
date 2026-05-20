extends Node

var recipes = {
	"cold_1": {"zone": 1, "level": 1, "cost": {"iron": 15, "biomass": 10}, "unlocked": false},
	"cold_2": {"zone": 1, "level": 2, "cost": {"void_crystal": 10, "biomass": 20}, "unlocked": false},
	"cold_3": {"zone": 1, "level": 3, "cost": {"void_crystal": 25, "energy_core": 1, "blueprint": 1}, "unlocked": false},
	"cold_4": {"zone": 1, "level": 4, "cost": {"void_crystal": 40, "energy_core": 3, "blueprint": 3}, "unlocked": false},
	"heat_1": {"zone": 2, "level": 1, "cost": {"iron": 20, "biomass": 15}, "unlocked": false},
	"heat_2": {"zone": 2, "level": 2, "cost": {"void_crystal": 12, "biomass": 25}, "unlocked": false},
	"heat_3": {"zone": 2, "level": 3, "cost": {"void_crystal": 30, "energy_core": 1, "blueprint": 1}, "unlocked": false},
	"heat_4": {"zone": 2, "level": 4, "cost": {"void_crystal": 45, "energy_core": 3, "blueprint": 3}, "unlocked": false},
	"grav_1": {"zone": 3, "level": 1, "cost": {"iron": 25, "void_crystal": 10}, "unlocked": false},
	"grav_2": {"zone": 3, "level": 2, "cost": {"void_crystal": 20, "biomass": 15}, "unlocked": false},
	"grav_3": {"zone": 3, "level": 3, "cost": {"void_crystal": 35, "energy_core": 2, "blueprint": 1}, "unlocked": false},
	"grav_4": {"zone": 3, "level": 4, "cost": {"void_crystal": 50, "energy_core": 3, "blueprint": 3}, "unlocked": false},
	"crash_1": {"zone": 0, "level": 1, "cost": {"iron": 10, "biomass": 5}, "unlocked": true},
	"crash_2": {"zone": 0, "level": 2, "cost": {"iron": 25, "biomass": 20}, "unlocked": false},
	"crash_3": {"zone": 0, "level": 3, "cost": {"void_crystal": 20, "energy_core": 1, "blueprint": 1}, "unlocked": false},
	"crash_4": {"zone": 0, "level": 4, "cost": {"void_crystal": 35, "energy_core": 2, "blueprint": 2}, "unlocked": false},
}

const ZONE_NAMES = ["Crash Zone", "极寒区", "熔岩区", "重力异常区"]
const ZONE_ICONS = ["O", "❄", "🔥", "◈"]
const LEVEL_NAMES = ["Lv1 初阶", "Lv2 中阶", "Lv3 高阶", "Lv4 终极"]

func unlock_recipe(recipe_id: String):
	if recipe_id in recipes:
		recipes[recipe_id].unlocked = true

func get_unlocked_recipes_for_zone(zone: int) -> Array:
	var result = []
	for id in recipes:
		if recipes[id].zone == zone and recipes[id].unlocked:
			result.append(id)
	return result
