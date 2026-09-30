extends "res://tests/native_martial_environment_runtime.gd"
## Short real G/R cancel/retry/terrain test; never writes the producer handoff.
func _run() -> void:
	capture = false
	game = (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = "user://martial_descent_diagnostic_" + str(Time.get_ticks_usec()) + ".json"
	root.add_child(game)
	await _frames(100)
	environment = get_first_node_in_group("native_environment_damage") as NativeEnvironmentDamage
	game.beast.set_physics_process(false)
	game.beast.global_position = Vector3(500, 50, 500)
	for enemy in game.enemies:
		enemy.set_physics_process(false)
		enemy.global_position = Vector3(500, 50, 500)
	game.combat_event.connect(_combat_observed)
	environment.damaged.connect(func(event: Dictionary): environment_events.append(event))
	game.player.descent_strike_landed.connect(func(id: int, point: Vector3, normal: Vector3, speed: float): landing_events.append({"id":id,"point":point,"normal":normal,"speed":speed}))
	await _descent_loop(false)
	var output := FileAccess.open(OUT + "/descent-diagnostic.json", FileAccess.WRITE)
	output.store_string(JSON.stringify({"checks":checks,"failed":failed,"frames":frame_states,"landing":landing_events,"environment":environment_events,"last_result":game.martial.last_result}, "\t"))
	print("MARTIAL_DESCENT_DIAGNOSTIC ", JSON.stringify({"checks":checks.size(),"failed":failed}))
	game.initialized = false
	game.queue_free()
	await process_frame
	quit(0 if failed.is_empty() else 1)
