extends SceneTree
## Isolated real world/controller fixture; synthetic axes, real physics delta.
## Never changes the production save or captures input from the user's window.
const SLOT := "user://star_abyss_gait_r6_verification.json"
var game: NativeMain
var observer: WorldDriver
var camera: Camera3D
var out := "res://assets/motion-r2/evidence/gait-r6/world"
var view := "side"
var images: Array = []

class WorldDriver extends Node:
	var game: NativeMain
	var states := [
		{"name":"idle","axes":Vector2.ZERO,"duration":0.4},
		{"name":"walk","axes":Vector2(0,1),"precision":true,"duration":2.4},
		{"name":"jog","axes":Vector2(0,1),"duration":2.0},
		{"name":"sprint","axes":Vector2(0,1),"shift":true,"duration":2.0},
		{"name":"stop","axes":Vector2.ZERO,"duration":0.6},
		{"name":"backward","axes":Vector2(0,-1),"precision":true,"duration":1.0},
		{"name":"strafe","axes":Vector2(1,0),"precision":true,"duration":1.0},
		{"name":"stop-final","axes":Vector2.ZERO,"duration":0.6},
	]
	var index := 0
	var age := 0.0
	var elapsed := 0.0
	var done := false
	var records: Array = []
	var wall_start := 0
	func _ready() -> void:
		wall_start = Time.get_ticks_usec()
	func _physics_process(delta: float) -> void:
		if done:
			return
		var state: Dictionary = states[index]
		var p := game.player
		assert(not p.is_physics_processing(), "fixture must own the single controller tick")
		# These are the same ground controller methods called by NativePlayer;
		# player automatic callback is disabled to avoid a second movement tick.
		if p._planet_enabled():
			p._sync_canonical_before_motion()
			p._align_planet_up(p._planet_up(p.global_position))
			p._step_ground_planet(delta, state.axes, state.get("shift",false), false, state.get("precision",false))
			p._update_visual(delta)
			p._sync_canonical_after_motion()
		else:
			p._step_ground(delta, state.axes, state.get("shift",false), false, state.get("precision",false))
			p._update_visual(delta)
		elapsed += delta
		age += delta
		var root_position := p.global_position
		var support: Dictionary = p._planet_support(root_position) if p._planet_enabled() else {"agl":root_position.y-p._foot_support_here()}
		records.append({"frame":Engine.get_physics_frames(),"in_physics":Engine.is_in_physics_frame(),"delta":delta,"seconds":elapsed,"wall_seconds":float(Time.get_ticks_usec()-wall_start)/1e6,"stage":state.name,"age":age,"speed":p.horizontal_speed,"position":[root_position.x,root_position.y,root_position.z],"agl":support.get("agl",0.0),"clip":p._r2.current,"phase":p._r2.gait_phase})
		if age >= float(state.duration):
			age = 0.0
			index += 1
			done = index == states.size()

func _initialize() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--out="):
			out = arg.trim_prefix("--out=")
		if arg.begins_with("--view="):
			view = arg.trim_prefix("--view=")
	call_deferred("run")

func run() -> void:
	DirAccess.make_dir_recursive_absolute(out+"/"+view)
	if FileAccess.file_exists(SLOT):
		push_error("Own verification slot already exists; refusing to overwrite")
		quit(1)
		return
	game = (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = SLOT
	root.add_child(game)
	game.player.set_physics_process(false)
	# Keep streaming, terrain and main update active; freeze only hostile AI so
	# the short movement check cannot be interrupted by an unrelated combat hit.
	game.beast.set_physics_process(false)
	for enemy in game.enemies:
		enemy.set_physics_process(false)
	game.player.teleport_to_ground(0.0,190.0)
	game.player.rotation = Vector3(0,PI,0)
	game.player._first_person = false
	game.player.flight_active = false
	game.player.velocity = Vector3.ZERO
	for tick in range(30):
		await physics_frame
	game.player.set_physics_process(false)
	observer = WorldDriver.new()
	observer.game = game
	root.add_child(observer)
	camera = Camera3D.new()
	game.add_child(camera)
	camera.fov = 34
	camera.current = true
	var last_capture := -1.0
	while not observer.done:
		await physics_frame
		var p := game.player
		var offset := Vector3(4.8,1.45,0) if view == "side" else Vector3(0,1.45,-4.8) if view == "front" else Vector3(0,1.45,4.8)
		camera.global_position = p.global_position+p.global_basis*offset
		camera.look_at(p.global_position+p.up_direction*0.94,p.up_direction)
		camera.current = true
		if observer.elapsed-last_capture >= 1.0/20.0:
			await RenderingServer.frame_post_draw
			var name := "%05d.png" % observer.records.size()
			root.get_texture().get_image().save_png(out+"/"+view+"/"+name)
			images.append({"file":name,"seconds":observer.elapsed,"record":observer.records.size()-1})
			last_capture = observer.elapsed
	FileAccess.open(out+"/"+view+"-trace.json",FileAccess.WRITE).store_string(JSON.stringify({"scope":"Isolated full main scene; actual NativePlayer ground controller and collision under engine physics; synthetic axes, not keyboard or human playtest; enemies frozen, streaming active.","time_scale":Engine.time_scale,"records":observer.records,"images":images,"glb_sha256":FileAccess.get_sha256("res://assets/motion-r2/c2-motion-r2.glb"),"driver_sha256":FileAccess.get_sha256("res://scripts/native_motion_r2.gd")},"\t"))
	game.initialized = false
	game.queue_free()
	await process_frame
	if FileAccess.file_exists(SLOT):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SLOT))
	print("R6_WORLD ",JSON.stringify({"frames":observer.records.size(),"seconds":observer.elapsed,"images":images.size(),"view":view}))
	quit()
