extends SceneTree

var _passed := 0
var _failed := 0


func _init() -> void:
        randomize()
        _ensure_current_scene()
        process_frame.connect(_run, CONNECT_ONE_SHOT)


func _run() -> void:
        print("\n========================================")
        print("  Star Abyss - system test suite")
        print("========================================\n")

        _test_world_generator()
        _test_player_oxygen()
        _test_zone_manager()
        _test_turret_logic()
        _test_build_and_combat_ui()
        _test_inventory_manager()
        _test_serum_recipes()

        print("\n========================================")
        print("  Test result: %d passed, %d failed" % [_passed, _failed])
        print("========================================\n")

        _cleanup_test_scene()
        quit(0 if _failed == 0 else 1)


func check(name: String, condition: bool, detail: String = "") -> void:
        if condition:
                _passed += 1
                print("  [PASS] %s" % name)
        else:
                _failed += 1
                print("  [FAIL] %s" % name)
        if detail:
                print("         -> %s" % detail)


func check_nearly(a: float, b: float, tolerance: float, name: String) -> void:
        check(name, absf(a - b) <= tolerance, "expected %.4f, got %.4f" % [b, a])


func _test_world_generator() -> void:
        print("\n[ WorldGenerator ]")

        var world_generator = _get_autoload("WorldGenerator")
        check("autoload exists", world_generator != null)
        if not world_generator:
                return

        if world_generator.height_map.is_empty() or world_generator.biome_map.is_empty():
                world_generator._build_maps()

        var h0 = world_generator.get_height_at(Vector2(0, 0))
        check("center height is float", typeof(h0) == TYPE_FLOAT, "h0=%.3f" % h0)
        check("center height is in safe range", h0 >= -1.0 and h0 <= 5.0, "h0=%.3f" % h0)

        var h_edge = world_generator.get_height_at(Vector2(50, 50))
        check("edge height is float", typeof(h_edge) == TYPE_FLOAT, "h_edge=%.3f" % h_edge)
        check("edge height is in noise range", h_edge >= -8.0 and h_edge <= 14.0, "h_edge=%.3f" % h_edge)

        var b0 = world_generator.get_biome_at(Vector2(0, 0))
        check("center biome is crash", b0 == world_generator.BIOME_CRASH, "biome=%d" % b0)

        var b_cold = world_generator.get_biome_at(Vector2(0, 30))
        check("north biome is cold", b_cold == world_generator.BIOME_COLD, "biome=%d" % b_cold)

        var b_heat = world_generator.get_biome_at(Vector2(30, 0))
        check("east biome is heat", b_heat == world_generator.BIOME_HEAT, "biome=%d" % b_heat)

        var spawn = world_generator.get_spawn_position(5.0, 10.0)
        check("spawn position is Vector3", typeof(spawn) == TYPE_VECTOR3)
        check("spawn y is safe", spawn.y >= -5.0, "y=%.3f" % spawn.y)

        check("height_map is populated", not world_generator.height_map.is_empty(), "size=%d" % world_generator.height_map.size())
        check("biome_map is populated", not world_generator.biome_map.is_empty(), "size=%d" % world_generator.biome_map.size())
        check("biome_map size is 101x101", world_generator.biome_map.size() == 101 * 101, "size=%d" % world_generator.biome_map.size())


func _test_player_oxygen() -> void:
        print("\n[ Player oxygen ]")

        var player_script_exists := ResourceLoader.exists("res://scripts/player.gd")
        check("player.gd exists", player_script_exists)

        var player_scene = load("res://scenes/main.tscn")
        check("main.tscn loads", player_scene != null)
        if not player_scene:
                return

        var main = player_scene.instantiate()
        var player = main.get_node_or_null("Player")
        check("Player node exists in main scene", player != null)
        if not player:
                main.free()
                return

        check_nearly(player.current_oxygen, 180.0, 0.01, "initial oxygen is 180")
        check("player starts alive", not player.is_dead)
        var initial_o2 = player.current_oxygen
        player.current_oxygen -= player.oxygen_drain_rate
        check("oxygen drain lowers value", player.current_oxygen < initial_o2, "%.1f -> %.1f" % [initial_o2, player.current_oxygen])
        player.refill_oxygen()
        check_nearly(player.current_oxygen, 180.0, 0.01, "refill restores oxygen")
        main.free()


func _test_zone_manager() -> void:
        print("\n[ ZoneManager ]")

        var zone_manager = _get_autoload("ZoneManager")
        check("autoload exists", zone_manager != null)
        if not zone_manager:
                return

        var mult = zone_manager.get_oxygen_multiplier()
        check("default multiplier is float", typeof(mult) == TYPE_FLOAT, "mult=%.2f" % mult)
        check("default multiplier is positive", mult >= 0.1, "mult=%.2f" % mult)

        zone_manager.current_zone = zone_manager.ZoneType.COLD
        var cold_mult = zone_manager.get_oxygen_multiplier()
        check("cold multiplier is valid", cold_mult > 0.0, "mult=%.2f" % cold_mult)
        zone_manager.current_zone = zone_manager.ZoneType.CRASH


func _test_turret_logic() -> void:
        print("\n[ Turret logic ]")

        var turret_script = load("res://scripts/turret.gd")
        check("turret.gd loads", turret_script != null)
        if not turret_script:
                return

        var has_fire_projectile := false
        for method in turret_script.get_script_method_list():
                if method.get("name", "") == "fire_projectile":
                        has_fire_projectile = true
                        break
        check("turret has fire_projectile()", has_fire_projectile)


func _test_inventory_manager() -> void:
        print("\n[ InventoryManager ]")

        var inventory_manager = _get_autoload("InventoryManager")
        check("autoload exists", inventory_manager != null)
        if not inventory_manager:
                return

        var iron_count = inventory_manager.resources.get("iron", 0)
        check("initial iron is int", typeof(iron_count) == TYPE_INT, "count=%d" % iron_count)

        inventory_manager.add_resource("iron", 10)
        var after_add = inventory_manager.resources.get("iron", 0)
        check("add_resource increases amount", after_add == iron_count + 10, "%d -> %d" % [iron_count, after_add])

        inventory_manager.consume_resources({"iron": 5})
        var after_remove = inventory_manager.resources.get("iron", 0)
        check("consume_resources decreases amount", after_remove == after_add - 5, "%d -> %d" % [after_add, after_remove])


func _test_build_and_combat_ui() -> void:
        print("\n[ Build and combat UI ]")

        var build_script = load("res://scripts/build_manager.gd")
        check("build_manager.gd loads", build_script != null)

        var combat_hud_script = load("res://scripts/combat_hud.gd")
        check("combat_hud.gd loads", combat_hud_script != null)

        var main_scene = load("res://scenes/main.tscn")
        check("main scene loads with build/combat nodes", main_scene != null)
        if not main_scene:
                return

        var main = main_scene.instantiate()
        check("BuildManager node exists", main.get_node_or_null("BuildManager") != null)
        check("CombatHUD node exists", main.get_node_or_null("CombatHUD") != null)
        main.free()


func _test_serum_recipes() -> void:
        print("\n[ SerumRecipes ]")

        var serum_recipes = _get_autoload("SerumRecipes")
        check("autoload exists", serum_recipes != null)
        if not serum_recipes:
                return

        check("recipes are populated", serum_recipes.recipes.size() >= 16, "size=%d" % serum_recipes.recipes.size())
        check("crash_1 starts unlocked", serum_recipes.recipes["crash_1"].get("unlocked", false))


func _get_autoload(name: String) -> Node:
        return root.get_node_or_null(name)


func _ensure_current_scene() -> void:
        if current_scene:
                return
        var main := Node3D.new()
        main.name = "Main"
        root.add_child(main)
        current_scene = main


func _cleanup_test_scene() -> void:
        if not current_scene:
                return
        var scene := current_scene
        current_scene = null
        if scene.get_parent():
                scene.get_parent().remove_child(scene)
        scene.free()
