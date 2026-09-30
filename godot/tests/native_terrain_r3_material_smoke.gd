extends SceneTree

# Developer shader check, not the independent main-scene acceptance.
const OUTPUT := "res://reports/terrain-r3-material"
var world: NativeWorld
var camera: Camera3D

func _initialize() -> void:
	call_deferred("_run")

func _shot(label: String, eye: Vector3, target: Vector3, up: Vector3 = Vector3.UP) -> void:
	camera.position = eye
	camera.look_at(target, up)
	for i in range(130):
		world.update_stream(eye)
		await physics_frame
	await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(OUTPUT + "/" + label + ".png")
	print("MATERIAL_SHOT ", label)

func _run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT))
	world = NativeWorld.new()
	root.add_child(world)
	camera = Camera3D.new()
	camera.near = 0.3
	camera.far = 800000.0
	camera.fov = 65.0
	root.add_child(camera)
	camera.make_current()
	await _shot("basin-ground", Vector3(-45, world.height_at(-45,190)+8,190), Vector3(0,30,-450))
	await _shot("basin-1600m",Vector3(0,1600,190),Vector3(0,0,-950))
	var field: NativePlanetField = world._planet.field
	for distance: float in [8000.0,17000.0,27000.0,34000.0]:
		var point: Vector3 = NativePlanet.canonical_to_scene(field.surface_point(field.route_direction(distance)))
		var up: Vector3 = world.up_at(point)
		var east: Vector3 = up.cross(Vector3.FORWARD).normalized()
		await _shot("route-%d" % int(distance),point+up*70.0-east*90.0,point+east*150.0,up)
	await _shot("orbit",Vector3(95000,160000,110000),NativePlanet.CENTER)
	world.queue_free()
	await process_frame
	quit()
