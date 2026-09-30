extends SceneTree

var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("_run")

func _check(value: bool, label: String) -> void:
	if not value:
		failures.append(label)
		printerr("FAIL: " + label)
	else:
		print("PASS: " + label)

func _run() -> void:
	var scene := load("res://scenes/main.tscn") as PackedScene
	var main := scene.instantiate() as NativeMain
	main.save_path = "user://star_abyss_native_blink_verify.json"
	root.add_child(main)
	await process_frame
	var player := main.player
	var blink := main.ascension
	var world := main.world
	player.teleport_to_ground(200.0, 200.0)
	world.update_stream(player.global_position)
	player.realm = 4
	var before := player.global_position
	var energy := player.energy
	var locked := blink.try_blink("short")
	_check(not locked.get("ok", false) and player.global_position == before and player.energy == energy, "R4 cannot blink or spend energy")
	player.realm = 6
	var short_start := Time.get_ticks_usec()
	var short := blink.try_blink("short")
	print("R6 short blink CPU ms: %.3f" % ((Time.get_ticks_usec() - short_start) / 1000.0))
	_check(short.get("ok", false) and absf(player.global_position.distance_to(before) - 12.0) < 1.0, "R6 short blink travels authored 12m")
	_check(absf(player.energy - energy + 12.0) < 0.01 and blink.serial == 1, "short blink spends 12 energy exactly once")
	_check(blink._effects.size() == 2, "origin and destination use existing 3D aperture GLB")
	var cooldown := blink.try_blink("short")
	_check(not cooldown.get("ok", false) and blink.serial == 1, "cooldown rejects repeat without mutation")
	player.teleport_to_ground(7.0, 188.0)
	world.update_stream(player.global_position)
	player.energy = 100.0
	blink.ability_time = blink.cooldown_until + 1.0
	var wall_origin := player.global_position
	var blocked := blink.try_blink("short")
	_check(not blocked.get("ok", false) and player.global_position == wall_origin and player.energy == 100.0, "camp wall blocks blink without spending energy")
	player.realm = 9
	player.global_position = Vector3(200.0, world.height_at(200.0, 200.0) + 1000.0, 200.0)
	player.flight_active = true
	player.energy = 100.0
	blink.ability_time = blink.cooldown_until + 1.0
	var airborne_origin := player.global_position
	var preview_start := Time.get_ticks_usec()
	var preview := blink._preview(airborne_origin, Vector3.FORWARD, 1800.0)
	print("R9 route preview CPU ms: %.3f" % ((Time.get_ticks_usec() - preview_start) / 1000.0))
	_check(preview.get("ok", false), "R9 full route is analytically safe")
	var long_start := Time.get_ticks_usec()
	var long := blink.try_blink("long")
	print("R9 long blink CPU ms: %.3f" % ((Time.get_ticks_usec() - long_start) / 1000.0))
	_check(long.get("ok", false) and absf(player.global_position.distance_to(airborne_origin) - 1800.0) < 0.05, "R9 long blink covers 1800m while airborne")
	_check(absf(player.energy - 75.0) < 0.01 and player.flight_active, "long blink costs 25 energy and preserves flight")
	_check(blink._effects.size() == 4, "R9 adds authored Dao gate at both ends")
	var saved := blink.snapshot()
	blink.restore({"time": 0.0, "cooldown_until": 0.0, "serial": 0})
	blink.restore(saved)
	_check(blink.serial == 2 and blink.cooldown_until > blink.ability_time, "blink cooldown survives save roundtrip")
	main.queue_free()
	await process_frame
	if failures.is_empty():
		print("NATIVE BLINK VERIFY 11/11")
		quit(0)
	else:
		printerr("NATIVE BLINK VERIFY FAILED " + str(failures.size()))
		quit(1)
