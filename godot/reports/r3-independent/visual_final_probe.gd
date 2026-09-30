extends "res://reports/r3-independent/combat_live_probe.gd"
var cast_capture_at: Dictionary={}

func _combat_event(record: Dictionary) -> void:
	super._combat_event(record)
	if record.get("side","")=="enemy":return
	if record.phase=="start" and String(record.action).begins_with("cast_"):
		cast_capture_at[index+10]="final-"+record.action+"-charge"
	if record.phase=="release" and String(record.action).begins_with("cast_"):
		cast_capture_at[index+2]="final-"+record.action+"-release"

func sample(delta: float) -> void:
	var p=game.player
	var now:=Time.get_ticks_usec()
	var feet: Dictionary={}
	for side in ["L","R"]:
		var socket: Transform3D=p._r2.socket_transform_world("foot_"+side.to_lower())
		feet[side]={"point":socket.origin,"terrain_gap":socket.origin.y-game.world.height_at(socket.origin.x,socket.origin.z),"anchor":p._r2._foot_anchors.get(side),"supported":p._r2._foot_anchors.has(side)}
	rows.append({"phase":phase,"frame":Engine.get_physics_frames(),"delta":delta,"wall_delta":(now-last_usec)/1000000.0,"physics":Engine.is_in_physics_frame(),"position":p.global_position,"speed":p.horizontal_speed,"clip":p._r2.current,"gait_phase":p._r2.gait_phase,"feet":feet})
	last_usec=now
	index+=1
	if cast_capture_at.has(index):_capture(cast_capture_at[index])
	match index:
		60:_ground_walk("final-walk",[KEY_CTRL,KEY_W])
		110:_capture("final-walk")
		180:_ground_walk("final-jog",[KEY_W])
		230:_capture("final-jog")
		300:_ground_walk("final-sprint",[KEY_SHIFT,KEY_W])
		350:_capture("final-sprint")
		420:_ground_walk("final-idle",[])
		480:_cast(4)
		481:_key(KEY_R,false)
		840:_cast(5)
		841:_key(KEY_R,false)
		1200:_cast(6)
		1201:_key(KEY_R,false)
		1560:_cast(8)
		1561:_key(KEY_R,false)
		1920:_cast(9)
		1921:_key(KEY_R,false)
		2100:
			root.size=Vector2i(960,540)
		2120:_capture("final-small-ui")
		2140:_finish_visual()

func _ground_walk(label: String, keys: Array) -> void:
	for key in [KEY_CTRL,KEY_SHIFT,KEY_W]:_key(key,false)
	game.world.update_stream(Vector3(0,0,260))
	game.player.teleport_to_ground(0,260)
	game.player.rotation.y=0
	Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)
	phase=label
	for key in keys:_key(key,true)

func _cast(realm: int) -> void:
	phase="final-r"+str(realm)
	game.player.realm=realm
	_key(KEY_R,true)

func _finish_visual() -> void:
	observer.set_physics_process(false)
	var changed: Array=[]
	for filename in signatures:
		if signatures[filename]!=FileAccess.get_sha256("res://scripts/"+filename):changed.append(filename)
	for path in asset_signatures:
		if asset_signatures[path]!=FileAccess.get_sha256(path):changed.append(path)
	var output:=FileAccess.open("res://reports/r3-independent/visual-final.json",FileAccess.WRITE)
	output.store_string(JSON.stringify({"utc":started_utc,"source_sha256":signatures,"asset_sha256":asset_signatures,"changed_during_run":changed,"rows":rows,"render_rows":render_rows,"events":events,"evidence":"normal physics and injected input, visible ankle/support samples; not human keyboard feel or video"}))
	output.close()
	game.initialized=false
	game.queue_free()
	print("R3_VISUAL_FINAL samples=",rows.size()," changed=",changed)
	quit()
