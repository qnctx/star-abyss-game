extends Node

# ============================================================================
# Star Abyss — 内嵌功能测试
# 由 main.tscn 的 SystemTest 节点驱动
# ============================================================================

var _passed := 0
var _failed := 0
var _log_lines: Array = []

signal tests_complete(passed: int, failed: int)


func _ready():
	_log("========================================")
	_log("  Star Abyss — 功能测试套件")
	_log("========================================")

	# 直接调用，不 await（headless 模式下 await process_frame 会失效）
	_run_all_tests()

	_log("========================================")
	_log("  测试结果: %d 通过, %d 失败" % [_passed, _failed])
	_log("========================================")

	_write_log_to_file()
	get_tree().quit(0 if _failed == 0 else 1)


func _log(msg: String):
	_log_lines.append(msg)
	print(msg)


func _write_log_to_file():
	var path = "/tmp/star_abyss_test_results.log"
	var f := FileAccess.open(path, FileAccess.WRITE)
	if f:
		for line in _log_lines:
			f.store_line(line)
		f.close()


func check(name: String, condition: bool, detail: String = ""):
	if condition:
		_passed += 1
		_log("[PASS] " + name + ((" → " + detail) if detail else ""))
	else:
		_failed += 1
		_log("[FAIL] " + name + ((" → " + detail) if detail else ""))


func check_eq(a, b, name: String, detail: String = ""):
	var ok = typeof(a) == typeof(b) and a == b
	if ok:
		_passed += 1
		_log("[PASS] " + name + ((" → " + detail) if detail else ""))
	else:
		_failed += 1
		_log("[FAIL] " + name + (" (expected %s, got %s)" % [str(b), str(a)]))


# ============================================================================
# 测试分组
# ============================================================================

func _run_all_tests():
	_test_world_generator()
	_test_zone_manager()
	_test_inventory_manager()
	_test_serum_recipes()
	_test_scene_files()


# ------------------------------------------------------------------
# WorldGenerator — 地形 + 资源生成
# ------------------------------------------------------------------
func _test_world_generator():
	_log("[ WorldGenerator ]")

	check("WorldGenerator 是 Node", WorldGenerator is Node)
	check("_noise 存在", WorldGenerator._noise != null)
	check("WORLD_SIZE = 100", WorldGenerator.WORLD_SIZE == 100)
	check("NOISE_AMPLITUDE = 3.0", absf(WorldGenerator.NOISE_AMPLITUDE - 3.0) < 0.01)

	# 地形高度在范围内
	var h0 = WorldGenerator.get_height_at(Vector2(0, 0))
	check("高度在范围内", h0 >= -4.0 and h0 <= 4.0, "h=%.2f" % h0)

	# 不同位置高度有变化
	var h1 = WorldGenerator.get_height_at(Vector2(50, 50))
	var h2 = WorldGenerator.get_height_at(Vector2(-30, 20))
	check("高度有变化", absf(h0 - h1) > 0.01 or absf(h1 - h2) > 0.01,
		"h0=%.2f h1=%.2f h2=%.2f" % [h0, h1, h2])

	# 区域判定
	var biome = WorldGenerator.get_biome_at(Vector2(0, 0))
	check("生物群系 biome 是 int", typeof(biome) == TYPE_INT, "biome=%d" % biome)
	check("原点 biome 有效 (0-4)", biome >= 0 and biome <= 4, "biome=%d" % biome)


# ------------------------------------------------------------------
# ZoneManager — 区域切换 + 氧气倍数
# ------------------------------------------------------------------
func _test_zone_manager():
	_log("[ ZoneManager ]")

	check("ZoneManager 是 Node", ZoneManager is Node)
	check("ZoneType 枚举存在", "CRASH" in ZoneManager.ZoneType)

	# 默认区域是 CRASH
	check("默认区域=CRASH", ZoneManager.current_zone == ZoneManager.ZoneType.CRASH)

	# 切换到 COLD，氧气消耗倍率应为 3.0
	ZoneManager.current_zone = ZoneManager.ZoneType.COLD
	var mult = ZoneManager.get_oxygen_multiplier()
	check("COLD 氧气消耗 = 3.0", absf(mult - 3.0) < 0.01, "%.2f" % mult)

	# 切换到 HEAT，消耗应更高
	ZoneManager.current_zone = ZoneManager.ZoneType.HEAT
	var heat_mult = ZoneManager.get_oxygen_multiplier()
	check("HEAT 氧气消耗 > COLD", heat_mult > mult, "%.2f > %.2f" % [heat_mult, mult])

	# 适应度机制：直接修改 adaptations 字典来模拟适应
	ZoneManager.current_zone = ZoneManager.ZoneType.COLD
	var cold_base = ZoneManager.get_oxygen_multiplier()
	ZoneManager.adaptations[ZoneManager.ZoneType.COLD] = 4
	var cold_adapted = ZoneManager.get_oxygen_multiplier()
	check("适应后消耗降低", cold_adapted < cold_base,
		"%.2f → %.2f" % [cold_base, cold_adapted])


# ------------------------------------------------------------------
# InventoryManager — 资源管理
# ------------------------------------------------------------------
func _test_inventory_manager():
	_log("[ InventoryManager ]")

	check("InventoryManager 是 Node", InventoryManager is Node)
	check("resources 是 Dictionary", typeof(InventoryManager.resources) == TYPE_DICTIONARY)

	# 初始铁为 0
	var iron_before = InventoryManager.resources.get("iron", 0)
	check("初始 iron >= 0", iron_before >= 0)

	# 添加资源
	InventoryManager.add_resource("iron", 10)
	var iron_after = InventoryManager.resources.get("iron", 0)
	check("add_resource(iron,+10) 正确", iron_after == iron_before + 10,
		"%d → %d" % [iron_before, iron_after])

	# 消耗资源
	InventoryManager.consume_resources({"iron": 3})
	var iron_consumed = InventoryManager.resources.get("iron", 0)
	check("consume_resources({iron:3}) 正确", iron_consumed == iron_after - 3,
		"%d → %d" % [iron_after, iron_consumed])

	# has_resources
	check("has_resources({iron:1})=true", InventoryManager.has_resources({"iron": 1}))
	check("has_resources({iron:99999})=false", !InventoryManager.has_resources({"iron": 99999}))

	# 新增资源类型
	InventoryManager.add_resource("void_crystal", 5)
	check("void_crystal 新增成功", InventoryManager.resources.get("void_crystal", 0) == 5)


# ------------------------------------------------------------------
# SerumRecipes — 配方系统
# ------------------------------------------------------------------
func _test_serum_recipes():
	_log("[ SerumRecipes ]")

	check("SerumRecipes 是 Node", SerumRecipes is Node)
	check("ZONE_NAMES 长度=4", SerumRecipes.ZONE_NAMES.size() == 4)
	check("LEVEL_NAMES 长度=4", SerumRecipes.LEVEL_NAMES.size() == 4)
	check("recipes 数量 >= 12", SerumRecipes.recipes.size() >= 12,
		"recipes=%d" % SerumRecipes.recipes.size())
	check("crash_1 已解锁", SerumRecipes.recipes["crash_1"].get("unlocked", false) == true)


# ------------------------------------------------------------------
# 场景文件完整性
# ------------------------------------------------------------------
func _test_scene_files():
	_log("[ 场景文件验证 ]")

	var scenes_to_check = [
		"res://scenes/resource_node.tscn",
		"res://scenes/player_projectile.tscn",
		"res://scenes/vfx_toxic_spores.tscn",
	]

	for scene_path in scenes_to_check:
		var exists = ResourceLoader.exists(scene_path)
		check("文件存在: %s" % scene_path.get_file(), exists, scene_path)
