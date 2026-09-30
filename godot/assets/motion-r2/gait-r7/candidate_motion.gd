extends "res://scripts/native_motion_r2.gd"
## Candidate-only model injection; uses the current shared production methods.
var asset_path := "res://assets/motion-r2/gait-r7/candidate.glb"

func _ready() -> void:
	var asset := load(asset_path) as PackedScene
	assert(asset != null, "candidate asset failed to load")
	model = asset.instantiate()
	add_child(model)
	player = _find_player(model)
	player.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	_rig = _find_rig(model)
	for point in GAIT_SOLES.POINTS:
		var influences: Array = []
		for term in point:
			influences.append([_rig.find_bone(term[0]),float(term[1]),term[2]])
		_sole_points.append(influences)
	var base: Node3D = asset.instantiate()
	base.name = "LocomotionSampler"
	add_child(base)
	base.visible = false
	_base_rig = _find_rig(base)
	_base_player = _find_player(base)
	_base_player.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	_remove_meshes(base)
	for key in player.get_animation_list():
		var short_name := String(key).get_slice("/", String(key).get_slice_count("/") - 1)
		names[short_name] = key
		if short_name in ["idle", "walk", "jog", "sprint", "cruise", "boost", "guard", "air_guard", "combat_ready"]:
			player.get_animation(key).loop_mode = Animation.LOOP_LINEAR
			_base_player.get_animation(key).loop_mode = Animation.LOOP_LINEAR
	preload("res://scripts/native_martial_library.gd").install(self)

