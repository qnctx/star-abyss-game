extends SceneTree

const Field = preload("res://scripts/native_planet_field.gd")
var field = Field.new()
var stage: Node3D
var camera: Camera3D

func _initialize() -> void:
	call_deferred("capture")

func capture() -> void:
	root.size = Vector2i(1440, 1000)
	stage = Node3D.new()
	root.add_child(stage)
	var environment := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("18222d")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("b3c4d5")
	env.ambient_light_energy = 0.65
	environment.environment = env
	stage.add_child(environment)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-42,-30,0)
	sun.light_energy = 1.5
	stage.add_child(sun)
	camera = Camera3D.new()
	camera.far = 300000.0
	stage.add_child(camera)
	var views: Array[Dictionary] = [
		{"name":"continent", "center":Vector2(-25000,0), "span":Vector2(155000,125000), "height_scale":3.0},
		{"name":"river", "center":Vector2(27000,2500), "span":Vector2(26000,14000), "height_scale":6.0},
		{"name":"cold", "center":Vector2(-38000,-35000), "span":Vector2(25000,17000), "height_scale":1.0},
		{"name":"volcanic", "center":Vector2(-56000,16000), "span":Vector2(31000,21000), "height_scale":1.0},
		{"name":"crystal", "center":Vector2(-14000,39000), "span":Vector2(24000,15000), "height_scale":1.0},
		{"name":"storm", "center":Vector2(-69000,-19000), "span":Vector2(29000,20000), "height_scale":1.0}
	]
	for view: Dictionary in views:
		var mesh: MeshInstance3D = make_patch(view.center, view.span, float(view.height_scale))
		stage.add_child(mesh)
		camera.projection = Camera3D.PROJECTION_ORTHOGONAL
		camera.size = float(view.span.x) * 0.80
		camera.position = Vector3(0,float(view.span.x)*0.75,float(view.span.x)*0.48)
		camera.look_at(Vector3.ZERO)
		for frame in range(5):
			await process_frame
		await RenderingServer.frame_post_draw
		var path: String = "res://../docs/development/planet-field-r3-" + String(view.name) + ".png"
		root.get_texture().get_image().save_png(path)
		print("R3_FIELD_PREVIEW=" + path)
		mesh.queue_free()
		await process_frame
	quit()

func make_patch(center: Vector2, span: Vector2, exaggeration: float) -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	const COUNT: int = 230
	var positions: Array[Vector3] = []
	var colors: Array[Color] = []
	for z in range(COUNT+1):
		for x in range(COUNT+1):
			var local := Vector2((float(x)/COUNT-0.5)*span.x,(float(z)/COUNT-0.5)*span.y)
			var s: float = center.x+local.x
			var n: float = center.y+local.y
			var direction: Vector3 = field.route_direction(s,n-Field._route_z(s))
			var value: Dictionary = field.sample(direction)
			var h: float = float(value.height)
			var color := Color("78866c").lerp(Color("62596b"),float(value.basin))
			color = color.lerp(Color("716b73"),float(value.mountains))
			color = color.lerp(Color("a4bec5"),float(value.cold))
			color = color.lerp(Color("645451"),float(value.volcanic))
			color = color.lerp(Color("978cb0"),float(value.crystal))
			color = color.lerp(Color("7a7970"),float(value.storm))
			if float(value.water_depth) > 0.0:
				h = float(value.water_height)
				color = Color("428786").lerp(Color("183c57"),clampf(float(value.water_depth)/400.0,0.0,1.0))
			positions.append(Vector3(local.x,h*exaggeration,local.y))
			colors.append(color)
	for z in range(COUNT):
		for x in range(COUNT):
			var a: int = z*(COUNT+1)+x
			for index: int in [a,a+1,a+COUNT+1,a+1,a+COUNT+2,a+COUNT+1]:
				st.set_color(colors[index])
				st.add_vertex(positions[index])
	st.generate_normals()
	var material := StandardMaterial3D.new()
	material.vertex_color_use_as_albedo = true
	material.roughness = 1.0
	st.set_material(material)
	var instance := MeshInstance3D.new()
	instance.mesh = st.commit()
	return instance
