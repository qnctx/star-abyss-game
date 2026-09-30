class_name NativeSurfaceDeformation
extends RefCounted

## Sparse, canonical impact records. Geometry owners apply offset_at() to their
## base height and commit a record only after the matching mesh and collider land.
const VERSION := 1
const PLANET_RADIUS := NativePlanetCoordinates.DEFAULT_RADIUS
const MIN_RADIUS := 6.0
const MAX_RADIUS := 12.0
const MIN_DEPTH := 1.0
const MAX_DEPTH := 3.0
const MAX_RECORDS := 64
const MIN_SEPARATION := 2.0

var _records: Array[Dictionary] = []
var _centers: Array[Vector3] = []
var _ids: Dictionary = {}


func count() -> int:
	return _records.size()


func clear() -> void:
	_records.clear()
	_centers.clear()
	_ids.clear()


func propose(center_direction: Vector3, radius: float, power: float, source: String, cast_id: String, phase: int = 0) -> Dictionary:
	if not center_direction.is_finite() or center_direction.length_squared() < 0.25:
		return {"valid": false, "reason": "invalid_center"}
	if not is_finite(radius) or radius < MIN_RADIUS or radius > MAX_RADIUS:
		return {"valid": false, "reason": "invalid_radius"}
	if not is_finite(power) or power < 600.0:
		return {"valid": false, "reason": "insufficient_power"}
	if source.is_empty() or cast_id.is_empty() or source.length() > 48 or cast_id.length() > 64 or phase < 0:
		return {"valid": false, "reason": "invalid_identity"}
	var center := center_direction.normalized()
	var impact_id := "%s:%s:%d" % [source, cast_id, phase]
	var depth := clampf(1.0 + (power - 600.0) / 500.0, MIN_DEPTH, MAX_DEPTH)
	var record := {"id": impact_id, "center": [center.x, center.y, center.z], "radius": radius, "depth": depth}
	var check := _check_candidate(record, center, _records, _centers, _ids)
	if not bool(check.valid):
		return check
	return {"valid": true, "record": record}


func commit(record: Dictionary) -> Dictionary:
	var parsed := _parse_record(record)
	if not bool(parsed.get("valid", false)):
		return parsed
	var center: Vector3 = parsed.center
	var clean: Dictionary = parsed.record
	var check := _check_candidate(clean, center, _records, _centers, _ids)
	if not bool(check.valid):
		return check
	_records.append(clean)
	_centers.append(center)
	_ids[clean.id] = true
	return {"valid": true, "record": clean.duplicate(true)}


func offset_at(direction: Vector3) -> float:
	if _records.is_empty() or not direction.is_finite() or direction.length_squared() < 0.25:
		return 0.0
	var sample_direction := direction.normalized()
	for i in range(_records.size()):
		# Chord distance retains metre-scale precision on a 120 km planet.
		# acos(dot) loses this precision for 6 m impacts with float32 vectors.
		var distance := PLANET_RADIUS * sample_direction.distance_to(_centers[i])
		var radius: float = _records[i].radius
		if distance >= radius:
			continue
		var depth: float = _records[i].depth
		var t := distance / radius
		var bowl := -depth * pow(1.0 - t * t, 2.0)
		var rim := 0.0
		if t > 0.65:
			var rim_t := (t - 0.65) / 0.35
			rim = 0.15 * depth * pow(sin(PI * rim_t), 2.0)
		return bowl + rim
	return 0.0


func affects_cap(center_direction: Vector3, cap_radius_metres: float) -> bool:
	if not center_direction.is_finite() or center_direction.length_squared() < 0.25 or not is_finite(cap_radius_metres):
		return false
	var center := center_direction.normalized()
	for i in range(_records.size()):
		if PLANET_RADIUS * center.distance_to(_centers[i]) <= cap_radius_metres + float(_records[i].radius):
			return true
	return false


func snapshot() -> Dictionary:
	return {
		"version": VERSION,
		"planet_id": NativePlanetCoordinates.PLANET_ID,
		"planet_seed": NativePlanetCoordinates.PLANET_SEED,
		"records": _records.duplicate(true),
	}


func restore(raw: Variant) -> Dictionary:
	# Older saves did not have a surface_impacts section.
	if raw == null or raw is Array and raw.is_empty() or raw is Dictionary and raw.is_empty():
		clear()
		return {"valid": true, "count": 0}
	if not raw is Dictionary:
		return {"valid": false, "reason": "invalid_snapshot"}
	if raw.get("version", -1) != VERSION or raw.get("planet_id", "") != NativePlanetCoordinates.PLANET_ID or raw.get("planet_seed", "") != NativePlanetCoordinates.PLANET_SEED:
		return {"valid": false, "reason": "wrong_planet_or_version"}
	var items: Variant = raw.get("records")
	if not items is Array or items.size() > MAX_RECORDS:
		return {"valid": false, "reason": "invalid_record_count"}
	var next_records: Array[Dictionary] = []
	var next_centers: Array[Vector3] = []
	var next_ids: Dictionary = {}
	for item: Variant in items:
		var parsed := _parse_record(item)
		if not bool(parsed.get("valid", false)):
			return parsed
		var check := _check_candidate(parsed.record, parsed.center, next_records, next_centers, next_ids)
		if not bool(check.valid):
			return check
		next_records.append(parsed.record)
		next_centers.append(parsed.center)
		next_ids[parsed.record.id] = true
	_records = next_records
	_centers = next_centers
	_ids = next_ids
	return {"valid": true, "count": _records.size()}


func _parse_record(raw: Variant) -> Dictionary:
	if not raw is Dictionary:
		return {"valid": false, "reason": "invalid_record"}
	var impact_id: Variant = raw.get("id")
	var xyz: Variant = raw.get("center")
	var radius_value: Variant = raw.get("radius")
	var depth_value: Variant = raw.get("depth")
	if not impact_id is String or impact_id.is_empty() or impact_id.length() > 120:
		return {"valid": false, "reason": "invalid_identity"}
	if not xyz is Array or xyz.size() != 3:
		return {"valid": false, "reason": "invalid_center"}
	for component: Variant in xyz:
		if not _is_number(component) or not is_finite(float(component)):
			return {"valid": false, "reason": "invalid_center"}
	if not _is_number(radius_value) or not _is_number(depth_value):
		return {"valid": false, "reason": "invalid_dimensions"}
	var center := Vector3(float(xyz[0]), float(xyz[1]), float(xyz[2]))
	var radius := float(radius_value)
	var depth := float(depth_value)
	if not center.is_finite() or absf(center.length() - 1.0) > 0.001:
		return {"valid": false, "reason": "invalid_center"}
	if not is_finite(radius) or not is_finite(depth) or radius < MIN_RADIUS or radius > MAX_RADIUS or depth < MIN_DEPTH or depth > MAX_DEPTH:
		return {"valid": false, "reason": "invalid_dimensions"}
	center = center.normalized()
	return {"valid": true, "center": center, "record": {"id": impact_id, "center": [center.x, center.y, center.z], "radius": radius, "depth": depth}}


func _check_candidate(record: Dictionary, center: Vector3, records: Array[Dictionary], centers: Array[Vector3], ids: Dictionary) -> Dictionary:
	if ids.has(record.id):
		return {"valid": false, "reason": "duplicate_impact"}
	if records.size() >= MAX_RECORDS:
		return {"valid": false, "reason": "record_budget"}
	for i in range(records.size()):
		if PLANET_RADIUS * center.distance_to(centers[i]) < float(record.radius) + float(records[i].radius) + MIN_SEPARATION:
			return {"valid": false, "reason": "overlapping_impact"}
	return {"valid": true}


func _is_number(value: Variant) -> bool:
	return typeof(value) == TYPE_FLOAT or typeof(value) == TYPE_INT
