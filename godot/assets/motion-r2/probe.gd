extends SceneTree
func _initialize() -> void:
	call_deferred("run")
func run() -> void:
	var m = load("res://scripts/native_motion_r2.gd").new()
	root.add_child(m)
	for name in ["jog","sprint","jab","cross"]:
		m.player.play(m.names[name],0)
		print(name," duration ",m.player.current_animation_length)
		for phase in [0.0,0.05,0.10,0.15,0.2,0.38]:
			m.player.seek(phase*m.player.current_animation_length,true)
			m._rig.force_update_all_bone_transforms()
			var side := "L" if name=="jab" else "R"
			var shoulder: Vector3 = m._rig.get_bone_global_pose(m._rig.find_bone("shoulder"+side)).origin
			var wrist: Vector3 = m._rig.get_bone_global_pose(m._rig.find_bone("wrist"+side)).origin
			print(phase," ankle ",m._rig.get_bone_global_pose(m._rig.find_bone("ankleL")).origin," punch delta ",wrist-shoulder)
	quit()
