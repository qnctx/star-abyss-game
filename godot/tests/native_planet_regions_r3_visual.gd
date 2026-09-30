extends SceneTree
const Regions = preload("res://scripts/native_planet_regions_r3.gd")
const Source = preload("res://assets/planet-regions-r3/geology_mesh_source.gd")
var planet: NativePlanet
var details: Node3D
var camera: Camera3D
var reports: Array[Dictionary] = []
var failures: Array[String] = []
var checks: int = 0

func check(label: String,valid: bool) -> void:
	checks += 1
	if not valid:
		failures.append(label)

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	root.size = Vector2i(1440,1000)
	var stage := Node3D.new()
	root.add_child(stage)
	var environment := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("24243c")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("9da9bc")
	env.ambient_light_energy = 0.7
	environment.environment = env
	stage.add_child(environment)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-35,-35,0)
	sun.light_energy = 1.3
	stage.add_child(sun)
	planet = NativePlanet.new()
	stage.add_child(planet)
	planet.setup_world(null)
	details = Regions.new()
	stage.add_child(details)
	details.setup(planet)
	var first_region: Dictionary = planet.field.landmark_regions()[0]
	for i in range(12):
		details.update_stream(first_region.position)
	check("no details before real terrain is loaded",int(details.snapshot().patches)==0)
	camera = Camera3D.new()
	camera.far = 9000.0
	camera.fov = 62.0
	stage.add_child(camera)
	for variant in range(6):
		for lod in range(2):
			ResourceSaver.save(Source.ice_cluster(variant,lod),"res://assets/planet-regions-r3/ice-%d-%d.tres" % [variant,lod])
			ResourceSaver.save(Source.vent(variant,lod),"res://assets/planet-regions-r3/vent-%d-%d.tres" % [variant,lod])
	for region: Dictionary in planet.field.landmark_regions():
		if region.id not in ["cold","volcanic"]:
			continue
		# Move from the named valley centre onto the adjacent actual cliff/low groove.
		var up: Vector3 = NativePlanet.radial_up(region.position)
		var east := Vector3(up.y,-up.x,0.0).normalized()
		var north := east.cross(up).normalized()
		var anchor: Vector3 = region.position+north*(500.0 if region.id=="cold" else 140.0)
		var direction: Vector3 = NativePlanet.scene_to_canonical(anchor).normalized()
		# Build real renderer near tiles synchronously in this isolated verifier.
		for tile: Dictionary in planet._neighbor_tiles(direction,NativePlanet.NEAR_LEVEL,2).values():
			var key: String = NativePlanet._tile_key(tile)
			if not planet._near_tiles.has(key):
				planet._near_tiles[key] = planet._build_tile(tile,NativePlanet.TILE_SEGMENTS,planet._near_root,true,0.0,0.0)
		for i in range(4):
			await physics_frame
		var actual: Dictionary = planet.rendered_visual_surface_at(anchor)
		anchor = actual.get("point",anchor)
		for frame in range(160):
			details.update_stream(anchor+up*5.0)
			await process_frame
		var snapshot: Dictionary = details.snapshot()
		check(String(region.id)+" actual visible patches",int(snapshot.patches)>0)
		check(String(region.id)+" triangle budget",int(snapshot.triangles)<=Regions.MAX_TRIANGLES)
		check(String(region.id)+" patch budget",int(snapshot.patches)<=Regions.MAX_PATCHES)
		var clearance_min: float = INF
		var clearance_max: float = -INF
		for cell: Dictionary in details._cells.values():
			var holder: Node3D = cell.node
			var mesh: MeshInstance3D = holder.get_child(0)
			var vertices: PackedVector3Array = mesh.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]
			for index in range(0,vertices.size(),3):
				var p: Vector3 = holder.to_global(vertices[index])
				var support: Dictionary = planet.rendered_visual_surface_at(p)
				check("rendered support exists",bool(support.get("ready",false)))
				if bool(support.get("ready",false)):
					var clearance: float = (p-Vector3(support.point)).dot(Vector3(support.normal))
					clearance_min = minf(clearance_min,clearance)
					clearance_max = maxf(clearance_max,clearance)
			if cell.kind=="volcanic" and bool(cell.collision_ready):
				check("vent collider only on ready surface",bool(planet.surface_at(cell.anchor).get("ready",false)))
		check(String(region.id)+" geological skin supported",clearance_min>=-0.10 and clearance_max<0.8)
		snapshot["clearance_min"] = clearance_min
		snapshot["clearance_max"] = clearance_max
		snapshot["region"] = region.id
		reports.append(snapshot)
		print("REGIONS_R3="+JSON.stringify({"region":region.id,"patches":snapshot.patches,"triangles":snapshot.triangles,"colliders":snapshot.colliders,"max_build_usec":snapshot.max_build_usec}))
		var focus: Vector3 = anchor
		if not snapshot.anchors.is_empty():
			focus = snapshot.anchors[0].position
			if region.id=="cold":
				var cell: Dictionary = details._cells.values()[0]
				focus = (cell.node.get_child(1) as Node3D).global_position
		var focus_surface: Dictionary = planet.rendered_visual_surface_at(focus)
		var facing: Vector3 = focus_surface.get("normal",up)
		camera.position = focus+facing*28.0+up*7.0+east*12.0
		camera.look_at(focus-up*2.0,up)
		for frame in range(5):
			await process_frame
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://../docs/development/planet-regions-r3-"+String(region.id)+".png")
		details.update_stream(Vector3(0,100000,0))
		await process_frame
		check(String(region.id)+" unload",int(details.snapshot().patches)==0 and int(details.snapshot().triangles)==0)
		reports.append({"after_unload":details.snapshot()})
	reports.append({"checks":checks,"failures":failures,"field_sha256":FileAccess.get_sha256("res://scripts/native_planet_field.gd"),"field_r3_sha256":FileAccess.get_sha256("res://scripts/native_planet_field_r3.gd")})
	var file := FileAccess.open("res://../docs/development/planet-regions-r3-results.json",FileAccess.WRITE)
	file.store_string(JSON.stringify(reports,"\t"))
	print("REGIONS_R3_CHECKS="+JSON.stringify({"checks":checks,"failures":failures}))
	quit(0 if failures.is_empty() else 1)
