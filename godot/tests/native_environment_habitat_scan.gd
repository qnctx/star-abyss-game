extends SceneTree
## Choose real field sites by habitat, without writing or loading any game save.
func _initialize() -> void:
	var field := NativePlanetField.new()
	var best := {"forest":{"score":-1.0},"transition":{"score":-1.0},"wetland":{"score":-1.0}}
	for s in range(13000,25001,1000):
		for n in range(-6000,6001,750):
			var direction := field.route_direction(float(s),float(n))
			var sample: Dictionary = field.sample(direction)
			if float(sample.legacy_weight)>0.0 or float(sample.water_depth)>.04: continue
			var forest := float(sample.forest)
			var wet := float(sample.wetland)
			var scores := {"forest":forest*(1.0-wet),"wetland":wet*forest,"transition":(1.0-absf(forest-.22)*3.0)*(1.0-wet)}
			for kind: String in best:
				if float(scores[kind])>float(best[kind].score):
					best[kind] = {"score":scores[kind],"direction":[direction.x,direction.y,direction.z],"route":[s,n],"sample":sample}
	DirAccess.make_dir_recursive_absolute("res://reports/ecology-damage-r4")
	var file := FileAccess.open("res://reports/ecology-damage-r4/habitat-sites.json",FileAccess.WRITE)
	file.store_string(JSON.stringify(best,"\t"))
	print("ECOLOGY_HABITAT_SITES=",JSON.stringify(best))
	quit()
