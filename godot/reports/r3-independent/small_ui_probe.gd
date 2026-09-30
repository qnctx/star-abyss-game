extends "res://reports/r3-independent/combat_live_probe.gd"
var scene_initial_sha: String
var before_click: int
func _initialize() -> void:
	scene_initial_sha=FileAccess.get_sha256("res://scenes/main.tscn")
	call_deferred("_run")
func sample(_delta: float) -> void:
	index+=1
	if index==30:game.player.realm=9
	if index==360:_capture("final-small-ui")
	if index==370:
		before_click=game.player._attack_serial
		var e:=InputEventMouseButton.new()
		e.button_index=MOUSE_BUTTON_LEFT
		e.position=Vector2(30,40)
		e.global_position=e.position
		e.pressed=true
		Input.parse_input_event(e)
	if index==380:
		observer.set_physics_process(false)
		var controls: Array=[]
		for c in game.find_children("*","Control",true,false):
			if c.is_visible_in_tree():controls.append({"path":str(c.get_path()),"rect":c.get_global_rect(),"mouse_filter":c.mouse_filter,"text":c.text if c is Label else ""})
		var output:=FileAccess.open("res://reports/r3-independent/small-ui.json",FileAccess.WRITE)
		output.store_string(JSON.stringify({"utc":started_utc,"scene_sha256":scene_initial_sha,"scene_unchanged":scene_initial_sha==FileAccess.get_sha256("res://scenes/main.tscn"),"attack_input_through_hud":game.player._attack_serial>before_click,"window_size":root.size,"viewport_rect":root.get_visible_rect(),"image_size":root.get_texture().get_image().get_size(),"controls":controls}))
		output.close()
		print("R3_SMALL_UI image=",root.get_texture().get_image().get_size()," window=",root.size)
		game.initialized=false
		game.queue_free()
		quit()
