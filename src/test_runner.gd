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
        _test_oxygen_plant()
        _test_oxygen_canister_manager()
        _test_death_drop_manager()
        _test_zone_manager()
        _test_turret_logic()
        _test_slow_field()
        _test_enemy_structure_targeting()
        _test_build_and_combat_ui()
        _test_build_recycle()
        _test_structure_upgrade()
        _test_structure_repair()
        _test_inventory_manager()
        _test_base_repair()
        _test_base_shield()
        _test_wave_warning_status()
        _test_wave_variant_logic()
        _test_enemy_reward_rules()
        _test_solar_panel_energy()
        _test_research_station()
        _test_signal_log_manager()
        _test_signal_beacon()
        _test_tech_unlocks()
        _test_save_manager()
        _test_resource_scanner()
        _test_objective_tracker()
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
        check("world generator places oxygen plants", get_nodes_in_group("oxygen_plants").size() > 0, "count=%d" % get_nodes_in_group("oxygen_plants").size())


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


func _test_oxygen_plant() -> void:
        print("\n[ Oxygen plant ]")

        var oxygen_plant_script = load("res://scripts/oxygen_plant.gd")
        var player_script = load("res://scripts/player.gd")
        check("oxygen_plant.gd loads", oxygen_plant_script != null)
        check("player.gd loads for oxygen plant test", player_script != null)
        if not oxygen_plant_script or not player_script:
                return

        var player = player_script.new()
        player.add_to_group("player")
        player.max_oxygen = 180.0
        player.current_oxygen = 90.0
        current_scene.add_child(player)

        var plant = oxygen_plant_script.new()
        current_scene.add_child(plant)
        check("oxygen plant joins group", plant.is_in_group("oxygen_plants"))
        check("oxygen plant can be collected", plant.collect(player))
        check_nearly(player.current_oxygen, 135.0, 0.01, "oxygen plant restores oxygen")
        check("oxygen plant queues after collection", plant.is_queued_for_deletion())
        plant.free()

        var full_plant = oxygen_plant_script.new()
        current_scene.add_child(full_plant)
        player.current_oxygen = player.max_oxygen
        check("oxygen plant waits when oxygen is full", not full_plant.collect(player))
        check("full oxygen plant remains available", not full_plant.is_queued_for_deletion())
        full_plant.free()
        player.free()


func _test_oxygen_canister_manager() -> void:
        print("\n[ Oxygen canister manager ]")

        var oxygen_canister_manager = _get_autoload("OxygenCanisterManager")
        var inventory_manager = _get_autoload("InventoryManager")
        var player_script = load("res://scripts/player.gd")
        var combat_hud_script = load("res://scripts/combat_hud.gd")
        check("OxygenCanisterManager autoload exists", oxygen_canister_manager != null)
        check("InventoryManager autoload exists for O2 kit test", inventory_manager != null)
        check("player.gd loads for O2 kit test", player_script != null)
        check("combat_hud.gd loads for O2 kit test", combat_hud_script != null)
        if not oxygen_canister_manager or not inventory_manager or not player_script or not combat_hud_script:
                return

        var old_resources: Dictionary = inventory_manager.resources.duplicate(true)
        inventory_manager.resources["biomass"] = 2
        inventory_manager.resources["energy"] = 1
        inventory_manager.resources["oxygen_canister"] = 0

        check("oxygen canister crafts from biomass and energy", oxygen_canister_manager.craft_canister())
        check("oxygen canister craft consumes biomass", inventory_manager.resources.get("biomass", -1) == 0)
        check("oxygen canister craft consumes energy", inventory_manager.resources.get("energy", -1) == 0)
        check("oxygen canister craft adds kit", inventory_manager.resources.get("oxygen_canister", -1) == 1)

        var player = player_script.new()
        player.add_to_group("player")
        player.max_oxygen = 180.0
        player.current_oxygen = 80.0
        current_scene.add_child(player)

        check("oxygen canister can be used", oxygen_canister_manager.use_canister(player))
        check_nearly(player.current_oxygen, 140.0, 0.01, "oxygen canister restores oxygen")
        check("oxygen canister use consumes kit", inventory_manager.resources.get("oxygen_canister", -1) == 0)

        inventory_manager.resources["oxygen_canister"] = 1
        player.current_oxygen = player.max_oxygen
        check("oxygen canister does not consume at full oxygen", not oxygen_canister_manager.use_canister(player))
        check("full oxygen keeps canister", inventory_manager.resources.get("oxygen_canister", -1) == 1)

        var combat_hud = combat_hud_script.new()
        current_scene.add_child(combat_hud)
        check("combat HUD shows oxygen kit hint", combat_hud.get_oxygen_supply_text().contains("O2 Kit"), combat_hud.get_oxygen_supply_text())

        combat_hud.queue_free()
        player.free()
        inventory_manager.resources = old_resources


func _test_death_drop_manager() -> void:
        print("\n[ Death drop manager ]")

        var death_drop_manager = _get_autoload("DeathDropManager")
        var inventory_manager = _get_autoload("InventoryManager")
        var combat_hud_script = load("res://scripts/combat_hud.gd")
        var objective_script = load("res://scripts/objective_tracker.gd")
        check("DeathDropManager autoload exists", death_drop_manager != null)
        check("InventoryManager autoload exists for death drop test", inventory_manager != null)
        check("combat_hud.gd loads for death drop test", combat_hud_script != null)
        check("objective_tracker.gd loads for death drop test", objective_script != null)
        if not death_drop_manager or not inventory_manager or not combat_hud_script or not objective_script:
                return

        var old_resources: Dictionary = inventory_manager.resources.duplicate(true)
        death_drop_manager.reset_drop()
        inventory_manager.resources["iron"] = 5
        inventory_manager.resources["energy"] = 2
        inventory_manager.resources["blueprint"] = 1

        var player := Node3D.new()
        player.name = "DeathDropTestPlayer"
        player.add_to_group("player")
        player.position = Vector3(12.0, 0.0, -4.0)
        current_scene.add_child(player)

        check("death drop records player death", death_drop_manager.record_player_death(player))
        check("death drop becomes active", death_drop_manager.has_active_drop())
        check("death drop removes half iron", inventory_manager.resources.get("iron", -1) == 3)
        check("death drop removes half energy", inventory_manager.resources.get("energy", -1) == 1)
        check("death drop removes single blueprint", inventory_manager.resources.get("blueprint", -1) == 0)
        check("death drop node spawns", get_nodes_in_group("death_drops").size() >= 1)
        check("death drop hint shows recovery", death_drop_manager.get_drop_hint().contains("Drop:"), death_drop_manager.get_drop_hint())

        var combat_hud = combat_hud_script.new()
        current_scene.add_child(combat_hud)
        check("combat HUD shows death drop hint", combat_hud.get_death_drop_text().contains("Drop:"), combat_hud.get_death_drop_text())

        var tracker = objective_script.new()
        current_scene.add_child(tracker)
        check("objective asks to recover death drop", tracker.get_objective_text().contains("Recover dropped resources"), tracker.get_objective_text())

        var save_data: Dictionary = death_drop_manager.capture_save_data()
        death_drop_manager.reset_drop()
        death_drop_manager.apply_save_data(save_data)
        check("death drop save restores active drop", death_drop_manager.has_active_drop())

        check("death drop can be collected", death_drop_manager.collect_active_drop())
        check("death drop restores iron", inventory_manager.resources.get("iron", -1) == 5)
        check("death drop restores energy", inventory_manager.resources.get("energy", -1) == 2)
        check("death drop restores blueprint", inventory_manager.resources.get("blueprint", -1) == 1)
        check("death drop clears after collect", not death_drop_manager.has_active_drop())

        tracker.queue_free()
        combat_hud.queue_free()
        player.free()
        death_drop_manager.reset_drop()
        inventory_manager.resources = old_resources


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


func _test_slow_field() -> void:
        print("\n[ Slow field ]")

        var enemy_script = load("res://scripts/enemy.gd")
        var slow_field_script = load("res://scripts/slow_field.gd")
        check("enemy.gd loads for slow test", enemy_script != null)
        check("slow_field.gd loads for slow test", slow_field_script != null)
        if not enemy_script or not slow_field_script:
                return

        var enemy = enemy_script.new()
        enemy.speed = 4.0
        enemy.position = Vector3(0.0, 0.0, 0.0)
        current_scene.add_child(enemy)

        var slow_field = slow_field_script.new()
        slow_field.position = Vector3(2.0, 0.0, 0.0)
        current_scene.add_child(slow_field)
        slow_field._process(0.1)
        check_nearly(enemy.get_effective_speed(), 4.0 * slow_field.SLOW_MULTIPLIER, 0.01, "slow field reduces enemy speed")

        enemy.position = Vector3(20.0, 0.0, 0.0)
        slow_field._process(0.1)
        check_nearly(enemy.get_effective_speed(), 4.0, 0.01, "enemy speed restores after leaving slow field")

        slow_field.queue_free()
        enemy.queue_free()


func _test_enemy_structure_targeting() -> void:
        print("\n[ Enemy structure targeting ]")

        var enemy_script = load("res://scripts/enemy.gd")
        check("enemy.gd loads for structure targeting test", enemy_script != null)
        if not enemy_script:
                return

        var enemy = enemy_script.new()
        current_scene.add_child(enemy)
        enemy.global_position = Vector3.ZERO
        enemy.damage = 12.0
        enemy.attack_range = 2.0
        enemy.structure_target_range = 4.0

        var structure := Node3D.new()
        structure.add_to_group("built_structures")
        structure.position = Vector3(1.0, 0.0, 0.0)
        current_scene.add_child(structure)

        check("enemy finds nearby built structure", enemy.find_structure_target() == structure)

        enemy._physics_process(1.0)
        check_nearly(float(structure.get_meta("structure_health", 0.0)), 88.0, 0.01, "enemy attack damages structure")

        enemy._physics_process(0.1)
        check_nearly(float(structure.get_meta("structure_health", 0.0)), 88.0, 0.01, "enemy structure attack respects cooldown")

        enemy._physics_process(1.0)
        check_nearly(float(structure.get_meta("structure_health", 0.0)), 76.0, 0.01, "enemy can attack structure again after cooldown")

        check("enemy damage_structure destroys depleted structure", enemy.damage_structure(structure, 200.0))
        check("depleted structure queues for deletion", structure.is_queued_for_deletion())

        var loose_node := Node3D.new()
        current_scene.add_child(loose_node)
        check("enemy ignores non-built structure damage target", not enemy.damage_structure(loose_node, 10.0))

        enemy.queue_free()
        loose_node.queue_free()


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

        var resource_scanner_script = load("res://scripts/resource_scanner.gd")
        check("resource_scanner.gd loads", resource_scanner_script != null)

        var slow_field_script = load("res://scripts/slow_field.gd")
        check("slow_field.gd loads", slow_field_script != null)

        var signal_beacon_script = load("res://scripts/signal_beacon.gd")
        check("signal_beacon.gd loads", signal_beacon_script != null)

        var signal_log_script = load("res://scripts/signal_log_manager.gd")
        check("signal_log_manager.gd loads", signal_log_script != null)

        var signal_cache_script = load("res://scripts/signal_cache.gd")
        check("signal_cache.gd loads", signal_cache_script != null)

        var death_drop_manager_script = load("res://scripts/death_drop_manager.gd")
        check("death_drop_manager.gd loads", death_drop_manager_script != null)

        var death_drop_script = load("res://scripts/death_drop.gd")
        check("death_drop.gd loads", death_drop_script != null)

        var oxygen_canister_script = load("res://scripts/oxygen_canister_manager.gd")
        check("oxygen_canister_manager.gd loads", oxygen_canister_script != null)

        var oxygen_plant_script = load("res://scripts/oxygen_plant.gd")
        check("oxygen_plant.gd loads", oxygen_plant_script != null)

        var objective_tracker_script = load("res://scripts/objective_tracker.gd")
        check("objective_tracker.gd loads", objective_tracker_script != null)

        var tech_manager_script = load("res://scripts/tech_manager.gd")
        check("tech_manager.gd loads", tech_manager_script != null)

        var save_manager_script = load("res://scripts/save_manager.gd")
        check("save_manager.gd loads", save_manager_script != null)
        var save_manager = _get_autoload("SaveManager")
        check("SaveManager autoload exists for HUD status", save_manager != null)

        var main_scene = load("res://scenes/main.tscn")
        check("main scene loads with build/combat nodes", main_scene != null)
        if not main_scene:
                return

        var main = main_scene.instantiate()
        check("BuildManager node exists", main.get_node_or_null("BuildManager") != null)
        check("CombatHUD node exists", main.get_node_or_null("CombatHUD") != null)
        check("BaseInteraction node exists", main.get_node_or_null("BaseInteraction") != null)
        check("ResourceScanner node exists", main.get_node_or_null("ResourceScanner") != null)
        check("ObjectiveTracker node exists", main.get_node_or_null("ObjectiveTracker") != null)
        main.free()

        if combat_hud_script and save_manager:
                var combat_hud = combat_hud_script.new()
                current_scene.add_child(combat_hud)
                save_manager.save_status_changed.emit("Saved")
                check("combat HUD shows save status", combat_hud.get_save_status_text().contains("Saved"), combat_hud.get_save_status_text())
                combat_hud._process(combat_hud.SAVE_STATUS_DURATION)
                check("combat HUD clears save status", combat_hud.get_save_status_text().is_empty(), combat_hud.get_save_status_text())
                combat_hud.queue_free()

        if build_script:
                var build_manager = build_script.new()
                current_scene.add_child(build_manager)
                build_manager.selected_building = build_manager.BUILD_SIGNAL_BEACON
                check("signal beacon is a build option", build_manager.get_selected_label() == "Signal Beacon")
                check("signal beacon cost includes blueprint", build_manager.get_selected_cost().get("blueprint", 0) == 2)
                build_manager.queue_free()


func _test_build_recycle() -> void:
        print("\n[ Build recycle ]")

        var build_script = load("res://scripts/build_manager.gd")
        var inventory_manager = _get_autoload("InventoryManager")
        check("build_manager.gd loads for recycle test", build_script != null)
        check("InventoryManager autoload exists", inventory_manager != null)
        if not build_script or not inventory_manager:
                return

        var old_iron: int = inventory_manager.resources.get("iron", 0)
        var old_biomass: int = inventory_manager.resources.get("biomass", 0)
        inventory_manager.resources["iron"] = 0
        inventory_manager.resources["biomass"] = 0

        var build_manager = build_script.new()
        current_scene.add_child(build_manager)

        var structure := Node3D.new()
        structure.add_to_group("built_structures")
        structure.set_meta("build_cost", {"iron": 20, "biomass": 8})
        structure.set_meta("build_label", "Turret")
        current_scene.add_child(structure)

        var recycle_status: String = build_manager.get_recycle_status_text()
        check("recycle status shows target label", recycle_status.contains("Target Turret"), recycle_status)
        check("recycle status shows refund", recycle_status.contains("10 iron") and recycle_status.contains("4 biomass"), recycle_status)

        var recycled: bool = build_manager.recycle_structure(structure)
        check("recycle_structure succeeds for built structure", recycled)
        check("recycle refunds half iron", inventory_manager.resources.get("iron", -1) == 10)
        check("recycle refunds half biomass", inventory_manager.resources.get("biomass", -1) == 4)

        var loose_node := Node3D.new()
        current_scene.add_child(loose_node)
        check("recycle_structure rejects non-built node", not build_manager.recycle_structure(loose_node))

        build_manager.queue_free()
        loose_node.queue_free()
        inventory_manager.resources["iron"] = old_iron
        inventory_manager.resources["biomass"] = old_biomass


func _test_structure_upgrade() -> void:
        print("\n[ Structure upgrade ]")

        var build_script = load("res://scripts/build_manager.gd")
        var turret_scene = load("res://scenes/turret.tscn")
        var inventory_manager = _get_autoload("InventoryManager")
        check("build_manager.gd loads for upgrade test", build_script != null)
        check("turret scene loads for upgrade test", turret_scene != null)
        check("InventoryManager autoload exists", inventory_manager != null)
        if not build_script or not turret_scene or not inventory_manager:
                return

        var old_iron: int = inventory_manager.resources.get("iron", 0)
        var old_energy: int = inventory_manager.resources.get("energy", 0)
        var old_blueprint: int = inventory_manager.resources.get("blueprint", 0)
        inventory_manager.resources["iron"] = 10
        inventory_manager.resources["energy"] = 5
        inventory_manager.resources["blueprint"] = 1

        var build_manager = build_script.new()
        current_scene.add_child(build_manager)

        var turret = turret_scene.instantiate()
        turret.add_to_group("built_structures")
        turret.add_to_group("built_turrets")
        turret.set_meta("build_label", "Turret")
        current_scene.add_child(turret)
        var old_damage: float = turret.damage
        var old_fire_rate: float = turret.fire_rate

        var upgrade_status: String = build_manager.get_upgrade_status_text()
        check("upgrade status shows turret level", upgrade_status.contains("Turret Lv 0/3"), upgrade_status)
        check("upgrade status shows ready when funded", upgrade_status.contains("READY"), upgrade_status)

        var upgraded: bool = build_manager.upgrade_structure(turret)
        check("upgrade_structure succeeds for turret", upgraded)
        check("upgrade increases turret damage", turret.damage > old_damage)
        check("upgrade increases turret fire rate", turret.fire_rate > old_fire_rate)
        check("upgrade records level", int(turret.get_meta("upgrade_level", 0)) == 1)
        check("upgrade consumes blueprint", inventory_manager.resources.get("blueprint", -1) == 0)

        turret.set_meta("upgrade_level", build_manager.MAX_UPGRADE_LEVEL)
        inventory_manager.resources["iron"] = 10
        inventory_manager.resources["energy"] = 5
        inventory_manager.resources["blueprint"] = 1
        var max_status: String = build_manager.get_upgrade_status_text()
        check("upgrade status shows max level", max_status.contains("MAX"), max_status)
        check("upgrade rejects max-level turret", not build_manager.upgrade_structure(turret))

        build_manager.queue_free()
        turret.queue_free()
        inventory_manager.resources["iron"] = old_iron
        inventory_manager.resources["energy"] = old_energy
        inventory_manager.resources["blueprint"] = old_blueprint


func _test_structure_repair() -> void:
        print("\n[ Structure repair ]")

        var build_script = load("res://scripts/build_manager.gd")
        var combat_hud_script = load("res://scripts/combat_hud.gd")
        var game_manager = _get_autoload("GameManager")
        var inventory_manager = _get_autoload("InventoryManager")
        check("build_manager.gd loads for repair test", build_script != null)
        check("combat_hud.gd loads for repair HUD test", combat_hud_script != null)
        check("GameManager autoload exists", game_manager != null)
        check("InventoryManager autoload exists", inventory_manager != null)
        if not build_script or not combat_hud_script or not game_manager or not inventory_manager:
                return

        var old_health: float = game_manager.base_health
        var old_shield: float = game_manager.base_shield
        var old_max_shield: float = game_manager.max_base_shield
        var old_iron: int = inventory_manager.resources.get("iron", 0)
        var old_biomass: int = inventory_manager.resources.get("biomass", 0)

        inventory_manager.resources["iron"] = 5
        inventory_manager.resources["biomass"] = 2

        var build_manager = build_script.new()
        current_scene.add_child(build_manager)

        var structure := Node3D.new()
        structure.add_to_group("built_structures")
        structure.set_meta("build_label", "Turret")
        structure.set_meta("structure_max_health", 100.0)
        structure.set_meta("structure_health", 40.0)
        current_scene.add_child(structure)

        var combat_hud = combat_hud_script.new()
        current_scene.add_child(combat_hud)
        var damage_hint: String = combat_hud.get_structure_damage_hint()
        check("combat HUD shows damaged structure label", damage_hint.contains("Struct Turret"), damage_hint)
        check("combat HUD shows damaged structure HP", damage_hint.contains("40/100"), damage_hint)

        var repair_status: String = build_manager.get_repair_status_text()
        check("repair status shows damaged target", repair_status.contains("Repair Turret HP 40/100"), repair_status)
        check("repair status shows ready when funded", repair_status.contains("READY"), repair_status)

        var repaired: bool = build_manager.repair_structure(structure)
        check("repair_structure succeeds for damaged built structure", repaired)
        check_nearly(float(structure.get_meta("structure_health", 0.0)), 75.0, 0.01, "repair restores structure HP")
        check("structure repair consumes iron", inventory_manager.resources.get("iron", -1) == 0)
        check("structure repair consumes biomass", inventory_manager.resources.get("biomass", -1) == 0)

        structure.set_meta("structure_health", 100.0)
        inventory_manager.resources["iron"] = 5
        inventory_manager.resources["biomass"] = 2
        check("repair_structure rejects full-health structure", not build_manager.repair_structure(structure))

        var splash_target := Node3D.new()
        splash_target.add_to_group("built_structures")
        var impact_position := Vector3(20.0, 0.0, 20.0)
        splash_target.position = impact_position
        splash_target.set_meta("structure_max_health", 100.0)
        splash_target.set_meta("structure_health", 100.0)
        current_scene.add_child(splash_target)

        game_manager.base_health = 100.0
        game_manager.base_shield = 0.0
        game_manager.max_base_shield = 0.0
        game_manager._on_base_reached(20.0, impact_position)
        check_nearly(float(splash_target.get_meta("structure_health", 0.0)), 80.0, 0.01, "base breach damages nearby structures")
        check_nearly(game_manager.base_health, 80.0, 0.01, "base breach still damages base")

        build_manager.queue_free()
        combat_hud.queue_free()
        structure.queue_free()
        splash_target.queue_free()
        game_manager.base_health = old_health
        game_manager.base_shield = old_shield
        game_manager.max_base_shield = old_max_shield
        inventory_manager.resources["iron"] = old_iron
        inventory_manager.resources["biomass"] = old_biomass


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


func _test_wave_warning_status() -> void:
        print("\n[ Wave warning status ]")

        var game_manager = _get_autoload("GameManager")
        check("GameManager autoload exists", game_manager != null)
        if not game_manager:
                return

        var old_is_night: bool = game_manager.is_night
        var old_remaining: float = game_manager.phase_time_remaining
        var old_direction: String = game_manager.last_wave_direction

        game_manager.is_night = false
        game_manager.phase_time_remaining = 61.0
        check("day timer text shows next night", game_manager.get_phase_timer_text() == "Next night 01:01")

        game_manager.is_night = true
        game_manager.phase_time_remaining = 5.0
        check("night timer text shows night end", game_manager.get_phase_timer_text() == "Night ends 00:05")

        var direction: String = game_manager._direction_label(Vector3.ZERO, Vector3(5.0, 0.0, -5.0))
        check("wave direction label supports compass direction", direction == "NE", direction)

        game_manager.is_night = old_is_night
        game_manager.phase_time_remaining = old_remaining
        game_manager.last_wave_direction = old_direction


func _test_wave_variant_logic() -> void:
        print("\n[ Wave variant logic ]")

        var game_manager = _get_autoload("GameManager")
        check("GameManager autoload exists", game_manager != null)
        if not game_manager:
                return

        var old_wave: int = game_manager.wave_number
        var old_enemies_alive: int = game_manager.enemies_alive

        game_manager.wave_number = 3
        check("wave 3 is scout", game_manager.get_wave_variant() == "scout")
        check("wave 3 label is Scout", game_manager.get_wave_variant_label() == "Scout")

        game_manager.wave_number = 4
        check("wave 4 is tank", game_manager.get_wave_variant() == "tank")
        check("wave 4 label is Tank", game_manager.get_wave_variant_label() == "Tank")

        game_manager.wave_number = 5
        check("wave 5 is elite", game_manager.get_wave_variant() == "elite")

        game_manager.wave_number = 10
        check("wave 10 is boss", game_manager.get_wave_variant() == "boss")

        game_manager.wave_number = 3
        var scout_enemy: Node = game_manager.spawn_enemy("scout")
        check("spawned scout records variant metadata", scout_enemy.get_meta("wave_variant", "") == "scout")
        check("spawned scout records label metadata", scout_enemy.get_meta("wave_variant_label", "") == "Scout")
        var csg_shapes := scout_enemy.find_children("*", "CSGPrimitive3D", true, false)
        check("spawned scout has tinted visual shapes", not csg_shapes.is_empty() and (csg_shapes[0] as CSGPrimitive3D).material != null)
        scout_enemy.queue_free()

        game_manager.wave_number = old_wave
        game_manager.enemies_alive = old_enemies_alive


func _test_enemy_reward_rules() -> void:
        print("\n[ Enemy reward rules ]")

        var game_manager = _get_autoload("GameManager")
        var inventory_manager = _get_autoload("InventoryManager")
        check("GameManager autoload exists", game_manager != null)
        check("InventoryManager autoload exists", inventory_manager != null)
        if not game_manager or not inventory_manager:
                return

        var old_iron: int = inventory_manager.resources.get("iron", 0)
        var old_biomass: int = inventory_manager.resources.get("biomass", 0)
        var old_crystal: int = inventory_manager.resources.get("void_crystal", 0)
        var old_energy_core: int = inventory_manager.resources.get("energy_core", 0)
        var old_blueprint: int = inventory_manager.resources.get("blueprint", 0)
        var old_enemies_alive: int = game_manager.enemies_alive

        inventory_manager.resources["iron"] = 0
        inventory_manager.resources["biomass"] = 0
        inventory_manager.resources["void_crystal"] = 0
        inventory_manager.resources["energy_core"] = 0
        inventory_manager.resources["blueprint"] = 0

        game_manager._drop_enemy_variant_bonus("boss")
        check("boss reward grants energy core", inventory_manager.resources.get("energy_core", -1) == 1)
        check("boss reward grants blueprint", inventory_manager.resources.get("blueprint", -1) == 1)

        inventory_manager.resources["iron"] = 0
        inventory_manager.resources["biomass"] = 0
        inventory_manager.resources["void_crystal"] = 0
        inventory_manager.resources["energy_core"] = 0
        inventory_manager.resources["blueprint"] = 0

        var breached_enemy := Node.new()
        breached_enemy.set_meta("wave_variant", "boss")
        game_manager.enemies_alive = 1
        game_manager._on_enemy_died(false, breached_enemy)
        check("base breach death does not grant boss energy core", inventory_manager.resources.get("energy_core", -1) == 0)
        check("base breach death does not grant boss blueprint", inventory_manager.resources.get("blueprint", -1) == 0)
        check("base breach death decrements enemy count", game_manager.enemies_alive == 0)

        inventory_manager.resources["iron"] = old_iron
        inventory_manager.resources["biomass"] = old_biomass
        inventory_manager.resources["void_crystal"] = old_crystal
        inventory_manager.resources["energy_core"] = old_energy_core
        inventory_manager.resources["blueprint"] = old_blueprint
        game_manager.enemies_alive = old_enemies_alive


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


func _test_signal_log_manager() -> void:
        print("\n[ Signal log manager ]")

        var signal_log_manager = _get_autoload("SignalLogManager")
        var inventory_manager = _get_autoload("InventoryManager")
        var game_manager = _get_autoload("GameManager")
        check("SignalLogManager autoload exists", signal_log_manager != null)
        check("InventoryManager autoload exists for signal log test", inventory_manager != null)
        check("GameManager autoload exists for signal log test", game_manager != null)
        if not signal_log_manager or not inventory_manager or not game_manager:
                return

        var old_iron: int = inventory_manager.resources.get("iron", 0)
        var old_energy: int = inventory_manager.resources.get("energy", 0)
        var old_is_night: bool = game_manager.is_night
        signal_log_manager.reset_logs()
        check("signal logs start empty", signal_log_manager.get_latest_message().is_empty())

        signal_log_manager.register_signal_progress(24.0)
        check("signal log waits below first milestone", not signal_log_manager.is_log_unlocked("signal_25"))

        signal_log_manager.register_signal_progress(50.0)
        check("signal log unlocks 25 milestone", signal_log_manager.is_log_unlocked("signal_25"))
        check("signal log unlocks 50 milestone", signal_log_manager.is_log_unlocked("signal_50"))
        check("signal log latest message is visible", signal_log_manager.get_latest_message().contains("Radio:"), signal_log_manager.get_latest_message())
        check("signal log spawns cache", _find_signal_cache("signal_25") != null)

        var cache = _find_signal_cache("signal_25")
        if cache:
                inventory_manager.resources["iron"] = 0
                inventory_manager.resources["energy"] = 0
                check("signal cache can be collected", cache.collect())
                check("signal cache grants iron", inventory_manager.resources.get("iron", -1) == 12)
                check("signal cache grants energy", inventory_manager.resources.get("energy", -1) == 3)
                check("signal cache records collected state", signal_log_manager.is_cache_collected("signal_25"))

        signal_log_manager.reset_logs()
        var player := Node3D.new()
        player.name = "SignalCacheTestPlayer"
        player.add_to_group("player")
        player.position = Vector3.ZERO
        current_scene.add_child(player)
        signal_log_manager.register_signal_progress(25.0)
        check("signal cache hint shows distance", signal_log_manager.get_cache_hint().contains("Cache:"), signal_log_manager.get_cache_hint())
        player.free()

        game_manager.is_night = true
        signal_log_manager.register_signal_progress(100.0)
        check("signal 100 starts extraction holdout", signal_log_manager.is_extraction_active())
        check("extraction status is visible", signal_log_manager.get_extraction_status_text().contains("Extraction:"), signal_log_manager.get_extraction_status_text())
        var extraction_data: Dictionary = signal_log_manager.capture_save_data()
        signal_log_manager.reset_logs()
        signal_log_manager.apply_save_data(extraction_data)
        check("signal save restores extraction holdout", signal_log_manager.is_extraction_active())
        signal_log_manager._process(signal_log_manager.EXTRACTION_HOLDOUT_DURATION)
        check("extraction holdout can complete", signal_log_manager.is_extraction_complete())
        check("extraction completion text is visible", signal_log_manager.get_extraction_status_text().contains("victory"), signal_log_manager.get_extraction_status_text())

        var data: Dictionary = signal_log_manager.capture_save_data()
        signal_log_manager.reset_logs()
        signal_log_manager.apply_save_data(data)
        check("signal log save restores 25 milestone", signal_log_manager.is_log_unlocked("signal_25"))
        signal_log_manager.reset_logs()
        inventory_manager.resources["iron"] = old_iron
        inventory_manager.resources["energy"] = old_energy
        game_manager.is_night = old_is_night


func _test_signal_beacon() -> void:
        print("\n[ Signal beacon ]")

        var inventory_manager = _get_autoload("InventoryManager")
        var signal_log_manager = _get_autoload("SignalLogManager")
        var signal_script = load("res://scripts/signal_beacon.gd")
        var combat_hud_script = load("res://scripts/combat_hud.gd")
        check("InventoryManager autoload exists for signal test", inventory_manager != null)
        check("SignalLogManager autoload exists for signal test", signal_log_manager != null)
        check("signal_beacon.gd loads for signal test", signal_script != null)
        check("combat_hud.gd loads for signal test", combat_hud_script != null)
        if not inventory_manager or not signal_log_manager or not signal_script or not combat_hud_script:
                return

        var old_energy: int = inventory_manager.resources.get("energy", 0)
        var old_signal_logs: Dictionary = signal_log_manager.capture_save_data()
        signal_log_manager.reset_logs()
        inventory_manager.resources["energy"] = 2

        var beacon = signal_script.new()
        current_scene.add_child(beacon)
        check("signal beacon joins group", beacon.is_in_group("signal_beacons"))
        check("signal beacon starts at zero progress", int(beacon.signal_progress) == 0)

        beacon._process(beacon.SIGNAL_INTERVAL)
        check("signal beacon consumes energy", inventory_manager.resources.get("energy", -1) == 1)
        check_nearly(beacon.signal_progress, beacon.SIGNAL_PROGRESS_PER_CYCLE, 0.01, "signal beacon advances progress")
        check("signal beacon status shows progress", beacon.get_signal_status_text().contains("10/100"), beacon.get_signal_status_text())

        beacon.signal_progress = 20.0
        beacon._process(beacon.SIGNAL_INTERVAL)
        check("signal beacon unlocks first radio log", signal_log_manager.is_log_unlocked("signal_25"))

        var combat_hud = combat_hud_script.new()
        current_scene.add_child(combat_hud)
        check("combat HUD shows signal hint", combat_hud.get_signal_hint().contains("Signal:"), combat_hud.get_signal_hint())
        check("combat HUD shows radio log", combat_hud.get_radio_log_text().contains("Radio:"), combat_hud.get_radio_log_text())
        signal_log_manager.apply_save_data({
                "unlocked_logs": {"signal_100": true},
                "latest_message": "Radio: rescue ping locked.",
                "extraction_holdout_active": true,
                "extraction_time_remaining": 90.0
        })
        check("combat HUD shows extraction holdout", combat_hud.get_signal_hint().contains("Extraction:"), combat_hud.get_signal_hint())

        inventory_manager.resources["energy"] = 0
        beacon._process(beacon.SIGNAL_INTERVAL)
        check_nearly(beacon.signal_progress, 30.0, 0.01, "signal beacon pauses without energy")

        beacon.signal_progress = beacon.SIGNAL_MAX
        check("signal beacon can complete", beacon.is_signal_complete())
        check("signal beacon completion text is visible", beacon.get_signal_status_text().contains("100/100"), beacon.get_signal_status_text())

        combat_hud.queue_free()
        beacon.queue_free()
        inventory_manager.resources["energy"] = old_energy
        signal_log_manager.apply_save_data(old_signal_logs)


func _test_tech_unlocks() -> void:
        print("\n[ Tech unlocks ]")

        var tech_manager = _get_autoload("TechManager")
        var inventory_manager = _get_autoload("InventoryManager")
        var build_script = load("res://scripts/build_manager.gd")
        check("TechManager autoload exists", tech_manager != null)
        check("InventoryManager autoload exists for tech test", inventory_manager != null)
        check("build_manager.gd loads for tech test", build_script != null)
        if not tech_manager or not inventory_manager or not build_script:
                return

        var old_blueprint: int = inventory_manager.resources.get("blueprint", 0)
        tech_manager.reset_unlocks()
        inventory_manager.resources["blueprint"] = 0

        check("turret starts unlocked", tech_manager.is_unlocked("turret"))
        check("signal beacon starts unlocked", tech_manager.is_unlocked("signal_beacon"))
        check("shield starts locked", not tech_manager.is_unlocked("shield_generator"))
        check("slow field starts locked", not tech_manager.is_unlocked("slow_field"))
        check("shield cannot unlock without blueprint", not tech_manager.unlock("shield_generator"))

        var build_manager = build_script.new()
        current_scene.add_child(build_manager)
        build_manager.selected_building = build_manager.BUILD_SHIELD_GENERATOR

        var locked_status: String = build_manager.get_selected_unlock_status_text()
        check("build manager reports selected locked tech", not build_manager.is_selected_unlocked())
        check("unlock status shows shield blueprint cost", locked_status.contains("1 blueprint"), locked_status)

        inventory_manager.resources["blueprint"] = 1
        check("build manager can unlock selected shield", build_manager.can_unlock_selected())
        check("unlock selected shield succeeds", build_manager.unlock_selected_tech())
        check("shield unlock consumes blueprint", inventory_manager.resources.get("blueprint", -1) == 0)
        check("shield is unlocked after purchase", build_manager.is_selected_unlocked())

        build_manager.selected_building = build_manager.BUILD_SLOW_FIELD
        inventory_manager.resources["blueprint"] = 1
        check("slow field rejects partial blueprint cost", not build_manager.unlock_selected_tech())
        check("partial failed unlock does not consume blueprint", inventory_manager.resources.get("blueprint", -1) == 1)

        inventory_manager.resources["blueprint"] = 2
        check("slow field unlock succeeds with two blueprints", build_manager.unlock_selected_tech())
        check("slow field unlock consumes two blueprints", inventory_manager.resources.get("blueprint", -1) == 0)
        check("slow field is unlocked after purchase", build_manager.is_selected_unlocked())

        build_manager.queue_free()
        tech_manager.reset_unlocks()
        inventory_manager.resources["blueprint"] = old_blueprint


func _test_save_manager() -> void:
        print("\n[ SaveManager ]")

        var save_manager = _get_autoload("SaveManager")
        var inventory_manager = _get_autoload("InventoryManager")
        var tech_manager = _get_autoload("TechManager")
        var game_manager = _get_autoload("GameManager")
        var signal_log_manager = _get_autoload("SignalLogManager")
        var death_drop_manager = _get_autoload("DeathDropManager")
        var turret_scene = load("res://scenes/turret.tscn")
        var enemy_scene = load("res://scenes/enemy.tscn")
        var signal_script = load("res://scripts/signal_beacon.gd")
        check("SaveManager autoload exists", save_manager != null)
        check("InventoryManager autoload exists for save test", inventory_manager != null)
        check("TechManager autoload exists for save test", tech_manager != null)
        check("GameManager autoload exists for save test", game_manager != null)
        check("SignalLogManager autoload exists for save test", signal_log_manager != null)
        check("DeathDropManager autoload exists for save test", death_drop_manager != null)
        check("turret scene loads for save test", turret_scene != null)
        check("enemy scene loads for save test", enemy_scene != null)
        check("signal_beacon.gd loads for save test", signal_script != null)
        if not save_manager or not inventory_manager or not tech_manager or not game_manager or not signal_log_manager or not death_drop_manager or not turret_scene or not enemy_scene or not signal_script:
                return

        var old_resources: Dictionary = inventory_manager.resources.duplicate(true)
        var old_unlocked: Dictionary = tech_manager.unlocked.duplicate(true)
        var old_is_night: bool = game_manager.is_night
        var old_wave: int = game_manager.wave_number
        var old_enemies_alive: int = game_manager.enemies_alive
        var old_base_health: float = game_manager.base_health
        var old_base_shield: float = game_manager.base_shield
        var old_max_shield: float = game_manager.max_base_shield
        var old_phase_time: float = game_manager.phase_time_remaining
        var old_direction: String = game_manager.last_wave_direction
        var old_signal_logs: Dictionary = signal_log_manager.capture_save_data()
        var old_death_drop: Dictionary = death_drop_manager.capture_save_data()

        for existing_structure in get_nodes_in_group("built_structures"):
                if existing_structure and is_instance_valid(existing_structure):
                        existing_structure.queue_free()
        for existing_enemy in get_nodes_in_group("enemies"):
                if existing_enemy and is_instance_valid(existing_enemy):
                        existing_enemy.queue_free()

        inventory_manager.resources["iron"] = 7
        inventory_manager.resources["blueprint"] = 3
        tech_manager.reset_unlocks()
        tech_manager.unlocked["shield_generator"] = true
        game_manager.is_night = true
        game_manager.wave_number = 4
        game_manager.enemies_alive = 1
        game_manager.base_health = 55.0
        game_manager.base_shield = 12.0
        game_manager.max_base_shield = 30.0
        game_manager.phase_time_remaining = 123.0
        game_manager.last_wave_direction = "NE"
        signal_log_manager.reset_logs()
        signal_log_manager.register_signal_progress(100.0)
        death_drop_manager.apply_save_data({
                "payload": {"iron": 2, "energy": 1},
                "position": [8.0, 0.75, -3.0]
        })

        var turret = turret_scene.instantiate()
        turret.add_to_group("built_structures")
        turret.add_to_group("built_turrets")
        turret.position = Vector3(3.0, 1.0, -2.0)
        turret.scale = Vector3.ONE * 1.16
        turret.set_meta("build_id", "turret")
        turret.set_meta("build_label", "Turret")
        turret.set_meta("build_cost", {"iron": 20, "void_crystal": 5})
        turret.set_meta("structure_max_health", 100.0)
        turret.set_meta("structure_health", 42.0)
        turret.set_meta("upgrade_level", 2)
        turret.damage = 22.0
        turret.fire_rate = 1.5
        current_scene.add_child(turret)

        var signal_beacon = signal_script.new()
        signal_beacon.position = Vector3(6.0, 1.0, -1.0)
        signal_beacon.set_meta("build_id", "signal_beacon")
        signal_beacon.set_meta("build_label", "Signal Beacon")
        signal_beacon.set_meta("build_cost", {"iron": 30, "void_crystal": 10, "energy": 10, "blueprint": 2})
        signal_beacon.set_meta("structure_max_health", 100.0)
        signal_beacon.set_meta("structure_health", 88.0)
        signal_beacon.signal_progress = 40.0
        signal_beacon.signal_power_timer = 2.0
        current_scene.add_child(signal_beacon)
        signal_beacon.add_to_group("built_structures")

        var enemy = enemy_scene.instantiate()
        enemy.position = Vector3(-4.0, 0.5, 3.0)
        enemy.name = "Scout_Save_Test"
        enemy.health = 17.0
        enemy.speed = 6.5
        enemy.damage = 8.0
        enemy.scale = Vector3.ONE * 0.85
        enemy.set_meta("wave_variant", "scout")
        enemy.set_meta("wave_variant_label", "Scout")
        current_scene.add_child(enemy)

        var data: Dictionary = save_manager.capture_save_data()
        check("save data captures inventory", int(data["inventory"].get("iron", 0)) == 7)
        check("save data captures tech unlock", bool(data["tech"].get("shield_generator", false)))
        check("save data captures game state", int(data["game"].get("wave_number", 0)) == 4)
        check("save data captures built structures", (data["structures"] as Array).size() >= 1)
        check("save data captures signal structures", _save_data_has_build(data, "signal_beacon"))
        check("save data captures signal logs", data.has("signal_logs"))
        check("save data captures extraction holdout", bool(data["signal_logs"].get("extraction_holdout_active", false)))
        var saved_death_payload: Dictionary = data["death_drop"].get("payload", {})
        check("save data captures death drop", saved_death_payload.has("iron"))
        check("save data captures active enemies", (data["enemies"] as Array).size() >= 1)

        inventory_manager.resources["iron"] = 0
        inventory_manager.resources["blueprint"] = 0
        tech_manager.unlocked["shield_generator"] = false
        signal_log_manager.reset_logs()
        death_drop_manager.reset_drop()
        game_manager.base_health = 10.0
        game_manager.enemies_alive = 0
        turret.queue_free()
        signal_beacon.queue_free()
        enemy.queue_free()

        check("apply save data succeeds", save_manager.apply_save_data(data))
        check("load restores inventory iron", inventory_manager.resources.get("iron", -1) == 7)
        check("load restores blueprint", inventory_manager.resources.get("blueprint", -1) == 3)
        check("load restores shield unlock", bool(tech_manager.unlocked.get("shield_generator", false)))
        check("load restores signal log milestone", signal_log_manager.is_log_unlocked("signal_100"))
        check("load restores extraction holdout", signal_log_manager.is_extraction_active())
        check("load restores death drop", death_drop_manager.has_active_drop())
        check_nearly(game_manager.base_health, 55.0, 0.01, "load restores base health")
        check("load restores wave number", game_manager.wave_number == 4)
        check("load restores enemy count", game_manager.enemies_alive == 1)

        var restored_turret: Node = null
        for structure in get_nodes_in_group("built_structures"):
                var structure_node := structure as Node
                if structure_node and is_instance_valid(structure_node) and not structure_node.is_queued_for_deletion() and str(structure_node.get_meta("build_id", "")) == "turret":
                        restored_turret = structure_node
                        break
        check("load restores saved turret", restored_turret != null)
        if restored_turret:
                check_nearly(float(restored_turret.get_meta("structure_health", 0.0)), 42.0, 0.01, "load restores structure health")
                check("load restores upgrade level", int(restored_turret.get_meta("upgrade_level", 0)) == 2)

        var restored_signal: Node = null
        for structure in get_nodes_in_group("built_structures"):
                var structure_node := structure as Node
                if structure_node and is_instance_valid(structure_node) and not structure_node.is_queued_for_deletion() and str(structure_node.get_meta("build_id", "")) == "signal_beacon":
                        restored_signal = structure_node
                        break
        check("load restores signal beacon", restored_signal != null)
        if restored_signal:
                check_nearly(float(restored_signal.get("signal_progress")), 40.0, 0.01, "load restores signal progress")
                check_nearly(float(restored_signal.get_meta("structure_health", 0.0)), 88.0, 0.01, "load restores signal structure health")

        var restored_enemy: Node = null
        for active_enemy in get_nodes_in_group("enemies"):
                var enemy_node := active_enemy as Node
                if enemy_node and is_instance_valid(enemy_node) and not enemy_node.is_queued_for_deletion() and str(enemy_node.get_meta("wave_variant", "")) == "scout":
                        restored_enemy = enemy_node
                        break
        check("load restores saved enemy", restored_enemy != null)
        if restored_enemy:
                check_nearly(float(restored_enemy.get("health")), 17.0, 0.01, "load restores enemy health")
                check("load restores enemy variant label", str(restored_enemy.get_meta("wave_variant_label", "")) == "Scout")

        for restored_structure in get_nodes_in_group("built_structures"):
                if restored_structure and is_instance_valid(restored_structure):
                        restored_structure.queue_free()
        for restored_enemy_node in get_nodes_in_group("enemies"):
                if restored_enemy_node and is_instance_valid(restored_enemy_node):
                        restored_enemy_node.queue_free()
        inventory_manager.resources = old_resources
        tech_manager.unlocked = old_unlocked
        game_manager.is_night = old_is_night
        game_manager.wave_number = old_wave
        game_manager.enemies_alive = old_enemies_alive
        game_manager.base_health = old_base_health
        game_manager.base_shield = old_base_shield
        game_manager.max_base_shield = old_max_shield
        game_manager.phase_time_remaining = old_phase_time
        game_manager.last_wave_direction = old_direction
        signal_log_manager.apply_save_data(old_signal_logs)
        death_drop_manager.apply_save_data(old_death_drop)


func _test_resource_scanner() -> void:
        print("\n[ Resource scanner ]")

        var scanner_script = load("res://scripts/resource_scanner.gd")
        var resource_script = load("res://scripts/resource_node.gd")
        check("resource_scanner.gd loads for scanner test", scanner_script != null)
        check("resource_node.gd loads for scanner test", resource_script != null)
        if not scanner_script or not resource_script:
                return

        var player := Node3D.new()
        player.name = "ScannerTestPlayer"
        player.add_to_group("player")
        player.position = Vector3(1000.0, 0.0, 1000.0)
        current_scene.add_child(player)

        var resource = resource_script.new()
        resource.resource_type = "iron"
        resource.position = Vector3(1005.0, 0.0, 1004.0)
        current_scene.add_child(resource)

        var scanner = scanner_script.new()
        current_scene.add_child(scanner)
        scanner._scan_now()
        var hint: String = scanner.get_scan_hint()
        check("scanner finds nearby iron", hint.contains("iron") and hint.contains("6m"), hint)

        scanner.selected_index = 1
        scanner._scan_now()
        check("scanner filters selected resource type", scanner.nearest_resource == null)

        var oxygen_plant := Node3D.new()
        oxygen_plant.name = "ScannerTestOxygenPlant"
        oxygen_plant.add_to_group("oxygen_plants")
        oxygen_plant.position = Vector3(1003.0, 0.0, 1000.0)
        current_scene.add_child(oxygen_plant)

        scanner.selected_index = 4
        scanner._scan_now()
        var oxygen_hint: String = scanner.get_scan_hint()
        check("scanner finds oxygen plant", oxygen_hint.contains("O2 plant") and oxygen_hint.contains("3m"), oxygen_hint)

        scanner.queue_free()
        oxygen_plant.free()
        resource.free()
        player.free()


func _test_objective_tracker() -> void:
        print("\n[ Objective tracker ]")

        var objective_script = load("res://scripts/objective_tracker.gd")
        var game_manager = _get_autoload("GameManager")
        var inventory_manager = _get_autoload("InventoryManager")
        var signal_log_manager = _get_autoload("SignalLogManager")
        check("objective_tracker.gd loads for objective test", objective_script != null)
        check("GameManager autoload exists for objective test", game_manager != null)
        check("InventoryManager autoload exists", inventory_manager != null)
        check("SignalLogManager autoload exists for objective test", signal_log_manager != null)
        if not objective_script or not game_manager or not inventory_manager or not signal_log_manager:
                return

        var old_is_night: bool = game_manager.is_night
        var old_enemies_alive: int = game_manager.enemies_alive
        var old_base_health: float = game_manager.base_health
        var old_iron: int = inventory_manager.resources.get("iron", 0)
        var old_void: int = inventory_manager.resources.get("void_crystal", 0)
        var old_biomass: int = inventory_manager.resources.get("biomass", 0)
        var old_signal_logs: Dictionary = signal_log_manager.capture_save_data()
        game_manager.is_night = false
        game_manager.enemies_alive = 0
        game_manager.base_health = game_manager.MAX_BASE_HEALTH
        inventory_manager.resources["iron"] = 0
        inventory_manager.resources["void_crystal"] = 2
        inventory_manager.resources["biomass"] = 0

        var tracker = objective_script.new()
        current_scene.add_child(tracker)

        var missing_text: String = tracker.get_missing_resources_text({"iron": 20, "void_crystal": 5})
        check("objective missing text shows iron gap", missing_text.contains("20 iron"), missing_text)
        check("objective missing text shows crystal gap", missing_text.contains("3 crystal"), missing_text)

        signal_log_manager.apply_save_data({
                "unlocked_logs": {"signal_100": true},
                "latest_message": "Radio: rescue ping locked.",
                "extraction_holdout_active": true,
                "extraction_time_remaining": 90.0
        })
        game_manager.enemies_alive = 2
        var extraction_text: String = tracker.get_objective_text()
        check("objective prioritizes extraction holdout", extraction_text.contains("extraction") and extraction_text.contains("Enemies 2"), extraction_text)
        signal_log_manager.reset_logs()
        game_manager.enemies_alive = 0

        var damaged_structure := Node3D.new()
        damaged_structure.add_to_group("built_structures")
        damaged_structure.set_meta("structure_max_health", 100.0)
        damaged_structure.set_meta("structure_health", 40.0)
        current_scene.add_child(damaged_structure)

        inventory_manager.resources["iron"] = 5
        inventory_manager.resources["biomass"] = 2
        var repair_objective: String = tracker.get_objective_text()
        check("objective asks to repair damaged structure when funded", repair_objective.contains("Repair damaged structure"), repair_objective)

        inventory_manager.resources["iron"] = 0
        inventory_manager.resources["biomass"] = 0
        var gather_repair_objective: String = tracker.get_objective_text()
        check("objective asks for structure repair resources", gather_repair_objective.contains("structure repair"), gather_repair_objective)

        damaged_structure.free()
        signal_log_manager.reset_logs()
        var player := Node3D.new()
        player.name = "ObjectiveSignalCachePlayer"
        player.add_to_group("player")
        player.position = Vector3.ZERO
        current_scene.add_child(player)
        signal_log_manager.register_signal_progress(25.0)
        var cache_objective: String = tracker.get_objective_text()
        check("objective asks to locate signal cache", cache_objective.contains("signal cache"), cache_objective)
        player.free()
        signal_log_manager.apply_save_data(old_signal_logs)

        tracker.queue_free()
        game_manager.is_night = old_is_night
        game_manager.enemies_alive = old_enemies_alive
        game_manager.base_health = old_base_health
        inventory_manager.resources["iron"] = old_iron
        inventory_manager.resources["void_crystal"] = old_void
        inventory_manager.resources["biomass"] = old_biomass


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


func _save_data_has_build(data: Dictionary, build_id: String) -> bool:
        var structures: Array = data.get("structures", [])
        for item in structures:
                if typeof(item) == TYPE_DICTIONARY and str(item.get("build_id", "")) == build_id:
                        return true
        return false


func _find_signal_cache(cache_id: String) -> Node:
        for cache in get_nodes_in_group("signal_caches"):
                var cache_node := cache as Node
                if cache_node and is_instance_valid(cache_node) and not cache_node.is_queued_for_deletion() and str(cache_node.get("cache_id")) == cache_id:
                        return cache_node
        return null


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
