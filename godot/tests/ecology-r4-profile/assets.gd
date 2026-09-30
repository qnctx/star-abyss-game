extends "res://scripts/native_environment_damage_assets.gd"

var timings: Dictionary = {}
func note(label: String, started: int) -> void:
	var elapsed := Time.get_ticks_usec()-started
	var row: Dictionary = timings.get(label,{"calls":0,"total_us":0,"max_us":0})
	row.calls += 1
	row.total_us += elapsed
	row.max_us = maxi(row.max_us,elapsed)
	timings[label] = row

func mesh_named(key: String) -> ArrayMesh:
	var cached := parts.has(key)
	var started := Time.get_ticks_usec()
	var result := super.mesh_named(key)
	note("mesh_cached" if cached else "mesh_load",started)
	return result
