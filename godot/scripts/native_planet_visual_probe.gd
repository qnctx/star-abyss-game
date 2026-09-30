extends SceneTree
var game: Node
var view: SubViewport
var camera: Camera3D
var rows: Array=[]
var out="res://reports/planet-world-r2/segments"
func _initialize() -> void:call_deferred("_run")
func _frames(n: int) -> void:
	for i in range(n):await physics_frame
	await process_frame
func _shot(name: String, eye: Vector3, target: Vector3, up: Vector3) -> void:
	camera.global_position=eye
	camera.look_at(target,up)
	await _frames(3)
	await RenderingServer.frame_post_draw
	view.get_texture().get_image().save_png(out+"/"+name+".png")
func _run() -> void:
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--label="):
			var label: String = argument.substr(8)
			if not label.is_empty() and label.length() < 40 and label.replace("-", "").is_valid_identifier():
				out = "res://reports/planet-world-r2/" + label
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(out))
	var hashes={}
	for path in ["scripts/native_world.gd","scripts/native_planet.gd","scripts/native_planet_field.gd","scripts/native_planet_coordinates.gd","scripts/native_player.gd","scripts/native_main.gd","scenes/main.tscn","assets/terrain/planet_surface.gdshader"]:hashes[path]=FileAccess.get_sha256("res://"+path)
	var utc=Time.get_datetime_string_from_system(true)
	game=load("res://scenes/main.tscn").instantiate()
	game.save_path="user://planet_independent_segments_"+str(Time.get_ticks_usec())+".json"
	root.add_child(game)
	view=SubViewport.new()
	view.size=Vector2i(960,540)
	view.world_3d=game.get_world_3d()
	view.render_target_update_mode=SubViewport.UPDATE_ALWAYS
	root.add_child(view)
	camera=Camera3D.new()
	camera.far=800000.0
	camera.near=0.2
	view.add_child(camera)
	camera.make_current()
	await _frames(5)
	var world=game.world
	var field=world._planet.field
	var targets=[]
	for distance in [8000,17000,27000,34000,42000]:targets.append({"name":"route-"+str(distance),"direction":field.route_direction(distance)})
	for pair in [["north",Vector3.UP],["south",Vector3.DOWN],["back",Vector3.LEFT],["cube-seam",Vector3(1,1,1).normalized()]]:targets.append({"name":pair[0],"direction":pair[1]})
	for fixture in targets:
		var sample: Dictionary=field.sample(fixture.direction)
		var ground: Vector3=NativePlanet.canonical_to_scene(field.surface_point(fixture.direction))
		var up: Vector3=world.up_at(ground)
		var east:=up.cross(Vector3.FORWARD).normalized()
		if east.length()<0.5:east=up.cross(Vector3.RIGHT).normalized()
		var north:=east.cross(up).normalized()
		# One fixture placement only. Product physics remains enabled throughout.
		game.player.global_position=ground+up*8.0
		game.player.velocity=Vector3.ZERO
		game.player.flight_active=false
		game.player._ground_vertical_speed=0.0
		world.update_stream(game.player.global_position)
		var fall=[]
		var started=Time.get_ticks_usec()
		for i in range(150):
			await physics_frame
			if i%10==0:
				var support: Dictionary=world.surface_at(game.player.global_position)
				fall.append({"frame":Engine.get_physics_frames(),"position":game.player.global_position,"velocity":game.player.velocity,"support":support,"player_physics":game.player.is_physics_processing()})
		await process_frame
		var ray=PhysicsRayQueryParameters3D.create(ground+up*50.0,ground-up*50.0,16)
		var hit: Dictionary=world.get_world_3d().direct_space_state.intersect_ray(ray)
		var ray_record={"hit":not hit.is_empty()}
		if not hit.is_empty():ray_record={"hit":true,"position":hit.position,"normal":hit.normal,"collider":str(hit.collider.get_path()),"field_distance":hit.position.distance_to(ground)}
		rows.append({"fixture":fixture,"field":sample,"analytic_ground":ground,"ray":ray_record,"fall":fall,"wall":(Time.get_ticks_usec()-started)/1000000.0,"final_up_dot":game.player.global_transform.basis.y.dot(up)})
		await _shot(fixture.name+"-ground",ground+up*3.0-east*12.0,ground+north*60.0+up*2.0,up)
		await _shot(fixture.name+"-oblique",ground+up*1600.0-east*1600.0,ground,up)
		if fixture.name == "route-34000":
			var sea: Vector3 = NativePlanet.canonical_to_scene(field.surface_point(field.route_direction(42000.0)))
			var route_tangent: Vector3 = (sea-ground).slide(up).normalized()
			await _shot("coast-east-overview",ground+up*850.0-route_tangent*1200.0,sea+world.up_at(sea)*120.0,up)
			await _shot("coast-east-ground",ground+up*16.0-route_tangent*70.0,ground+route_tangent*1400.0+up*8.0,up)
	# Free cameras are visual geometry evidence, not a claimed player ascent.
	await _shot("orbit-default",Vector3(180000,160000,180000),NativePlanet.CENTER,Vector3.UP)
	for node in game.find_children("*","WorldEnvironment",true,false):node.environment.fog_enabled=false
	await _shot("orbit-no-fog-diagnostic",Vector3(180000,160000,180000),NativePlanet.CENTER,Vector3.UP)
	var changed=[]
	for path in hashes:
		if hashes[path]!=FileAccess.get_sha256("res://"+path):changed.append(path)
	var f=FileAccess.open(out+"/results.json",FileAccess.WRITE)
	f.store_string(JSON.stringify({"utc":utc,"hashes":hashes,"changed":changed,"time_scale":Engine.time_scale,"rows":rows,"method":"Segment fixtures, normal main/player physics thereafter; independent real physics layer16 rays. Free diagnostic camera screenshots do not establish continuous travel."}))
	f.close()
	game.initialized=false
	game.queue_free()
	print("PLANET_SEGMENTS count=",rows.size()," changed=",changed)
	quit()
