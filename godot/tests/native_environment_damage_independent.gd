extends SceneTree
## Independent service/physics regression; never loads Main or a player save.
## Run: Godot --headless --path godot --script res://tests/native_environment_damage_independent.gd
const Damage = preload("res://scripts/native_environment_damage.gd")
const Assets = preload("res://scripts/native_environment_damage_assets.gd")
const Ecology = preload("res://scripts/native_planet_ecology.gd")
const SupportWorld = preload("res://tests/test_fake_support_world.gd")
const TEST_DIR := "user://environment-damage-independent"
const SEED := "independent-seed-730241"
const SLOT := "independent-test-only"

class TestEcology extends Node3D:
	var planet: Node3D = null
	var damage_service: Node3D
	var cells: Array[Node3D] = []
	func clear() -> void:
		damage_service.clear_stream()
		for cell in cells:
			if is_instance_valid(cell): cell.queue_free()
		cells.clear()

var failures: Array[String] = []
var skipped_visual_checks: Array[String] = []
var checks := 0
var observations: Dictionary = {}
var library: RefCounted
var run_dir := ""

func _initialize() -> void:
	call_deferred("run")

func check(label: String, condition: bool) -> void:
	checks += 1
	if not condition:
		failures.append(label)
		push_error("ENVIRONMENT_INDEPENDENT: "+label)

func fixture() -> Dictionary:
	var owner := TestEcology.new()
	root.add_child(owner)
	var service := Damage.new()
	owner.add_child(service)
	owner.damage_service = service
	service.setup(owner,library)
	return {"owner":owner,"service":service}

func add_entity(f: Dictionary, id: String, asset_name: String, position: Vector3, cell_key := "cell-a", physical := true, uniform_scale := 1.0) -> Dictionary:
	var asset: Dictionary = library.assets[asset_name]
	var cell := Node3D.new()
	f.owner.add_child(cell)
	if f.owner is TestEcology: f.owner.cells.append(cell)
	var transform := Transform3D(Basis.IDENTITY.scaled(Vector3.ONE*uniform_scale),position)
	var batch := MultiMesh.new()
	batch.transform_format = MultiMesh.TRANSFORM_3D
	batch.mesh = asset.mesh
	batch.instance_count = 1
	batch.set_instance_transform(0,transform)
	var visual := MultiMeshInstance3D.new()
	visual.multimesh = batch
	cell.add_child(visual)
	var body := StaticBody3D.new()
	body.collision_layer = 1 if physical else 0
	body.collision_mask = 0
	body.set_meta("environment_entity",id)
	cell.add_child(body)
	body.transform = transform
	if physical:
		if asset.species=="outcrop":
			var hull := CollisionShape3D.new()
			hull.shape = (asset.mesh as ArrayMesh).create_convex_shape(true,true)
			body.add_child(hull)
		else:
			for segment: Dictionary in asset.segments:
				Assets.add_segment(body,segment)
	var record := {"asset":asset,"transform":transform,"batch":batch,"index":0,"body":body,"parent":cell,"cell":cell_key,"physical":physical,"kind":"outcrop" if asset.species=="outcrop" else "tree"}
	f.service.register_entity(id,record)
	return record

func query(origin: Vector3, cast_id: String, power := 35.0, radius := 0.5, direction := Vector3.FORWARD, reach := 4.0, phase := 0) -> Dictionary:
	return {"origin":origin,"radius":radius,"direction":direction,"reach":reach,"power":power,"damage_type":"blunt","source":"test-player","cast_id":cast_id,"phase":phase}

func isolated_part_point(record: Dictionary, part: String) -> Dictionary:
	# Choose a real mesh-path location outside every other damage part. This
	# avoids confusing an intended trunk test with a correctly hit low branch.
	for segment: Dictionary in record.asset.segments:
		if segment.part!=part: continue
		for fraction: float in [0.15,0.35,0.55,0.75,0.9]:
			for radial: Vector3 in [Vector3.RIGHT,Vector3.LEFT,Vector3.FORWARD,Vector3.BACK,Vector3.UP,Vector3.DOWN]:
				var point: Vector3 = (segment.a as Vector3).lerp(segment.b,fraction)+radial*float(segment.radius)*0.9
				if point.y<1.0: continue
				var overlap := false
				for other: Dictionary in record.asset.segments:
					if other.part in [part,"stump"]: continue
					var closest := Geometry3D.get_closest_point_to_segment(point,other.a,other.b)
					if point.distance_to(closest)<=float(other.radius)+0.025:
						overlap = true
						break
				if not overlap: return {"point":point,"part":part}
	return {}

func part_attack(record: Dictionary, part: String, cast_id: String, power: float) -> Dictionary:
	var sample := isolated_part_point(record,part)
	if sample.is_empty(): return {}
	var point: Vector3 = record.transform*sample.point
	if record.get("part_nodes",{}).has(part): point = record.part_nodes[part].mesh.global_transform*sample.point
	return query(point,cast_id,power,0.006,Vector3.ZERO,0.0)

func direct_stem_family(asset: Dictionary, stem: String) -> Array[String]:
	var family: Array[String] = [stem]
	for part: String in asset.parts:
		if asset.get("parents",{}).get(part,"")==stem: family.append(part)
	return family

func same_pose_map(a: Dictionary, b: Dictionary) -> bool:
	if a.size()!=b.size(): return false
	for part: String in a:
		if not b.has(part) or a[part].size()!=b[part].size(): return false
		for index in range(a[part].size()):
			if absf(float(a[part][index])-float(b[part][index]))>0.00001: return false
	return true

func dispose(f: Dictionary) -> void:
	f.owner.clear()
	f.owner.free()
	if f.has("support_world") and is_instance_valid(f.support_world): f.support_world.free()

func write_json(path: String, value: Variant) -> void:
	var file := FileAccess.open(path,FileAccess.WRITE)
	check("test fixture writable "+path,file!=null)
	if file!=null:
		file.store_string(JSON.stringify(value))
		file.close()

func envelope(state: Dictionary) -> Dictionary:
	return {"version":1,"generation":Damage.GENERATION,"world_seed":SEED,"slot_identity":SLOT,"entities":{"tree-stable-id":state}}

func state_value() -> Dictionary:
	return {"health":{"trunk":80.0},"broken":[],"poses":{},"fallen":false}

func run() -> void:
	run_dir = TEST_DIR+"/"+Time.get_datetime_string_from_system(true).replace(":","-")+"-"+str(Time.get_ticks_usec())
	check("isolated test directory created",DirAccess.make_dir_recursive_absolute(run_dir)==OK)
	library = Assets.new()
	library.load_library()
	check("all thirty species age LOD and rock variants load",library.assets.size()==30)
	for species: String in ["pine","oak","alder"]:
		var heights: Array[float] = []
		var triangles: Array[int] = []
		for age in range(3):
			var asset: Dictionary = library.assets["%s-%d-0"%[species,age]]
			heights.append(float(asset.height))
			triangles.append(int(asset.triangles))
			check("real mesh and collider segments "+str(asset.id),asset.mesh.get_surface_count()>0 and asset.segments.size()>2)
			var physical_trunk := false
			var query_branch := false
			for segment: Dictionary in asset.segments:
				if segment.part=="trunk" and segment.get("physical",true): physical_trunk = true
				if str(segment.part).begins_with("branch_"): query_branch = true
			check("every age has a physical trunk "+str(asset.id),physical_trunk)
			check("every age has queryable branches "+str(asset.id),query_branch)
		check("age changes actual geometry "+species,heights[0]<heights[1] and heights[1]<heights[2] and triangles[0]!=triangles[1])
	test_queries_and_dedupe()
	await process_frame
	await test_fall_and_collision()
	await test_occlusion()
	test_branch_damage()
	test_young_branch_collision()
	test_fragment_budget()
	test_stream_lifecycle()
	test_persistence()
	test_backup_recovery()
	test_save_failure_observable()
	test_deformation_request_contract()
	test_persistent_entity_cap()
	test_embedded_state_contract()
	test_multistem_subtrees()
	test_separate_fragment_histories()
	test_separate_fragment_histories(false)
	test_legacy_oak_sweep_semantics()
	test_finite_basal_contact_order()
	test_first_contact_boundaries()
	test_contact_ties_and_limits()
	test_contact_world_scale()
	await test_contact_rid_contract()
	await test_verified_rock_surface_fallback()
	await test_support_reactivation_and_reanchor()
	await test_unready_support_budget()
	test_corrupt_states()
	await process_frame
	var source_hashes: Dictionary = {}
	for source_path: String in ["res://scripts/native_environment_damage.gd","res://scripts/native_environment_damage_assets.gd","res://scripts/native_planet_ecology.gd","res://scripts/native_planet.gd","res://assets/planet-ecology-r4/manifest.json","res://tests/native_environment_damage_independent.gd","res://tests/test_fake_support_world.gd"]:
		source_hashes[source_path] = FileAccess.get_sha256(source_path)
	var report := {"checks":checks,"failures":failures,"skipped_visual_checks":skipped_visual_checks,"observations":observations,"save_directory":run_dir,"source_sha256":source_hashes,"scope":"Independent environment service and real physics; no game-wide or visual acceptance claim."}
	write_json(run_dir+"/report.json",report)
	print("ENVIRONMENT_DAMAGE_INDEPENDENT="+JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)

func test_queries_and_dedupe() -> void:
	var f := fixture()
	var service: Node3D = f.service
	add_entity(f,"target","pine-2-0",Vector3.ZERO)
	add_entity(f,"behind","pine-2-0",Vector3(0,0,8))
	add_entity(f,"beyond-bound","pine-2-0",Vector3(100,0,0))
	add_entity(f,"visual-only","pine-2-0",Vector3.ZERO,"far-cell",false)
	var attack := query(Vector3(0,1.8,2),"cast-1")
	var first: Dictionary = service.damage(attack)
	check("directed query hits physical forward tree only",first.changed==1 and first.hits[0].entity_id=="target")
	if first.changed>0:
		check("hit returns real collider RID point and normal",is_instance_valid(first.hits[0].collider) and first.hits[0].rid.is_valid() and first.hits[0].point.is_finite() and first.hits[0].normal.is_finite())
	check("same cast phase cannot damage target twice",service.damage(attack).changed==0)
	attack.phase = 1
	check("next authorized hit phase can hit same target",service.damage(attack).changed==1)
	attack.phase = 0
	attack.cast_id = "cast-2"
	check("same source new cast can hit target",service.damage(attack).changed==1)
	check("three hits reduce trunk health exactly once each",is_equal_approx(float(service.states.get("target",{}).get("health",{}).get("trunk",NAN)),195.0))
	check("negative damage does nothing",service.damage(query(Vector3.ZERO,"invalid-power",-1.0)).changed==0)
	check("nonfinite origin does nothing",service.damage(query(Vector3(INF,0,0),"invalid-origin")).changed==0)
	check("nonfinite power does nothing",service.damage(query(Vector3.ZERO,"invalid-float",NAN)).changed==0)
	check("zero direction with positive reach does nothing",service.damage(query(Vector3.ZERO,"invalid-direction",35.0,2.0,Vector3.ZERO)).changed==0)
	var sphere: Dictionary = service.damage(query(Vector3(0,1.8,0),"clamped-radius",1.0,1000.0,Vector3.ZERO,0.0))
	check("oversized radius remains local",sphere.changed==2 and not service.states.has("beyond-bound") and not service.states.has("visual-only"))
	dispose(f)
	var crowded := fixture()
	for index in range(40): add_entity(crowded,"crowd-%d"%index,"pine-0-0",Vector3.ZERO,"crowd")
	var capped: Dictionary = crowded.service.damage(query(Vector3(0,1.8,2),"hit-cap",1.0))
	check("a single query never exceeds target cap",capped.changed>0 and capped.changed<=Damage.MAX_HITS)
	dispose(crowded)

func test_fall_and_collision() -> void:
	var f := fixture()
	var record := add_entity(f,"fall-tree","pine-2-0",Vector3.ZERO)
	# Headless Dummy RenderingServer may not retain MultiMesh instance buffers.
	# Probe readback first and report an explicit deferred visual check if absent.
	var probe := Transform3D(Basis.IDENTITY,Vector3(18,9,6))
	record.batch.set_instance_transform(0,probe)
	var readable: bool = record.batch.get_instance_transform(0).origin.is_equal_approx(probe.origin)
	record.batch.set_instance_transform(0,record.transform)
	observations["multimesh_transform_readback_supported"] = readable
	var high_segment: Dictionary = record.asset.segments[5]
	var high_point: Vector3 = (high_segment.a+high_segment.b)*0.5
	await physics_frame
	await physics_frame
	var space: PhysicsDirectSpaceState3D = f.owner.get_world_3d().direct_space_state
	var ray := PhysicsRayQueryParameters3D.create(high_point+Vector3(0,0,3),high_point-Vector3(0,0,3),1)
	check("standing tree has actual high trunk collision",not space.intersect_ray(ray).is_empty())
	var result: Dictionary = f.service.damage(query(Vector3(0,1.8,2),"fell-tree",1200.0))
	check("heavy trunk hit starts directional fall",result.changed==1 and result.hits[0].destroyed and f.service.states["fall-tree"].fallen and f.service.snapshot().moving_trees==1)
	if result.changed!=1 or not record.has("part_nodes"):
		dispose(f)
		return
	if readable:
		check("original standing multimesh is hidden",record.batch.get_instance_transform(0).basis.get_scale().is_zero_approx())
	else:
		skipped_visual_checks.append("Original standing MultiMesh disappears after fracture: renderer has no instance-transform readback; requires GPU image verification.")
	check("original standing collider is removed immediately",record.body.collision_layer==0)
	# Exercise the actual service animation, then synchronize the real physics world.
	f.service._physics_process(2.0)
	await physics_frame
	await physics_frame
	check("fall completes within bounded animation",f.service.snapshot().moving_trees==0)
	check("fallen trunk collider follows final pose",not record.part_nodes.trunk.body.transform.basis.is_equal_approx(Basis.IDENTITY))
	check("old high trunk location no longer blocks ray",space.intersect_ray(ray).is_empty())
	var fallen_point: Vector3 = record.part_nodes.trunk.body.global_transform*high_point
	var landed_ray := PhysicsRayQueryParameters3D.create(fallen_point+Vector3.UP*3.0,fallen_point-Vector3.UP*3.0,1)
	check("fallen trunk is a real obstacle at its new position",not space.intersect_ray(landed_ray).is_empty())
	observations["fall_pose"] = f.service.states["fall-tree"].fall_pose
	var clear_query := query(fallen_point+Vector3.UP*2.0,"clear-fallen-tree",300.0,0.5,Vector3.DOWN,4.0)
	var cleared: Dictionary = f.service.damage(clear_query)
	check("fallen trunk is damageable at its transformed location",cleared.changed==1 and f.service.states["fall-tree"].get("cleared",false))
	await physics_frame
	await physics_frame
	check("cleared fallen trunk no longer blocks player",space.intersect_ray(landed_ray).is_empty())
	dispose(f)

func test_occlusion() -> void:
	var f := fixture()
	add_entity(f,"occluded-tree","pine-2-0",Vector3.ZERO)
	var wall := StaticBody3D.new()
	wall.collision_layer = 16
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(6,6,0.4)
	shape.shape = box
	wall.add_child(shape)
	f.owner.add_child(wall)
	wall.position = Vector3(0,2,2)
	await physics_frame
	await physics_frame
	var attack := query(Vector3(0,1.8,4),"wall-blocked",35.0,0.5,Vector3.FORWARD,7.0)
	var blocked: Dictionary = f.service.damage(attack)
	check("real wall prevents damage to tree behind it",blocked.changed==0 and blocked.blocked and f.service.states.is_empty())
	check("occlusion reports actual blocker for skill VFX",blocked.has("occluder") and blocked.occluder.collider==wall)
	attack.cast_id = "wall-excluded"
	attack.exclude_rids = [wall.get_rid()]
	check("explicit caller collider exclusion is honored",f.service.damage(attack).changed==1)
	dispose(f)

func test_branch_damage() -> void:
	var f := fixture()
	var record := add_entity(f,"branch-tree","oak-2-0",Vector3.ZERO)
	var selected := {}
	for segment: Dictionary in record.asset.segments:
		if str(segment.part).begins_with("branch_") and Vector2(segment.b.x,segment.b.z).length()>2.0:
			selected = segment
			break
	check("mature tree supplies queryable branch geometry",not selected.is_empty())
	if not selected.is_empty():
		var result: Dictionary = f.service.damage(query(selected.b,"break-branch",200.0,0.01,Vector3.ZERO,0.0))
		check("branch query fractures branch without felling trunk",result.changed==1 and result.hits[0].part==selected.part and result.hits[0].destroyed and not f.service.states["branch-tree"].fallen)
		if result.changed!=1 or not record.get("part_nodes",{}).has(selected.part):
			dispose(f)
			return
		check("broken branch has a real rigid body",record.part_nodes[selected.part].body is RigidBody3D)
		var cleared: Dictionary = f.service.damage(query(selected.b,"clear-branch",200.0,0.01,Vector3.ZERO,0.0))
		check("detached branch can be cleared at its current location",cleared.changed==1 and selected.part in f.service.states["branch-tree"].get("removed",[]))
		check("cleared branch loses actual collision",record.part_nodes[selected.part].body.collision_layer==0)
	dispose(f)

func test_fragment_budget() -> void:
	var f := fixture()
	check("fragment test binds an independent slot",f.service.bind_save_slot(run_dir+"/fragments.json",SEED,SLOT,false)==OK)
	for index in range(5): add_entity(f,"rock-%d"%index,"outcrop-0-0",Vector3(index*7.0,0,0),"rocks")
	var attack := query(Vector3(14,2,0),"break-rocks",1200.0,20.0,Vector3.ZERO,0.0)
	attack.occlusion_origin = Vector3(14,25,0)
	var result: Dictionary = f.service.damage(attack)
	check("high power breaks finite rock masses",result.changed==5)
	check("dynamic fragment count respects hard budget",f.service.snapshot().dynamic_fragments==Damage.MAX_DYNAMIC)
	var moving := 0
	var retained := 0
	for record: Dictionary in f.service.entities.values():
		for part: Dictionary in record.get("part_nodes",{}).values():
			if part.body is RigidBody3D:
				retained += 1
				if not part.body.freeze: moving += 1
	check("budget counts real unfrozen rigid bodies",moving<=Damage.MAX_DYNAMIC and retained==30)
	var before_count: int = f.service.snapshot().dynamic_fragments
	var first_body: RigidBody3D = f.service.debris[0].body if before_count>0 else null
	var before_pose: Transform3D = first_body.transform if first_body!=null else Transform3D.IDENTITY
	check("saving active fragments succeeds",f.service.save_state()==OK)
	check("saving does not end live fragment simulation",f.service.snapshot().dynamic_fragments==before_count)
	check("saving never teleports or freezes live fragments",first_body!=null and first_body.transform.is_equal_approx(before_pose) and not first_body.freeze)
	var saved: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(run_dir+"/fragments.json"))
	check("active fragments have restore poses in saved copy",saved.get("entities",{}).get("rock-4",{}).get("poses",{}).size()==6)
	f.service._physics_process(4.0)
	check("fragment activity expires after bounded time",f.service.snapshot().dynamic_fragments==0)
	for state: Dictionary in f.service.states.values():
		check("rock fragment poses preserved",state.fallen and state.broken.size()==6 and state.poses.size()==6)
	observations["retained_rock_fragment_bodies"] = retained
	dispose(f)

func test_young_branch_collision() -> void:
	for species: String in ["pine","oak","alder"]:
		var f := fixture()
		var record := add_entity(f,"young-"+species,species+"-0-0",Vector3.ZERO)
		var selected := {}
		var distance := -1.0
		for segment: Dictionary in record.asset.segments:
			if not str(segment.part).begins_with("branch_"): continue
			var radial := Vector2(segment.b.x,segment.b.z).length()
			if radial>distance:
				distance = radial
				selected = segment
		check("young tree has a branch damage query "+species,not selected.is_empty())
		if not selected.is_empty():
			var result: Dictionary = f.service.damage(query(selected.b,"young-branch-"+species,150.0,0.015,Vector3.ZERO,0.0))
			check("young branch responds to real service "+species,result.changed==1 and str(result.hits[0].part).begins_with("branch_"))
			if result.changed>0:
				var body: Node3D = record.part_nodes[result.hits[0].part].body
				var shapes := 0
				for child in body.get_children():
					if child is CollisionShape3D and child.shape!=null: shapes += 1
				check("young detached branch has actual physics collision "+species,body is RigidBody3D and shapes>0)
		dispose(f)

func test_stream_lifecycle() -> void:
	var f := fixture()
	add_entity(f,"same-cell-1","pine-0-0",Vector3.ZERO,"shared")
	add_entity(f,"same-cell-2","pine-0-0",Vector3(8,0,0),"shared")
	add_entity(f,"other-cell","pine-0-0",Vector3(16,0,0),"other")
	f.service.clear_stream()
	check("clear_stream removes multiple entities per cell and subsequent cells",f.service.snapshot().registered==0)
	dispose(f)

func test_persistence() -> void:
	var path := run_dir+"/roundtrip.json"
	var f := fixture()
	check("explicit independent slot binds",f.service.bind_save_slot(path,SEED,SLOT,false)==OK)
	var active_record := add_entity(f,"tree-stable-id","pine-2-0",Vector3.ZERO)
	f.service.damage(query(Vector3(0,1.8,2),"persist-fall",1200.0))
	var before_motions: int = f.service.snapshot().moving_trees
	var before_pose: Transform3D = active_record.part_nodes.trunk.body.transform
	check("save while tree is actively falling succeeds",f.service.save_state()==OK)
	check("save never ends or teleports live tree fall",before_motions==1 and f.service.snapshot().moving_trees==before_motions and active_record.part_nodes.trunk.body.transform.is_equal_approx(before_pose))
	check("snapshot saved without temporary file remaining",FileAccess.file_exists(path) and not FileAccess.file_exists(path+".tmp"))
	dispose(f)
	var restored := fixture()
	check("matching generation seed slot reload succeeds",restored.service.bind_save_slot(path,SEED,SLOT)==OK)
	var record := add_entity(restored,"tree-stable-id","pine-2-0",Vector3.ZERO)
	check("stable entity stays fallen across unload reload",restored.service.states.get("tree-stable-id",{}).get("fallen",false) and record.has("live") and record.body.collision_layer==0)
	check("saved fallen pose is applied to actual collider",not record.part_nodes.trunk.body.transform.basis.is_equal_approx(Basis.IDENTITY))
	check("reset clears stream and persisted damage",restored.service.reset_state(true)==OK and restored.service.snapshot().registered==0 and restored.service.snapshot().modified==0)
	dispose(restored)
	var reset_copy := fixture()
	check("reset state survives reload",reset_copy.service.bind_save_slot(path,SEED,SLOT)==OK and reset_copy.service.snapshot().modified==0)
	dispose(reset_copy)
	var wrong_slot := fixture()
	check("another slot cannot inherit damage",wrong_slot.service.bind_save_slot(path,SEED,"other-slot")==ERR_FILE_CORRUPT and wrong_slot.service.snapshot().modified==0)
	dispose(wrong_slot)
	var wrong_seed := fixture()
	check("another world seed cannot inherit damage",wrong_seed.service.bind_save_slot(path,SEED+"-other",SLOT)==ERR_FILE_CORRUPT and wrong_seed.service.snapshot().modified==0)
	dispose(wrong_seed)
	var switching := fixture()
	check("original slot binds for switch test",switching.service.bind_save_slot(path,SEED,SLOT)==OK)
	add_entity(switching,"switch-live","pine-2-0",Vector3.ZERO)
	switching.service.damage(query(Vector3(0,1.8,2),"switch-pending",1200.0))
	check("changing slot clears streamed entities and old damage",switching.service.bind_save_slot(run_dir+"/new-slot.json",SEED+"-new","new-slot",false)==OK and switching.service.snapshot().registered==0 and switching.service.snapshot().modified==0 and switching.service.snapshot().moving_trees==0)
	check("new slot can save its own empty state",switching.service.save_state()==OK)
	dispose(switching)
	var transient := fixture()
	check("unbound service never writes a default user save",transient.service.save_state()==ERR_UNCONFIGURED)
	dispose(transient)

func test_backup_recovery() -> void:
	var path := run_dir+"/rename-window.json"
	write_json(path+".bak",envelope(state_value()))
	var f := fixture()
	check("missing primary recovers explicitly matched valid backup",f.service.bind_save_slot(path,SEED,SLOT)==OK and f.service.states.has("tree-stable-id"))
	check("recovered backup can repair primary on next save",f.service.save_state()==OK and FileAccess.file_exists(path))
	dispose(f)

func test_save_failure_observable() -> void:
	var f := fixture()
	var errors: Array[String] = []
	f.service.persistence_failed.connect(func(message: String) -> void: errors.append(message))
	check("explicit missing-parent path binds without writing",f.service.bind_save_slot(run_dir+"/intentionally-missing/sidecar.json",SEED,SLOT,false)==OK)
	var result: int = f.service.save_state()
	check("failed sidecar write returns error and emits diagnostic",result!=OK and errors.size()==1 and not f.service.snapshot().state_error.is_empty())
	check("independent failure fixture becomes writable",DirAccess.make_dir_recursive_absolute(run_dir+"/intentionally-missing")==OK)
	check("transient write failure permits same-slot retry",f.service.save_state()==OK and f.service.snapshot().state_error.is_empty())
	dispose(f)

func test_deformation_request_contract() -> void:
	var f := fixture()
	var requests: Array[Dictionary] = []
	f.service.surface_impact_requested.connect(func(request: Dictionary) -> void: requests.append(request))
	var attack := query(Vector3(0,1,0),"landing-impact",1200.0,1000.0,Vector3.ZERO,0.0)
	attack.deform_surface = true
	var first: Dictionary = f.service.damage(attack)
	f.service.damage(attack)
	check("one landing phase emits exactly one bounded terrain request",requests.size()==1 and requests[0].radius==Damage.MAX_QUERY_RADIUS)
	check("request without terrain consumer never claims crater completion",first.has("deformation_request") and not first.get("deformed",false) and first.changed==0)
	dispose(f)

func test_persistent_entity_cap() -> void:
	var f := fixture()
	check("budget fixture binds explicit test slot",f.service.bind_save_slot(run_dir+"/budget.json",SEED,SLOT,false)==OK)
	var history := envelope(state_value())
	history.entities.clear()
	history.entities["known-at-cap"] = state_value()
	for index in range(Damage.MAX_PERSISTENT_ENTITIES-1):
		history.entities["history-%d"%index] = state_value()
	check("exact persistent entity budget imports successfully",f.service.import_state(history)==OK and f.service.snapshot().modified==Damage.MAX_PERSISTENT_ENTITIES)
	var new_record := add_entity(f,"new-at-cap","pine-2-0",Vector3.ZERO)
	add_entity(f,"known-at-cap","pine-2-0",Vector3(12,0,0))
	var rejected: Dictionary = f.service.damage(query(Vector3(0,1.8,2),"cap-reject",35.0))
	check("new entity is rejected before changing render collision or state",rejected.changed==0 and rejected.get("budget_exhausted",false) and not f.service.states.has("new-at-cap") and not new_record.has("live") and new_record.body.collision_layer==1)
	var accepted: Dictionary = f.service.damage(query(Vector3(12,1.8,2),"cap-existing",35.0))
	check("already recorded entity remains damageable at cap",accepted.changed==1 and is_equal_approx(float(f.service.states["known-at-cap"].health.trunk),45.0) and f.service.snapshot().modified==Damage.MAX_PERSISTENT_ENTITIES)
	history.entities["overflow"] = state_value()
	check("oversized import is rejected without replacing active state",f.service.import_state(history)==ERR_FILE_CORRUPT and f.service.snapshot().modified==Damage.MAX_PERSISTENT_ENTITIES and not f.service.states.has("overflow"))
	dispose(f)

func test_embedded_state_contract() -> void:
	var f := fixture()
	check("embedded export fixture binds explicit slot",f.service.bind_save_slot(run_dir+"/embedded.json",SEED,SLOT,false)==OK)
	add_entity(f,"embedded-tree","pine-2-0",Vector3.ZERO)
	f.service.damage(query(Vector3(0,1.8,2),"embedded-damage",35.0))
	var exported: Dictionary = f.service.export_state()
	check("export identifies exact version generation world and slot",exported.version==1 and exported.generation==Damage.GENERATION and exported.world_seed==SEED and exported.slot_identity==SLOT)
	check("export has stable entity id and exact health",exported.entities.has("embedded-tree") and is_equal_approx(float(exported.entities["embedded-tree"].health.trunk),265.0))
	exported.entities["embedded-tree"].health.trunk = 1.0
	check("export is independent from live mutable state",is_equal_approx(float(f.service.states["embedded-tree"].health.trunk),265.0))
	exported = f.service.export_state()
	var restored := fixture()
	check("embedded import fixture binds matching identity",restored.service.bind_save_slot(run_dir+"/embedded-restored.json",SEED,SLOT,false)==OK)
	check("valid embedded import and export preserve exact nonpose state",restored.service.import_state(exported)==OK and restored.service.export_state().entities==exported.entities)
	exported.entities["embedded-tree"].health.trunk = 2.0
	check("import owns a copy independent of caller mutations",is_equal_approx(float(restored.service.states["embedded-tree"].health.trunk),265.0))
	for field: String in ["slot_identity","world_seed","generation"]:
		var incompatible: Dictionary = f.service.export_state()
		incompatible[field] = "incompatible-"+field
		check("embedded import rejects mismatched "+field,restored.service.import_state(incompatible)==ERR_FILE_CORRUPT and is_equal_approx(float(restored.service.states["embedded-tree"].health.trunk),265.0))
	var bad_header: Dictionary = f.service.export_state()
	bad_header.version = {"wrong":"type"}
	check("embedded import rejects malformed header without state mutation",restored.service.import_state(bad_header)==ERR_FILE_CORRUPT and restored.service.states.size()==1)
	check("valid explicit import recovers after rejected incompatible state",restored.service.import_state(f.service.export_state())==OK and restored.service.snapshot().state_error.is_empty())
	dispose(restored)
	dispose(f)

func test_multistem_subtrees() -> void:
	for asset_name: String in ["oak-1-0","oak-2-0","alder-0-0","alder-1-0","alder-2-0"]:
		var f := fixture()
		var path := run_dir+"/multistem-"+asset_name+".json"
		check("multistem fixture binds "+asset_name,f.service.bind_save_slot(path,SEED,SLOT,false)==OK)
		var id := "multi-"+asset_name
		var record := add_entity(f,id,asset_name,Vector3.ZERO)
		var stems: Array[String] = []
		for part: String in record.asset.parts:
			if part.begins_with("stem_"): stems.append(part)
		check("actual multistem asset exposes independent stems "+asset_name,stems.size()>=2 and record.asset.get("parents",{}).get("stem_00","")=="trunk")
		if stems.size()<2:
			dispose(f)
			continue
		var stem := stems[0]
		var other_stem := stems[1]
		var family := direct_stem_family(record.asset,stem)
		var attack := part_attack(record,stem,"detach-"+asset_name,500.0)
		check("actual stem has an isolated spatial hit point "+asset_name,not attack.is_empty())
		if attack.is_empty():
			dispose(f)
			continue
		var result: Dictionary = f.service.damage(attack)
		check("stem query hits that stem without felling whole plant "+asset_name,result.changed==1 and result.hits[0].part==stem and not f.service.states[id].fallen)
		if result.changed!=1 or not record.get("part_nodes",{}).has(stem):
			dispose(f)
			continue
		var fragment: Node3D = record.part_nodes[stem].body
		var joined := fragment is RigidBody3D and family.size()>1
		for member: String in family:
			joined = joined and record.part_nodes[member].body==fragment and f.service.states[id].get("fragment_roots",{}).get(member,"")==stem
		check("stem and all attached branches share one rigid body "+asset_name,joined and f.service.snapshot().dynamic_fragments==1)
		check("sibling stem stays attached with real collision "+asset_name,record.part_nodes[other_stem].body is StaticBody3D and record.part_nodes[other_stem].body.collision_layer==1 and other_stem not in f.service.states[id].broken)
		var expected: Dictionary = f.service.export_state().entities[id].duplicate(true)
		check("all fragment members get coherent saved poses "+asset_name,expected.poses.size()==family.size())
		check("multistem save preserves active subtree motion "+asset_name,f.service.save_state()==OK and f.service.snapshot().dynamic_fragments==1 and not fragment.freeze)
		dispose(f)
		var restored := fixture()
		check("multistem snapshot reloads "+asset_name,restored.service.bind_save_slot(path,SEED,SLOT)==OK)
		var actual: Dictionary = restored.service.states.get(id,{})
		check("multistem health and fracture provenance reload exactly "+asset_name,actual.get("health",{})==expected.health and actual.get("broken",[])==expected.broken and actual.get("fragment_roots",{})==expected.fragment_roots)
		check("multistem poses reload within numeric tolerance "+asset_name,same_pose_map(actual.get("poses",{}),expected.poses))
		var loaded_record := add_entity(restored,id,asset_name,Vector3.ZERO)
		var matched := true
		for member: String in family:
			matched = matched and loaded_record.part_nodes[member].body.transform.is_equal_approx(loaded_record.part_nodes[stem].body.transform)
		check("reloaded subtree meshes retain one coherent pose "+asset_name,matched)
		var clear_attack := part_attack(loaded_record,stem,"clear-restored-"+asset_name,1000.0)
		if clear_attack.is_empty():
			check("reloaded subtree remains spatially queryable "+asset_name,false)
		else:
			var cleared: Dictionary = restored.service.damage(clear_attack)
			var removed: bool = cleared.changed==1 and not restored.service.states[id].get("cleared",false)
			for member: String in family:
				removed = removed and member in restored.service.states[id].get("removed",[]) and loaded_record.part_nodes[member].body.collision_layer==0
			check("clearing reloaded fragment clears its whole event only "+asset_name,removed and loaded_record.part_nodes[other_stem].body.collision_layer==1 and other_stem not in restored.service.states[id].get("removed",[]))
		dispose(restored)

func test_separate_fragment_histories(clear_branch_first := true) -> void:
	var f := fixture()
	var id := "separate-fragments"
	var record := add_entity(f,id,"alder-1-0",Vector3.ZERO)
	var stem := "stem_00"
	var family := direct_stem_family(record.asset,stem)
	check("separate-fragment test has actual stem hierarchy",family.size()>1 and "stem_01" in record.asset.parts)
	if family.size()<2:
		dispose(f)
		return
	var branch := ""
	for member: String in family:
		if member.begins_with("branch_") and not isolated_part_point(record,member).is_empty():
			branch = member
			break
	check("separate-fragment tree has an isolated attached branch",not branch.is_empty())
	if branch.is_empty():
		dispose(f)
		return
	var branch_hit: Dictionary = f.service.damage(part_attack(record,branch,"history-branch",300.0))
	check("branch detaches before its parent stem",branch_hit.changed==1 and branch_hit.hits[0].part==branch and stem not in f.service.states[id].broken)
	if branch_hit.changed!=1:
		dispose(f)
		return
	var independent_body: Node3D = record.part_nodes[branch].body
	var stem_hit: Dictionary = f.service.damage(part_attack(record,stem,"history-stem",500.0))
	check("later stem break does not reparent previously detached branch",stem_hit.changed==1 and stem_hit.hits[0].part==stem and record.part_nodes[branch].body==independent_body and record.part_nodes[stem].body!=independent_body and f.service.states[id].fragment_roots[branch]==branch and f.service.states[id].fragment_roots[stem]==stem)
	var basal_attack := part_attack(record,"trunk","history-base",1200.0)
	check("shared basal trunk has its own precise hit point",not basal_attack.is_empty())
	if basal_attack.is_empty():
		dispose(f)
		return
	var base_hit: Dictionary = f.service.damage(basal_attack)
	check("basal hit fells remaining stems without merging prior fragments",base_hit.changed==1 and base_hit.hits[0].part=="trunk" and f.service.states[id].fallen and record.part_nodes[branch].body==independent_body and "stem_01" not in f.service.states[id].broken)
	if not clear_branch_first:
		var parent_clear: Dictionary = f.service.damage(part_attack(record,stem,"history-clear-stem-first",1200.0))
		var removed_group: bool = parent_clear.changed==1
		for member: String in family:
			if member!=branch: removed_group = removed_group and member in f.service.states[id].get("removed",[])
		check("clearing parent stem never clears an earlier independent branch",removed_group and branch not in f.service.states[id].get("removed",[]) and independent_body.collision_layer==1 and independent_body.visible and record.part_nodes["stem_01"].body.collision_layer==1)
		var child_clear: Dictionary = f.service.damage(part_attack(record,branch,"history-clear-branch-last",1200.0))
		check("old branch remains independently clearable after parent stem is gone",child_clear.changed==1 and branch in f.service.states[id].get("removed",[]) and not f.service.states[id].get("cleared",false) and record.part_nodes["stem_01"].body.collision_layer==1)
		dispose(f)
		return
	var clear_branch: Dictionary = f.service.damage(part_attack(record,branch,"history-clear-branch",1200.0))
	check("clearing old branch after basal fall leaves stem fragment and plant",clear_branch.changed==1 and branch in f.service.states[id].get("removed",[]) and stem not in f.service.states[id].get("removed",[]) and not f.service.states[id].get("cleared",false) and record.part_nodes[stem].body.collision_layer==1 and record.part_nodes["stem_01"].body.collision_layer==1)
	var clear_stem: Dictionary = f.service.damage(part_attack(record,stem,"history-clear-stem",1200.0))
	var removed_family: bool = clear_stem.changed==1
	for member: String in family:
		removed_family = removed_family and member in f.service.states[id].get("removed",[])
	check("clearing stem event preserves other fallen stems",removed_family and not f.service.states[id].get("cleared",false) and record.part_nodes["stem_01"].body.collision_layer==1)
	dispose(f)

func test_legacy_oak_sweep_semantics() -> void:
	var f := fixture()
	var record := add_entity(f,"legacy-oak-sweep","oak-1-0",Vector3.ZERO)
	var attack := query(Vector3(-3,1.6,0),"legacy-fixed-oak",350.0,0.7,Vector3.RIGHT,4.0)
	var result: Dictionary = f.service.damage(attack)
	check("original fixed oak sweep reports an actual geometry hit",result.changed==1)
	if result.changed==1:
		var part: String = result.hits[0].part
		observations["legacy_oak_sweep_actual_part"] = part
		var state: Dictionary = f.service.states["legacy-oak-sweep"]
		if part=="trunk":
			check("fixed sweep basal hit applies whole-plant semantics",state.fallen)
		elif part.begins_with("stem_") or part.begins_with("branch_"):
			check("fixed sweep local limb hit applies subtree semantics",not state.fallen and part in state.broken and state.get("fragment_roots",{}).get(part,"")==part)
		else:
			check("fixed sweep targets a damageable woody part",false)
	dispose(f)

func test_finite_basal_contact_order() -> void:
	# Retain the exact failed visual query. Independently sample the expanded
	# capsules to prove the basal front surface precedes the overlapping stem.
	for prebroken: bool in [false,true]:
		var f := fixture()
		var id := "finite-base-contact"
		var record := add_entity(f,id,"oak-1-0",Vector3(-8,0,0))
		var attack := query(Vector3(-10,1.12,0),"fixed-finite-base",350.0,0.05,Vector3.RIGHT,2.5)
		if not prebroken:
			var entries: Dictionary = {}
			for part: String in ["trunk","stem_01"]:
				var first_entry: float = INF
				for sample_index in range(4097):
					var distance: float = 2.5*float(sample_index)/4096.0
					var center: Vector3 = attack.origin+Vector3.RIGHT*distance
					for segment: Dictionary in record.asset.segments:
						if segment.part!=part: continue
						var axis_point: Vector3 = Geometry3D.get_closest_point_to_segment(center,record.transform*segment.a,record.transform*segment.b)
						if center.distance_to(axis_point)<=float(segment.radius)+0.05:
							first_entry = distance
							break
					if is_finite(first_entry): break
				entries[part] = first_entry
			observations["finite_basal_sampled_entry_distances"] = entries
			check("fixed finite sweep overlaps both basal trunk and nearest stem",is_finite(entries.trunk) and is_finite(entries.stem_01))
			check("sampled basal front surface precedes overlapping stem",float(entries.trunk)+0.001<float(entries.stem_01))
		else:
			var branch_hit: Dictionary = f.service.damage(part_attack(record,"branch_00","finite-prior-branch",300.0))
			var stem_hit: Dictionary = f.service.damage(part_attack(record,"stem_00","finite-prior-stem",500.0))
			check("finite sweep setup independently detaches branch then stem",branch_hit.changed==1 and branch_hit.hits[0].part=="branch_00" and stem_hit.changed==1 and stem_hit.hits[0].part=="stem_00" and not f.service.states[id].fallen)
		var result: Dictionary = f.service.damage(attack)
		var label: String = " after prior branch and stem fracture" if prebroken else " on intact multistem oak"
		check("finite basal sweep hits shared trunk first"+label,result.changed==1 and not result.hits.is_empty() and result.hits[0].part=="trunk")
		check("finite basal sweep fells remaining whole plant"+label,f.service.states.get(id,{}).get("fallen",false))
		if prebroken:
			check("basal sweep preserves earlier detached event identities",f.service.states[id].fragment_roots.get("branch_00","")=="branch_00" and f.service.states[id].fragment_roots.get("stem_00","")=="stem_00" and "stem_01" not in f.service.states[id].broken)
		dispose(f)

func test_first_contact_boundaries() -> void:
	var f := fixture()
	var record := add_entity(f,"capsule-boundaries","pine-0-0",Vector3.ZERO)
	var segment: Dictionary = {}
	for candidate: Dictionary in record.asset.segments:
		if candidate.part=="trunk": segment = candidate; break
	var center: Vector3 = (segment.a as Vector3).lerp(segment.b,0.5)
	var axis: Vector3 = ((segment.b as Vector3)-(segment.a as Vector3)).normalized()
	var across: Vector3 = axis.cross(Vector3.FORWARD).normalized()
	var lateral: Vector3 = axis.cross(across).normalized()
	var expanded_radius: float = float(segment.radius)+0.05
	var start_offset: float = expanded_radius+0.5
	# Small explicit margins straddle tangent/endpoint boundaries without
	# asserting mathematically exact equality after float coordinate rotation.
	var cases: Array[Dictionary] = [
		{"label":"forward","origin":center-across*start_offset,"direction":across,"reach":2.0*start_offset,"expected":true},
		{"label":"reverse","origin":center+across*start_offset,"direction":-across,"reach":2.0*start_offset,"expected":true},
		{"label":"starts inside","origin":center,"direction":across,"reach":start_offset,"expected":true},
		{"label":"near tangent inside","origin":center+lateral*(expanded_radius-0.0002)-across*start_offset,"direction":across,"reach":2.0*start_offset,"expected":true},
		{"label":"near tangent outside","origin":center+lateral*(expanded_radius+0.002)-across*start_offset,"direction":across,"reach":2.0*start_offset,"expected":false},
		{"label":"endpoint reaches surface","origin":center-across*start_offset,"direction":across,"reach":0.5002,"expected":true},
		{"label":"endpoint stops before surface","origin":center-across*start_offset,"direction":across,"reach":0.498,"expected":false}
	]
	for sample: Dictionary in cases:
		var result: Dictionary = f.service.damage(query(sample.origin,"boundary-"+str(sample.label),1.0,0.05,sample.direction,sample.reach))
		if sample.expected:
			check("real capsule first-contact boundary "+str(sample.label),result.changed==1 and result.hits[0].part=="trunk" and result.hits[0].point.is_finite() and result.hits[0].normal.is_finite())
			if sample.label in ["forward","reverse"] and result.changed==1:
				check("entry normal faces incoming sweep "+str(sample.label),(result.hits[0].normal as Vector3).dot(sample.direction)<-0.99)
		else:
			check("real capsule first-contact boundary "+str(sample.label),result.changed==0)
	dispose(f)

func test_contact_ties_and_limits() -> void:
	var f := fixture()
	for index in range(3): add_entity(f,"equal-entry-%d"%index,"pine-0-0",Vector3.ZERO)
	var attack := query(Vector3(-2,1.5,0),"tie-stop-first",1.0,0.05,Vector3.RIGHT,4.0)
	attack["max_targets"] = 2
	attack["stop_on_first"] = true
	var first: Dictionary = f.service.damage(attack)
	check("equal entry ties obey stop_on_first over max_targets",first.changed==1 and first.hits.size()==1)
	attack.cast_id = "tie-two"
	attack.stop_on_first = false
	var two: Dictionary = f.service.damage(attack)
	check("equal entry ties obey explicit target count without duplicates",two.changed==2 and two.hits.size()==2 and two.hits[0].entity_id!=two.hits[1].entity_id)
	attack.cast_id = "tie-all"
	attack.max_targets = 3
	var all: Dictionary = f.service.damage(attack)
	check("equal entry ties retain all permitted targets",all.changed==3 and all.hits.size()==3)
	dispose(f)

func test_contact_world_scale() -> void:
	var reference_point: Vector3 = Vector3.ZERO
	for uniform_scale: float in [1.0,3.0]:
		var f := fixture()
		var world_origin: Vector3 = Vector3.ZERO if uniform_scale==1.0 else Vector3(1400,0,-2100)
		add_entity(f,"scaled-oak","oak-1-0",world_origin,"scale-cell",true,uniform_scale)
		var result: Dictionary = f.service.damage(query(world_origin+Vector3(-2,1.12,0)*uniform_scale,"scaled-base",1.0,0.05*uniform_scale,Vector3.RIGHT,2.5*uniform_scale))
		check("first contact respects world translation and uniform scale "+str(uniform_scale),result.changed==1 and result.hits[0].part=="trunk")
		if result.changed==1:
			var local_point: Vector3 = ((result.hits[0].point as Vector3)-world_origin)/uniform_scale
			if uniform_scale==1.0: reference_point = local_point
			else: check("scaled first-contact position matches base asset units",local_point.distance_to(reference_point)<0.001)
		dispose(f)

func contact_query_from_surface(surface: Dictionary, cast_id: String) -> Dictionary:
	var point: Vector3 = surface.position
	var normal: Vector3 = surface.normal
	var attack := query(point+normal*0.03,cast_id,1.0,0.001,-normal,0.028)
	attack["contact_rid"] = surface.rid
	attack["contact_point"] = point
	attack["contact_normal"] = normal
	attack["contact_shape"] = int(surface.shape)
	return attack

func misses_all_live_proxies(record: Dictionary, attack: Dictionary) -> bool:
	var start: Vector3 = attack.origin
	var end: Vector3 = start+(attack.direction as Vector3).normalized()*float(attack.reach)
	for segment: Dictionary in record.asset.segments:
		if segment.part=="stump": continue
		var transform: Transform3D = record.transform
		if record.has("part_nodes") and record.part_nodes.has(segment.part):
			transform = record.part_nodes[segment.part].mesh.global_transform
		var nearest: PackedVector3Array = Geometry3D.get_closest_points_between_segments(start,end,transform*segment.a,transform*segment.b)
		if nearest[0].distance_to(nearest[1])<=float(attack.radius)+float(segment.radius)*transform.basis.get_scale().x:
			return false
	return true

func find_real_rock_fallback_surface(f: Dictionary, record: Dictionary) -> Dictionary:
	var center: Vector3 = record.transform*(record.asset.mesh as ArrayMesh).get_aabb().get_center()
	var directions: Array[Vector3] = [Vector3.UP,Vector3.DOWN]
	for elevation: float in [-1.5,-0.75,-0.25,0.0,0.25,0.75,1.5]:
		for index in range(32):
			var angle: float = TAU*float(index)/32.0
			directions.append(Vector3(cos(angle),elevation,sin(angle)).normalized())
	for direction: Vector3 in directions:
		var ray := PhysicsRayQueryParameters3D.create(center+direction*15.0,center-direction*15.0,1)
		var surface: Dictionary = f.owner.get_world_3d().direct_space_state.intersect_ray(ray)
		if surface.is_empty() or not surface.collider is Node: continue
		if surface.collider.get_meta("environment_entity","")!=record.id: continue
		if surface.collider.get_meta("environment_part","")=="stump": continue
		var attack := contact_query_from_surface(surface,"sample-only")
		if not misses_all_live_proxies(record,attack): continue
		var normal: Vector3 = surface.normal
		var point: Vector3 = surface.position
		var confirm := PhysicsRayQueryParameters3D.create(point+normal*0.01,point-normal*0.01,17)
		var verified: Dictionary = f.owner.get_world_3d().direct_space_state.intersect_ray(confirm)
		if verified.is_empty() or verified.rid!=surface.rid or verified.shape!=surface.shape: continue
		if (verified.position as Vector3).distance_to(point)>0.005: continue
		return {"surface":surface,"query":attack,"confirmed_surface":verified}
	return {}

func test_contact_rid_contract() -> void:
	var f := fixture()
	var left := add_entity(f,"rid-left","pine-0-0",Vector3.ZERO)
	var right := add_entity(f,"rid-right","pine-0-0",Vector3(4,0,0))
	await physics_frame
	await physics_frame
	var ray := PhysicsRayQueryParameters3D.create(Vector3(0,1.5,3),Vector3(0,1.5,-3),1)
	var original: Dictionary = f.owner.get_world_3d().direct_space_state.intersect_ray(ray)
	check("original entity RID comes from an actual physics ray",not original.is_empty() and original.rid==left.body.get_rid())
	if original.is_empty():
		dispose(f)
		return
	var attack := query(Vector3(2,1.5,0),"rid-invalid",1.0,3.0,Vector3.ZERO,0.0)
	attack["contact_rid"] = RID()
	check("explicit invalid contact RID fails closed",f.service.damage(attack).changed==0 and f.service.states.is_empty())
	attack.cast_id = "rid-wrong-type"
	attack.contact_rid = 7
	check("wrong contact RID type fails closed",f.service.damage(attack).changed==0 and f.service.states.is_empty())
	attack.cast_id = "rid-original"
	attack.contact_rid = original.rid
	var filtered: Dictionary = f.service.damage(attack)
	check("original body RID filters to its own entity",filtered.changed==1 and filtered.hits[0].entity_id=="rid-left" and not f.service.states.has("rid-right"))
	await physics_frame
	await physics_frame
	var materialized: Dictionary = f.owner.get_world_3d().direct_space_state.intersect_ray(ray)
	check("materialized part RID is obtained from live physics",not materialized.is_empty() and materialized.rid!=original.rid and materialized.collider.get_meta("environment_entity","")=="rid-left")
	if not materialized.is_empty():
		attack.cast_id = "rid-materialized"
		attack.contact_rid = materialized.rid
		var part_filtered: Dictionary = f.service.damage(attack)
		check("materialized part RID filters to its own entity",part_filtered.changed==1 and part_filtered.hits[0].entity_id=="rid-left" and not f.service.states.has("rid-right"))
	attack.cast_id = "rid-absent-compatible"
	attack.erase("contact_rid")
	var legacy: Dictionary = f.service.damage(attack)
	check("absent contact RID retains area-query compatibility",legacy.changed==2 and f.service.states.has("rid-right"))
	dispose(f)
	f = fixture()
	add_entity(f,"wall-tree","pine-0-0",Vector3.ZERO)
	var wall := StaticBody3D.new()
	wall.collision_layer = 16
	var wall_shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(4,4,0.4)
	wall_shape.shape = box
	wall.add_child(wall_shape)
	f.owner.add_child(wall)
	wall.position = Vector3(0,1.5,2)
	await physics_frame
	await physics_frame
	var wall_ray := PhysicsRayQueryParameters3D.create(Vector3(0,1.5,4),Vector3(0,1.5,-2),17)
	var wall_hit: Dictionary = f.owner.get_world_3d().direct_space_state.intersect_ray(wall_ray)
	check("non ecology first blocker is verified by physics",not wall_hit.is_empty() and wall_hit.rid==wall.get_rid())
	if not wall_hit.is_empty():
		var blocked_attack := query(Vector3(0,1.5,4),"rid-wall-first",1.0,0.05,Vector3.FORWARD,6.0)
		blocked_attack["contact_rid"] = wall_hit.rid
		check("non ecology first-contact RID cannot damage tree behind wall",f.service.damage(blocked_attack).changed==0 and f.service.states.is_empty())
		blocked_attack.cast_id = "rid-wall-legacy"
		blocked_attack.erase("contact_rid")
		var blocked: Dictionary = f.service.damage(blocked_attack)
		check("wall still occludes legacy queries without contact RID",blocked.changed==0 and blocked.blocked)
	dispose(f)

func test_verified_rock_surface_fallback() -> void:
	var f := fixture()
	var rock := add_entity(f,"fallback-rock","outcrop-0-0",Vector3.ZERO)
	var tree := add_entity(f,"fallback-tree","pine-0-0",Vector3(20,0,0))
	await physics_frame
	await physics_frame
	var sample := find_real_rock_fallback_surface(f,rock)
	check("real convex rock has a ray-confirmed surface outside query proxies",not sample.is_empty())
	if sample.is_empty():
		dispose(f)
		return
	var attack: Dictionary = sample.query.duplicate()
	var point: Vector3 = sample.surface.position
	var normal: Vector3 = sample.surface.normal
	var end: Vector3 = attack.origin+(attack.direction as Vector3)*float(attack.reach)
	var nearest: Vector3 = Geometry3D.get_closest_point_to_segment(point,attack.origin,end)
	observations["rock_fallback_original_surface"] = {"point":str(point),"normal":str(normal),"shape":sample.surface.shape,"point_to_finite_segment":point.distance_to(nearest)}
	check("fallback evidence is finite unit-normal same-RID same-shape contact",point.is_finite() and normal.is_finite() and absf(normal.length_squared()-1.0)<0.0001 and point.distance_to(nearest)<=float(attack.radius)+0.005 and sample.confirmed_surface.rid==sample.surface.rid and sample.confirmed_surface.shape==sample.surface.shape)
	var absent: Dictionary = attack.duplicate()
	absent.cast_id = "fallback-absent"
	absent.erase("contact_rid")
	check("proxy miss without contact evidence produces no damage",f.service.damage(absent).changed==0 and f.service.states.is_empty())
	var invalid_cases: Array[Dictionary] = [
		{"label":"wrong live RID","field":"contact_rid","value":tree.body.get_rid()},
		{"label":"wrong shape index","field":"contact_shape","value":int(sample.surface.shape)+100},
		{"label":"wrong shape type","field":"contact_shape","value":"0"},
		{"label":"far contact point","field":"contact_point","value":point+normal*2.0},
		{"label":"nonfinite contact point","field":"contact_point","value":Vector3(INF,0,0)},
		{"label":"nonfinite normal","field":"contact_normal","value":Vector3(NAN,0,0)},
		{"label":"nonunit normal","field":"contact_normal","value":normal*0.5},
		{"label":"wrong normal type","field":"contact_normal","value":[0,1,0]}
	]
	for invalid: Dictionary in invalid_cases:
		var bad: Dictionary = attack.duplicate()
		bad.cast_id = "fallback-invalid-"+str(invalid.label)
		bad[invalid.field] = invalid.value
		check("rock fallback rejects "+str(invalid.label),f.service.damage(bad).changed==0 and f.service.states.is_empty())
	var tree_ray := PhysicsRayQueryParameters3D.create(Vector3(20,1.5,3),Vector3(20,1.5,-3),1)
	var tree_surface: Dictionary = f.owner.get_world_3d().direct_space_state.intersect_ray(tree_ray)
	check("tree exclusion uses a real tree surface",not tree_surface.is_empty() and tree_surface.rid==tree.body.get_rid())
	if not tree_surface.is_empty():
		var tree_attack := contact_query_from_surface(tree_surface,"no-tree-fallback")
		check("tree surface test misses analytic sweep by explicit small margin",misses_all_live_proxies(tree,tree_attack))
		check("tree never uses the outcrop-only contact fallback",f.service.damage(tree_attack).changed==0 and not f.service.states.has("fallback-tree"))
	attack.cast_id = "fallback-positive-original"
	var accepted: Dictionary = f.service.damage(attack)
	check("verified original convex surface enables rock fallback",accepted.changed==1 and accepted.hits[0].entity_id=="fallback-rock" and str(accepted.hits[0].part).begins_with("chunk_") and not f.service.states.has("fallback-tree"))
	if accepted.changed!=1:
		dispose(f)
		return
	await physics_frame
	await physics_frame
	var live_sample := find_real_rock_fallback_surface(f,rock)
	check("materialized convex chunk provides independent real fallback evidence",not live_sample.is_empty())
	if not live_sample.is_empty():
		var live_attack: Dictionary = live_sample.query.duplicate()
		var live_part: String = live_sample.surface.collider.get_meta("environment_part","")
		check("materialized fallback sample identifies actual chunk collider",live_part.begins_with("chunk_") and rock.part_nodes.has(live_part) and live_sample.surface.rid==rock.part_nodes[live_part].body.get_rid())
		var sibling_rid := RID()
		for part: String in rock.part_nodes:
			if part.begins_with("chunk_") and part!=live_part:
				sibling_rid = rock.part_nodes[part].body.get_rid()
				break
		var wrong_body: Dictionary = live_attack.duplicate()
		wrong_body.cast_id = "fallback-wrong-sibling-body"
		wrong_body.contact_rid = sibling_rid
		var health_before: Dictionary = f.service.states["fallback-rock"].health.duplicate(true)
		check("same-entity wrong part body cannot authorize sibling fallback",sibling_rid.is_valid() and f.service.damage(wrong_body).changed==0 and f.service.states["fallback-rock"].health==health_before)
		# Adversarial deferred-cleanup fixture: a removed part still has a stale
		# physical collider for this frame. Evidence remains from a real ray.
		f.service.states["fallback-rock"]["removed"] = [live_part]
		live_attack.cast_id = "fallback-removed-stale-collider"
		check("removed chunk cannot fall back onto another live chunk",f.service.damage(live_attack).changed==0 and f.service.states["fallback-rock"].health==health_before)
		f.service.states["fallback-rock"].removed = []
		live_attack.cast_id = "fallback-positive-materialized"
		var live_accepted: Dictionary = f.service.damage(live_attack)
		check("verified materialized chunk fallback keeps exact part identity",live_accepted.changed==1 and live_accepted.hits[0].entity_id=="fallback-rock" and live_accepted.hits[0].part==live_part)
	dispose(f)

func support_fixture(height := 0.0, ready := true) -> Dictionary:
	var world := SupportWorld.new()
	root.add_child(world)
	world.build_floor(height,ready)
	var planet := NativePlanet.new()
	world.add_child(planet)
	var owner := Ecology.new()
	world.add_child(owner)
	owner.planet = planet
	owner.asset_library = library
	var service := Damage.new()
	owner.add_child(service)
	owner.damage_service = service
	service.setup(owner,library)
	service.set_physics_process(false)
	return {"owner":owner,"service":service,"support_world":world}

func world_pose_map(record: Dictionary, parts: Array[String]) -> Dictionary:
	var poses: Dictionary = {}
	for part: String in parts:
		if record.part_nodes.has(part): poses[part] = record.part_nodes[part].mesh.global_transform
	return poses

func health_value_evidence(value: Variant) -> Dictionary:
	# Decimal output alone can round in JSON; retain exact binary64 bytes too.
	return {"value":value,"type":type_string(typeof(value)),"decimal_17":String.num(float(value),17),"float64_le_hex":PackedFloat64Array([float(value)]).to_byte_array().hex_encode()}

func test_support_reactivation_and_reanchor() -> void:
	var f := support_fixture()
	var path: String = run_dir+"/physical-support-anchor.json"
	check("support fixture binds independent save",f.service.bind_save_slot(path,SEED,SLOT,false)==OK)
	var record := add_entity(f,"supported-stem","alder-1-0",Vector3.ZERO)
	var family := direct_stem_family(record.asset,"stem_00")
	await physics_frame
	await physics_frame
	var physical_floor: Dictionary = f.support_world._physical_landing_support(Vector3.ZERO)
	check("support fixture has real old-basin floor collider",physical_floor.get("ready",false) and physical_floor.rid==f.support_world.floor_body.get_rid() and absf(physical_floor.point.y)<0.001 and f.owner.planet is NativePlanet and f.owner.cells.is_empty())
	var fracture: Dictionary = f.service.damage(part_attack(record,"stem_00","support-fracture",500.0))
	check("support scenario starts with an actual detached stem group",fracture.changed==1 and fracture.hits[0].part=="stem_00")
	if fracture.changed!=1:
		dispose(f)
		return
	f.service._physics_process(4.0)
	var settled_body: RigidBody3D = record.part_nodes.stem_00.body
	var previous_world: Dictionary = world_pose_map(record,family)
	check("fragment settles on actual floor before support change",settled_body.freeze and f.service.snapshot().dynamic_fragments==0)
	f.support_world.lower_floor(-3.0)
	await physics_frame
	await physics_frame
	var lowered_floor: Dictionary = f.support_world._physical_landing_support(Vector3.ZERO)
	check("lowered support evidence comes from real physics",lowered_floor.get("ready",false) and absf(lowered_floor.point.y+3.0)<0.001)
	f.owner.invalidate_surface_region(Vector3.ZERO,20.0)
	check("terrain notification queues directly registered fragment once",f.owner.cells.is_empty() and f.service.snapshot().pending_support==1)
	f.service._physics_process(0.0)
	var resumed: RigidBody3D = record.part_nodes.stem_00.body
	var same_body: bool = not resumed.freeze and f.service.snapshot().dynamic_fragments==1
	for member: String in family: same_body = same_body and record.part_nodes[member].body==resumed
	check("support loss reactivates the full fragment as one body",same_body and record.part_nodes.stem_01.body is StaticBody3D)
	# Isolate the query regression from neighboring foliage contacts while
	# keeping real physics motion and the real layer-32 terrain collider.
	resumed.collision_mask = 32
	resumed.linear_velocity = Vector3(8,0,0)
	f.service.set_physics_process(true)
	for tick in range(8): await physics_frame
	f.service.set_physics_process(false)
	var moved_attack := part_attack(record,"stem_00","moving-resupport-hit",1.0)
	var misses_saved: bool = not moved_attack.is_empty()
	if not moved_attack.is_empty():
		for segment: Dictionary in record.asset.segments:
			if segment.part!="stem_00": continue
			var old_pose: Transform3D = previous_world.stem_00
			var closest: Vector3 = Geometry3D.get_closest_point_to_segment(moved_attack.origin,old_pose*segment.a,old_pose*segment.b)
			if (moved_attack.origin as Vector3).distance_to(closest)<=float(segment.radius)+float(moved_attack.radius): misses_saved = false
	check("moving resupport query is outside its obsolete saved pose",misses_saved)
	var moving_hit: Dictionary = f.service.damage(moved_attack)
	check("moving resupport remains damageable at current body pose",moving_hit.changed==1 and moving_hit.hits[0].part=="stem_00" and moving_hit.hits[0].collider==resumed)
	f.service._physics_process(4.0)
	var settled_after: Dictionary = world_pose_map(record,family)
	var floor_drop_once: bool = resumed.freeze and f.service.snapshot().dynamic_fragments==0
	for member: String in family:
		floor_drop_once = floor_drop_once and absf((settled_after[member] as Transform3D).origin.y-(previous_world[member] as Transform3D).origin.y+3.0)<0.01
	check("resupported group settles at the lowered physical floor",floor_drop_once)
	# Generate removed and cleared states through real damage calls before save.
	var removed_record := add_entity(f,"removed-branch","pine-0-0",Vector3(-20,0,0))
	var branch: String = "branch_00"
	var detach: Dictionary = f.service.damage(part_attack(removed_record,branch,"anchor-remove-detach",500.0))
	var clear_branch: Dictionary = f.service.damage(part_attack(removed_record,branch,"anchor-remove-clear",500.0))
	check("anchor fixture has a genuinely removed branch",detach.changed==1 and clear_branch.changed==1 and branch in f.service.states["removed-branch"].get("removed",[]))
	var cleared_record := add_entity(f,"cleared-tree","pine-0-0",Vector3(20,0,0))
	var fell: Dictionary = f.service.damage(part_attack(cleared_record,"trunk","anchor-clear-fell",500.0))
	var clear_tree: Dictionary = f.service.damage(part_attack(cleared_record,"trunk","anchor-clear-remnant",500.0))
	check("anchor fixture has a genuinely cleared tree",fell.changed==1 and clear_tree.changed==1 and f.service.states["cleared-tree"].get("cleared",false))
	var expected: Dictionary = f.service.export_state().entities["supported-stem"].duplicate(true)
	check("support snapshot records optional pose anchor",expected.has("pose_anchor") and expected.pose_anchor.size()==12 and f.service.save_state()==OK)
	var saved_payload: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	check("support expected health comes from the actual saved JSON",saved_payload is Dictionary and saved_payload.get("entities",{}).has("supported-stem"))
	if not saved_payload is Dictionary or not saved_payload.get("entities",{}).has("supported-stem"):
		dispose(f)
		return
	var saved_expected: Dictionary = saved_payload.entities["supported-stem"].duplicate(true)
	dispose(f)
	var restored := support_fixture(-3.0,false)
	check("resupport snapshot reloads in same isolated slot",restored.service.bind_save_slot(path,SEED,SLOT)==OK)
	var loaded_record := add_entity(restored,"supported-stem","alder-1-0",Vector3(0,-3,0))
	var reanchored: Dictionary = world_pose_map(loaded_record,family)
	var stable_world: bool = true
	for member: String in family: stable_world = stable_world and (reanchored[member] as Transform3D).is_equal_approx(settled_after[member])
	check("root height change preserves broken world poses without double drop",stable_world)
	var loaded_state: Dictionary = restored.service.states["supported-stem"]
	var health_diagnostics: Dictionary = {}
	var health_exact: bool = loaded_state.health==saved_expected.health
	for part: String in saved_expected.health:
		var memory_value: Variant = expected.health.get(part)
		var saved_value: Variant = saved_expected.health[part]
		var loaded_value: Variant = loaded_state.health.get(part)
		var memory_evidence: Dictionary = health_value_evidence(memory_value)
		var saved_evidence: Dictionary = health_value_evidence(saved_value)
		var loaded_evidence: Dictionary = health_value_evidence(loaded_value)
		var magnitude: float = absf(float(memory_value))
		var ulp: float = pow(2.0,floor(log(magnitude)/log(2.0))-52.0) if magnitude>0.0 else 0.0
		var serialization_delta: float = float(saved_value)-float(memory_value)
		health_diagnostics[part] = {"memory":memory_evidence,"saved_json":saved_evidence,"loaded":loaded_evidence,"memory_to_saved_delta":serialization_delta,"saved_to_loaded_delta":float(loaded_value)-float(saved_value),"memory_ulp_size":ulp,"memory_to_saved_ulps":serialization_delta/ulp if ulp>0.0 else null,"saved_equals_loaded_value_and_type":saved_value==loaded_value and typeof(saved_value)==typeof(loaded_value)}
		health_exact = health_exact and saved_evidence.type==loaded_evidence.type and saved_evidence.float64_le_hex==loaded_evidence.float64_le_hex
	observations["support_health_serialization"] = {"saved_file_sha256":FileAccess.get_sha256(path),"values":health_diagnostics}
	check("reanchor preserves health exactly as stored in actual save JSON",health_exact)
	check("reanchor preserves exact broken member list",loaded_state.broken==expected.broken and loaded_state.broken==saved_expected.broken)
	check("reanchor preserves exact fragment root mapping",loaded_state.fragment_roots==expected.fragment_roots and loaded_state.fragment_roots==saved_expected.fragment_roots)
	check("reanchor writes exact replacement root transform",loaded_state.pose_anchor==[1.0,0.0,0.0,0.0,1.0,0.0,0.0,0.0,1.0,0.0,-3.0,0.0])
	var removed_loaded := add_entity(restored,"removed-branch","pine-0-0",Vector3(-20,-3,0))
	var cleared_loaded := add_entity(restored,"cleared-tree","pine-0-0",Vector3(20,-3,0))
	check("removed branch does not reappear after reanchor",not removed_loaded.part_nodes.has(branch) and branch in restored.service.states["removed-branch"].removed)
	check("cleared tree does not reappear after reanchor",cleared_loaded.part_nodes.is_empty() and cleared_loaded.body.collision_layer==0 and restored.service.states["cleared-tree"].cleared)
	for tick in range(4): restored.service._physics_process(0.016)
	var still_world: Dictionary = world_pose_map(loaded_record,family)
	var stays_frozen: bool = restored.service.snapshot().dynamic_fragments==0 and restored.service.snapshot().pending_support>0
	for member: String in family: stays_frozen = stays_frozen and (still_world[member] as Transform3D).is_equal_approx(reanchored[member])
	check("unready basin owner retains restored group in recheck queue",stays_frozen)
	dispose(restored)

func test_unready_support_budget() -> void:
	var f := support_fixture(0.0,false)
	await physics_frame
	await physics_frame
	check("unready owner fixture still has a real physical floor",f.support_world._chunks.is_empty() and f.support_world._physical_landing_support(Vector3.ZERO).get("ready",false))
	for index in range(5): add_entity(f,"unsupported-rock-%d"%index,"outcrop-0-0",Vector3.ZERO)
	var result: Dictionary = f.service.damage(query(Vector3(0,2,0),"unsupported-budget",1200.0,20.0,Vector3.ZERO,0.0))
	check("unready support budget scenario fractures five real rocks",result.changed==5)
	check("MAX_DYNAMIC overflow terminates and queues unsettled groups",f.service.snapshot().dynamic_fragments==Damage.MAX_DYNAMIC and f.service.snapshot().pending_support>=6)
	f.service._physics_process(4.0)
	var positions: Dictionary = {}
	for id: String in f.service.entities:
		var record: Dictionary = f.service.entities[id]
		for part: String in record.part_nodes:
			if part.begins_with("chunk_"): positions[id+"/"+part] = record.part_nodes[part].mesh.global_transform
	for tick in range(6):
		f.service._physics_process(0.016)
		await physics_frame
	var frozen: bool = f.service.snapshot().dynamic_fragments==0 and f.service.snapshot().pending_support==30
	for id: String in f.service.entities:
		var record: Dictionary = f.service.entities[id]
		for part: String in record.part_nodes:
			if not part.begins_with("chunk_"): continue
			frozen = frozen and record.part_nodes[part].body.freeze and (record.part_nodes[part].mesh.global_transform as Transform3D).is_equal_approx(positions[id+"/"+part])
	check("missing ready owner freezes all fragments without falling through or queue loss",frozen)
	dispose(f)

func test_corrupt_states() -> void:
	var variants: Array[Dictionary] = []
	var invalid := state_value()
	invalid.poses = {"trunk":"not a transform array"}
	variants.append({"label":"string pose","state":invalid})
	invalid = state_value()
	invalid.poses = {"trunk":["bad",0,0,0,1,0,0,0,1,0,0,0]}
	variants.append({"label":"nonnumeric pose","state":invalid})
	invalid = state_value()
	invalid.poses = {"trunk":[0,0,0]}
	variants.append({"label":"short pose","state":invalid})
	invalid = state_value()
	invalid.health = {"trunk":{"bad":"number"}}
	variants.append({"label":"nonnumeric health","state":invalid})
	invalid = state_value()
	invalid.fallen = "false"
	variants.append({"label":"nonnumeric fallen flag","state":invalid})
	invalid = state_value()
	invalid.broken = [{"bad":"part"}]
	variants.append({"label":"nonstring broken part","state":invalid})
	invalid = state_value()
	invalid.broken = ["branch_00"]
	variants.append({"label":"broken member without root and pose","state":invalid})
	invalid = state_value()
	invalid.broken = ["stem_00","branch_00"]
	invalid.fragment_roots = {"stem_00":"branch_00","branch_00":"stem_00"}
	invalid.poses = {"stem_00":[1,0,0,0,1,0,0,0,1,0,0,0],"branch_00":[1,0,0,0,1,0,0,0,1,0,0,0]}
	variants.append({"label":"cyclic fragment event roots","state":invalid})
	for bad_anchor: Variant in ["not an array",[1,0,0], ["bad",0,0,0,1,0,0,0,1,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0], [1,0,0,0,1,0,0,0,1,1000001,0,0], [1,0,0,0,1,0,0,0,1,INF,0,0]]:
		invalid = state_value()
		invalid.pose_anchor = bad_anchor
		variants.append({"label":"malformed optional pose anchor "+str(variants.size()),"state":invalid})
	for index in range(variants.size()):
		var path := run_dir+"/corrupt-%d.json"%index
		write_json(path,envelope(variants[index].state))
		var original := FileAccess.get_file_as_string(path)
		var f := fixture()
		check("reject malformed persisted "+str(variants[index].label),f.service.bind_save_slot(path,SEED,SLOT)==ERR_FILE_CORRUPT)
		check("corrupt state cannot overwrite original "+str(variants[index].label),f.service.save_state()==ERR_FILE_CORRUPT and FileAccess.get_file_as_string(path)==original)
		dispose(f)
	var invalid_header := envelope(state_value())
	invalid_header.version = {"invalid":"header type"}
	var header_path := run_dir+"/corrupt-header.json"
	write_json(header_path,invalid_header)
	var header_fixture := fixture()
	check("malformed header returns error without unsafe conversion",header_fixture.service.bind_save_slot(header_path,SEED,SLOT)==ERR_FILE_CORRUPT)
	dispose(header_fixture)
