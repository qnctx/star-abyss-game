extends SceneTree
## Automated main-path visual evidence, not a claim of live keyboard feel.
## The whole main scene, character, enemies and VFX retain real physics clocks.
var out := "res://assets/vfx-r3/evidence/full-world"
var write_png := true
var game: Node3D
var records: Array = []
var events: Array = []
var active := false
var elapsed := 0.0
var tier := 4
var camera_view := 0
var frame := 0
var capture_frame := -1
var profile: Dictionary
var observer_camera: Camera3D
var observed_effect: Node3D

class PhysicsObserver extends Node:
	var tick: Callable
	func _physics_process(delta: float) -> void:
		tick.call(delta)

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	write_png = not OS.get_cmdline_user_args().has("--no-png")
	if not write_png:
		out += "/baseline"
	var args := OS.get_cmdline_user_args()
	var tag_index := args.find("--capture-tag")
	if tag_index >= 0 and tag_index+1 < args.size():
		out += "/" + args[tag_index+1]
	DirAccess.make_dir_recursive_absolute(out)
	game = load("res://scenes/main.tscn").instantiate()
	game.save_path = "user://star_abyss_vfx_r3_visual_%d.json" % Time.get_ticks_usec()
	root.add_child(game)
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	game.combat_event.connect(func(e: Dictionary):
		var entry := e.duplicate(true)
		entry["realm"] = game.player.realm
		entry["view"] = camera_view
		events.append(entry))
	for i in range(12):
		await physics_frame
	var observer := PhysicsObserver.new()
	observer.process_physics_priority = 200
	observer.tick = _observe
	game.add_child(observer)
	observer_camera = Camera3D.new()
	observer_camera.fov = 56
	game.add_child(observer_camera)
	var tiers := [4,5,6,8,9]
	var tier_index := args.find("--tier")
	if tier_index >= 0 and tier_index+1 < args.size():
		tiers = [int(args[tier_index+1])]
	# 0 = native third-person air, 1 = observer side air, 2 = native ground.
	for view in range(3):
		camera_view = view
		for rank in tiers:
			tier = rank
			game._cancel_cast()
			game.player.cancel_combat_action()
			game.player.realm = rank
			var beast_y: float = game.world.height_at(NativeRiftwing.HOME_X,NativeRiftwing.HOME_Z)
			game.beast.restore({"hp":game.beast.max_hp,"mode":"ground","position":[NativeRiftwing.HOME_X,beast_y,NativeRiftwing.HOME_Z]})
			game.player.energy = 100
			game.player.health = 100
			game.player._hurt_time = 0.0
			game.player.rotation.y = 0.0
			game.player.teleport_to_ground(NativeRiftwing.HOME_X,NativeRiftwing.HOME_Z+12)
			if view != 2:
				game.player.global_position.y += 5.0
			game.player.flight_active = view != 2
			var pitch := -0.32 if view != 2 else 0.0
			game.player._look_pitch = pitch
			game.player.get_node("CameraPivot").rotation.x = pitch
			game.attack_ready = 0.0
			game.cast_cooldown_until = 0.0
			game.world.update_stream(game.player.global_position)
			for i in range(8):
				await physics_frame
			if view != 1:
				game.player.get_node("CameraPivot/Camera3D").make_current()
			else:
				observer_camera.position = game.player.position+Vector3(5.0,2.5,4.0)
				observer_camera.look_at(game.player.position+Vector3(0,1.3,-3.8))
				observer_camera.make_current()
			profile = NativeMotionR2.cast_profile(rank)
			game._try_r3_cast()
			# Ascension clears its handle at impact while the visual tail remains
			# alive. Retain an observer reference through the real auto-free.
			observed_effect = game.ascension._r3_cast_vfx
			elapsed = 0.0
			frame = 0
			active = true
			while active:
				await RenderingServer.frame_post_draw
				if capture_frame >= 0 and write_png:
					root.get_texture().get_image().save_png(out+"/r%d-v%d-f%03d.png"%[tier,view,capture_frame])
					capture_frame = -1
	var file := FileAccess.open(out+"/normal-time.json",FileAccess.WRITE)
	file.store_string(JSON.stringify({"mode":"real main scene physics clocks; automated _try_r3_cast trigger; no keyboard feel claim","records":records,"events":events,"save_path":game.save_path},"\t"))
	game.initialized = false
	print("R3_VFX_FULL_WORLD_COMPLETE samples=",records.size()," events=",events.size())
	quit()

func _observe(delta: float) -> void:
	if not active:
		return
	elapsed += delta
	frame += 1
	var effect = observed_effect
	var snapshot: Dictionary = effect.debug_snapshot() if is_instance_valid(effect) else {"active_count":0}
	records.append({"realm":tier,"view":camera_view,"frame":Engine.get_physics_frames(),"render_frame":Engine.get_frames_drawn(),"delta":delta,"elapsed":elapsed,"wall_usec":Time.get_ticks_usec(),"player":game.player.position,"socket":game.player.combat_socket_transform_world(profile.socket).origin,"snapshot":snapshot,"draw_calls_scene":Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),"primitives_scene":Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME)})
	if frame % 3 == 0 and elapsed >= profile.windup-0.12 and elapsed <= profile.windup+0.38:
		capture_frame = frame
	if elapsed >= profile.duration+0.7:
		active = false
