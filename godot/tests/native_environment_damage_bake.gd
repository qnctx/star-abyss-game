extends SceneTree
func _initialize() -> void:
	var assets = preload("res://scripts/native_environment_damage_assets.gd").new()
	assets.prefer_baked = false
	assets.load_library()
	for key: String in assets.assets:
		ResourceSaver.save(assets.assets[key].mesh,assets.ROOT+key+".res")
		for part: String in assets.assets[key].parts:
			var name := key+"_"+part
			ResourceSaver.save(assets.mesh_named(name),assets.ROOT+name+".res")
	print("ECOLOGY_R4_BAKED=",assets.parts.size())
	quit()
