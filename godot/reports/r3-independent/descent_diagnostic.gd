extends "res://reports/r3-independent/combat_live_probe.gd"
func sample(delta: float) -> void:
	var p=game.player
	rows.append({"frame":Engine.get_physics_frames(),"delta":delta,"physics":Engine.is_in_physics_frame(),"position":p.global_position,"velocity":p.velocity,"vertical_speed":p._vertical_speed,"terrain":p._ground_here(),"support":p._foot_support_here(),"flight":p.flight_active,"c_down":Input.is_physical_key_pressed(KEY_C),"mouse_mode":Input.get_mouse_mode(),"small_down_clear":p._air_path_clear(p.global_position,p.global_position-Vector3.UP*.05),"slide_count":p.get_slide_collision_count(),"on_floor":p.is_on_floor()})
	index+=1
	if index==60:
		game.world.update_stream(Vector3(1368.319,0,-1013.209))
		game.player.teleport_to_ground(1368.319,-1013.209)
		game.player.global_position.y+=14
		game.player.flight_active=true
		_key(KEY_C,true)
	if index==300:
		_key(KEY_C,false)
		observer.set_physics_process(false)
		var f:=FileAccess.open("res://reports/r3-independent/descent-diagnostic.json",FileAccess.WRITE)
		f.store_string(JSON.stringify({"utc":started_utc,"rows":rows,"source_sha256":signatures,"events":events}))
		f.close()
		print("R3_DESCENT_DIAGNOSTIC last=",JSON.stringify(rows[-1]))
		game.initialized=false
		game.queue_free()
		quit()
