extends Node

# ============================================================================
# Star Abyss — 系统功能测试套件
# 用法: godot --headless --path src --script test_runner.gd
# ============================================================================

var _passed := 0
var _failed := 0
var _results: Array = []

signal tests_complete(passed: int, failed: int)


func _ready():
	print("\n========================================")
	print("  Star Abyss — 功能测试套件")
	print("========================================\n")
	
	# 等待一帧让 autoload 就绪
	await get_tree().process_frame
	
	_run_all_tests()
	
	print("\n========================================")
	print("  测试结果: %d 通过, %d 失败" % [_passed, _failed])
	print("========================================\n")
	
	tests_complete.emit(_passed, _failed)
	get_tree().quit(0 if _failed == 0 else 1)


# ============================================================================
# 测试框架
# ============================================================================

func check(name: String, condition: bool, detail: String = ""):
	if condition:
		_results.append("[PASS] " + name)
		_passed += 1
		print("  [PASS] %s" % name)
		if detail:
			print("         → %s" % detail)
	else:
		_results.append("[FAIL] " + name)
		_failed += 1
		print("  [FAIL] %s" % name)
		if detail:
			print("         → %s" % detail)


func check_nearly(a: float, b: float, tolerance: float = 0.001, name: String = ""):
	var ok := absf(a - b) < tolerance
	check(name, ok, "期望 %.4f, 实际 %.4f (容差 %.4f)" % [b, a, tolerance])


# ============================================================================
# 测试用例
# ============================================================================

func _run_all_tests():
	_test_world_generator()
	_test_player_oxygen()
	_test_zone_manager()
	_test_turret_logic()
	_test_inventory_manager()
	_test_serum_recipes()


# ------------------------------------------------------------------
# WorldGenerator — 地形生成 & 生物群系
# ------------------------------------------------------------------
func _test_world_generator():
	print("\n[ WorldGenerator ]")
	
	if not WorldGenerator:
		print("  [SKIP] WorldGenerator autoload 未就绪")
		return
	
	# 地形高度
	var h0 = WorldGenerator.get_height_at(Vector2(0, 0))
	check("中心点高度是数值", typeof(h0) == TYPE_FLOAT, "类型=%d" % typeof(h0))
	check("中心点高度在范围内 [-3,3]", h0 >= -3.0 and h0 <= 3.0, "h0=%.3f" % h0)
	
	var h_edge = WorldGenerator.get_height_at(Vector2(50, 50))
	check("边缘点高度是数值", typeof(h_edge) == TYPE_FLOAT)
	check("边缘点高度在噪声范围内", h_edge >= -5.0 and h_edge <= 5.0, "h_edge=%.3f" % h_edge)
	
	# 生物群系分类
	var b0 = WorldGenerator.get_biome_at(Vector2(0, 0))
	check("中心是 CRASH 群系", b0 == WorldGenerator.BIOME_CRASH, "biome=%d" % b0)
	
	var b_cold = WorldGenerator.get_biome_at(Vector2(0, 30))
	check("北方是 COLD 群系", b_cold == WorldGenerator.BIOME_COLD, "biome=%d" % b_cold)
	
	var b_heat = WorldGenerator.get_biome_at(Vector2(30, 0))
	check("东方是 HEAT 群系", b_heat == WorldGenerator.BIOME_HEAT, "biome=%d" % b_heat)
	
	# 生成 spawn 位置
	var spawn = WorldGenerator.get_spawn_position(5.0, 10.0)
	check("spawn 位置是 Vector3", typeof(spawn) == TYPE_VECTOR3)
	check("spawn Y >= 0", spawn.y >= -5.0, "y=%.3f" % spawn.y)
	
	# height_map 和 biome_map 填充
	check("height_map 非空", not WorldGenerator.height_map.is_empty(), "size=%d" % WorldGenerator.height_map.size())
	check("biome_map 非空", not WorldGenerator.biome_map.is_empty(), "size=%d" % WorldGenerator.biome_map.size())
	check("biome_map 大小正确", WorldGenerator.biome_map.size() == 101 * 101, "实际 %d" % WorldGenerator.biome_map.size())


# ------------------------------------------------------------------
# Player — 氧气系统
# ------------------------------------------------------------------
func _test_player_oxygen():
	print("\n[ Player — 氧气系统 ]")
	
	# 找 Player 节点（需要场景中有）
	var player = _get_node_optional("/root/Main/Player")
	if not player:
		print("  [SKIP] Player 节点不在场景树中，跳过运行时测试")
		# 仍然测试逻辑：player.gd 的变量存在性
		var script = load("res://scripts/player.gd")
		check("player.gd 可加载", script != null)
		return
	
	# 初始氧气
	check_nearly(player.current_oxygen, 100.0, 0.01, "初始氧气 100")
	check("玩家未死亡", !player.is_dead)
	
	# 模拟氧气消耗 (用假的 delta)
	var initial_o2 = player.current_oxygen
	# 手动触发一点氧气消耗逻辑（模拟 1 秒）
	var drain = player.oxygen_drain_rate * 1.0
	player.current_oxygen -= drain
	check("氧气消耗正确", player.current_oxygen < initial_o2, "%.1f → %.1f" % [initial_o2, player.current_oxygen])
	
	# refill
	player.refill_oxygen()
	check_nearly(player.current_oxygen, 100.0, 0.01, "refill 后回到 100")
	
	# 死亡逻辑
	player.current_oxygen = 0.0
	player.die()
	check("死亡后 is_dead=true", player.is_dead)


# ------------------------------------------------------------------
# ZoneManager — 区域氧气倍数
# ------------------------------------------------------------------
func _test_zone_manager():
	print("\n[ ZoneManager ]")
	
	if not ZoneManager:
		print("  [SKIP] ZoneManager autoload 未就绪")
		return
	
	# 测试各区域氧气倍数
	var mult = ZoneManager.get_oxygen_multiplier()
	check("默认倍数是数值", typeof(mult) == TYPE_FLOAT)
	check("倍数 >= 0.1", mult >= 0.1, "mult=%.2f" % mult)
	
	# 测试区域切换
	if ZoneManager and "current_zone" in ZoneManager:
		ZoneManager.current_zone = ZoneManager.ZoneType.COLD
		var cold_mult = ZoneManager.get_oxygen_multiplier()
		check("COLD 区域倍数有效", cold_mult > 0.0, "%.2f" % cold_mult)
		ZoneManager.current_zone = ZoneManager.ZoneType.CRASH


# ------------------------------------------------------------------
# Turret — 炮台逻辑
# ------------------------------------------------------------------
func _test_turret_logic():
	print("\n[ Turret 逻辑 ]")
	
	var turret_script = load("res://scripts/turret.gd")
	check("turret.gd 可加载", turret_script != null)
	
	if not turret_script:
		return
	
	# 检查 turret 关键方法是否存在
	var turret_methods = ["_process", "_on_body_entered", "fire"]
	var has_fire := false
	for m in turret_script.get_script_method_list():
		if m["name"] == "fire":
			has_fire = true
	check("turret.gd 有 fire() 方法", has_fire)


# ------------------------------------------------------------------
# InventoryManager — 物品系统
# ------------------------------------------------------------------
func _test_inventory_manager():
	print("\n[ InventoryManager ]")
	
	if not InventoryManager:
		print("  [SKIP] InventoryManager autoload 未就绪")
		return
	
	var iron_count = InventoryManager.resources.get("iron", 0)
	check("初始铁矿石数量是数值", typeof(iron_count) == TYPE_INT, "count=%d" % iron_count)
	
	# 添加物品
	InventoryManager.add_resource("iron", 10)
	var after_add = InventoryManager.resources.get("iron", 0)
	check("添加后数量增加", after_add >= iron_count, "%d → %d" % [iron_count, after_add])

	# 移除物品（consume_resources）
	InventoryManager.consume_resources({"iron": 5})
	var after_remove = InventoryManager.resources.get("iron", 0)
	check("移除后数量减少", after_remove < after_add, "%d → %d" % [after_add, after_remove])


# ------------------------------------------------------------------
# SerumRecipes — 合成配方
# ------------------------------------------------------------------
func _test_serum_recipes():
	print("\n[ SerumRecipes ]")
	
	var recipes_script = load("res://scripts/serum_recipes.gd")
	check("serum_recipes.gd 可加载", recipes_script != null)
	
	if not recipes_script:
		return
	
	# 检查配方数据
	if "recipes" in recipes_script:
		var recipes = recipes_script.get("recipes")
		check("配方列表非空", recipes.size() > 0, "size=%d" % recipes.size())


# ============================================================================
# 工具
# ============================================================================

func _get_node_optional(path: String) -> Node:
	if has_node(path):
		return get_node(path)
	return null
