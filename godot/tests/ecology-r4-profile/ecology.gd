extends "res://scripts/native_planet_ecology.gd"

var timings: Dictionary = {}
func note(label: String, started: int) -> void:
	var elapsed := Time.get_ticks_usec()-started
	var row: Dictionary = timings.get(label,{"calls":0,"total_us":0,"max_us":0})
	row.calls += 1
	row.total_us += elapsed
	row.max_us = maxi(row.max_us,elapsed)
	timings[label] = row

var build_samples: Array[Dictionary] = []
func _init() -> void:
	asset_library = preload("res://tests/ecology-r4-profile/assets.gd").new()
func setup(source: Node3D) -> void:
	super.setup(source)
	remove_child(damage_service)
	damage_service.free()
	damage_service = preload("res://tests/ecology-r4-profile/damage.gd").new()
	add_child(damage_service)
	damage_service.setup(self,asset_library)
func _build(tile: Dictionary, player_position: Vector3) -> void:
	var initial_instances := instances
	var initial_triangles := triangles
	var started := Time.get_ticks_usec()
	super._build(tile,player_position)
	var elapsed := Time.get_ticks_usec()-started
	note("_build",started)
	if elapsed>1000:
		build_samples.append({"tile":tile.duplicate(true),"elapsed_us":elapsed,"added_instances":instances-initial_instances,"added_triangles":triangles-initial_triangles})
func profile_snapshot() -> Dictionary:
	return {"ecology":timings.duplicate(true),"damage":damage_service.timings.duplicate(true),"assets":asset_library.timings.duplicate(true),"build_samples":build_samples.duplicate(true),"timing_note":"Nested inclusive timings; do not sum. Residual damage includes candidate traversal and bookkeeping. mesh_load includes resource decoding. Profile wrappers add overhead."}
func reset_profile() -> void:
	timings.clear()
	damage_service.timings.clear()
	asset_library.timings.clear()
	build_samples.clear()

func _select(direction: Vector3) -> void:
	var started := Time.get_ticks_usec()
	super._select(direction)
	note("_select",started)

func _surface(point: Vector3, lod: int) -> Dictionary:
	var started := Time.get_ticks_usec()
	var result = super._surface(point,lod)
	note("_surface_lod_"+str(lod),started)
	return result

func _still_supported(cell: Dictionary) -> bool:
	var started := Time.get_ticks_usec()
	var result = super._still_supported(cell)
	note("_still_supported",started)
	return result
