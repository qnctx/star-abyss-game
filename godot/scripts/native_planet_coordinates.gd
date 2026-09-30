extends RefCounted
class_name NativePlanetCoordinates

## Authoritative planet positions are Dictionaries of float64 x/y/z values.
## Vector3 is used only at the render/physics edge, after subtracting an
## anchor. This follows playable/src/planet/coordinates.mjs exactly.
const DEFAULT_RADIUS := 120000.0
const PLANET_ID := "star-abyss"
const PLANET_SEED := "star-abyss-planet-v1"
const PLANET_VERSION := 1


static func point(x: float, y: float, z: float) -> Dictionary:
	return {"x": x, "y": y, "z": z}


static func valid(p: Dictionary) -> bool:
	if not p.has("x") or not p.has("y") or not p.has("z"):
		return false
	for axis in ["x", "y", "z"]:
		if typeof(p[axis]) not in [TYPE_FLOAT, TYPE_INT]:
			return false
		var value := float(p[axis])
		if is_nan(value) or is_inf(value):
			return false
	return true


static func add(a: Dictionary, b: Dictionary) -> Dictionary:
	return point(float(a["x"]) + float(b["x"]), float(a["y"]) + float(b["y"]), float(a["z"]) + float(b["z"]))


static func subtract(a: Dictionary, b: Dictionary) -> Dictionary:
	return point(float(a["x"]) - float(b["x"]), float(a["y"]) - float(b["y"]), float(a["z"]) - float(b["z"]))


static func scale(a: Dictionary, factor: float) -> Dictionary:
	return point(float(a["x"]) * factor, float(a["y"]) * factor, float(a["z"]) * factor)


static func dot(a: Dictionary, b: Dictionary) -> float:
	return float(a["x"]) * float(b["x"]) + float(a["y"]) * float(b["y"]) + float(a["z"]) * float(b["z"])


static func length(a: Dictionary) -> float:
	return sqrt(dot(a, a))


static func unit(a: Dictionary) -> Dictionary:
	var magnitude := length(a)
	return scale(a, 1.0 / magnitude) if magnitude > 0.0 and not is_inf(magnitude) else {}


static func to_cartesian(lat: float, lon: float, height: float = 0.0, radius: float = DEFAULT_RADIUS) -> Dictionary:
	var distance := radius + height
	var cos_lat := cos(lat)
	return point(distance * cos_lat * cos(lon), distance * sin(lat), -distance * cos_lat * sin(lon))


static func to_geodetic(canonical: Dictionary, radius: float = DEFAULT_RADIUS) -> Dictionary:
	if not valid(canonical):
		return {}
	var distance := length(canonical)
	if distance <= 0.0:
		return {}
	return {"lat": asin(clampf(float(canonical["y"]) / distance, -1.0, 1.0)), "lon": atan2(-float(canonical["z"]), float(canonical["x"])), "height": distance - radius}


static func tangent_frame(lat: float = 0.0, lon: float = 0.0, radius: float = DEFAULT_RADIUS) -> Dictionary:
	var up := unit(to_cartesian(lat, lon, 0.0, radius))
	var east := point(-sin(lon), 0.0, -cos(lon))
	var south := point(sin(lat) * cos(lon), -cos(lat), -sin(lat) * sin(lon))
	return {"origin": scale(up, radius), "up": up, "east": east, "south": south}


static func local_to_canonical(local: Vector3, frame: Dictionary) -> Dictionary:
	return add(frame["origin"], add(scale(frame["east"], float(local.x)), add(scale(frame["up"], float(local.y)), scale(frame["south"], float(local.z)))))


static func canonical_to_local(canonical: Dictionary, frame: Dictionary) -> Vector3:
	var relative := subtract(canonical, frame["origin"])
	return Vector3(dot(relative, frame["east"]), dot(relative, frame["up"]), dot(relative, frame["south"]))


static func radial_up(canonical: Dictionary) -> Vector3:
	var direction := unit(canonical)
	return Vector3(float(direction.get("x", 0.0)), float(direction.get("y", 1.0)), float(direction.get("z", 0.0)))


static func advance_canonical(canonical: Dictionary, east_metres: float, south_metres: float, up_metres: float) -> Dictionary:
	if not valid(canonical):
		return {}
	var geo := to_geodetic(canonical)
	var distance := length(canonical)
	var next_distance := distance + up_metres
	if next_distance <= 0.0:
		return {}
	var frame := tangent_frame(float(geo["lat"]), float(geo["lon"]), distance)
	var tangent := add(scale(frame["east"], east_metres), scale(frame["south"], south_metres))
	var travel := length(tangent)
	if travel <= 0.0:
		return scale(frame["up"], next_distance)
	var arc := travel / maxf(1.0, distance + up_metres * 0.5)
	var direction := add(scale(frame["up"], cos(arc)), scale(tangent, sin(arc) / travel))
	return scale(unit(direction), next_distance)
