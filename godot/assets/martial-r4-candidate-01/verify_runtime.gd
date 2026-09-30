extends SceneTree
## Candidate QA only. Actual input and Player/Motion physics; no manual seek/skill step.
const ROOT := "res://assets/martial-r4-candidate-01/"
const LIB = preload(ROOT+"native_martial_candidate_library.gd")
const MODULE = preload(ROOT+"native_martial_skills_candidate.gd")
var game: NativeMain
var traces: Array[Dictionary] = []
var checks: Array[Dictionary] = []
var case_name := "initialization"
var output := ROOT+"runtime-reports/"+str(Time.get_ticks_usec())
var landed := 0
var source_hashes := {}
func _initialize() -> void: call_deferred("_run")
func _check(ok: bool,label: String) -> void:
	checks.append({"ok":ok,"label":label})
	print("PASS: " if ok else "FAIL: ",label)
func _key(code: Key,down: bool) -> void:
	var event := InputEventKey.new()
	event.physical_keycode=code;event.pressed=down;root.push_input(event)
func _hashes() -> Dictionary:
	var result := {}
	for path in ["native_player.gd","native_motion_r2.gd","native_main.gd","native_martial_skills.gd","native_environment_damage.gd","native_planet_ecology.gd"]:
		result[path]=FileAccess.get_sha256("res://scripts/"+path)
	for path in ["c2-martial-r4.glb","charge.glb","pressure.glb","descent_wake.glb","build.py"]:
		result["candidate/"+path]=FileAccess.get_sha256(ROOT+path)
	return result
func _frames(count: int) -> void:
	for index in range(count):
		await physics_frame
		await process_frame
		if game==null or not is_instance_valid(game.player): continue
		var rig: Skeleton3D=game.player._r2._rig
		var poses := {}
		for bone_name in ["pelvis","chest","head","wristL","wristR","kneeL","kneeR","ankleL","ankleR"]:
			var bone := rig.find_bone(bone_name)
			var pose := rig.global_transform*rig.get_bone_global_pose(bone)
			poses[bone_name]={"origin":str(pose.origin),"quaternion":str(pose.basis.get_rotation_quaternion())}
		traces.append({"case":case_name,"physics_frame":Engine.get_physics_frames(),"render_frame":Engine.get_process_frames(),"game_time":game.time,"clip":game.player._r2.current,"progress":game.player._r2._action_progress,"phase":game.martial.current.get("phase","finished"),"flight":game.player.flight_active,"strike":game.player.descent_strike_active,"position":str(game.player.global_position),"surface":str(game.world.surface_at(game.player.global_position)),"poses":poses})
func _rise() -> bool:
	_key(KEY_G,true)
	for index in range(240):
		await _frames(1)
		if float(game.world.surface_at(game.player.global_position).get("agl",0.0))>=25.0: break
	_key(KEY_G,false)
	await _frames(8)
	return game.player.flight_active and float(game.world.surface_at(game.player.global_position).get("agl",0.0))>=25.0
func _run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output))
	source_hashes=_hashes()
	game=(load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path="user://martial_candidate01_"+str(Time.get_ticks_usec())+".json"
	root.add_child(game)
	await _frames(100)
	# Deterministic art fixture. Freeze AI movement, keep Main/World/Player/Motion running.
	game.beast.set_physics_process(false);game.beast.global_position=Vector3(500,50,500)
	for enemy in game.enemies:
		enemy.set_physics_process(false);enemy.global_position=Vector3(500,50,500)
	game.player.realm=9;game.player.energy=100.0
	game.player.global_position=Vector3(0,game.world.height_at(0,190)+0.10,190)
	game.player.velocity=Vector3.ZERO
	await _frames(12)
	var original: Node=game.martial
	var saved: Dictionary=original.snapshot()
	original.queue_free()
	await process_frame
	game.martial=MODULE.new()
	game.add_child(game.martial)
	game.martial.setup(game);game.martial.restore(saved)
	_check(LIB.install(game.player._r2),"ten runtime-parsed candidate clips installed on original rig without editor import")
	game.martial.selected="break"
	game.player.descent_strike_landed.connect(func(_serial: int,_point: Vector3,_normal: Vector3,_speed: float): landed+=1)
	case_name="charged-break"
	_key(KEY_R,true);await _frames(180);_key(KEY_R,false)
	_check(not game.player._cast_active,"charged break finishes naturally")
	case_name="actual-G-ascent"
	_check(await _rise(),"actual G reaches legal 25m descent height")
	_key(KEY_T,true);_key(KEY_T,false)
	_check(game.martial.selected=="descent","actual T selects descent")
	case_name="descent-contact"
	_key(KEY_R,true)
	for index in range(240):
		await _frames(1)
		if landed>0: break
	await _frames(75);_key(KEY_R,false)
	_check(landed==1,"one actual descent ground contact with authored landing recovery")
	case_name="natural-descent-cooldown"
	for index in range(1200):
		if float(game.martial.cooldowns.get("descent",0.0))<=0.0: break
		await _frames(1)
	case_name="actual-G-cancel-ascent"
	_check(await _rise(),"actual G reaches height for accepted cancellation")
	case_name="descent-accepted-cancel"
	_key(KEY_R,true)
	for index in range(45):
		await _frames(1)
		if game.player.descent_strike_active: break
	_check(game.player.descent_strike_active,"descent accepted before cancellation")
	await _frames(4);_key(KEY_R,false);_key(KEY_G,true);await _frames(10);_key(KEY_G,false);await _frames(45)
	_check(landed==1 and not game.player.descent_strike_active,"accepted cancellation produces no additional ground contact")
	_check(_hashes()==source_hashes,"production and candidate sources unchanged during runtime")
	var file := FileAccess.open(output+"/result.json",FileAccess.WRITE)
	file.store_string(JSON.stringify({"checks":checks,"traces":traces,"source_sha256":source_hashes,"slot":game.save_path,"scope":"Candidate-only actual R/T/G, live Main/Player/Motion; deterministic realm/energy/position and stationary AI art fixture. No editor import, no production promotion. Normal-speed visual inspection still required; movie mode is rendering evidence, not runtime performance."},"\t"))
	print("MARTIAL_CANDIDATE_RESULT ",output)
	game.initialized=false;game.queue_free();await process_frame
	quit(0 if checks.all(func(check): return check.ok) else 1)
