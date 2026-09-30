extends SceneTree
const OUT="res://reports/planet-native-r1-independent/basin-skirt04"
class Observer extends Node:
	var probe
	func _physics_process(delta: float) -> void:probe.sample(delta)
var game
var observer
var rows=[]
var images=[]
var rois=[]
var draws=[]
var hashes={}
var tick=0
var stage="warmup"
var start=0
var last_image=0
var utc=""
var finished=false
func _initialize():call_deferred("run")
func key(code: int, down: bool):
	var e=InputEventKey.new()
	e.physical_keycode=code;e.keycode=code;e.pressed=down
	Input.parse_input_event(e)
func place(x: float,z: float,h: float,yaw: float=0.0):
	game.player.global_position=Vector3(x,game.world.height_at(x,z)+h,z)
	game.player.velocity=Vector3.ZERO
	game.player._vertical_speed=0.0
	game.player._ground_vertical_speed=0.0
	game.player.flight_active=h>2.0
	game.player.rotation.y=yaw
	game.player._look_pitch=-0.65
	game.player.get_node("CameraPivot").rotation.x=-0.65
	game.world.update_stream(game.player.global_position)
func run():
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT))
	for path in ["scripts/native_planet.gd","scripts/native_world.gd","scripts/native_player.gd","scripts/native_main.gd","scripts/native_planet_field.gd","assets/terrain/planet_surface.gdshader","assets/terrain/far_basin.gdshader","assets/terrain/basin_near_surface.gdshader","scenes/main.tscn"]:hashes[path]=FileAccess.get_sha256("res://"+path)
	utc=Time.get_datetime_string_from_system(true)
	game=load("res://scenes/main.tscn").instantiate()
	game.save_path="user://basin_independent_"+str(Time.get_ticks_usec())+".json"
	root.add_child(game)
	observer=Observer.new();observer.probe=self;observer.process_physics_priority=10000;root.add_child(observer)
	start=Time.get_ticks_usec()
	RenderingServer.frame_post_draw.connect(rendered)
func sample(delta: float):
	if finished:return
	tick+=1
	if tick%6==0:
		var p=game.player
		rows.append({"tick":tick,"stage":stage,"wall":(Time.get_ticks_usec()-start)/1e6,"delta":delta,"position":p.global_position,"velocity":p.velocity,"support":game.world.surface_at(p.global_position),"g":p._held_g,"c":p._held_c,"d":Input.is_physical_key_pressed(KEY_D),"player_physics":p.is_physics_processing(),"main_physics":game.is_physics_processing(),"mid":game.world._planet.loaded_mid_tile_count(),"camera":p.get_node("CameraPivot/Camera3D").global_transform})
	match tick:
		30:stage="ground-tile160";game.player.teleport_to_ground(0,165);game.player._look_pitch=-0.25;game.player.get_node("CameraPivot").rotation.x=-0.25;key(KEY_W,true)
		180:key(KEY_W,false);stage="descend350";place(0,190,380);key(KEY_C,true)
		360:key(KEY_C,false);stage="orbit-fixture";place(0,190,125000);game.player._look_pitch=-1.35;game.player.get_node("CameraPivot").rotation.x=-1.35
		480:finish.call_deferred()
	if stage.ends_with("pan"):
		var e=InputEventMouseMotion.new();e.relative=Vector2(0.7,0);root.push_input(e)
func rendered():
	if finished:return
	var now=Time.get_ticks_usec()
	draws.append({"tick":tick,"stage":stage,"wall":(now-start)/1e6})
	if tick<30:return
	var im=root.get_texture().get_image()
	rois.append({"image":im.get_region(Rect2i(0,420,960,100)),"tick":tick,"stage":stage,"wall":(now-start)/1e6})
	if now-last_image<100000:return
	last_image=now
	images.append({"image":im,"tick":tick,"stage":stage,"wall":(now-start)/1e6})
func finish():
	finished=true
	var frames=[]
	for i in range(images.size()):
		var item=images[i]
		var filename="%04d-%s.png"%[i,item.stage]
		item.image.save_png(OUT+"/"+filename)
		frames.append({"file":filename,"tick":item.tick,"stage":item.stage,"wall":item.wall})
	var roi_meta=[]
	for i in range(rois.size()):
		var r=rois[i]
		var filename="roi-%04d.png"%i
		r.image.save_png(OUT+"/"+filename)
		roi_meta.append({"file":filename,"tick":r.tick,"stage":r.stage,"wall":r.wall})
	var changed=[]
	for path in hashes:
		if hashes[path]!=FileAccess.get_sha256("res://"+path):changed.append(path)
	var f=FileAccess.open(OUT+"/results.json",FileAccess.WRITE)
	f.store_string(JSON.stringify({"utc":utc,"hashes":hashes,"changed":changed,"rows":rows,"frames":frames,"roi_frames":roi_meta,"draws":draws,"time_scale":Engine.time_scale,"physics_frames":tick,"method":"Normal Main/Player physics, default fog, real Player camera. Initial phase fixtures; G/D/W synthetic inputs and mouse events thereafter. Buffered resized screenshots; actual draw timing includes GPU readback."}))
	f.close();game.initialized=false;game.queue_free();print("BASIN_DYNAMIC frames=",tick," captures=",frames.size()," changed=",changed);quit()
