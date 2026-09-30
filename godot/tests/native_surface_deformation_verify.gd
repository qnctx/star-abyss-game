extends SceneTree

const Deformation = preload("res://scripts/native_surface_deformation.gd")

var _failures: Array[String] = []
var _checks := 0


func _initialize() -> void:
	var field := Deformation.new()
	var center := Vector3.RIGHT
	var proposal := field.propose(center, 10.0, 600.0, "player", "impact-1")
	_check("valid proposal", proposal.get("valid", false))
	_check("proposal is not a committed crater", field.count() == 0 and field.offset_at(center) == 0.0)
	var committed := field.commit(proposal.record)
	_check("commit adds one record", committed.get("valid", false) and field.count() == 1)
	_check("one metre bowl at center", absf(field.offset_at(center) + 1.0) < 0.0001)
	_check("smooth raised rim", field.offset_at(_direction_at(8.25)) > 0.03)
	_check("zero outside finite support", field.offset_at(_direction_at(10.1)) == 0.0 and field.offset_at(Vector3.LEFT) == 0.0)
	_check("affected cap culling", field.affects_cap(_direction_at(30.0), 21.0) and not field.affects_cap(_direction_at(40.0), 21.0))
	_check("same cast cannot apply twice", field.commit(proposal.record).get("reason") == "duplicate_impact")
	var overlap := field.propose(_direction_at(19.0), 10.0, 1000.0, "player", "impact-2")
	_check("overlapping craters rejected", overlap.get("reason") == "overlapping_impact")
	_check("low power rejected", field.propose(Vector3.UP, 10.0, 599.0, "player", "weak").get("reason") == "insufficient_power")
	_check("oversize crater rejected", field.propose(Vector3.UP, 13.0, 1000.0, "player", "big").get("reason") == "invalid_radius")
	var strong := field.propose(Vector3.UP, 12.0, 5000.0, "player", "strong")
	_check("high power depth clamped", strong.get("valid", false) and absf(float(strong.record.depth) - 3.0) < 0.0001)
	_check("second commit", field.commit(strong.record).get("valid", false))
	var encoded := JSON.stringify(field.snapshot())
	var restored := Deformation.new()
	var restore_result := restored.restore(JSON.parse_string(encoded))
	_check("JSON snapshot round trip", restore_result.get("valid", false) and restored.count() == 2 and absf(restored.offset_at(center) + 1.0) < 0.0001)
	var wrong_seed := restored.snapshot()
	wrong_seed["planet_seed"] = "some-other-world"
	_check("seed mismatch leaves existing records", restored.restore(wrong_seed).get("reason") == "wrong_planet_or_version" and restored.count() == 2)
	var bad_record := restored.snapshot()
	bad_record.records[1].depth = 100.0
	_check("invalid restore is atomic", restored.restore(bad_record).get("reason") == "invalid_dimensions" and restored.count() == 2)
	_check("legacy empty save clears", restored.restore([]).get("valid", false) and restored.count() == 0)
	for i in range(Deformation.MAX_RECORDS):
		var theta := float(i) * 0.01
		var direction := Vector3(cos(theta), sin(theta), 0.0)
		var candidate := restored.propose(direction, 6.0, 600.0, "test", str(i))
		if not candidate.get("valid", false) or not restored.commit(candidate.record).get("valid", false):
			_failures.append("record budget fill failed at " + str(i))
			break
	_check("bounded sparse record count", restored.count() == Deformation.MAX_RECORDS)
	_check("budget rejects extra record", restored.propose(Vector3.BACK, 6.0, 600.0, "test", "overflow").get("reason") == "record_budget")
	print("NATIVE_SURFACE_DEFORMATION_JSON=" + JSON.stringify({"checks": _checks, "passed": _checks - _failures.size(), "failures": _failures}))
	quit(0 if _failures.is_empty() else 1)


func _direction_at(metres: float) -> Vector3:
	return Vector3(1.0, metres / Deformation.PLANET_RADIUS, 0.0).normalized()


func _check(name: String, passed: bool) -> void:
	_checks += 1
	if not passed:
		_failures.append(name)
