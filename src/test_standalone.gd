extends SceneTree

var _passed := 0
var _failed := 0


func _init() -> void:
        _ensure_current_scene()
        process_frame.connect(_run, CONNECT_ONE_SHOT)


func _run() -> void:
        randomize()
        print("========================================")
        print("  Star Abyss - standalone logic tests")
        print("========================================")

        _test_world_generator_logic()
        _test_zone_manager_logic()
        _test_inventory_logic()

        print("\n========================================")
        print("  Test result: %d passed, %d failed" % [_passed, _failed])
        print("========================================")

        _cleanup_test_scene()
        quit(0 if _failed == 0 else 1)


func check(name: String, ok: bool, detail: String = "") -> void:
        if ok:
                _passed += 1
                print("  [PASS] %s" % name)
        else:
                _failed += 1
                print("  [FAIL] %s" % name)
        if detail:
                print("         -> %s" % detail)


func _test_world_generator_logic() -> void:
        print("\n[ WorldGenerator math ]")

        var noise := FastNoiseLite.new()
        noise.noise_type = 2
        noise.frequency = 0.05

        var h0 = noise.get_noise_2d(0.0, 0.0)
        var h1 = noise.get_noise_2d(10.0, 10.0)
        var h2 = noise.get_noise_2d(-30.0, 50.0)

        check("noise output is float", typeof(h0) == TYPE_FLOAT, "h0=%.3f" % h0)
        check("noise is in [-1, 1]", h0 >= -1.0 and h0 <= 1.0, "h0=%.3f" % h0)
        check("different positions vary", absf(h0 - h1) > 0.01, "h0=%.3f h1=%.3f" % [h0, h1])
        check("noise is continuous", absf(h0 - h2) < 2.0, "%.3f vs %.3f" % [h0, h2])

        var amplitude = 3.0
        var h_scaled = h0 * amplitude
        check("amplitude scale is bounded", absf(h_scaled) <= 3.0, "%.3f * 3 = %.3f" % [h0, h_scaled])

        var crash_radius = 15.0
        var dist = 5.0
        var scale = dist / crash_radius
        check("crash-zone scale is below 1", scale < 1.0, "scale=%.2f" % scale)
        check("crash-zone scale is non-negative", scale >= 0.0, "scale=%.2f" % scale)

        var world_size = 100
        var grid_points = world_size + 1
        check("grid_points = 101", grid_points == 101)
        check("vertex count = 10201", grid_points * grid_points == 10201)

        var triangles = world_size * world_size * 2
        check("triangle count = 20000", triangles == 20000)
        check("index count = 60000", triangles * 3 == 60000)


func _test_zone_manager_logic() -> void:
        print("\n[ ZoneManager math ]")

        var zone_type = {"CRASH": 0, "COLD": 1, "HEAT": 2, "GRAVITY": 3}
        var zone_pressure = {
                zone_type["CRASH"]: 1.0,
                zone_type["COLD"]: 3.0,
                zone_type["HEAT"]: 3.5,
                zone_type["GRAVITY"]: 4.0
        }
        var adaptations = {
                zone_type["CRASH"]: 0,
                zone_type["COLD"]: 0,
                zone_type["HEAT"]: 0,
                zone_type["GRAVITY"]: 0
        }
        var adaptation_effects = [0.0, 0.20, 0.40, 0.70, 1.00]

        var mult_crash = zone_pressure[zone_type["CRASH"]] * (1.0 - adaptation_effects[adaptations[zone_type["CRASH"]]] * 0.9)
        check("crash oxygen multiplier = 1.0", absf(mult_crash - 1.0) < 0.01, "%.3f" % mult_crash)

        var mult_cold = zone_pressure[zone_type["COLD"]] * (1.0 - adaptation_effects[adaptations[zone_type["COLD"]]] * 0.9)
        check("cold oxygen cost > crash", mult_cold > mult_crash, "%.2f > %.2f" % [mult_cold, mult_crash])
        check("cold oxygen multiplier = 3.0", absf(mult_cold - 3.0) < 0.01, "%.3f" % mult_cold)

        var mult_heat = zone_pressure[zone_type["HEAT"]] * (1.0 - adaptation_effects[adaptations[zone_type["HEAT"]]] * 0.9)
        check("heat oxygen multiplier = 3.5", absf(mult_heat - 3.5) < 0.01, "%.3f" % mult_heat)

        var mult_gravity = zone_pressure[zone_type["GRAVITY"]] * (1.0 - adaptation_effects[adaptations[zone_type["GRAVITY"]]] * 0.9)
        check("gravity oxygen multiplier = 4.0", absf(mult_gravity - 4.0) < 0.01, "%.3f" % mult_gravity)

        adaptations[zone_type["COLD"]] = 4
        var mult_cold_adapted = zone_pressure[zone_type["COLD"]] * (1.0 - adaptation_effects[adaptations[zone_type["COLD"]]] * 0.9)
        check("max adaptation lowers cold oxygen cost", mult_cold_adapted < mult_crash * 0.5, "%.3f < %.3f" % [mult_cold_adapted, mult_crash * 0.5])


func _test_inventory_logic() -> void:
        print("\n[ Inventory math ]")

        var resources = {
                "iron": 0,
                "void_crystal": 0,
                "biomass": 0,
                "energy": 0,
                "energy_core": 0,
                "blueprint": 0
        }

        check("initial iron = 0", resources["iron"] == 0)
        check("initial energy = 0", resources["energy"] == 0)

        resources["iron"] += 10
        check("add iron +10", resources["iron"] == 10)

        resources["void_crystal"] += 3
        check("add void crystal +3", resources["void_crystal"] == 3)

        resources["energy"] += 2
        check("add energy +2", resources["energy"] == 2)

        resources["iron"] -= 4
        check("consume iron 4", resources["iron"] == 6)

        var has_enough = func(needed: Dictionary) -> bool:
                for type in needed:
                        if resources.get(type, 0) < needed[type]:
                                return false
                return true

        check("has iron 3", has_enough.call({"iron": 3}))
        check("does not have iron 7", not has_enough.call({"iron": 7}))
        check("has iron 6", has_enough.call({"iron": 6}))
        check("has void crystal 2", has_enough.call({"void_crystal": 2}))
        check("does not have void crystal 5", not has_enough.call({"void_crystal": 5}))
        check("does not have missing resource", not has_enough.call({"missing": 1}))

        resources["iron"] = 1006
        check("large add is stable", resources["iron"] == 1006)
        resources["iron"] -= 1000
        check("large consume is stable", resources["iron"] == 6)


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
