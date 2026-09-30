extends SceneTree
var failures: Array[String] = []
func _initialize() -> void:
	call_deferred("run")
func skeleton(node: Node) -> Skeleton3D:
	if node is Skeleton3D:
		return node
	for child in node.get_children():
		var s := skeleton(child)
		if s != null:
			return s
	return null
func run() -> void:
	var motion = load("res://scripts/native_motion_r2.gd").new()
	root.add_child(motion)
	var rig := skeleton(motion)
	var rests: Array[Transform3D] = []
	for i in range(rig.get_bone_count()):
		rests.append(rig.get_bone_rest(i))
	var states := [{}, {"speed":0.88}, {"airborne":true}, {"airborne":true,"boost":true,"bank":1.0}, {"airborne":true,"boost":true,"bank":-1.0}, {"action":"left-jab"}, {"action":"right-cross"}, {"action":"rising-kick"}, {"guard":true}, {"action":"hit"}, {"action":"cast"}, {"first_person":true}, {}]
	var frames := 0
	for state in states:
		for f in range(60):
			motion.step(1.0/60.0,state)
			rig.force_update_all_bone_transforms()
			for b in range(rig.get_bone_count()):
				var pose := rig.get_bone_global_pose(b)
				if not pose.is_finite() or pose.origin.length() > 3.0:
					failures.append("Invalid or oversized bone pose")
				if not rests[b].is_equal_approx(rig.get_bone_rest(b)):
					failures.append("Rest transform changed")
			frames += 1
		if bool(state.get("first_person",false)) == motion.visible:
			failures.append("First person visibility mismatch")
	var vfx = load("res://scripts/native_vfx_r2.gd").new()
	root.add_child(vfx)
	vfx.auto_tick = false
	vfx.launch(Vector3(0,1.4,0),Vector3(0,0,-1),24)
	vfx.advance(0.1)
	if vfx.global_position.z > -0.44:
		failures.append("Effect spawned behind hand")
	vfx.advance(0.2)
	if vfx.global_position.z >= -2.0:
		failures.append("Effect did not travel forward")
	vfx.impact()
	var stop: Vector3 = vfx.global_position
	vfx.advance(0.05)
	if vfx.global_position != stop:
		failures.append("Effect moved after collision")
	vfx.advance(0.1)
	if not vfx.is_queued_for_deletion():
		failures.append("Effect did not expire")
	var timed = load("res://scripts/native_vfx_r2.gd").new()
	root.add_child(timed)
	timed.auto_tick = false
	timed.launch_toward(Vector3(0,1.4,0), Vector3(0,1.4,-12),0.4)
	timed.advance(0.4)
	if timed.global_position.distance_to(Vector3(0,1.4,-12)) > 0.001:
		failures.append("Effect missed authoritative contact time")
	# Exercise the real player data interface without entering its world or save loop.
	var owner_player = load("res://scripts/native_player.gd").new()
	owner_player._attack_name = "left-jab"
	owner_player._attack_elapsed = 0.0
	owner_player._attack_windup = 0.2
	owner_player._attack_duration = 0.6
	motion.update_from_player(0.2,owner_player)
	if absf(motion.player.current_animation_position / motion.player.current_animation_length - 0.38) > 0.001:
		failures.append("Player windup did not map to authored contact pose")
	motion.update_from_player(0.41,owner_player)
	if not owner_player._attack_name.is_empty():
		failures.append("Adapter failed to clear completed attack")
	owner_player._cast_active = true
	owner_player._cast_elapsed = 0.0
	owner_player._cast_windup = 0.3
	owner_player._cast_duration = 0.7
	motion.update_from_player(0.71,owner_player)
	if owner_player._cast_active:
		failures.append("Adapter failed to clear completed cast")
	owner_player.free()
	var report := {"frames":frames,"states":states.size(),"bones":rig.get_bone_count(),"failures":failures,"scope":"Native module transitions, rest preservation, visibility and VFX lifetime; no claim about real input or full-world camera."}
	var file := FileAccess.open("res://assets/motion-r2/transition-report.json",FileAccess.WRITE)
	file.store_string(JSON.stringify(report,"  "))
	file.close()
	print(JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
