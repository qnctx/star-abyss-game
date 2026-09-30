extends SceneTree
const Ecology = preload("res://scripts/native_planet_ecology.gd")
var ecology: Node3D
var stage: Node3D
var camera: Camera3D
var output := "res://reports/ecology-damage-r4/"
var visual := false
var failures: Array[String] = []
var tested_parts := {}

func _initialize() -> void: call_deferred("run")

func run() -> void:
	visual = "--visual" in OS.get_cmdline_user_args()
	DirAccess.make_dir_recursive_absolute(output)
	stage = Node3D.new()
	root.add_child(stage)
	ecology = Ecology.new()
	stage.add_child(ecology)
	ecology.setup(null)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color("69737d")
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color("b7c4d5")
	env.environment.ambient_light_energy = .72
	env.environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	stage.add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-42,-30,0)
	sun.light_energy = 1.6
	sun.shadow_enabled = true
	stage.add_child(sun)
	var ground := StaticBody3D.new()
	stage.add_child(ground)
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(180,.5,180)
	shape.shape = box
	shape.position.y = -.3
	ground.add_child(shape)
	var floor_mesh := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(180,180)
	floor_mesh.mesh = plane
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color("696650")
	mat.roughness = 1.0
	floor_mesh.material_override = mat
	ground.add_child(floor_mesh)
	camera = Camera3D.new()
	stage.add_child(camera)
	camera.fov = 43
	camera.far = 600
	for species_index in range(3):
		for age in range(3):
			var species: String = ["pine","oak","alder"][species_index]
			add_entity(species+str(age),"%s-%d-0"%[species,age],Vector3((age-1)*21,0,-species_index*28),"tree")
	camera.position = Vector3(42,25,55)
	camera.look_at(Vector3(0,6,-18))
	await capture("01-species-age-perspective")
	camera.position = Vector3(0,83,-18)
	camera.look_at(Vector3(0,0,-18),Vector3.FORWARD)
	await capture("02-species-age-birdseye")
	# Same orthographic presentation as the reference: one species at a time.
	for species_index in range(3):
		for child in stage.get_children():
			if child.name.begins_with("Entity_"): child.visible = child.name.begins_with("Entity_"+["pine","oak","alder"][species_index])
		camera.projection = Camera3D.PROJECTION_ORTHOGONAL
		camera.size = 43 # Full old-oak crown fits the species review frame.
		camera.position = Vector3(0,10,24-species_index*28)
		camera.look_at(Vector3(0,9,-species_index*28))
		await capture("03-reference-row-"+str(species_index))
	# Explicit isolated save path; never bind to the user's default slot.
	ecology.damage_service.clear_stream()
	for child in stage.get_children():
		if child.name.begins_with("Entity_"): child.queue_free()
	await process_frame
	var bind: int = ecology.damage_service.bind_save_slot(output+"test-slot.environment.json",12345,"visual-r4-independent",false)
	check("isolated slot bound",bind==OK)
	add_entity("oak-target","oak-1-0",Vector3(-8,0,0),"tree")
	add_entity("rock-target","outcrop-0-0",Vector3(10,0,-3),"outcrop")
	camera.projection = Camera3D.PROJECTION_PERSPECTIVE
	camera.position = Vector3(28,17,38)
	camera.look_at(Vector3(0,5,0))
	await capture("04-destruction-intact")
	var record: Dictionary = ecology.damage_service.entities["oak-target"]
	var segment: Dictionary = {}
	for candidate: Dictionary in record.asset.segments:
		if str(candidate.part).begins_with("branch_") and (candidate.b as Vector3).distance_to(candidate.a)>1.0: segment = candidate; break
	if not segment.is_empty():
		var point: Vector3 = record.transform*((segment.a as Vector3).lerp(segment.b,.85))
		var result: Dictionary = ecology.damage_service.damage({"origin":point,"radius":.18,"power":180,"damage_type":"slash","source":"test-player","cast_id":"branch-1","phase":0})
		tested_parts["branch"] = result.hits[0].part if not result.hits.is_empty() else "miss"
		check("branch detached by spatial query",result.changed==1 and not ecology.damage_service.states["oak-target"].fallen)
		check("same cast target deduplicated",ecology.damage_service.damage({"origin":point,"radius":.18,"power":180,"source":"test-player","cast_id":"branch-1"}).changed==0)
	await physics_ticks(40)
	await capture("05-branch-falling")
	# The independent suite retains the old fixed sweep as a geometry regression.
	# This sequence separately exercises a real branch, one main stem and the base.
	var stem_segments: Array = record.asset.segments.filter(func(s: Dictionary)->bool:return s.part=="stem_00")
	var stem_point: Vector3 = record.transform*((stem_segments[2].a as Vector3).lerp(stem_segments[2].b,.5))
	var stem_result: Dictionary = ecology.damage_service.damage({"origin":stem_point,"radius":.035,"power":210,"damage_type":"slash","source":"test-player","cast_id":"stem-3"})
	tested_parts["main_stem"] = stem_result.hits[0].part if not stem_result.hits.is_empty() else "miss"
	check("one main stem detaches without whole tree collapse",stem_result.changed==1 and stem_result.hits[0].part=="stem_00" and not ecology.damage_service.states["oak-target"].fallen and "stem_01" not in ecology.damage_service.states["oak-target"].broken)
	await physics_ticks(40)
	await capture("05b-main-stem-subtree-falling")
	await physics_ticks(180)
	var review_camera := camera.transform
	camera.position = Vector3(-1,8,19)
	camera.look_at(Vector3(-8,4,0))
	await capture("05c-partial-tree-settled-close")
	camera.transform = review_camera
	var trunk_query := {"origin":Vector3(-10,1.12,0),"radius":.05,"direction":Vector3.RIGHT,"reach":2.5,"power":350,"damage_type":"blunt","source":"test-player","cast_id":"base-4"}
	var trunk_result: Dictionary = ecology.damage_service.damage(trunk_query)
	tested_parts["basal_trunk"] = trunk_result.hits[0].part if not trunk_result.hits.is_empty() else "miss"
	check("shared basal trunk breaks and remaining crown falls",trunk_result.changed==1 and trunk_result.hits[0].part=="trunk" and ecology.damage_service.states["oak-target"].fallen)
	if visual: check("original standing MultiMesh hidden on real GPU",absf((record.batch as MultiMesh).get_instance_transform(0).basis.determinant())<.000001)
	await physics_ticks(40)
	await capture("06-trunk-hinge-fall")
	var rock_result: Dictionary = ecology.damage_service.damage({"origin":Vector3(10,2,-3),"radius":4.0,"power":800,"damage_type":"blast","source":"test-player","cast_id":"rock-3"})
	check("finite rock shattered",rock_result.changed==1)
	await physics_ticks(15)
	await capture("07-rock-fracture-flight")
	await physics_ticks(230)
	await capture("08-settled-same-camera")
	camera.position = Vector3(-3,4,9)
	camera.look_at(Vector3(-8,1.4,0))
	await capture("08b-basal-fracture-close")
	camera.transform = review_camera
	check("fragment physics reclaimed",ecology.damage_service.debris.is_empty())
	check("save isolated sidecar",ecology.damage_service.save_state()==OK)
	var state_before: Dictionary = ecology.damage_service.states.duplicate(true)
	var diagnostic := FileAccess.open(output+"before-reload-state.json",FileAccess.WRITE)
	diagnostic.store_string(JSON.stringify(state_before,"\t"))
	ecology.damage_service.clear_stream()
	for child in stage.get_children():
		if child.name.begins_with("Entity_"): child.queue_free()
	await process_frame
	check("reload isolated sidecar",ecology.damage_service.bind_save_slot(output+"test-slot.environment.json",12345,"visual-r4-independent",true)==OK)
	add_entity("oak-target","oak-1-0",Vector3(-8,0,0),"tree")
	add_entity("rock-target","outcrop-0-0",Vector3(10,0,-3),"outcrop")
	await capture("09-reloaded-same-camera")
	diagnostic = FileAccess.open(output+"after-reload-state.json",FileAccess.WRITE)
	diagnostic.store_string(JSON.stringify(ecology.damage_service.states,"\t"))
	check("persistent damage equivalent",equivalent(state_before,ecology.damage_service.states))
	var report := {"failures":failures,"tested_parts":tested_parts,"damage":ecology.damage_service.snapshot(),"actual_godot_frames":visual,"scope":"isolated authored assets and real physics; not whole game acceptance"}
	var f := FileAccess.open(output+"visual-test-results.json",FileAccess.WRITE)
	f.store_string(JSON.stringify(report,"\t"))
	print("ENVIRONMENT_R4_VISUAL="+JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)

func add_entity(id: String, key: String, position: Vector3, kind: String) -> void:
	var parent := Node3D.new()
	parent.name = "Entity_"+id
	stage.add_child(parent)
	var asset: Dictionary = ecology.asset_library.assets[key]
	var transform := Transform3D(Basis.IDENTITY,position)
	var batch := MultiMesh.new()
	batch.transform_format = MultiMesh.TRANSFORM_3D
	batch.mesh = asset.mesh
	batch.instance_count = 1
	batch.set_instance_transform(0,transform)
	var visual_mesh := MultiMeshInstance3D.new()
	visual_mesh.multimesh = batch
	parent.add_child(visual_mesh)
	var body := StaticBody3D.new()
	body.transform = transform
	parent.add_child(body)
	if kind=="tree":
		for segment: Dictionary in asset.segments: ecology.asset_library.add_segment(body,segment)
	else:
		var shape := CollisionShape3D.new()
		shape.shape = (asset.mesh as ArrayMesh).create_convex_shape(true,true)
		body.add_child(shape)
	ecology.damage_service.register_entity(id,{"cell":id,"kind":kind,"asset":asset,"transform":transform,"parent":parent,"batch":batch,"index":0,"body":body,"physical":true})

func capture(name: String) -> void:
	await process_frame
	await process_frame
	if visual:
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(output+name+".png")

func physics_ticks(count: int) -> void:
	for i in range(count): await physics_frame

func check(label: String, passed: bool) -> void:
	if not passed: failures.append(label)

func equivalent(a: Variant,b: Variant) -> bool:
	if (a is int or a is float) and (b is int or b is float): return absf(float(a)-float(b))<.00001
	if a is Array and b is Array:
		if a.size()!=b.size(): return false
		for i in range(a.size()):
			if not equivalent(a[i],b[i]): return false
		return true
	if a is Dictionary and b is Dictionary:
		if a.size()!=b.size(): return false
		for key in a:
			if not b.has(key) or not equivalent(a[key],b[key]): return false
		return true
	return a==b
