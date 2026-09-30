extends "res://scripts/native_environment_damage.gd"

var timings: Dictionary = {}
func note(label: String, started: int) -> void:
	var elapsed := Time.get_ticks_usec()-started
	var row: Dictionary = timings.get(label,{"calls":0,"total_us":0,"max_us":0})
	row.calls += 1
	row.total_us += elapsed
	row.max_us = maxi(row.max_us,elapsed)
	timings[label] = row

func damage(query: Dictionary) -> Dictionary:
	var started := Time.get_ticks_usec()
	var result = super.damage(query)
	note("damage",started)
	return result

func _occluder(record: Dictionary, origin: Vector3, point: Vector3, query: Dictionary) -> Dictionary:
	var started := Time.get_ticks_usec()
	var result = super._occluder(record,origin,point,query)
	note("_occluder",started)
	return result

func _materialize(id: String) -> void:
	var started := Time.get_ticks_usec()
	super._materialize(id)
	note("_materialize",started)

func _part_shapes(record: Dictionary, part: String, body: CollisionObject3D, offset := Vector3.ZERO) -> void:
	var started := Time.get_ticks_usec()
	super._part_shapes(record,part,body,offset)
	note("_part_shapes",started)

func _fell_tree(id: String, direction: Vector3) -> void:
	var started := Time.get_ticks_usec()
	super._fell_tree(id,direction)
	note("_fell_tree",started)

func _break_part(id: String, part: String, direction: Vector3, power: float) -> void:
	var started := Time.get_ticks_usec()
	super._break_part(id,part,direction,power)
	note("_break_part",started)

func _clearance(record: Dictionary, world_point: Vector3) -> float:
	var started := Time.get_ticks_usec()
	var result = super._clearance(record,world_point)
	note("_clearance",started)
	return result

func _physical_support(point: Vector3) -> Dictionary:
	var started := Time.get_ticks_usec()
	var result = super._physical_support(point)
	note("_physical_support",started)
	return result

func _resume_support(item: Dictionary) -> void:
	var started := Time.get_ticks_usec()
	super._resume_support(item)
	note("_resume_support",started)
