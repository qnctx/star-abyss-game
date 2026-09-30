extends RefCounted
## Runtime GLTF parsing for isolated candidate QA; no editor import/cache overwrite.
static func scene_from_glb(path: String) -> Node:
	var document := GLTFDocument.new()
	var state := GLTFState.new()
	if document.append_from_file(path, state) != OK:
		return null
	return document.generate_scene(state)

static func install(motion: Node) -> bool:
	var imported := scene_from_glb("res://assets/martial-r4-candidate-01/c2-martial-r4.glb")
	if imported == null: return false
	var source: AnimationPlayer = motion._find_player(imported)
	if source == null:
		imported.free()
		return false
	var library := AnimationLibrary.new()
	var root: Node = motion.player.get_node(motion.player.root_node)
	var rig_path := String(root.get_path_to(motion._rig))
	for key in source.get_animation_list():
		var short_name := String(key).get_slice("/", String(key).get_slice_count("/")-1)
		if not "cast_martial_" in short_name: continue
		var animation := source.get_animation(key).duplicate(true) as Animation
		for index in range(animation.get_track_count()-1,-1,-1):
			var old_path := animation.track_get_path(index)
			var bone := String(old_path.get_concatenated_subnames())
			if bone.is_empty() or motion._rig.find_bone(bone)<0: animation.remove_track(index)
			else: animation.track_set_path(index, NodePath(rig_path+":"+bone))
		animation.loop_mode=Animation.LOOP_NONE
		library.add_animation(short_name,animation)
		motion.names[short_name]="martial_candidate_01/"+short_name
	motion.player.add_animation_library("martial_candidate_01",library)
	imported.free()
	return library.get_animation_list().size()==10
