extends RefCounted

## R3 reference-led geography. All masks have compact, smooth support; this
## chart is inactive at the longitude seam and poles. Units are metres.
const REGIONS: Array[Dictionary] = [
	{"id": "cold", "name": "低温裂谷", "s": -38000.0, "n": -35000.0, "rx": 13000.0, "rz": 8500.0, "angle": -0.45},
	{"id": "volcanic", "name": "赤炉火山矿带", "s": -56000.0, "n": 16000.0, "rx": 16000.0, "rz": 10000.0, "angle": 0.65},
	{"id": "crystal", "name": "镜晶峡谷", "s": -14000.0, "n": 39000.0, "rx": 13000.0, "rz": 7500.0, "angle": -0.6},
	{"id": "storm", "name": "天穹风暴高原", "s": -69000.0, "n": -19000.0, "rx": 16000.0, "rz": 10500.0, "angle": 0.25}
]

static func smooth01(v: float) -> float:
	var t: float = clampf(v, 0.0, 1.0)
	return t * t * t * (t * (t * 6.0 - 15.0) + 10.0)

static func support(radius: float, core: float = 0.25) -> float:
	return 1.0 - smooth01((radius - core) / (1.0 - core))

static func basin(s: float, n: float) -> float:
	# Covers every original corner without inheriting its square ownership mask.
	var x: float = s + 850.0 + 700.0 * sin(n / 2600.0)
	var y: float = n - 400.0 + 500.0 * sin(s / 3100.0)
	var radius: float = Vector2(x / 9800.0, y / 8000.0).length()
	return support(radius, 0.60)

static func geography(s: float, n: float, noise: float) -> Dictionary:
	var extent: float = support(Vector2((s + 29000.0) / 85000.0, n / 71000.0).length(), 0.65)
	# Linked western/northern ridges and broad footslopes, not global corrugation.
	var axis: float = -21000.0 + 0.22 * s + 3800.0 * sin(s / 15000.0)
	var ridge_distance: float = absf(n - axis)
	var belt: float = exp(-pow(ridge_distance / 9200.0, 2.0)) * extent
	var spine: float = pow(0.5 + 0.5 * cos((n - axis) / 1600.0 + sin(s / 5400.0)), 2.0)
	var broken_ridge: float = 0.72 + 0.16 * sin(s / 1600.0 + sin(n / 920.0)) + 0.12 * sin(s / 620.0 + n / 430.0)
	var relief: float = belt * (620.0 + 1000.0 * spine * broken_ridge + 280.0 * noise)
	# A sinuous, continuous canyon cuts the northern belt longitudinally.
	var canyon_axis: float = axis + 1400.0 * sin(s / 4300.0)
	var canyon: float = exp(-pow((n - canyon_axis) / 780.0, 2.0)) * extent
	relief *= 1.0 - canyon * 0.85
	var weights: Dictionary = {"cold": 0.0, "volcanic": 0.0, "crystal": 0.0, "storm": 0.0}
	for region: Dictionary in REGIONS:
		var delta: Vector2 = Vector2(s - float(region.s), n - float(region.n)).rotated(-float(region.angle))
		var warp: float = 430.0 * sin(delta.x / 2500.0) + 180.0 * sin(delta.x / 930.0)
		var radius: float = Vector2(delta.x / float(region.rx), (delta.y + warp) / float(region.rz)).length()
		var weight: float = support(radius, 0.3)
		weights[region.id] = weight
		if weight <= 0.0:
			continue
		# Narrow escarpments, talus benches and eroded strata reproduce the
		# reference's plateau/rift silhouette rather than a smooth bowl.
		var fault_distance: float = absf(delta.y + warp)
		var fault: float = 1.0 - smooth01((fault_distance - 250.0) / 420.0)
		var bench: float = 1.0 - smooth01((fault_distance - 770.0) / 350.0)
		var outcrop: float = (0.5 + 0.5 * sin(delta.x / 240.0 + sin(delta.y / 310.0))) * (0.5 + 0.5 * sin(delta.y / 170.0 + delta.x / 530.0))
		var strata: float = (1.0 - fault) * (35.0 + 70.0 * outcrop) - bench * 55.0
		match String(region.id):
			"cold":
				relief += weight * (780.0 - fault * 620.0 + strata)
			"volcanic":
				var cone: float = exp(-pow(delta.length() / 5100.0, 2.0))
				var caldera: float = exp(-pow(delta.length() / 1250.0, 2.0))
				relief += weight * (450.0 + 1800.0 * cone - 850.0 * caldera - fault * 140.0 + strata)
			"crystal":
				relief += weight * (960.0 - fault * 840.0 + strata)
			"storm":
				relief += weight * (1150.0 - fault * 530.0 + 40.0 * sin(delta.x / 2300.0) + strata * 0.6)
	return {"relief": relief, "mountains": clampf(belt + float(weights.volcanic) + float(weights.cold) * 0.6 + float(weights.crystal) * 0.6 + float(weights.storm) * 0.8, 0.0, 1.0), "weights": weights}

static func islands(s: float, n: float) -> float:
	# Elongated fractured shelf islands; keep the 42 km first-route sea open.
	var chain: float = support((n - 17500.0) / 23000.0 if n >= 17500.0 else (17500.0 - n) / 18000.0, 0.1)
	var axis: float = 46500.0 + 0.19 * n + 1500.0 * sin(n / 4300.0)
	var shelf: float = support(absf(s - axis) / 7800.0, 0.05)
	var blocks: float = smooth01((sin(n / 1850.0 + sin(s / 2200.0)) + 0.42) / 1.1)
	var fracture: float = smooth01(absf(sin((s - axis) / 640.0 + n / 1700.0)) / 0.36)
	return chain * shelf * blocks * fracture * 1150.0

static func river_center(s: float) -> float:
	return 950.0 + 340.0 * sin(s / 2800.0) + 90.0 * sin(s / 810.0)

static func river_channel(s: float, cross: float) -> float:
	var downstream: float = smooth01((s - 20000.0) / 14500.0)
	var center: float = river_center(s)
	var width: float = 100.0 + 220.0 * downstream
	var main: float = exp(-pow((cross - center) / width, 2.0))
	# Tributaries join the same channel with exactly the same downstream head.
	var tributary: float = 0.0
	for join_s: float in [16000.0, 22500.0, 29000.0]:
		var t: float = clampf((join_s - s) / 6500.0, 0.0, 1.0)
		var envelope: float = smooth01((s - (join_s - 6500.0)) / 900.0) * (1.0 - smooth01((s - join_s) / 500.0))
		var branch_center: float = center + 2900.0 * t * t + 180.0 * sin(t * PI)
		tributary = maxf(tributary, exp(-pow((cross - branch_center) / (75.0 + downstream * 50.0), 2.0)) * envelope)
	var delta_center: float = center + 1100.0 * downstream + 90.0 * sin(s / 1100.0) * downstream
	var delta: float = exp(-pow((cross - delta_center) / (80.0 + 140.0 * downstream), 2.0)) * downstream
	return maxf(main, maxf(tributary, delta))
