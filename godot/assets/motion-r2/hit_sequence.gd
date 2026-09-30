extends SceneTree
const SLOT := "user://star_abyss_motion_hit_sequence.json"
const OUTPUT := "res://assets/motion-r2/evidence/hit-regression"
func _initialize() -> void:
	call_deferred("run")
func run() -> void:
	Engine.physics_ticks_per_second=30
	DirAccess.make_dir_recursive_absolute(OUTPUT)
	var provenance := {"utc":Time.get_datetime_string_from_system(true),"driver_sha256":FileAccess.get_sha256("res://scripts/native_motion_r2.gd"),"player_sha256":FileAccess.get_sha256("res://scripts/native_player.gd"),"main_sha256":FileAccess.get_sha256("res://scripts/native_main.gd")}
	var provenance_file := FileAccess.open(OUTPUT+"/provenance.json",FileAccess.WRITE)
	provenance_file.store_string(JSON.stringify(provenance,"  "))
	provenance_file.close()
	var game := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path=SLOT
	root.add_child(game)
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	for f in range(4):await physics_frame
	game.set_physics_process(false)
	game.player.set_physics_process(false)
	game.beast.set_physics_process(false)
	game.save_clock=-100000.0
	var p := game.player
	p.teleport_to_ground(40,40)
	p.velocity=Vector3.ZERO
	p.horizontal_speed=0
	p.flight_active=false
	p.rotation.y=0
	var camera := Camera3D.new()
	game.add_child(camera)
	camera.current=true
	camera.fov=42
	var trace: Array=[]
	# Let the engine finish the frame in which the tick-rate change was applied;
	# the first physics_frame signal can still expose the old 60Hz cached delta.
	await process_frame
	await physics_frame
	await process_frame
	for f in range(108):
		# move_and_slide consumes the engine physics delta, not our argument.
		# Resume inside the real 30Hz physics signal before manually stepping.
		await physics_frame
		p.guarding=f<24
		if f==10 or f==30:p.apply_hit(Vector3.FORWARD,1000.0)
		if f==60:p.apply_hit(Vector3.FORWARD,6221.0)
		p._hurt_time=maxf(0,p._hurt_time-1.0/30.0)
		p._step_ground(1.0/30.0,Vector2.ZERO,false,false)
		game._physics_process(1.0/30.0)
		p._update_visual(1.0/30.0)
		game._update_hud()
		camera.global_position=p.global_position+Vector3(4.8,2.0,0)
		camera.look_at(p.global_position+Vector3.UP)
		var rig := p._r2._rig
		var feet: Array=[]
		for side in ["L","R"]:
			var foot := rig.global_transform*rig.get_bone_global_pose(rig.find_bone("ankle"+side)).origin
			feet.append({"ankle_above_root":foot.y-p.global_position.y,"ankle_above_support":foot.y-p._foot_support_here()})
		trace.append({"frame":f,"engine_in_physics":Engine.is_in_physics_frame(),"engine_physics_dt":p.get_physics_process_delta_time(),"root_position":str(p.global_position),"root_y":p.global_position.y,"support_y":p._foot_support_here(),"agl":p.global_position.y-p._foot_support_here(),"speed":p.horizontal_speed,"clip":p._r2.current,"feet":feet})
		await process_frame
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(OUTPUT+"/f%03d.png"%f)
	var file := FileAccess.open(OUTPUT+"/trace.json",FileAccess.WRITE)
	file.store_string(JSON.stringify(trace,"  "))
	game.initialized=false
	game.queue_free()
	await process_frame
	if FileAccess.file_exists(SLOT):DirAccess.remove_absolute(ProjectSettings.globalize_path(SLOT))
	print("HIT_REGRESSION_CAPTURE 108 frames: block, ordinary hit, launch")
	quit()
