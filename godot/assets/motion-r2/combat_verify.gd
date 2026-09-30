extends SceneTree
const Motion = preload("res://scripts/native_motion_r2.gd")
var failures: Array[String] = []
func _initialize() -> void:
	call_deferred("run")
func run() -> void:
	var motion := Motion.new()
	root.add_child(motion)
	var rig: Skeleton3D = motion._rig
	var rests: Array[Transform3D] = []
	for i in range(rig.get_bone_count()):
		rests.append(rig.get_bone_rest(i))
	var report := {}
	for action in ["jab","cross","kick","guard","hit"]:
		motion.step(1.0,{"speed":0.0})
		var anchors := {}
		var drift := 0.0
		var max_jump := 0.0
		var previous := {}
		for f in range(61):
			motion.position.z -= 0.001
			motion.step(1.0/60.0,{"action":action,"progress":float(f)/60.0})
			for side in ["L","R"]:
				var ankle := rig.find_bone("ankle"+side)
				var pos := rig.global_transform*rig.get_bone_global_pose(ankle).origin
				if f==10: anchors[side]=pos
				if f>10 and (action!="kick" or side=="L"):
					drift=maxf(drift,pos.distance_to(anchors[side]))
				if previous.has(side):max_jump=maxf(max_jump,pos.distance_to(previous[side]))
				previous[side]=pos
			for i in range(rig.get_bone_count()):
				if not rig.get_bone_global_pose(i).is_finite():failures.append(action+" nonfinite")
		if drift>0.015:failures.append(action+" support drift "+str(drift))
		report[action]={"support_ankle_world_drift_m":drift,"max_ankle_frame_delta_m":max_jump,"root_travel_m":0.061}
	for action in ["jab","cross","kick","guard","hit"]:
		motion.step(0.2,{"airborne":true,"action":action,"progress":0.38})
		if motion.current!="air_"+action:failures.append("air clip "+action)
		if not motion._foot_anchors.is_empty():failures.append("air foot lock")
	# Cancelling a kick while the rear foot is chambered must not anchor it aloft.
	motion.step(0.2,{"action":"kick","progress":0.7})
	for f in range(12):motion.step(1.0/60.0,{"action":"jab","progress":float(f)/30.0})
	var rear_ankle := rig.get_bone_global_pose(rig.find_bone("ankleR")).origin
	if rear_ankle.y > 0.20:failures.append("kick cancellation locked rear foot in air")
	report["kick_cancel_rear_ankle_height_m"]=rear_ankle.y
	# Current controller speed caps, including recovery; keep one anchor through
	# a travelling three-hit chain, instead of testing only a tiny displacement.
	motion.step(1.0,{})
	var chain_anchor := {}
	var chain_drift := 0.0
	var rear_drift := 0.0
	var chain_start := motion.position
	for move in [{"action":"jab","duration":0.27,"full":0.42,"windup":0.15,"speed":0.5},{"action":"cross","duration":0.31,"full":0.50,"windup":0.19,"speed":0.35},{"action":"kick","duration":0.68,"full":0.68,"windup":0.27,"speed":0.08}]:
		for f in range(ceili(float(move.duration)*60.0)):
			motion.position.z -= float(move.speed)/60.0
			motion.step(1.0/60.0,{"action":move.action,"progress":motion._contact_progress(float(f)/60.0,move.windup,move.full)})
			var point := rig.global_transform*rig.get_bone_global_pose(rig.find_bone("ankleL")).origin
			var rear := rig.global_transform*rig.get_bone_global_pose(rig.find_bone("ankleR")).origin
			if move.action=="jab" and f==10:
				chain_anchor["L"]=point
				chain_anchor["R"]=rear
			if chain_anchor.has("L"):chain_drift=maxf(chain_drift,point.distance_to(chain_anchor.L))
			if chain_anchor.has("R") and move.action!="kick":rear_drift=maxf(rear_drift,rear.distance_to(chain_anchor.R))
	report["travelling_chain"]={"root_travel_m":motion.position.distance_to(chain_start),"left_support_drift_m":chain_drift,"rear_support_before_kick_drift_m":rear_drift}
	if maxf(chain_drift,rear_drift)>0.025:failures.append("Travelling combo exceeds support reach")
	# Regression: a grounded knockback outruns the old footprint. An unreachable
	# target must replant on the ground, never turn into a floating seated pose.
	motion.step(1.0,{})
	var highest_sole_proxy := 0.0
	for f in range(24):
		motion.position.z += 16.0/60.0
		motion.step(1.0/60.0,{"action":"hit","progress":minf(1.0,float(f)/21.0),"speed":16.0})
		for side in ["L","R"]:
			var height := rig.get_bone_global_pose(rig.find_bone("ankle"+side)).origin.y
			highest_sole_proxy=maxf(highest_sole_proxy,height)
			if f>6 and (height>0.20 or height<0.08):failures.append("Knockback foot lost floor contact")
	report["unreachable_knockback_max_ankle_y_m"]=highest_sole_proxy
	# Hold visual dt at zero, as requested by the authoritative hitstop controller.
	motion.step(0.2,{"action":"cross","progress":0.38})
	var wrist := rig.find_bone("wristR")
	var before := rig.get_bone_global_pose(wrist)
	motion.step(0.0,{"action":"cross","progress":0.38})
	if not before.is_equal_approx(rig.get_bone_global_pose(wrist)):failures.append("hitstop pose drift")
	for i in range(rig.get_bone_count()):
		if rig.get_bone_rest(i)!=rests[i]:failures.append("rest mutated")
	report["failures"]=failures
	report["scope"]="support ankle position with 6.1cm single-clip translation and 0.307m capped three-hit chain; air selection; finite rig; immutable rest; visual hitstop; kick cancel landing. Not sole contact, hand anatomy or artistic acceptance."
	var out := FileAccess.open("res://assets/motion-r2/combat-report.json",FileAccess.WRITE)
	out.store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
