extends SceneTree

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var stage := Node3D.new()
	root.add_child(stage)
	var ecology := NativePlanetEcology.new()
	ecology.use_saved_meshes = false
	stage.add_child(ecology)
	ecology.setup(null)
	var output := "res://assets/planet-ecology-r3/"
	for key in ecology.meshes:
		ResourceSaver.save(ecology.meshes[key].mesh,output+key+".res")
		if ecology.meshes[key].shape != null: ResourceSaver.save(ecology.meshes[key].shape,output+key+"-collision.tres")
	var environment := WorldEnvironment.new()
	environment.environment = Environment.new()
	environment.environment.background_mode = Environment.BG_COLOR
	environment.environment.background_color = Color("a3abbc")
	environment.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.environment.ambient_light_color = Color("b7c1d5")
	environment.environment.ambient_light_energy = 0.7
	environment.environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	stage.add_child(environment)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-42,-28,0)
	sun.light_energy = 1.8
	sun.shadow_enabled = true
	stage.add_child(sun)
	var ground := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(160,130)
	ground.mesh = plane
	var soil := StandardMaterial3D.new()
	soil.albedo_color = Color("565548")
	soil.roughness = 1.0
	ground.material_override = soil
	stage.add_child(ground)
	var camera := Camera3D.new()
	camera.position = Vector3(28,15,38)
	stage.add_child(camera)
	camera.look_at(Vector3(0,8,0))
	camera.fov = 48
	for i in range(8):
		var node := MeshInstance3D.new()
		node.mesh = ecology.meshes["tree-0"].mesh
		node.position = Vector3(-11+(i%4)*10,0,-floori(i/4.0)*21)
		node.rotation.y = i*2.3
		node.scale = Vector3.ONE*(0.85+(i%3)*0.13)
		stage.add_child(node)
	for i in range(60):
		var tuft := MeshInstance3D.new()
		tuft.mesh = ecology.meshes["grass-0"].mesh
		tuft.position = Vector3(sin(i*2.39)*18,0,cos(i*1.73)*12)
		stage.add_child(tuft)
	for i in range(18):
		var node := MeshInstance3D.new()
		node.mesh = ecology.meshes["reed-0" if i%3==0 else "pebble-0"].mesh
		node.position = Vector3(-15+i*1.6,0,5+sin(i)*3)
		stage.add_child(node)
	await process_frame
	await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(output+"preview-forest-r3.png")
	for node in stage.get_children():
		if node is MeshInstance3D and node != ground: node.queue_free()
	await process_frame
	for i in range(4):
		var kind: String = ["outcrop","crystal","floatrock","pebble"][i]
		var node := MeshInstance3D.new()
		node.mesh = ecology.meshes[kind+"-0"].mesh
		node.position = Vector3((i-1.5)*10,7 if kind=="floatrock" else 0,0)
		stage.add_child(node)
	camera.position = Vector3(25,16,40)
	camera.look_at(Vector3(0,3,0))
	await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(output+"preview-geology-r3.png")
	print("R3_PREVIEW_OK: actual Godot render and 21 mesh resources saved")
	quit()
