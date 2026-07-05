extends Node

signal resource_changed(resource_type: String, amount: int)
signal carry_weight_changed(total_weight: float, capacity: float)

# P4 重量系统：每种资源的单位重量（kg/个）。
# 容量 25kg 起步（参考新手期设计），超重会减速 + 加速耗氧（软惩罚，非硬上限）。
const RESOURCE_WEIGHT := {
	"iron": 0.5,
	"void_crystal": 0.3,
	"biomass": 0.2,
	"energy": 0.1,
	"energy_core": 1.0,
	"blueprint": 0.05,
	"oxygen_canister": 1.5,
}
const CARRY_CAPACITY := 25.0

var resources = {
	"iron": 0,
	"void_crystal": 0,
	"biomass": 0,
	"energy": 0,
	"energy_core": 0,
	"blueprint": 0,
	"oxygen_canister": 0
}


func add_resource(type: String, amount: int):
	if type in resources:
		resources[type] += amount
		resource_changed.emit(type, resources[type])
		carry_weight_changed.emit(get_total_weight(), CARRY_CAPACITY)


func has_resources(requirements: Dictionary) -> bool:
	for type in requirements:
		var required := int(requirements[type])
		if required <= 0:
			continue
		if int(resources.get(type, 0)) < required:
			return false
	return true


func consume_resources(requirements: Dictionary) -> bool:
	if not has_resources(requirements):
		return false
	for type in requirements:
		var amount := int(requirements[type])
		if amount <= 0:
			continue
		resources[type] = int(resources.get(type, 0)) - amount
		resource_changed.emit(str(type), int(resources[type]))
	carry_weight_changed.emit(get_total_weight(), CARRY_CAPACITY)
	return true


func reset_resources() -> void:
	for type in resources:
		resources[type] = 0
		resource_changed.emit(str(type), 0)
	carry_weight_changed.emit(0.0, CARRY_CAPACITY)


# P4 重量系统：返回当前总负重（kg）。
func get_total_weight() -> float:
	var total := 0.0
	for type in resources:
		var amount := int(resources[type])
		var unit := float(RESOURCE_WEIGHT.get(type, 0.0))
		total += amount * unit
	return total


# P4 重量系统：返回负重比例（total / capacity）。>1.0 表示超重。
func get_load_ratio() -> float:
	if CARRY_CAPACITY <= 0.0:
		return 0.0
	return get_total_weight() / CARRY_CAPACITY


# P4 重量系统：返回速度倍率（超重线性减速到 0.5x，未超重为 1.0）。
func get_speed_weight_multiplier() -> float:
	var ratio := get_load_ratio()
	if ratio <= 1.0:
		return 1.0
	return maxf(0.5, 1.0 - (ratio - 1.0) * 0.5)


# P4 重量系统：返回氧耗倍率（超重线性加速到 1.5x，未超重为 1.0）。
func get_oxygen_weight_multiplier() -> float:
	var ratio := get_load_ratio()
	if ratio <= 1.0:
		return 1.0
	return 1.0 + (ratio - 1.0) * 0.5
