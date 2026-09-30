extends "res://assets/motion-r2/preview.gd"

func _initialize() -> void:
	clips = ["jab","cross","kick","guard","hit","air_jab","air_kick"]
	destination = "res://assets/motion-r2/evidence/combat"
	camera_views = [Vector3(0,1.65,-4.0),Vector3(4,1.65,0),Vector3(2.8,1.65,-3.2)]
	capture_sequence = false
	super._initialize()
