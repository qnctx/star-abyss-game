extends SceneTree
## Full main scene, real attack entry/timers; independent save and hidden capture.
const SLOT := "user://star_abyss_motion_combat_sequence.json"
const OUTPUT := "res://assets/motion-r2/evidence/main-combat"
var events: Array = []
var views_to_capture: Array[int] = [0,1,2]
func _initialize() -> void:
	call_deferred("run")
func run() -> void:
	DirAccess.make_dir_recursive_absolute(OUTPUT)
	var game := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = SLOT
	root.add_child(game)
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	for f in range(4):await physics_frame
	game.set_physics_process(false)
	game.player.set_physics_process(false)
	game.beast.set_physics_process(false)
	var player := game.player
	player.teleport_to_ground(0.0,190.0)
	# Face the existing moon light; no extra light or altered materials in evidence.
	player.rotation = Vector3(0,PI,0)
	player.velocity = Vector3.ZERO
	player.horizontal_speed = 0.0
	player.flight_active = false
	player.health = player.max_health
	var camera := Camera3D.new()
	game.add_child(camera)
	camera.fov = 42
	camera.current = true
	var views := [Vector3(4.3,2.0,0),Vector3(3.2,2.0,-3.2),Vector3(6.0,2.4,-0.7),Vector3(6.0,2.4,-0.7)]
	var original_beast_position := game.beast.global_position
	for view in views_to_capture:
		var target_distance := 2.0 if view==3 else 2.3
		game.beast.global_position = player.global_position-player.basis.z*target_distance if view>=2 else original_beast_position
		if view>=2:game.beast.rotation.y=player.rotation.y+PI
		game.beast.hp = NativeRiftwing.MAX_HP
		events.append({"view":view,"target_center_distance":target_distance if view>=2 else -1.0})
		game.attack_ready = 0.0
		game.combo = 0
		game.queued_attack = false
		game.pending_contact = -1.0
		player._attack_name = ""
		player._hurt_time = 0.0
		player._visual_hitstop = 0.0
		player._r2.step(1.0,{})
		var last_serial := player._attack_serial
		var started := 0
		var last_hp := game.beast.hp
		for f in range(105):
			# Press once, then during each buffered cancel window. No direct clip seek.
			if f==6 or (started>0 and started<3 and game.attack_ready<=0.12 and not game.queued_attack):game._try_attack()
			player._update_visual(1.0/30.0)
			game._physics_process(1.0/30.0)
			if player._attack_serial != last_serial:
				started += 1
				events.append({"view":view,"frame":f,"attack":player._attack_name,"serial":player._attack_serial})
				last_serial=player._attack_serial
			if game.beast.hp != last_hp:
				events.append({"view":view,"frame":f,"damage":last_hp-game.beast.hp,"hp":game.beast.hp,"visual_elapsed":player._attack_elapsed,"windup":player._attack_windup})
				last_hp=game.beast.hp
			camera.global_position=player.global_position+player.basis*views[view]
			camera.look_at(player.global_position+Vector3.UP*1.0)
			game._update_hud()
			await process_frame
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(OUTPUT+"/v%d-%03d.png"%[view,f])
	var file := FileAccess.open(OUTPUT+("/events-contact-refresh.json" if not views_to_capture.has(0) else "/events.json"),FileAccess.WRITE)
	file.store_string(JSON.stringify({"events":events,"driver_sha256":FileAccess.get_sha256("res://scripts/native_motion_r2.gd"),"main_sha256":FileAccess.get_sha256("res://scripts/native_main.gd"),"scope":"Real Main attack entry, buffer and timers with frozen world physics; stationary whiff views and/or real Riftwing hit view. Creature AI/physics frozen; no claim of human input or movement acceptance."},"  "))
	game.initialized = false
	game.queue_free()
	await process_frame
	if FileAccess.file_exists(SLOT):DirAccess.remove_absolute(ProjectSettings.globalize_path(SLOT))
	print("MAIN_COMBAT_SEQUENCE ",JSON.stringify(events))
	quit()
