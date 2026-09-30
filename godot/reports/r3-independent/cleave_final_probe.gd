extends "res://reports/r3-independent/combat_live_probe.gd"
func sample(delta: float) -> void:
	rows.append({"frame":Engine.get_physics_frames(),"physics":Engine.is_in_physics_frame(),"delta":delta,"clip":game.player._r2.current})
	index+=1
	match index:
		60:
			phase="cleave_final"
			game.player.teleport_to_ground(0,260)
			game.player.rotation.y=0
			game.player.realm=8
			_key(KEY_R,true)
		61:_key(KEY_R,false)
		100:_capture("cleave-final-charge")
		172:_capture("cleave-final-release")
		210:
			observer.set_physics_process(false)
			var changed: Array=[]
			for filename in signatures:
				if signatures[filename]!=FileAccess.get_sha256("res://scripts/"+filename):changed.append(filename)
			for path in asset_signatures:
				if asset_signatures[path]!=FileAccess.get_sha256(path):changed.append(path)
			var f:=FileAccess.open("res://reports/r3-independent/cleave-final.json",FileAccess.WRITE)
			f.store_string(JSON.stringify({"utc":started_utc,"source_sha256":signatures,"asset_sha256":asset_signatures,"changed_during_run":changed,"rows":rows,"events":events}))
			f.close()
			game.initialized=false
			game.queue_free()
			print("R3_CLEAVE_FINAL changed=",changed)
			quit()
