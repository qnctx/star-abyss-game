extends "res://assets/motion-r2/preview.gd"
func _initialize() -> void:
	clips = ["jab","cross"]
	destination = "res://assets/motion-r2/evidence/contact"
	camera_views = [Vector3(-3.4,1.7,0),Vector3(0,1.7,-3.7),Vector3(3.4,1.7,0)]
	capture_sequence = false
	call_deferred("run")
