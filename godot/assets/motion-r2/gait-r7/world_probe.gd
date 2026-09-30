extends SceneTree
## Isolated real world/controller fixture; synthetic axes, real physics delta.
## Never changes the production save or captures input from the user's window.
const CandidateScript = preload("res://assets/motion-r2/gait-r7/candidate_motion.gd")
var adapter_path := "res://assets/motion-r2/gait-r7/candidate_motion.gd"
var capture := true
var slot := ""
var asset := "res://assets/motion-r2/gait-r7/next.glb"
var captured: Array[Image] = []
var game: NativeMain
var observer: WorldDriver
var camera: Camera3D
var out := "res://assets/motion-r2/evidence/gait-r7/world-candidate1"
var view := "side"
var images: Array = []

class WorldDriver extends Node:
	var game: NativeMain
	var states := [
		{"name":"idle","axes":Vector2.ZERO,"duration":0.4},
		{"name":"walk","axes":Vector2(0,1),"precision":true,"duration":3.0},
		{"name":"jog","axes":Vector2(0,1),"duration":2.1},
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
	var camera: Camera3D
	var view := "side"
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
		var rig := p._r2._rig
		var transforms: Array = []
		var names: Array = []
		var joints := {}
		for i in range(rig.get_bone_count()):
			var t := rig.get_bone_global_pose(i)
			transforms.append(t)
			var name := String(rig.get_bone_name(i))
			names.append(name)
			joints[name] = vec(rig.global_transform*t.origin)
		var probes: Array = []
		for terms in p._r2._sole_points:
			var v := Vector3.ZERO
			for term in terms:
				v += (transforms[term[0]]*Vector3(term[2]))*float(term[1])
			probes.append(vec(rig.global_transform*v))
		var packed: Array = []
		for t in transforms:packed.append(xf(t))
		records.append({"tick":records.size()+1,"frame":Engine.get_physics_frames(),"in_physics":Engine.is_in_physics_frame(),"delta":delta,"seconds":elapsed,"wall_seconds":float(Time.get_ticks_usec()-wall_start)/1e6,"stage":state.name,"stage_age":age,"age":age,"speed":p.horizontal_speed,"position":vec(root_position),"agl":support.get("agl",0.0),"support_up":vec(p.up_direction),"support_point":vec(support.get("point",root_position)),"clip":p._r2.current,"phase":p._r2.gait_phase,"visual_lift":p._r2._gait_floor_lift,"character_transform":xf(p.global_transform),"model_transform":xf(p._r2.model.global_transform),"rig_transform":xf(rig.global_transform),"bone_names":names,"bone_global_poses":packed,"joints_world":joints,"fixed_material_points_world":probes})
		if age >= float(state.duration):
			age = 0.0
			index += 1
			done = index == states.size()

	static func vec(p: Vector3) -> Array:
		return [p.x,p.y,p.z]
	static func xf(t: Transform3D) -> Array:
		return [t.basis.x.x,t.basis.x.y,t.basis.x.z,t.basis.y.x,t.basis.y.y,t.basis.y.z,t.basis.z.x,t.basis.z.y,t.basis.z.z,t.origin.x,t.origin.y,t.origin.z]
	func _process(_delta: float) -> void:
		if camera == null or records.is_empty():return
		var p := game.player
		var offset := Vector3(4.8,0.96,0) if view == "side" else Vector3(0,0.96,-4.8) if view == "front" else Vector3(0,0.96,4.8)
		camera.global_position = p.global_position+p.global_basis*offset
		camera.look_at(p.global_position+p.up_direction*0.96,p.up_direction)
		camera.current = true
		var projected := {}
		for bone in records[-1].joints_world:
			var v: Array = records[-1].joints_world[bone]
			var screen := camera.unproject_position(Vector3(v[0],v[1],v[2]))
			projected[bone] = [screen.x,screen.y]
		records[-1]["projected_joints"] = projected
		records[-1]["camera_transform"] = xf(camera.global_transform)

func _initialize() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg == "--no-capture":capture = false
		if arg.begins_with("--adapter="):adapter_path = arg.trim_prefix("--adapter=")
		if arg.begins_with("--out="):
			out = arg.trim_prefix("--out=")
		if arg.begins_with("--model="):
			asset = arg.trim_prefix("--model=")
		if arg.begins_with("--view="):
			view = arg.trim_prefix("--view=")
	call_deferred("run")

func run() -> void:
	DirAccess.make_dir_recursive_absolute(out+"/"+view)
	var frozen_hashes := {}
	for path in [asset,adapter_path,"res://scripts/native_motion_r2.gd","res://scripts/native_player.gd","res://scripts/native_main.gd"]:
		frozen_hashes[path] = FileAccess.get_sha256(path)
	slot = "user://gait-r7-verification/%d-%d/player.json" % [OS.get_process_id(),int(Time.get_unix_time_from_system()*1000)]
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(slot.get_base_dir()))
	game = (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = slot
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
	var old := game.player._r2
	var adapter := load(adapter_path) as Script
	var injected: NativeMotionR2 = adapter.new()
	injected.set("asset_path",asset)
	injected.transform = old.transform
	old.get_parent().add_child(injected)
	game.player._r2 = injected
	old.queue_free()
	await process_frame
	observer = WorldDriver.new()
	observer.game = game
	observer.view = view
	observer.process_priority = 1000
	root.add_child(observer)
	observer.set_physics_process(false)
	camera = Camera3D.new()
	game.add_child(camera)
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 2.2
	observer.camera = camera
	camera.current = true
	if capture:
		for warmup in range(30):
			await RenderingServer.frame_post_draw
	observer.wall_start = Time.get_ticks_usec()
	observer.set_physics_process(true)
	var last_capture := -1.0
	while not observer.done:
		await physics_frame
		if capture and observer.elapsed-last_capture >= 1.0/30.0-0.000001:
			await RenderingServer.frame_post_draw
			var name := "%05d.png" % observer.records.size()
			captured.append(root.get_texture().get_image())
			images.append({"file":name,"seconds":observer.elapsed,"record":observer.records.size()-1,"tick":observer.records.size()})
			last_capture = observer.elapsed
	for i in range(captured.size()):
		captured[i].save_png(out+"/"+view+"/"+images[i].file)
	for path in frozen_hashes:
		assert(frozen_hashes[path] == FileAccess.get_sha256(path),"Fixture dependency changed: "+String(path))
	var ps := JSON.parse_string(FileAccess.get_file_as_string("res://assets/motion-r2/gait-r6/independent/sole-probes.json")) as Dictionary
	var provenance: Array = []
	for side in ["L","R"]:
		for point in ps.points[side]:provenance.append({"side":side,"id":point.id,"source":point.source,"terms":point.terms})
	FileAccess.open(out+"/"+view+"-trace.json",FileAccess.WRITE).store_string(JSON.stringify({"view":view,"scope":"Isolated full main scene with candidate C2 model injection; actual current NativePlayer ground controller and collision under engine physics; synthetic axes, not keyboard or human playtest; enemies frozen, streaming active. Own save folder retained; no production save accessed.","time_scale":Engine.time_scale,"captured_pixels":capture,"model_adapter_path":adapter_path,"model_adapter_sha256":FileAccess.get_sha256(adapter_path),"records":observer.records,"images":images,"asset_path":asset,"glb_sha256":FileAccess.get_sha256(asset),"driver_sha256":FileAccess.get_sha256("res://scripts/native_motion_r2.gd"),"player_sha256":FileAccess.get_sha256("res://scripts/native_player.gd"),"main_sha256":FileAccess.get_sha256("res://scripts/native_main.gd"),"own_save_path":slot,"fixed_material_points_provenance":provenance,"camera":{"projection":"orthographic","level":true,"size":camera.size,"viewport":[root.size.x,root.size.y]},"transform_encoding":"basis columns x/y/z then origin, 12 floats; bone global poses in skeleton coordinates"}))
	game.initialized = false
	game.queue_free()
	await process_frame
	print("R7_WORLD ",JSON.stringify({"frames":observer.records.size(),"seconds":observer.elapsed,"images":images.size(),"view":view}))
	quit()
