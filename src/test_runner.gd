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
        _test_base_repair()
        _test_base_shield()
        _test_solar_panel_energy()
        _test_research_station()
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
        check("energy resource exists", inventory_manager.resources.has("energy"))

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

        var o2_station_script = load("res://scripts/o2_station.gd")
        check("o2_station.gd loads", o2_station_script != null)

        var base_interaction_script = load("res://scripts/base_interaction.gd")
        check("base_interaction.gd loads", base_interaction_script != null)

        var shield_generator_script = load("res://scripts/shield_generator.gd")
        check("shield_generator.gd loads", shield_generator_script != null)

        var solar_panel_script = load("res://scripts/solar_panel.gd")
        check("solar_panel.gd loads", solar_panel_script != null)

        var research_station_script = load("res://scripts/research_station.gd")
        check("research_station.gd loads", research_station_script != null)

        var main_scene = load("res://scenes/main.tscn")
        check("main scene loads with build/combat nodes", main_scene != null)
        if not main_scene:
                return

        var main = main_scene.instantiate()
        check("BuildManager node exists", main.get_node_or_null("BuildManager") != null)
        check("CombatHUD node exists", main.get_node_or_null("CombatHUD") != null)
        check("BaseInteraction node exists", main.get_node_or_null("BaseInteraction") != null)
        main.free()


func _test_base_repair() -> void:
        print("\n[ Base repair ]")

        var game_manager = _get_autoload("GameManager")
        var inventory_manager = _get_autoload("InventoryManager")
        check("GameManager autoload exists", game_manager != null)
        check("InventoryManager autoload exists", inventory_manager != null)
        if not game_manager or not inventory_manager:
                return

        var old_health: float = game_manager.base_health
        var old_iron: int = inventory_manager.resources.get("iron", 0)
        var old_biomass: int = inventory_manager.resources.get("biomass", 0)

        game_manager.base_health = 50.0
        inventory_manager.resources["iron"] = 10
        inventory_manager.resources["biomass"] = 5
        var repaired: bool = game_manager.repair_base()
        check("repair_base succeeds when damaged and funded", repaired)
        check_nearly(game_manager.base_health, 75.0, 0.01, "repair adds 25 base HP")
        check("repair consumes iron", inventory_manager.resources.get("iron", -1) == 0)
        check("repair consumes biomass", inventory_manager.resources.get("biomass", -1) == 0)

        game_manager.base_health = game_manager.MAX_BASE_HEALTH
        inventory_manager.resources["iron"] = 10
        inventory_manager.resources["biomass"] = 5
        var full_repair: bool = game_manager.repair_base()
        check("repair_base fails at full health", not full_repair)
        check("full health repair does not consume iron", inventory_manager.resources.get("iron", -1) == 10)
        check("GameManager has force_start_night()", game_manager.has_method("force_start_night"))

        game_manager.base_health = old_health
        inventory_manager.resources["iron"] = old_iron
        inventory_manager.resources["biomass"] = old_biomass


func _test_base_shield() -> void:
        print("\n[ Base shield ]")

        var game_manager = _get_autoload("GameManager")
        check("GameManager autoload exists", game_manager != null)
        if not game_manager:
                return

        var old_health: float = game_manager.base_health
        var old_shield: float = game_manager.base_shield
        var old_max_shield: float = game_manager.max_base_shield

        game_manager.base_health = 100.0
        game_manager.base_shield = 0.0
        game_manager.max_base_shield = 0.0
        game_manager.register_base_shield(50.0)
        check_nearly(game_manager.base_shield, 50.0, 0.01, "register shield fills shield")
        check_nearly(game_manager.max_base_shield, 50.0, 0.01, "register shield raises max")

        game_manager._on_base_reached(20.0)
        check_nearly(game_manager.base_shield, 30.0, 0.01, "shield absorbs incoming damage first")
        check_nearly(game_manager.base_health, 100.0, 0.01, "shield prevents base damage")

        game_manager._on_base_reached(40.0)
        check_nearly(game_manager.base_shield, 0.0, 0.01, "shield can be depleted")
        check_nearly(game_manager.base_health, 90.0, 0.01, "overflow damage hits base")

        game_manager.base_health = old_health
        game_manager.base_shield = old_shield
        game_manager.max_base_shield = old_max_shield


func _test_solar_panel_energy() -> void:
        print("\n[ Solar panel energy ]")

        var game_manager = _get_autoload("GameManager")
        var inventory_manager = _get_autoload("InventoryManager")
        check("GameManager autoload exists", game_manager != null)
        check("InventoryManager autoload exists", inventory_manager != null)
        if not game_manager or not inventory_manager:
                return

        var solar_script = load("res://scripts/solar_panel.gd")
        check("solar_panel.gd loads for generation test", solar_script != null)
        if not solar_script:
                return

        var old_energy: int = inventory_manager.resources.get("energy", 0)
        var old_is_night: bool = game_manager.is_night
        inventory_manager.resources["energy"] = 0

        var panel = solar_script.new()
        current_scene.add_child(panel)
        game_manager.is_night = false
        panel._process(panel.ENERGY_INTERVAL)
        check("solar panel generates energy during day", inventory_manager.resources.get("energy", -1) == 1)

        game_manager.is_night = true
        panel._process(panel.ENERGY_INTERVAL * 2.0)
        check("solar panel pauses at night", inventory_manager.resources.get("energy", -1) == 1)

        panel.queue_free()
        inventory_manager.resources["energy"] = old_energy
        game_manager.is_night = old_is_night


func _test_research_station() -> void:
        print("\n[ Research station ]")

        var inventory_manager = _get_autoload("InventoryManager")
        check("InventoryManager autoload exists", inventory_manager != null)
        if not inventory_manager:
                return

        var research_script = load("res://scripts/research_station.gd")
        check("research_station.gd loads for research test", research_script != null)
        if not research_script:
                return

        var old_energy: int = inventory_manager.resources.get("energy", 0)
        var old_blueprint: int = inventory_manager.resources.get("blueprint", 0)
        inventory_manager.resources["energy"] = 5
        inventory_manager.resources["blueprint"] = 0

        var station = research_script.new()
        current_scene.add_child(station)
        station._process(station.RESEARCH_INTERVAL)
        check("research consumes energy", inventory_manager.resources.get("energy", -1) == 0)
        check("research creates blueprint", inventory_manager.resources.get("blueprint", -1) == 1)

        station._process(station.RESEARCH_INTERVAL * 2.0)
        check("research pauses without energy", inventory_manager.resources.get("blueprint", -1) == 1)

        station.queue_free()
        inventory_manager.resources["energy"] = old_energy
        inventory_manager.resources["blueprint"] = old_blueprint


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
