extends SceneTree
var game: Node
var observer: Node
var rows: Array = []
var events: Array = []
var setup_results: Array = []
var index := 0
var last_usec := 0
var started_utc := ""
var slot := ""
var phase := "warmup"
var signatures: Dictionary = {}
var interrupt_started := -1
var render_rows: Array=[]
var asset_signatures: Dictionary={}

func render_sample(delta: float) -> void:
	render_rows.append({"phase":phase,"delta":delta,"draw_calls":Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),"objects":Performance.get_monitor(Performance.RENDER_TOTAL_OBJECTS_IN_FRAME)})

func _initialize() -> void: call_deferred("_run")
func _run() -> void:
	started_utc = Time.get_datetime_string_from_system(true)
	slot = "user://r3_independent_combat_" + str(Time.get_ticks_usec()) + ".json"
	var dir := DirAccess.open("res://scripts")
	for filename in dir.get_files():
		if filename.ends_with(".gd"): signatures[filename] = FileAccess.get_sha256("res://scripts/" + filename)
	for folder in ["motion-r2","enemy-r3","vfx-r3"]:
		var assets:=DirAccess.open("res://assets/"+folder)
		if assets==null:continue
		for filename in assets.get_files():
			if filename.ends_with(".glb"):
				var path: String="res://assets/"+folder+"/"+filename
				asset_signatures[path]=FileAccess.get_sha256(path)
	game = load("res://scenes/main.tscn").instantiate()
	if not "save_path" in game:
		game.free()
		quit(2)
		return
	game.save_path = slot
	root.add_child(game)
	game.combat_event.connect(_combat_event)
	observer = Node.new()
	observer.set_script(load("res://reports/r3-independent/physics_observer.gd"))
	observer.probe = self
	observer.process_physics_priority = 10000
	root.add_child(observer)
	last_usec = Time.get_ticks_usec()

func _combat_event(record: Dictionary) -> void:
	var item := record.duplicate(true)
	item["test_phase"] = phase
	item["frame"] = Engine.get_physics_frames()
	item["physics"] = Engine.is_in_physics_frame()
	item["player_hp"] = game.player.health
	item["beast_hp"] = game.beast.hp
	item["ordinary_hp"] = game.enemies[0].hp
	item["pending"] = game.pending_cast.duplicate(true)
	item["hand_r"] = game.player.combat_socket_transform_world("hand_r").origin
	var limb: Vector3=game.player.attack_contact_point_world(game.pending_combo)
	item["limb_contact"]=limb
	item["beast_contact_gap"]=game.beast.body_contact_distance(limb) if limb.is_finite() else -1.0
	item["beast_position"]=game.beast.global_position
	item["player_position"]=game.player.global_position
	item["player_hurt_time"]=game.player._hurt_time
	if is_instance_valid(game.ascension._r3_cast_vfx):
		item["vfx"] = game.ascension._r3_cast_vfx.debug_snapshot()
	events.append(item)

func sample(delta: float) -> void:
	var now := Time.get_ticks_usec()
	var p = game.player
	rows.append({"frame":Engine.get_physics_frames(),"phase":phase,"physics":Engine.is_in_physics_frame(),"delta":delta,"wall_delta":(now-last_usec)/1000000.0,"position":p.global_position,"player_hp":p.health,"guarding":p.guarding,"energy":p.energy,"flight":p.flight_active,"cast":p._cast_active,"clip":p._r2.current,"fragments":game.fragments,"beast":game.beast.get_combat_snapshot(),"ordinary":game.enemies[0].get_combat_snapshot(),"c_down":Input.is_physical_key_pressed(KEY_C),"mouse_mode":Input.get_mouse_mode(),"terrain":p._ground_here(),"support":p._foot_support_here(),"velocity":p.velocity,"vertical_speed":p._vertical_speed,"on_floor":p.is_on_floor(),"slide_count":p.get_slide_collision_count()})
	last_usec=now
	index+=1
	if phase=="interrupt_cast" and interrupt_started<0 and game.beast.phase=="windup" and game.beast.attack_kind=="claw":
		interrupt_started=index
		_key(KEY_R,true)
	elif index==interrupt_started+1:
		_key(KEY_R,false)
	match index:
		60:
			phase="ground_r4"
			_place(game.enemies[0],18,0,4)
			_key(KEY_R,true)
		61: _key(KEY_R,false)
		80: _capture("r4-charge")
		94: _capture("r4-release")
		210:
			phase="ordinary_r9"
			_place(game.enemies[0],40,0,9)
			_key(KEY_R,true)
		211: _key(KEY_R,false)
		310: _capture("r9-charge")
		346: _capture("r9-release")
		390:
			phase="pickup"
			if game.enemies[0].mode == "dead":
				_place(game.enemies[0],2,0,9)
				_key(KEY_H,true)
		391: _key(KEY_H,false)
		410:
			phase="melee_2m"
			_place(game.beast,2.0,0,4)
			var mouse := InputEventMouseButton.new()
			mouse.button_index=MOUSE_BUTTON_LEFT
			mouse.pressed=true
			Input.parse_input_event(mouse)
		411:
			var mouse := InputEventMouseButton.new()
			mouse.button_index=MOUSE_BUTTON_LEFT
			mouse.pressed=false
			Input.parse_input_event(mouse)
		470:
			phase="guard_beast"
			_place(game.beast,2.4,0,4)
			var mouse := InputEventMouseButton.new()
			mouse.button_index=MOUSE_BUTTON_RIGHT
			mouse.pressed=true
			Input.parse_input_event(mouse)
		560: _capture("guard-beast")
		710:
			var mouse := InputEventMouseButton.new()
			mouse.button_index=MOUSE_BUTTON_RIGHT
			mouse.pressed=false
			Input.parse_input_event(mouse)
			phase="interrupt_cast"
			_place(game.beast,2.0,0,9)
		1010:
			phase="air_pursuit"
			_place(game.beast,14,14,4)
		1230: _capture("air-pursuit")
		1310:
			phase="landing"
			_key(KEY_C,true)
		1500: _key(KEY_C,false)
		1790:
			phase="ground_5m"
			_place(game.beast,5.0,0,4)
		2070:
			phase="save_after_combat"
			_key(KEY_F5,true)
		2071: _key(KEY_F5,false)
		2090: _finish()

func _place(enemy: Node3D, distance: float, height: float, realm: int) -> void:
	var p=game.player
	var target=enemy.global_position+Vector3(0,0,distance)
	game.world.update_stream(target)
	var safe: bool=p.teleport_to_ground(target.x,target.z)
	setup_results.append({"phase":phase,"teleport_safe":safe,"enemy_position":enemy.global_position})
	p.rotation.y=0
	p.realm=realm
	if height>0:
		p.global_position.y+=height
		p.flight_active=true
	Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)
	var camera=p.get_node("CameraPivot/Camera3D") as Camera3D
	# Scenario aim uses the visible camera; product still chooses/re-reads authority.
	camera.look_at(enemy.global_position+Vector3.UP*1.3)

func _key(key: int, pressed: bool) -> void:
	var event:=InputEventKey.new()
	event.physical_keycode=key
	event.keycode=key
	event.pressed=pressed
	Input.parse_input_event(event)

func _capture(label: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://reports/r3-independent/"+label+".png")

func _finish() -> void:
	observer.set_physics_process(false)
	var changed: Array=[]
	for filename in signatures:
		if signatures[filename]!=FileAccess.get_sha256("res://scripts/"+filename):changed.append(filename)
	for path in asset_signatures:
		if asset_signatures[path]!=FileAccess.get_sha256(path):changed.append(path)
	var saved: Variant=JSON.parse_string(FileAccess.get_file_as_string(slot))
	var expected_fragments: int=game.fragments
	var expected_loot: int=game.enemies[0].loot_left
	game.initialized=false
	game.queue_free()
	await process_frame
	game=load("res://scenes/main.tscn").instantiate()
	game.save_path=slot
	root.add_child(game)
	for i in range(5): await physics_frame
	var reload_checks={"fragments_restored":game.fragments==expected_fragments,"ordinary_stays_dead":game.enemies[0].mode=="dead" and game.enemies[0].hp==0,"remaining_loot_restored":game.enemies[0].loot_left==expected_loot,"combat_field_present":saved.has("combat"),"enemy_field_present":saved.has("enemy_r3")}
	var file:=FileAccess.open("res://reports/r3-independent/combat-live.json",FileAccess.WRITE)
	file.store_string(JSON.stringify({"utc":started_utc,"time_scale":Engine.time_scale,"source_sha256":signatures,"asset_sha256":asset_signatures,"changed_during_run":changed,"setup":setup_results,"rows":rows,"render_rows":render_rows,"events":events,"save":saved,"reload_checks":reload_checks,"mode":"normal product physics and autonomous AI; injected Godot keys; setup teleport/aim only"}))
	file.close()
	game.initialized=false
	game.queue_free()
	print("R3_COMBAT_LIVE samples=",rows.size()," events=",events.size()," changed=",changed)
	quit()
