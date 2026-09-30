extends SceneTree
var failures: Array[String] = []
func _initialize() -> void:
	call_deferred("run")
func run() -> void:
	var motion = load("res://scripts/native_motion_r2.gd").new()
	root.add_child(motion)
	var report: Array = []
	for speed in [6.8,10.0]:
		for direction in [Vector3.FORWARD,Vector3.BACK,Vector3.LEFT,Vector3.RIGHT]:
			var state := {"speed":speed,"local_velocity":direction*speed}
			for f in range(60):
				motion.step(1.0/120.0,state)
			var phase_start: float = motion.gait_phase
			motion.step(0.1,state)
			var expected := 0.2 * (-1.0 if direction == Vector3.BACK else 1.0)
			if absf(wrapf(motion.gait_phase-phase_start-expected,-.5,.5)) > 0.001:
				failures.append("Stride speed phase mismatch")
			if motion.gait_name != ("jog" if speed==6.8 else "sprint") or absf(motion.playback_rate-1.0)>0.001:
				failures.append("Actual speed did not select matching authored gait")
			report.append({"speed":speed,"direction":str(direction),"gait":motion.gait_name,"rate":motion.playback_rate})
	# Combat no longer copies jogging legs: world support is checked separately by
	# combat_verify.gd. Here ensure the drive actually changes pelvis orientation.
	for action in ["jab","cross"]:
		motion.step(0.2,{"action":action,"progress":0.0})
		var pelvis: int = motion._rig.find_bone("pelvis")
		var start_q: Quaternion = motion._rig.get_bone_pose_rotation(pelvis)
		motion.step(0.2,{"action":action,"progress":0.38})
		if start_q.angle_to(motion._rig.get_bone_pose_rotation(pelvis)) < deg_to_rad(8):
			failures.append("Punch lost pelvis drive")
	# Quantify stance foot drift in world space for actual 6.8 and 10 m/s.
	for speed in [6.8,10.0]:
		for settle in range(60):
			motion.step(1.0/120.0,{"speed":speed,"local_velocity":Vector3(0,0,-speed)})
		motion.gait_phase = 0.0
		motion._blend_age = 1.0
		var points: Array[Vector3] = []
		var stance := 0.22 if speed==6.8 else 0.18
		for f in range(1,25):
			motion.step(1.0/240.0,{"speed":speed,"local_velocity":Vector3(0,0,-speed)})
			motion._rig.force_update_all_bone_transforms()
			if motion.gait_phase < stance:
				var foot: Vector3 = motion._rig.get_bone_global_pose(motion._rig.find_bone("ankleL")).origin
				foot.z -= speed*float(f)/240.0
				points.append(foot)
		var drift := 0.0
		for p in points:
			drift = maxf(drift,absf(p.z-points[0].z))
		report.append({"speed":speed,"stance_world_ankle_drift_m":drift})
		if drift > 0.025:
			failures.append("Stance foot drift exceeds 2.5 cm")
	for action in ["jab","cross"]:
		for movement in [Vector3.ZERO,Vector3(0,0,-0.2),Vector3(0.2,0,0),Vector3(0,0,0.2)]:
			for f in range(60):
				motion.step(1.0/60.0,{"action":action,"progress":0.38,"speed":movement.length(),"local_velocity":movement})
			motion._rig.force_update_all_bone_transforms()
			var side := "L" if action == "jab" else "R"
			var shoulder: Vector3 = motion._rig.get_bone_global_pose(motion._rig.find_bone("shoulder"+side)).origin
			var wrist: Vector3 = motion._rig.get_bone_global_pose(motion._rig.find_bone("wrist"+side)).origin
			var delta: Vector3 = motion._rig.global_basis * (wrist-shoulder)
			report.append({"action":action,"movement":str(movement),"wrist_minus_shoulder_world":str(delta),"forward_m":-delta.z,"lateral_m":absf(delta.x)})
			if -delta.z < 0.44 or absf(delta.x) > .08:
				failures.append("Punch contact is not aligned to aim-forward")
	for tier in [6,8,9]:
		var effect = load("res://scripts/native_vfx_r2.gd").new()
		root.add_child(effect)
		effect.auto_tick = false
		effect.launch_tier(tier,Vector3.ZERO,Vector3(0,1.4,-4),0.5)
		effect.advance(0.5)
		if effect.global_position.distance_to(Vector3(0,1.4,-4))>.001 or not effect.stationary:
			failures.append("High tier target alignment failed")
		effect.advance(.26)
		if not effect.is_queued_for_deletion():
			failures.append("High tier failed to expire")
	var output := {"results":report,"failures":failures}
	var file := FileAccess.open("res://assets/motion-r2/directional-report.json",FileAccess.WRITE)
	file.store_string(JSON.stringify(output,"  "))
	print(JSON.stringify(output))
	quit(0 if failures.is_empty() else 1)
