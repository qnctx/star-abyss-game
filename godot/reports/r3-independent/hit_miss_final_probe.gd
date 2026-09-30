extends "res://reports/r3-independent/combat_live_probe.gd"
var visual_events: Array=[]
var hooked: Dictionary={}
func sample(delta: float) -> void:
	_hook()
	rows.append({"frame":Engine.get_physics_frames(),"physics":Engine.is_in_physics_frame(),"delta":delta,"phase":phase,"ordinary_hp":game.enemies[0].hp})
	index+=1
	match index:
		60:
			phase="empty_cast"
			game.player.teleport_to_ground(0,260)
			game.player.rotation.y=0
			game.player.realm=4
			_key(KEY_R,true)
			_hook()
		61:_key(KEY_R,false)
		180:
			phase="real_hit"
			_place(game.enemies[0],18,0,4)
			_key(KEY_R,true)
			_hook()
		181:_key(KEY_R,false)
		300:
			observer.set_physics_process(false)
			var changed: Array=[]
			for filename in signatures:
				if signatures[filename]!=FileAccess.get_sha256("res://scripts/"+filename):changed.append(filename)
			var file:=FileAccess.open("res://reports/r3-independent/hit-miss-final.json",FileAccess.WRITE)
			file.store_string(JSON.stringify({"utc":started_utc,"source_sha256":signatures,"asset_sha256":asset_signatures,"changed_during_run":changed,"rows":rows,"events":events,"visual_events":visual_events}))
			file.close()
			game.initialized=false
			game.queue_free()
			print("R3_HIT_MISS_FINAL changed=",changed," visual=",JSON.stringify(visual_events))
			quit()
func _hook() -> void:
	if is_instance_valid(game.ascension._r3_cast_vfx):
		var id: int=game.ascension._r3_cast_vfx.get_instance_id()
		if hooked.has(id):return
		hooked[id]=true
		game.ascension._r3_cast_vfx.visual_event.connect(func(serial: int, event_phase: String, details: Dictionary):visual_events.append({"test_phase":phase,"serial":serial,"phase":event_phase,"details":details}))
