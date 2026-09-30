extends SceneTree

var checks: Array[Dictionary] = []
var failures: Array[String] = []


func _initialize() -> void:
	var c := NativePlanetCoordinates
	var old_frame := c.tangent_frame()
	var legacy := Vector3(1370.0, 2.5, -1022.0)
	var canonical := c.local_to_canonical(legacy, old_frame)
	_check("legacy basin maps to authoritative double coordinates", c.valid(canonical) and absf(float(canonical["x"]) - 120002.5) < 0.000001 and absf(float(canonical["y"]) - 1022.0) < 0.000001 and absf(float(canonical["z"]) + 1370.0) < 0.000001)
	_check("legacy tangent round trip", c.canonical_to_local(canonical, old_frame).distance_to(legacy) < 0.0002)
	var opposite := c.to_cartesian(0.0, PI, 3509.852)
	var geo := c.to_geodetic(opposite)
	_check("backside height and longitude", absf(float(geo["height"]) - 3509.852) < 0.000001 and absf(absf(float(geo["lon"])) - PI) < 0.000001)
	for lat in [PI * 0.5 - 0.000001, -PI * 0.5 + 0.000001]:
		var polar := c.to_cartesian(lat, 1.2, 3.0)
		var readback := c.to_geodetic(polar)
		_check("polar geodetic round trip " + str(lat), absf(float(readback["lat"]) - lat) < 0.000001 and absf(float(readback["lon"]) - 1.2) < 0.000001 and absf(float(readback["height"]) - 3.0) < 0.000001)
	var equator := c.to_cartesian(0.0, 0.0)
	var east_ten := c.advance_canonical(equator, 10.0, 0.0, 0.0)
	_check("east arc keeps radial altitude", absf(c.length(east_ten) - c.DEFAULT_RADIUS) < 0.000001 and float(east_ten["z"]) < -9.999)
	var behind := c.advance_canonical(equator, PI * c.DEFAULT_RADIUS, 0.0, 0.0)
	_check("arc crosses old boundary to backside", float(behind["x"]) < -119999.999 and absf(c.length(behind) - c.DEFAULT_RADIUS) < 0.000001)
	var backside_frame := c.tangent_frame(0.0, PI)
	var nearby := c.advance_canonical(behind, 2.0, 3.0, 4.0)
	var near_local := c.canonical_to_local(nearby, backside_frame)
	_check("backside local physics remains near floating anchor", near_local.length() < 6.0 and absf(near_local.y - 4.0) < 0.001, str(near_local))
	print("NATIVE_PLANET_COORDINATES_JSON=" + JSON.stringify({"total": checks.size(), "passed": checks.size() - failures.size(), "failures": failures, "checks": checks}))
	quit(0 if failures.is_empty() else 1)


func _check(name: String, passed: bool, detail: String = "") -> void:
	checks.append({"name": name, "pass": passed, "detail": detail})
	if not passed:
		failures.append(name + ": " + detail)
