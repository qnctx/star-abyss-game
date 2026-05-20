extends Node

signal resource_changed(resource_type: String, amount: int)

var resources = {
	"iron": 0,
	"void_crystal": 0,
	"biomass": 0,
	"energy_core": 0,
	"blueprint": 0
}


func add_resource(type: String, amount: int):
	if type in resources:
		resources[type] += amount
		resource_changed.emit(type, resources[type])


func has_resources(requirements: Dictionary) -> bool:
	for type in requirements:
		if resources.get(type, 0) < requirements[type]:
			return false
	return true


func consume_resources(requirements: Dictionary):
	for type in requirements:
		resources[type] -= requirements[type]
		resource_changed.emit(type, resources[type])
