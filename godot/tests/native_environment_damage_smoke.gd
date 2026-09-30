extends SceneTree
const Ecology = preload("res://scripts/native_planet_ecology.gd")
func _initialize() -> void:
	call_deferred("run")
func run() -> void:
	var ecology = Ecology.new()
	root.add_child(ecology)
	ecology.setup(null)
	print("ENVIRONMENT_R4_SMOKE=",ecology.damage_service.snapshot())
	ecology.clear()
	quit()
