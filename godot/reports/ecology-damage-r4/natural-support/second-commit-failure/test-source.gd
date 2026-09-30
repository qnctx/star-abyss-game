extends SceneTree
# Natural streamed entities and production World commit; no manually registered asset.
const OUT := "res://reports/ecology-damage-r4/natural-support/"
const STATE_FILE := OUT+"isolated-world-state.json"
var world: NativeWorld
var ecology: NativePlanetEcology
var service: NativeEnvironmentDamage
var camera: Camera3D
var origin := Vector3.ZERO
var observer := Vector3.ZERO
var checks: Array[Dictionary] = []
var failed: Array[String] = []
var commits: Array[Dictionary] = []
var target := ""
var evidence := {}
func _initialize() -> void: call_deferred("run")
func check(label: String, ok: bool) -> void:
	checks.append({"label":label,"ok":ok})
	if not ok: failed.append(label)
func tick(count: int) -> void:
	for i in range(count):
		world.update_stream(observer)
		await physics_frame
		await process_frame
func capture(name: String) -> void:
	if "--visual" not in OS.get_cmdline_user_args(): return
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(OUT+name+".png")
func geometry(id: String) -> Dictionary:
	var parts := {}
	if not service.entities.has(id): return {"registered":false}
	var record: Dictionary = service.entities[id]
	var checked_parts: Array = ["stump"]+service.states.get(id,{}).get("broken",[])
	var root_up := NativePlanet.radial_up(record.transform.origin)
	var root_ray := PhysicsRayQueryParameters3D.create(record.transform.origin+root_up*10.0,record.transform.origin-root_up*10.0,16)
	var root_hit := root.get_world_3d().direct_space_state.intersect_ray(root_ray)
	var root_gap: float = INF if root_hit.is_empty() else (record.transform.origin-(root_hit.position as Vector3)).dot(root_up)
	for part: String in checked_parts:
		if part in service.states[id].get("removed",[]) or not record.get("part_nodes",{}).has(part): continue
		var entry: Dictionary = record.part_nodes[part]
		var body: CollisionObject3D = entry.body
		var mesh: MeshInstance3D = entry.mesh
		var vertices: PackedVector3Array = mesh.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]
		var terrain_gap := INF
		var physical_contact := INF
		var up := NativePlanet.radial_up(mesh.global_position)
		for i in range(0,vertices.size(),maxi(1,vertices.size()/96)):
			var point := mesh.global_transform*vertices[i]
			var terrain_ray := PhysicsRayQueryParameters3D.create(point+up*10.0,point-up*10.0,16)
			terrain_ray.hit_back_faces = true
			var floor_hit := root.get_world_3d().direct_space_state.intersect_ray(terrain_ray)
			if not floor_hit.is_empty() and (floor_hit.collider as Node).is_in_group("native_planet_terrain"):
				terrain_gap = minf(terrain_gap,(point-(floor_hit.position as Vector3)).dot(up))
			var contact_ray := PhysicsRayQueryParameters3D.create(point+up*.08,point-up*.3,1,[body.get_rid()])
			var contact := root.get_world_3d().direct_space_state.intersect_ray(contact_ray)
			if not contact.is_empty(): physical_contact = minf(physical_contact,absf((point-(contact.position as Vector3)).dot(up)))
		var shape_count := 0
		for child in body.get_children():
			if child is CollisionShape3D and not child.disabled: shape_count += 1
		parts[part] = {"role":"anchored_base" if part=="stump" else "free_fragment","world_pose":service._encode_transform(mesh.global_transform),"body_id":body.get_instance_id(),"shape_count":shape_count,"terrain_gap":terrain_gap,"physical_contact":physical_contact,"frozen":body.freeze if body is RigidBody3D else true}
	return {"registered":true,"parts":parts,"root_terrain_gap":root_gap,"pending_support":service.support_rechecks.size(),"dynamic":service.debris.size()}
func validate_geometry(label: String, data: Dictionary) -> void:
	check(label+" target registered",data.get("registered",false))
	check(label+" real fractured parts present",not data.get("parts",{}).is_empty())
	for part: String in data.get("parts",{}):
		var item: Dictionary = data.parts[part]
		check(label+" "+part+" actual collision shapes",int(item.shape_count)>0)
		if item.role=="anchored_base":
			check(label+" anchored root follows real terrain",is_finite(float(data.root_terrain_gap)) and absf(float(data.root_terrain_gap))<=.05)
			check(label+" anchored base does not hover",is_finite(float(item.terrain_gap)) and float(item.terrain_gap)<=.08)
			continue
		check(label+" "+part+" loaded terrain and no penetration",is_finite(float(item.terrain_gap)) and float(item.terrain_gap)>=-.08)
		check(label+" "+part+" physical support contact",is_finite(float(item.physical_contact)) and float(item.physical_contact)<=.08)
func run() -> void:
	DirAccess.make_dir_recursive_absolute(OUT)
	world = NativeWorld.new()
	root.add_child(world)
	await process_frame
	ecology = world._planet_ecology
	service = ecology.damage_service
	world.surface_deformation_committed.connect(func(result: Dictionary): commits.append(result))
	camera = Camera3D.new()
	root.add_child(camera)
	camera.far = 12000.0
	var reopened := "--reopen" in OS.get_cmdline_user_args()
	if reopened:
		var saved: Variant = JSON.parse_string(FileAccess.get_file_as_string(STATE_FILE))
		if not saved is Dictionary:
			check("producer state available",false)
			finish("consumer")
			return
		origin = Vector3(saved.origin[0],saved.origin[1],saved.origin[2])
		observer = Vector3(saved.observer[0],saved.observer[1],saved.observer[2])
		target = saved.target
		check("deformation snapshot restored",world.restore_deformations(saved.deformations).get("valid",false))
		check("environment snapshot restored",service.import_state(saved.environment)==OK)
		await tick(700)
		var restored := geometry(target)
		evidence["restored_geometry"] = restored
		validate_geometry("OS restore",restored)
		var pose_matches: bool = restored.get("parts",{}).size()==saved.geometry.get("parts",{}).size()
		for part: String in restored.get("parts",{}):
			if not saved.geometry.parts.has(part): pose_matches = false; continue
			var before: Array = saved.geometry.parts[part].world_pose
			var after: Array = restored.parts[part].world_pose
			for i in range(12):
				if absf(float(before[i])-float(after[i]))>.0001: pose_matches = false
		check("OS restore preserves supported world poses",pose_matches)
		var up := NativePlanet.radial_up(origin)
		camera.position = origin+up*10.0+Vector3(22,0,20)
		camera.look_at(origin+up*2,up)
		await capture("04-natural-os-reopen")
		finish("consumer")
		return
	var sites: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://reports/ecology-damage-r4/habitat-sites.json"))
	var a: Array = sites.transition.direction
	var direction := Vector3(a[0],a[1],a[2])
	var sample: Dictionary = world._planet.field.sample(direction)
	origin = NativePlanet.canonical_to_scene(direction*(NativePlanet.RADIUS+float(sample.height)))
	observer = origin
	await tick(650)
	var nearest := INF
	for id: String in service.entities:
		var record: Dictionary = service.entities[id]
		if record.kind!="outcrop" or not record.physical: continue
		var distance: float = record.transform.origin.distance_to(origin)
		if distance<nearest: nearest = distance; target = id
	check("natural streamed physical outcrop available",not target.is_empty())
	if target.is_empty(): finish("producer"); return
	var record: Dictionary = service.entities[target]
	check("target belongs to production ecology cell",ecology.cells.has(record.cell))
	origin = record.transform.origin
	await tick(100)
	check("selected natural target remains registered after local stream",service.entities.has(target))
	if not service.entities.has(target): finish("producer"); return
	record = service.entities[target]
	var up := NativePlanet.radial_up(origin)
	camera.position = origin+up*10.0+record.transform.basis.x*20.0+record.transform.basis.z*18.0
	camera.look_at(origin+up*2,up)
	await capture("01-natural-before-damage")
	var result: Dictionary = service.damage({"origin":origin+up*2.0,"radius":4.5,"power":1200.0,"source":"natural-support-test","cast_id":"natural-rock-break","contact_rid":record.body.get_rid(),"stop_on_first":true})
	check("natural rock damaged through sole authority",result.changed==1 and result.hits[0].entity_id==target)
	await tick(260)
	evidence["precommit_geometry"] = geometry(target)
	await capture("02-natural-settled-before-late-commit")
	var requested := world.request_surface_impact({"origin":origin,"radius":12.0,"power":1600.0,"source":"natural-support-test","cast_id":"late-real-world-commit"})
	check("real production terrain rebuild accepted",requested.get("accepted",false))
	if requested.get("accepted",false):
		for i in range(600):
			await tick(1)
			if not commits.is_empty(): break
	check("real collider deformation committed",not commits.is_empty() and commits[-1].get("applied",false))
	await tick(700)
	var after := geometry(target)
	evidence["postcommit_geometry"] = after
	validate_geometry("natural commit",after)
	evidence["commits"] = commits
	await capture("03-natural-supported-after-commit")
	var snapshot := {"origin":[origin.x,origin.y,origin.z],"observer":[observer.x,observer.y,observer.z],"target":target,"environment":service.export_state(),"deformations":world.snapshot_deformations(),"geometry":after}
	var f := FileAccess.open(STATE_FILE,FileAccess.WRITE)
	f.store_string(JSON.stringify(snapshot,"	"))
	f.close()
	finish("producer")
func finish(mode: String) -> void:
	var hashes := {}
	for path: String in ["res://scripts/native_environment_damage.gd","res://scripts/native_planet_ecology.gd","res://scripts/native_world.gd","res://tests/native_environment_damage_natural_support.gd"]: hashes[path] = FileAccess.get_sha256(path)
	var report := {"checks":checks,"failed":failed,"evidence":evidence,"target":target,"scope":"Natural production Ecology cells with real NativeWorld collider commit, direct service damage; actual R input is a separate martial audit","source_sha256":hashes}
	var f := FileAccess.open(OUT+mode+".json",FileAccess.WRITE)
	f.store_string(JSON.stringify(report,"	"))
	print("NATURAL_SUPPORT_RESULT="+JSON.stringify({"checks":checks.size(),"failed":failed,"mode":mode}))
	quit(0 if failed.is_empty() else 1)
