extends SceneTree
# Persistence fixture. This verifies serialization, not obtaining loot in combat.
var checks: Array = []
func _initialize() -> void: call_deferred("_run")
func _check(label: String, passed: bool) -> void: checks.append({"label":label,"pass":passed})
func _run() -> void:
	var sha := FileAccess.get_sha256("res://scripts/native_main.gd")
	var slot := "user://r3_independent_save_"+str(Time.get_ticks_usec())+".json"
	var packed := load("res://scenes/main.tscn") as PackedScene
	var game = packed.instantiate()
	if not "save_path" in game:
		quit(2)
		return
	game.save_path = slot
	root.add_child(game)
	for i in range(5): await physics_frame
	game.player.teleport_to_ground(0,260)
	game.player.realm = 6
	game.player.health = 123456.0
	game.player.energy = 73.0
	game.fragments = 7
	game.investigated.assign(["beacon"])
	game._save_game()
	var raw: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(slot))
	_check("dedicated save written",not raw.is_empty())
	game.initialized = false
	game.queue_free()
	await process_frame
	var restored = packed.instantiate()
	restored.save_path = slot
	root.add_child(restored)
	for i in range(5): await physics_frame
	_check("realm survives",restored.player.realm==6)
	_check("health survives",absf(restored.player.health-123456.0)<0.01)
	_check("energy survives allowing normal regeneration",absf(restored.player.energy-73.0)<1.0)
	_check("inventory survives",restored.fragments==7)
	_check("investigation survives",restored.investigated.has("beacon"))
	_check("safe player position survives",restored.player.global_position.distance_to(Vector3(0,restored.world.height_at(0,260),260))<0.1)
	_check("vehicle remains separate from player",restored.skimmer.global_position.distance_to(restored.player.global_position)>30)
	_check("world remains six kilometres",NativePlayer.WORLD_HALF>2980)
	_check("main source stable during test",sha==FileAccess.get_sha256("res://scripts/native_main.gd"))
	var output := FileAccess.open("res://reports/r3-independent/save-preservation.json",FileAccess.WRITE)
	output.store_string(JSON.stringify({"utc":Time.get_datetime_string_from_system(true),"main_sha256":sha,"slot":slot,"checks":checks,"saved_fixture":raw,"evidence":"serialization fixture, not gameplay loot acquisition or manual F5 test"}))
	output.close()
	restored.initialized=false
	restored.queue_free()
	await process_frame
	DirAccess.remove_absolute(ProjectSettings.globalize_path(slot))
	print("R3_SAVE_INDEPENDENT ",JSON.stringify(checks))
	quit(1 if checks.any(func(c):return not c.pass) else 0)
