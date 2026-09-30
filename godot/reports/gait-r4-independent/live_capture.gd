extends SceneTree
var game: Node
var observer: Node
var rows: Array=[]
var frames: Array=[]
var cameras: Dictionary={}
var views: Dictionary={}
var frame_index:=0
var index:=0
var phase:="idle"
var output_dir:="res://reports/gait-r4-independent/baseline"
var started_usec:=0
var last_capture_usec:=0
var utc:=""
var hashes: Dictionary={}
var held: Array=[]
var finishing:=false
var lightweight:=false
var buffered: Array=[]

func _initialize() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg=="--lightweight":lightweight=true
		if arg.begins_with("--label="):
			var label:=arg.trim_prefix("--label=")
			if label.is_valid_filename():output_dir="res://reports/gait-r4-independent/"+label
	call_deferred("_run")

func _run() -> void:
	utc=Time.get_datetime_string_from_system(true)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output_dir+"/frames"))
	for path in ["res://scripts/native_player.gd","res://scripts/native_motion_r2.gd","res://assets/motion-r2/c2-motion-r2.glb","res://scenes/main.tscn"]:
		hashes[path]=FileAccess.get_sha256(path)
	game=load("res://scenes/main.tscn").instantiate()
	game.save_path="user://gait_r4_independent_"+str(Time.get_ticks_usec())+".json"
	root.add_child(game)
	game.world.update_stream(Vector3(0,0,260))
	game.player.teleport_to_ground(0,260)
	game.player.rotation.y=0
	if lightweight:root.disable_3d=true
	for name in (["side"] if lightweight else ["front","side","back"]):
		var view:=SubViewport.new()
		view.size=Vector2i(320,320) if lightweight else Vector2i(480,480)
		view.world_3d=game.get_world_3d()
		view.render_target_update_mode=SubViewport.UPDATE_ALWAYS
		root.add_child(view)
		var camera:=Camera3D.new()
		camera.projection=Camera3D.PROJECTION_ORTHOGONAL
		camera.size=2.3
		camera.near=.05
		camera.far=150
		view.add_child(camera)
		camera.make_current()
		views[name]=view
		cameras[name]=camera
	observer=Node.new()
	observer.set_script(load("res://reports/gait-r4-independent/observer.gd"))
	observer.probe=self
	observer.process_physics_priority=10000
	root.add_child(observer)
	started_usec=Time.get_ticks_usec()
	RenderingServer.frame_post_draw.connect(_rendered)

func sample(delta: float) -> void:
	var p=game.player
	var rig: Skeleton3D=p._r2._rig
	var bones: Dictionary={}
	for name in ["pelvis","waist","hipL","hipR","kneeL","kneeR","ankleL","ankleR","elbowL","elbowR","wristL","wristR"]:
		var b:=rig.find_bone(name)
		if b>=0:bones[name]=rig.global_transform*rig.get_bone_global_pose(b).origin
	var observed: Array=[]
	for key in held:
		if Input.is_physical_key_pressed(key):observed.append(key)
	rows.append({"frame":Engine.get_physics_frames(),"elapsed_wall":(Time.get_ticks_usec()-started_usec)/1000000.0,"delta":delta,"physics":Engine.is_in_physics_frame(),"phase":phase,"position":p.global_position,"velocity":p.velocity,"clip":p._r2.current,"gait_phase":p._r2.gait_phase,"bones":bones,"anchors":p._r2._foot_anchors.duplicate(),"requested_keys":held.duplicate(),"observed_keys":observed,"mouse_mode":Input.get_mouse_mode()})
	var center: Vector3=p.global_position+Vector3.UP*.98
	if cameras.has("front"):cameras.front.global_position=center+Vector3(0,0,-5)
	cameras.side.global_position=center+Vector3(5,0,0)
	if cameras.has("back"):cameras.back.global_position=center+Vector3(0,0,5)
	for camera in cameras.values():camera.look_at(center)
	index+=1
	match index:
		60:phase="walk_start";_keys([KEY_CTRL,KEY_W])
		90:phase="walk"
		240:phase="walk_stop";_keys([])
		300:phase="jog_start";_keys([KEY_W])
		330:phase="jog"
		480:phase="jog_stop";_keys([])
		540:phase="sprint_start";_keys([KEY_SHIFT,KEY_W])
		570:phase="sprint"
		720:phase="sprint_stop";_keys([])
		810:_finish()

func _keys(keys: Array) -> void:
	for key in held:_key(key,false)
	held=keys
	for key in held:_key(key,true)

func _key(code: int, pressed: bool) -> void:
	var e:=InputEventKey.new()
	e.physical_keycode=code
	e.keycode=code
	e.pressed=pressed
	Input.parse_input_event(e)

func _rendered() -> void:
	if finishing or views.is_empty() or index<2:return
	var now:=Time.get_ticks_usec()
	if now-last_capture_usec<(33000 if lightweight else 66000):return
	last_capture_usec=now
	frame_index+=1
	for name in views:
		var img: Image=views[name].get_texture().get_image()
		if lightweight:buffered.append({"image":img,"name":name,"index":frame_index})
		else:img.save_png(output_dir+"/frames/%s-%04d.png"%[name,frame_index])
	frames.append({"index":frame_index,"wall_time":(now-started_usec)/1000000.0,"physics_frame":Engine.get_physics_frames(),"phase":phase})

func _finish() -> void:
	finishing=true
	observer.set_physics_process(false)
	_keys([])
	for item in buffered:
		item.image.save_png(output_dir+"/frames/%s-%04d.png"%[item.name,item.index])
	var changed: Array=[]
	for path in hashes:
		if hashes[path]!=FileAccess.get_sha256(path):changed.append(path)
	var f:=FileAccess.open(output_dir+"/capture.json",FileAccess.WRITE)
	f.store_string(JSON.stringify({"utc":utc,"time_scale":Engine.time_scale,"source_sha256":hashes,"changed_during_run":changed,"rows":rows,"frames":frames,"camera":"same world, orthographic 2.3m, center foot+0.98m, 5m; side320px buffered" if lightweight else "same world, orthographic 2.3m, center foot+0.98m, front/side/back at 5m, 480px","capture":"automatic product physics; no manual animation seek by harness; lightweight30Hz maximum" if lightweight else "wall-clock scheduled PNG at at most15Hz; automatic product physics; no manual animation seek by harness"}))
	f.close()
	game.initialized=false
	game.queue_free()
	print("GAIT_R4_CAPTURE rows=",rows.size()," frames=",frames.size()," changed=",changed)
	quit()
