extends SceneTree

var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("_run")

func _check(value: bool, label: String) -> void:
	if value:
		print("PASS: " + label)
	else:
		failures.append(label)
		printerr("FAIL: " + label)

func _run() -> void:
	var scene := load("res://scenes/main.tscn") as PackedScene
	var main := scene.instantiate() as NativeMain
	main.save_path = "user://star_abyss_native_cast_verify.json"
	root.add_child(main)
	await process_frame
	var beast := main.beast
	var player := main.player
	beast.set_physics_process(false)
	for enemy in main.enemies:
		enemy.set_physics_process(false)
	beast.hp = NativeRiftwing.MAX_HP
	player.realm = 8
	player.energy = 100.0
	player.global_position = beast.global_position + Vector3(0.0, 10.0, 20.0)
	player.flight_active = true
	main.world.update_stream(player.global_position)
	var camera := player.get_node("CameraPivot/Camera3D") as Camera3D
	camera.look_at(beast.global_position + Vector3.UP * 1.3)
	main._try_air_cast()
	_check(main.pending_cast_time > 1.7 and beast.hp == NativeRiftwing.MAX_HP, "R8 void break begins with authored windup, no instant damage")
	var cast_vfx := main.ascension._active_cast_vfx
	_check(cast_vfx != null and cast_vfx.mesh_root != null and cast_vfx.mesh_root.scene_file_path.ends_with("qi-fracture-r2.glb") and main.ascension._effects.is_empty(), "R8 cast instantiates the authored R2 void fracture")
	for i in range(90):
		await physics_frame
	_check(beast.hp == NativeRiftwing.MAX_HP, "R8 damage waits through first 1.5 seconds")
	for i in range(35):
		await physics_frame
	_check(beast.hp == NativeRiftwing.MAX_HP - 85000.0, "R8 void break hits at release")
	_check(player.energy < 82.0 and player.energy > 80.0, "R8 cast spends 18 energy with normal flight drain")
	for tier in [6, 9]:
		beast.hp = NativeRiftwing.MAX_HP
		player.realm = tier
		player.energy = 100.0
		player.global_position = beast.global_position + Vector3(0.0, 10.0, 20.0)
		player.flight_active = true
		main.world.update_stream(player.global_position)
		camera.look_at(beast.global_position + Vector3.UP * 1.3)
		main.attack_ready = 0.0
		main._try_air_cast()
		var expected_asset := "qi-domain-r2.glb" if tier == 6 else "qi-dao-r2.glb"
		var tier_vfx := main.ascension._active_cast_vfx
		_check(tier_vfx != null and tier_vfx.mesh_root != null and tier_vfx.mesh_root.scene_file_path.ends_with(expected_asset) and beast.hp == NativeRiftwing.MAX_HP, "R%d cast loads its authored R2 asset before damage" % tier)
		var windup := float(NativeMain.AIR_CAST_RULES[tier]["windup"])
		for i in range(ceili((windup + 0.12) * 60.0)):
			await physics_frame
		var expected_damage := float(NativeMain.AIR_CAST_RULES[tier]["damage"])
		_check(absf(beast.hp - (NativeRiftwing.MAX_HP - expected_damage)) < 0.01 and main.pending_cast.is_empty(), "R%d cast deals its authoritative damage once at release" % tier)
	main.queue_free()
	await process_frame
	if failures.is_empty():
		print("NATIVE AIR CAST VERIFY 9/9")
		quit(0)
	else:
		printerr("NATIVE AIR CAST VERIFY FAILED " + str(failures.size()))
		quit(1)
