extends SceneTree
var game: Node
func _initialize() -> void:
	call_deferred("_run")
func _run() -> void:
	var paths=["res://scripts/native_world.gd","res://scripts/native_player.gd","res://scripts/native_main.gd","res://scenes/main.tscn"]
	var hashes={}
	for p in paths:hashes[p]=FileAccess.get_sha256(p)
	game=load("res://scenes/main.tscn").instantiate()
	game.save_path="user://planet_independent_baseline_"+str(Time.get_ticks_usec())+".json"
	root.add_child(game)
	var view=SubViewport.new()
	view.size=Vector2i(960,720)
	view.world_3d=game.get_world_3d()
	view.render_target_update_mode=SubViewport.UPDATE_ALWAYS
	root.add_child(view)
	var camera=Camera3D.new()
	camera.far=100000.0
	view.add_child(camera)
	camera.make_current()
	var shots=[{"name":"overview-default","pos":Vector3(7200,6800,7200),"target":Vector3.ZERO,"clear":false},{"name":"overview-no-fog-diagnostic","pos":Vector3(7200,6800,7200),"target":Vector3.ZERO,"clear":true},{"name":"east-edge-no-fog-diagnostic","pos":Vector3(3180,220,500),"target":Vector3(2980,0,0),"clear":true}]
	for shot in shots:
		if shot.clear:
			for node in game.find_children("*","WorldEnvironment",true,false):node.environment.fog_enabled=false
		camera.global_position=shot.pos
		camera.look_at(shot.target)
		for i in range(8):await physics_frame
		await RenderingServer.frame_post_draw
		view.get_texture().get_image().save_png("res://reports/planet-native-r1-independent/old-square-baseline/"+shot.name+".png")
	var changed=[]
	for p in paths:
		if FileAccess.get_sha256(p)!=hashes[p]:changed.append(p)
	var f=FileAccess.open("res://reports/planet-native-r1-independent/old-square-baseline/capture.json",FileAccess.WRITE)
	f.store_string(JSON.stringify({"utc":Time.get_datetime_string_from_system(true),"hashes":hashes,"changed":changed,"shots":shots,"note":"Actual main scene; free diagnostic cameras; fog disabled only for explicitly named diagnostic shots; no traversal claim"}))
	f.close()
	game.initialized=false
	game.queue_free()
	print("PLANET_BASELINE changed=",changed)
	quit()
