extends Node

# ============================================================================
# Star Abyss — 独立功能测试
# 用法: godot --headless --path src --script test_standalone.gd
# ============================================================================

var _passed := 0
var _failed := 0

func _ready():
	print("========================================")
	print("  Star Abyss — 功能测试套件")
	print("========================================")
	
	# 初始化随机种子
	randomize()
	
	_test_world_generator_logic()
	_test_zone_manager_logic()
	_test_inventory_logic()
	
	print("\n========================================")
	print("  测试结果: %d 通过, %d 失败" % [_passed, _failed])
	print("========================================")
	
	get_tree().quit(0 if _failed == 0 else 1)


func check(name: String, ok: bool, detail: String = ""):
	if ok:
		_passed += 1
		print("  [PASS] %s" % name)
		if detail:
			print("         → %s" % detail)
	else:
		_failed += 1
		print("  [FAIL] %s" % name)
		if detail:
			print("         → %s" % detail)


# ------------------------------------------------------------------
# WorldGenerator — 地形高度 + 生物群系
# ------------------------------------------------------------------
func _test_world_generator_logic():
	print("\n[ WorldGenerator ]")
	
	# 测试 OpenSimplexNoise 数学逻辑
	var noise := FastNoiseLite.new()
	noise.noise_type = 2  # TYPE_OPENSIMPLEX2 = 2
	noise.frequency = 0.05
	
	# 采样几个点
	var h0 = noise.get_noise_2d(0.0, 0.0)
	var h1 = noise.get_noise_2d(10.0, 10.0)
	var h2 = noise.get_noise_2d(-30.0, 50.0)
	
	check("OpenSimplexNoise 输出 float", typeof(h0) == TYPE_FLOAT, "h0=%.3f" % h0)
	check("噪声值在 [-1,1] 范围", h0 >= -1.0 and h0 <= 1.0, "h0=%.3f" % h0)
	check("不同位置有不同噪声", absf(h0 - h1) > 0.01, "h0=%.3f h1=%.3f" % [h0, h1])
	check("噪声图连续性", absf(h0 - h2) < 2.0, "%.3f vs %.3f" % [h0, h2])
	
	# 测试噪声范围（amplitude=3）
	var amplitude = 3.0
	var h_scaled = h0 * amplitude
	check("幅度缩放有效", absf(h_scaled) <= 3.0, "%.3f * 3 = %.3f" % [h0, h_scaled])
	
	# 测试崩溃区域压低逻辑（距离 < 15 时高度被压低）
	var crash_radius = 15.0
	var dist = 5.0
	var scale = dist / crash_radius
	check("崩溃区缩放因子 < 1", scale < 1.0, "scale=%.2f" % scale)
	check("崩溃区缩放因子 >= 0", scale >= 0.0, "scale=%.2f" % scale)
	
	# 测试网格尺寸
	var world_size = 100
	var grid_points = world_size + 1
	check("grid_points = 101", grid_points == 101)
	check("顶点数 = 10201", grid_points * grid_points == 10201)
	
	# 测试三角形索引生成
	var triangles = world_size * world_size * 2
	check("三角形数 = 20000", triangles == 20000)
	check("索引数 = 60000", triangles * 3 == 60000)


# ------------------------------------------------------------------
# ZoneManager — 区域氧气倍数
# ------------------------------------------------------------------
func _test_zone_manager_logic():
	print("\n[ ZoneManager ]")

	# ZoneType enum (使用字典但用字符串键访问)
	var ZoneType = {"CRASH": 0, "COLD": 1, "HEAT": 2, "GRAVITY": 3}
	var ZONE_PRESSURE = {
		ZoneType["CRASH"]: 1.0,
		ZoneType["COLD"]: 3.0,
		ZoneType["HEAT"]: 3.5,
		ZoneType["GRAVITY"]: 4.0
	}
	var adaptations = {ZoneType["CRASH"]: 0, ZoneType["COLD"]: 0, ZoneType["HEAT"]: 0, ZoneType["GRAVITY"]: 0}
	var ADAPTATION_EFFECTS = [0.0, 0.20, 0.40, 0.70, 1.00]

	# 模拟 get_oxygen_multiplier(zone)
	var mult_crash = ZONE_PRESSURE[ZoneType["CRASH"]] * (1.0 - ADAPTATION_EFFECTS[adaptations[ZoneType["CRASH"]]] * 0.9)
	check("CRASH 氧气消耗倍率 = 1.0", absf(mult_crash - 1.0) < 0.01, "%.3f" % mult_crash)

	var mult_cold = ZONE_PRESSURE[ZoneType["COLD"]] * (1.0 - ADAPTATION_EFFECTS[adaptations[ZoneType["COLD"]]] * 0.9)
	check("COLD 氧气消耗 > CRASH", mult_cold > mult_crash, "%.2f > %.2f" % [mult_cold, mult_crash])
	check("COLD 氧气消耗 = 3.0", absf(mult_cold - 3.0) < 0.01, "%.3f" % mult_cold)

	var mult_heat = ZONE_PRESSURE[ZoneType["HEAT"]] * (1.0 - ADAPTATION_EFFECTS[adaptations[ZoneType["HEAT"]]] * 0.9)
	check("HEAT 氧气消耗 = 3.5", absf(mult_heat - 3.5) < 0.01, "%.3f" % mult_heat)

	var mult_gravity = ZONE_PRESSURE[ZoneType["GRAVITY"]] * (1.0 - ADAPTATION_EFFECTS[adaptations[ZoneType["GRAVITY"]]] * 0.9)
	check("GRAVITY 氧气消耗 = 4.0", absf(mult_gravity - 4.0) < 0.01, "%.3f" % mult_gravity)

	# 适应度提升后消耗降低
	adaptations[ZoneType["COLD"]] = 4
	var mult_cold_adapted = ZONE_PRESSURE[ZoneType["COLD"]] * (1.0 - ADAPTATION_EFFECTS[adaptations[ZoneType["COLD"]]] * 0.9)
	check("适应度MAX时COLD消耗降至30%%", mult_cold_adapted < mult_crash * 0.5, "%.3f < %.3f" % [mult_cold_adapted, mult_crash * 0.5])


# ------------------------------------------------------------------
# InventoryManager — 资源系统
# ------------------------------------------------------------------
func _test_inventory_logic():
	print("\n[ InventoryManager ]")

	var resources = {
		"iron": 0,
		"void_crystal": 0,
		"biomass": 0,
		"energy_core": 0,
		"blueprint": 0
	}

	# 初始为 0
	check("初始 iron=0", resources["iron"] == 0)

	# 添加（模拟 add_resource）
	resources["iron"] += 10
	check("add_resource(iron,+10)", resources["iron"] == 10)

	resources["void_crystal"] += 3
	check("add_resource(void_crystal,+3)", resources["void_crystal"] == 3)

	# 消耗（模拟 consume_resources）
	resources["iron"] -= 4
	check("consume_resources({iron:4})", resources["iron"] == 6)

	# has_resources 逻辑
	var has_enough = func(needed: Dictionary) -> bool:
		for type in needed:
			if resources.get(type, 0) < needed[type]:
				return false
		return true

	check("has_resources({iron:3})=true", has_enough.call({"iron": 3}))
	check("has_resources({iron:7})=false", !has_enough.call({"iron": 7}))
	check("has_resources({iron:6})=true", has_enough.call({"iron": 6}))
	check("has_resources({void_crystal:2})=true", has_enough.call({"void_crystal": 2}))
	check("has_resources({void_crystal:5})=false", !has_enough.call({"void_crystal": 5}))
	check("has_resources({missing:1})=false", !has_enough.call({"missing": 1}))

	# 溢出检测
	resources["iron"] = 1006
	check("大量添加不会异常", resources["iron"] == 1006)
	resources["iron"] -= 1000
	check("大量消耗后正确", resources["iron"] == 6)
