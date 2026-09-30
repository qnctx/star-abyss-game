extends RefCounted
class_name NativePlanetField

## Continuous spherical field, extended from the playable field by the approved
## R3 geography. The old basin retains its exact tangent-plane surface inside
## ±3 km and ownership fades by 4 km; visual basin geography is independent.

const RADIUS: float = 120000.0
const MASK32: int = 0xffffffff
const SEED: String = "star-abyss-planet-v1"
const GeographyR3 = preload("res://scripts/native_planet_field_r3.gd")

var legacy_world: Node
var deformations: NativeSurfaceDeformation
var _seed_hash: int


func _init(world: Node = null) -> void:
	legacy_world = world
	_seed_hash = 2166136261
	for i in range(SEED.length()):
		_seed_hash = ((_seed_hash ^ SEED.unicode_at(i)) * 16777619) & MASK32


static func _smooth01(value: float) -> float:
	var t: float = clampf(value, 0.0, 1.0)
	return t * t * t * (t * (t * 6.0 - 15.0) + 10.0)


static func _mix(a: float, b: float, t: float) -> float:
	return a + (b - a) * t


func _lattice(x: int, y: int, z: int, seed_offset: int) -> float:
	var h: int = (_seed_hash + seed_offset) & MASK32
	h = (h ^ ((x * 374761393) & MASK32) ^ ((y * 668265263) & MASK32) ^ ((z * 2147483647) & MASK32)) & MASK32
	h = ((h ^ (h >> 13)) * 1274126177) & MASK32
	return float((h ^ (h >> 16)) & MASK32) / 4294967295.0


func _noise(p: Vector3, frequency: float, seed_offset: int = 0) -> float:
	var q: Vector3 = p * frequency
	var x: int = floori(q.x)
	var y: int = floori(q.y)
	var z: int = floori(q.z)
	var u: float = _smooth01(q.x - float(x))
	var v: float = _smooth01(q.y - float(y))
	var w: float = _smooth01(q.z - float(z))
	var a: float = _mix(_lattice(x, y, z, seed_offset), _lattice(x + 1, y, z, seed_offset), u)
	var b: float = _mix(_lattice(x, y + 1, z, seed_offset), _lattice(x + 1, y + 1, z, seed_offset), u)
	var c: float = _mix(_lattice(x, y, z + 1, seed_offset), _lattice(x + 1, y, z + 1, seed_offset), u)
	var d: float = _mix(_lattice(x, y + 1, z + 1, seed_offset), _lattice(x + 1, y + 1, z + 1, seed_offset), u)
	return _mix(_mix(a, b, v), _mix(c, d, v), w)


static func _route_z(s: float) -> float:
	return 500.0 * sin(s / 9500.0)


static func _route_profile(s: float) -> float:
	const KNOTS: Array[Vector2] = [Vector2(3000, 60), Vector2(6500, 240), Vector2(14000, 170), Vector2(22000, 90), Vector2(29000, 24), Vector2(35000, 2), Vector2(41000, -180)]
	for i in range(1, KNOTS.size()):
		if s <= KNOTS[i].x:
			var a: Vector2 = KNOTS[i - 1]
			var b: Vector2 = KNOTS[i]
			return _mix(a.y, b.y, _smooth01((s - a.x) / (b.x - a.x)))
	return -180.0


func sample(direction: Vector3, deformation_override: NativeSurfaceDeformation = null) -> Dictionary:
	var p: Vector3 = direction.normalized()
	var continental: float = _noise(p, 3.1)
	var moisture: float = _noise(p, 9.7, 11)
	var temperature: float = clampf(1.0 - absf(p.y) * 0.8 + (_noise(p, 6.0, 31) - 0.5) * 0.2, 0.0, 1.0)
	var ridge: float = 1.0 - absf(_noise(p, 25.0, 7) * 2.0 - 1.0)
	var mountain: float = _smooth01((continental - 0.47) / 0.25) * pow(ridge, 3.0)
	var river: float = exp(-pow((_noise(p, 38.0, 29) - 0.5) / 0.026, 2.0)) * _smooth01((continental - 0.4) / 0.15)
	var height: float = (continental - 0.48) * 7000.0 + mountain * 1400.0 + (_noise(p, 150.0, 3) - 0.5) * 90.0 - river * 28.0
	var s: float = atan2(-p.z, p.x) * RADIUS
	var north_south: float = asin(clampf(-p.y, -1.0, 1.0)) * RADIUS
	var cross: float = north_south - _route_z(s)
	var coast_east: float = 35000.0 + 5500.0 * sin(north_south / 17000.0) + 2200.0 * sin(north_south / 7300.0)
	var plate_radius: float = Vector2((s + 20000.0) / 85000.0, north_south / 72000.0).length()
	var plate_edge: float = 1.0 + 0.08 * sin(atan2(north_south, s + 20000.0) * 3.0) + (_noise(p, 8.0, 63) - 0.5) * 0.12
	var plate: float = 1.0 - _smooth01((plate_radius - (plate_edge - 0.35)) / 0.35)
	var inland: float = 1.0 - _smooth01((s - (coast_east - 15000.0)) / 18000.0)
	var uplift: float = plate * inland
	var basin_apron: float = GeographyR3.basin(s, north_south)
	var geography: Dictionary = GeographyR3.geography(s, north_south, _noise(p, 33.0, 43))
	# Kilometres of open low-relief ground separate the basin from the mountain belts.
	var inland_height: float = 80.0 + (1.0 - basin_apron) * (115.0 + _noise(p, 12.0, 43) * 180.0 + float(geography.relief)) + (_noise(p, 110.0, 59) - 0.5) * 12.0
	height = _mix(height, inland_height, uplift)
	mountain = _mix(mountain, float(geography.mountains), uplift)
	var eastern_sea: float = _smooth01((s - (coast_east - 2000.0)) / 11000.0) * (1.0 - _smooth01((s - 95000.0) / 25000.0)) * (1.0 - _smooth01((absf(north_south) - 22000.0) / 42000.0))
	height = _mix(height, -250.0 - _smooth01((s - coast_east) / 30000.0) * 850.0 + (_noise(p, 16.0, 83) - 0.5) * 90.0, eastern_sea)
	height += GeographyR3.islands(s, north_south) * eastern_sea
	var route_blend: float = _smooth01((s - 2700.0) / 1300.0) * (1.0 - _smooth01((s - 42000.0) / 8000.0)) * (1.0 - _smooth01((absf(cross) - 1800.0) / 7200.0))
	var channel: float = GeographyR3.river_channel(s, cross)
	if route_blend > 0.0:
		var shoulder: float = 1.0 - exp(-pow(maxf(0.0, absf(cross) - 600.0) / 1600.0, 2.0))
		height = _mix(height, _route_profile(s) - channel * 8.0 + shoulder * mountain * 280.0, route_blend)
		moisture = _mix(moisture, _mix(0.25, 0.9, _smooth01((s - 8000.0) / 19000.0)), route_blend)
		river = _mix(river, channel, route_blend)
	# Branches may leave the route's flat centre; carve a connected floodplain
	# to the same monotonic head rather than putting water on a higher shoulder.
	var drainage: float = _smooth01((s - 5900.0) / 600.0) * (1.0 - _smooth01((s - 35000.0) / 1000.0))
	var floodplain: float = 1.0 - _smooth01((absf(cross - 1600.0) - 1700.0) / 2600.0)
	var drainage_blend: float = drainage * floodplain
	if drainage_blend > 0.0:
		var bed: float = _route_profile(s) - 3.0 - channel * 6.0 + (1.0 - channel) * 3.0
		height = _mix(height, minf(height, bed), drainage_blend)
		river = maxf(river, channel * drainage_blend)
	var legacy_weight: float = 0.0
	if legacy_world != null and p.x > 0.5:
		var tx: float = -p.z * RADIUS / p.x
		var tz: float = -p.y * RADIUS / p.x
		if maxf(absf(tx), absf(tz)) < 4000.0:
			var base_method := "base_height_at" if legacy_world.has_method("base_height_at") else "height_at"
			var old_height: float = legacy_world.call(base_method, tx, tz)
			for i in range(12):
				old_height = legacy_world.call(base_method, tx * (1.0 + old_height / RADIUS), tz * (1.0 + old_height / RADIUS))
			var lx: float = tx * (1.0 + old_height / RADIUS)
			var lz: float = tz * (1.0 + old_height / RADIUS)
			legacy_weight = 1.0 - _smooth01((maxf(absf(lx), absf(lz)) - 3000.0) / 1000.0)
			height = _mix(height, (RADIUS + old_height) / p.x - RADIUS, legacy_weight)
	var active_deformations: NativeSurfaceDeformation = deformation_override if deformation_override != null else deformations
	if active_deformations != null and active_deformations.count() > 0:
		height += active_deformations.offset_at(p)
	var ocean: float = 1.0 - _smooth01((height + 40.0) / 80.0)
	var coast: float = exp(-pow(height / 95.0, 2.0))
	var wetland: float = moisture * exp(-pow((height - 65.0) / 170.0, 2.0)) * (1.0 - ocean)
	var forest: float = moisture * temperature * (1.0 - mountain) * (1.0 - ocean)
	var basin_weight: float = basin_apron
	var water_height: Variant = null
	if legacy_weight != 1.0:
		if drainage_blend > 0.001 and s >= 6499.9 and s <= 35000.1:
			water_height = maxf(0.0, _route_profile(s) - 3.0)
		elif height < 0.0:
			water_height = 0.0
	var water_depth: float = 0.0 if water_height == null else maxf(0.0, float(water_height) - height)
	var special: Dictionary = geography.weights
	return {"height": height, "moisture": moisture, "temperature": temperature, "river": river, "mountains": mountain * (1.0 - ocean), "ocean": ocean, "coast": coast, "wetland": wetland, "forest": forest, "basin": basin_weight, "legacy_weight": legacy_weight, "uplift": uplift, "water_height": water_height, "water_depth": water_depth, "route_s": s, "cold": special.cold, "volcanic": special.volcanic, "crystal": special.crystal, "storm": special.storm}


func landmark_regions() -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for region: Dictionary in GeographyR3.REGIONS:
		var direction: Vector3 = route_direction(float(region.s), float(region.n) - _route_z(float(region.s)))
		var canonical: Vector3 = surface_point(direction)
		result.append({"id": region.id, "name": region.name, "reference": "docs/art/planet-review-r3/12-special-regions.png", "position": Vector3(-canonical.z, canonical.x - RADIUS, -canonical.y), "direction": direction, "canonical": canonical})
	return result


func surface_point(direction: Vector3) -> Vector3:
	var p: Vector3 = direction.normalized()
	return p * (RADIUS + float(sample(p).height))


func route_direction(s: float, cross_offset: float = 0.0) -> Vector3:
	var cross: float = (_route_z(s) + cross_offset) / RADIUS
	var along: float = s / RADIUS
	return Vector3(cos(along) * cos(cross), -sin(cross), -sin(along) * cos(cross)).normalized()
