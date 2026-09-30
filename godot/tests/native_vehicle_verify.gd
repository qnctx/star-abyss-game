extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var main := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	main.save_path = "user://star_abyss_native_vehicle_verify.json"
	root.add_child(main)
	await physics_frame
	var car := main.skimmer
	var start := car.global_position
	var initial_hit := car.move_and_collide(Vector3(0.0, 0.0, -1.0))
	if initial_hit != null or car.global_position.distance_to(start) < 0.9:
		printerr("FAIL: skimmer cannot drive across open terrain")
		quit(1)
		return
	print("PASS: skimmer drives over open terrain")
	car.global_position = Vector3(7.0, main.world.height_at(7.0, 188.0), 188.0)
	await physics_frame
	var wall_hit := car.move_and_collide(Vector3(0.0, 0.0, -15.0))
	if wall_hit == null or car.global_position.z < 178.0:
		printerr("FAIL: skimmer crossed medical building wall")
		quit(1)
		return
	print("PASS: skimmer stops at authored medical wall")
	main.queue_free()
	await process_frame
	quit(0)
