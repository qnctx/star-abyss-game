extends Node
var probe: SceneTree
func _physics_process(delta: float) -> void:
	probe.sample(delta)
func _process(delta: float) -> void:
	if probe.has_method("render_sample"):
		probe.render_sample(delta)
