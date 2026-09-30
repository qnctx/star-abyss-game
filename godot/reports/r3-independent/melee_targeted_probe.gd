extends "res://reports/r3-independent/combat_live_probe.gd"
var wall_info: Dictionary={}
var melee_start:=Vector3.ZERO
var initial_distance:=2.0

func _initialize() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg=="--distance-2.3":initial_distance=2.3
		if arg=="--distance-2.6":initial_distance=2.6
	call_deferred("_run")

func sample(delta: float) -> void:
	var now:=Time.get_ticks_usec()
	var p=game.player
	var point: Vector3=p.attack_contact_point_world(0)
	rows.append({"frame":Engine.get_physics_frames(),"phase":phase,"delta":delta,"wall_delta":(now-last_usec)/1000000.0,"physics":Engine.is_in_physics_frame(),"position":p.global_position,"velocity":p.velocity,"attack":p._attack_name,"elapsed":p._attack_elapsed,"hurt":p._hurt_time,"gap":game.beast.body_contact_distance(point),"beast_hp":game.beast.hp,"clip":p._r2.current})
	last_usec=now
	index+=1
	match index:
		60:
			phase="melee_2m"
			_place(game.beast,initial_distance,0,4)
			melee_start=p.global_position
			_click(true)
		61:_click(false)
		69:_capture("melee-step-contact")
		125:
			phase="wall_step"
			game.world.update_stream(Vector3(-30,0,174))
			var query:=PhysicsRayQueryParameters3D.create(Vector3(-30,1,174),Vector3(-17,1,174),1)
			query.exclude=[p.get_rid()]
			wall_info=p.get_world_3d().direct_space_state.intersect_ray(query)
			if not wall_info.is_empty():
				var hit: Vector3=wall_info.position
				wall_info={"hit":hit,"safe_setup":p.teleport_to_ground(hit.x-5.0,hit.z)}
				p.rotation.y=-PI/2
				if wall_info.safe_setup:_key(KEY_W,true)
		230:
			_key(KEY_W,false)
		240:
			wall_info["start"]=p.global_position
			_click(true)
		241:_click(false)
		280:_finish_targeted()

func _click(pressed: bool) -> void:
	var e:=InputEventMouseButton.new()
	e.button_index=MOUSE_BUTTON_LEFT
	e.pressed=pressed
	Input.parse_input_event(e)

func _finish_targeted() -> void:
	observer.set_physics_process(false)
	wall_info["end"]=game.player.global_position
	var changed: Array=[]
	for filename in signatures:
		if signatures[filename]!=FileAccess.get_sha256("res://scripts/"+filename):changed.append(filename)
	for path in asset_signatures:
		if asset_signatures[path]!=FileAccess.get_sha256(path):changed.append(path)
	var output:=FileAccess.open("res://reports/r3-independent/melee-targeted.json",FileAccess.WRITE)
	output.store_string(JSON.stringify({"utc":started_utc,"initial_distance":initial_distance,"source_sha256":signatures,"asset_sha256":asset_signatures,"changed_during_run":changed,"rows":rows,"events":events,"wall":wall_info,"melee_start":melee_start,"evidence":"normal physics, autonomous enemy; real scene wall ray fixture"}))
	output.close()
	game.initialized=false
	game.queue_free()
	print("R3_MELEE_TARGETED samples=",rows.size()," changed=",changed)
	quit()
