extends SceneTree

const Field = preload("res://scripts/native_planet_field.gd")
const Geography = preload("res://scripts/native_planet_field_r3.gd")
const World = preload("res://scripts/native_world.gd")
var failures: Array[String] = []
var checks: int = 0

func check(label: String, valid: bool) -> void:
	checks += 1
	if not valid:
		failures.append(label)

func _initialize() -> void:
	var world = World.new()
	var field = Field.new(world)
	var bare = Field.new()
	var baseline_script := GDScript.new()
	baseline_script.source_code = FileAccess.get_file_as_string("res://../docs/development/planet-field-r3-baseline/native_planet_field.gd.txt").replace("class_name NativePlanetField", "")
	check("baseline compiles", baseline_script.reload() == OK)
	var baseline = baseline_script.new(world)
	var baseline_max: float = 0.0
	var legacy_max: float = 0.0
	for x in range(-2990, 2991, 230):
		for z in range(-2990, 2991, 230):
			var old: float = world.height_at(x, z)
			var p: Vector3 = Vector3(Field.RADIUS + old, -z, -x).normalized()
			var value: Dictionary = field.sample(p)
			baseline_max = maxf(baseline_max, absf(float(value.height) - float(baseline.sample(p).height)))
			var scene: Vector3 = p * (Field.RADIUS + float(value.height))
			legacy_max = maxf(legacy_max, absf(scene.x - Field.RADIUS - old))
			check("legacy ownership %s,%s" % [x,z], is_equal_approx(float(value.legacy_weight), 1.0))
			check("dry original basin %s,%s" % [x,z], value.water_height == null)
			check("basin independent of legacy %s,%s" % [x,z], value.basin == bare.sample(p).basin)
	check("legacy exact surface within float32 3 cm", legacy_max < 0.03)
	check("legacy radial height exactly equals saved baseline", baseline_max == 0.0)
	var basin_corners: Array[float] = []
	for x: float in [-3000.0,3000.0]:
		for z: float in [-3000.0,3000.0]:
			var direction: Vector3 = Vector3(Field.RADIUS + world.height_at(x,z),-z,-x).normalized()
			var weight: float = float(field.sample(direction).basin)
			basin_corners.append(weight)
			check("visual basin fully covers old corner %s:%s" % [x,z], weight >= 0.995)
	var max_slope: float = 0.0
	var last_h: float = float(field.sample(field.route_direction(4000.0)).height)
	for s in range(4050, 42001, 50):
		var value: Dictionary = field.sample(field.route_direction(s))
		max_slope = maxf(max_slope, absf(float(value.height) - last_h) / 50.0)
		last_h = float(value.height)
	check("first-route longitudinal slope under 12 degrees", max_slope < tan(deg_to_rad(12.0)))
	var last_head: float = INF
	var min_depth: float = INF
	for s in range(6500, 35001, 50):
		var value: Dictionary = field.sample(field.route_direction(s, Geography.river_center(s)))
		check("continuous river water %s" % s, value.water_height != null)
		if value.water_height != null:
			check("river downhill %s" % s, float(value.water_height) <= last_head + 0.01)
			last_head = float(value.water_height)
		min_depth = minf(min_depth, float(value.water_depth))
	check("river never blocked by dry bed", min_depth > 2.0)
	var sea: Dictionary = field.sample(field.route_direction(42000.0))
	check("42 km ocean", sea.water_height != null and float(sea.water_depth) > 80.0)
	for s: float in [8000.0,17000.0,27000.0,34000.0]:
		var route: Dictionary = field.sample(field.route_direction(s))
		check("land route remains dry %s" % s, float(route.water_depth) < 0.15)
	var landmarks: Array[Dictionary] = field.landmark_regions()
	check("four landmarks", landmarks.size() == 4)
	for region: Dictionary in landmarks:
		var value: Dictionary = field.sample(region.direction)
		check("region peak " + region.id, float(value[region.id]) > 0.99)
		check("region not ocean " + region.id, float(value.height) > 100.0)
		check("region scene conversion " + region.id, region.position.distance_to(Vector3(-region.canonical.z, region.canonical.x - Field.RADIUS, -region.canonical.y)) < 0.01)
		check("region away from legacy " + region.id, float(value.legacy_weight) == 0.0)
	# Seams, poles and cube-edge directions use the identical field on both sides.
	var seam_max: float = 0.0
	for p: Vector3 in [Vector3(-1,0,0), Vector3(0,1,0), Vector3(0,-1,0), Vector3(1,1,0), Vector3(1,0,1), Vector3(0,1,1)]:
		for offset: Vector3 in [Vector3(0.000001,0,0),Vector3(0,0.000001,0),Vector3(0,0,0.000001)]:
			seam_max = maxf(seam_max, absf(float(field.sample((p+offset).normalized()).height) - float(field.sample((p-offset).normalized()).height)))
	check("sphere seam local continuity under 1 metre", seam_max < 1.0)
	var plains_slope: float = 0.0
	for s in range(-10000, 14001, 600):
		for n in range(9000, 18001, 600):
			var a: float = float(field.sample(field.route_direction(s,n-Field._route_z(s))).height)
			var b: float = float(field.sample(field.route_direction(s+30,n-Field._route_z(s+30))).height)
			var c: float = float(field.sample(field.route_direction(s,n+30-Field._route_z(s))).height)
			plains_slope = maxf(plains_slope, Vector2(b-a,c-a).length()/30.0)
	check("broad southern plains under 8 degrees", plains_slope < tan(deg_to_rad(8.0)))
	var island_land: int = 0
	var island_sea: int = 0
	for s in range(45000, 58001, 500):
		for n in range(9000, 26001, 500):
			var value: Dictionary = field.sample(field.route_direction(s,n-Field._route_z(s)))
			if float(value.height) > 20.0:
				island_land += 1
			elif float(value.water_depth) > 10.0:
				island_sea += 1
	check("fractured island chain has land and sea", island_land > 30 and island_sea > 30)
	for latitude in range(-85, 86, 10):
		for longitude in range(-180, 180, 10):
			var lat: float = deg_to_rad(latitude)
			var lon: float = deg_to_rad(longitude)
			var value: Dictionary = field.sample(Vector3(cos(lat)*cos(lon),sin(lat),cos(lat)*sin(lon)))
			check("finite global terrain", is_finite(float(value.height)))
			for key: String in ["cold","volcanic","crystal","storm","basin","legacy_weight"]:
				check("bounded global " + key, float(value[key]) >= 0.0 and float(value[key]) <= 1.0)
	# River branches remain wet right up to their junctions.
	for join_s: float in [16000.0,22500.0,29000.0]:
		for back in range(0, 4501, 100):
			var s: float = join_s - back
			var t: float = float(back) / 6500.0
			var cross: float = Geography.river_center(s) + 2900.0*t*t + 180.0*sin(t*PI)
			check("wet tributary %s:%s" % [join_s,back], float(field.sample(field.route_direction(s,cross)).water_depth) > 1.0)
	var cameras: Array[Dictionary] = []
	for region: Dictionary in landmarks:
		var d: Vector3 = region.direction
		var up: Vector3 = Vector3(-d.z,d.x,-d.y)
		var east: Vector3 = Vector3(d.x,d.z,0.0).normalized()
		cameras.append({"id":region.id,"position":region.position + up*1800.0 + east*2500.0,"target":region.position,"up":up,"fov":60.0,"far":30000.0})
	var result: Dictionary = {"checks":checks,"failures":failures,"legacy_max_error_m":legacy_max,"baseline_height_difference_m":baseline_max,"basin_corner_weights":basin_corners,"route_max_slope":max_slope,"plains_max_slope":plains_slope,"river_min_depth_m":min_depth,"sphere_seam_max_m":seam_max,"island_land_samples":island_land,"island_sea_samples":island_sea,"landmarks":landmarks,"scene_cameras":cameras}
	print("R3_FIELD_RESULT=" + JSON.stringify(result))
	var report := FileAccess.open("res://../docs/development/planet-field-r3-results.json", FileAccess.WRITE)
	report.store_string(JSON.stringify(result,"\t"))
	world.free()
	quit(0 if failures.is_empty() else 1)
