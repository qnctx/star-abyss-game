extends SceneTree
## Read-only actual rendered skin bake after frame_post_draw; no manual physics.
var actor: Driver
var meshes: Array[MeshInstance3D] = []
var samples: Array = []
var side_indices: Dictionary = {}
var out := "res://assets/motion-r2/evidence/gait-r6/candidate1/skin.json"

class Driver extends Node3D:
	var motion: NativeMotionR2
	var tick := 0
	var elapsed := 0.0
	var age := 0.0
	var index := 0
	var done := false
	var wall_start := 0
	var records: Array = []
	var stages := [{"name":"idle","speed":0.0,"duration":0.5},{"name":"walk","speed":1.6,"duration":2.0},{"name":"jog","speed":6.8,"duration":2.0},{"name":"sprint","speed":10.0,"duration":2.0},{"name":"stop","speed":0.0,"duration":0.8}]
	func _ready() -> void:
		motion = NativeMotionR2.new()
		add_child(motion)
		wall_start = Time.get_ticks_usec()
	func _physics_process(delta: float) -> void:
		if done:
			return
		var state: Dictionary = stages[index]
		elapsed += delta
		age += delta
		tick += 1
		position.z -= float(state.speed)*delta
		motion.step(delta,{"speed":state.speed,"local_velocity":Vector3(0,0,-float(state.speed))})
		records.append({"tick":tick,"physics_frame":Engine.get_physics_frames(),"delta":delta,"seconds":elapsed,"wall":float(Time.get_ticks_usec()-wall_start)/1e6,"stage":state.name,"age":age,"phase":motion.gait_phase,"probe_minimum":motion._gait_sole_minimum,"visual_lift":motion._gait_floor_lift})
		if age >= float(state.duration):
			age = 0.0
			index += 1
			done = index == stages.size()

func _initialize() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--out="):
			out = arg.trim_prefix("--out=")
	call_deferred("run")

func collect(node: Node) -> void:
	if node is MeshInstance3D and node.skin != null:
		meshes.append(node)
		var groups := []
		for surface in range(node.mesh.get_surface_count()):
			var rest: PackedVector3Array = node.mesh.surface_get_arrays(surface)[Mesh.ARRAY_VERTEX]
			var sides := PackedInt32Array()
			for v in rest:
				var world: Vector3 = node.global_transform * v
				sides.append(0 if actor.to_local(world).x < 0.0 else 1)
			groups.append(sides)
		side_indices[node.get_instance_id()] = groups
	for child in node.get_children():
		collect(child)

func run() -> void:
	actor = Driver.new()
	root.add_child(actor)
	collect(actor.motion.model)
	var camera := Camera3D.new()
	actor.add_child(camera)
	camera.position = Vector3(4,1.2,0)
	camera.look_at(Vector3(0,0.9,0))
	camera.current = true
	var previous := -1.0
	while not actor.done:
		await physics_frame
		if actor.elapsed-previous < 0.016:
			continue
		await RenderingServer.frame_post_draw
		var row: Dictionary = actor.records[-1].duplicate()
		var min_y := INF
		var minima := {"L":INF,"R":INF}
		var lowest := {}
		var count := 0
		for mesh in meshes:
			var baked := mesh.bake_mesh_from_current_skeleton_pose()
			for s in range(baked.get_surface_count()):
				var vertices: PackedVector3Array = baked.surface_get_arrays(s)[Mesh.ARRAY_VERTEX]
				for i in range(vertices.size()):
					var world := mesh.global_transform * vertices[i]
					var y := world.y-actor.global_position.y
					count += 1
					if y < min_y:
						min_y = y
						lowest = {"mesh":str(mesh.name),"surface":s,"vertex":i,"world":[world.x,world.y,world.z]}
					var side := "L" if side_indices[mesh.get_instance_id()][s][i] == 0 else "R"
					minima[side] = minf(float(minima[side]),y)
		row["min_y"] = min_y
		row["side_min_y"] = minima
		row["lowest"] = lowest
		row["skinned_vertex_count"] = count
		row["sample_wall"] = float(Time.get_ticks_usec()-actor.wall_start)/1e6
		samples.append(row)
		previous = actor.elapsed
	DirAccess.make_dir_recursive_absolute(out.get_base_dir())
	var extrema := {}
	for row in samples:
		if not extrema.has(row.stage):
			extrema[row.stage] = row.min_y
		else:
			extrema[row.stage] = minf(float(extrema[row.stage]),float(row.min_y))
	FileAccess.open(out,FileAccess.WRITE).store_string(JSON.stringify({"method":"MeshInstance3D.bake_mesh_from_current_skeleton_pose after actual render; all skinned vertices scanned in world coordinates against actor root flat plane; immutable left/right rest-space vertex groups, no classification by deformed X. Actual automatic physics, may stall rendering during GPU readback.","glb_sha256":FileAccess.get_sha256("res://assets/motion-r2/c2-motion-r2.glb"),"driver_sha256":FileAccess.get_sha256("res://scripts/native_motion_r2.gd"),"time_scale":Engine.time_scale,"physics_frames":actor.tick,"records":actor.records,"samples":samples,"stage_min_y":extrema},"\t"))
	print("R6_FULL_SKIN_DEPTH ",JSON.stringify({"physics_frames":actor.tick,"mesh_count":meshes.size(),"samples":samples.size(),"stage_min_y":extrema}))
	quit()
