extends Node3D
## Isolated old-basin owner with an actual physics floor, never an analytic plane.
var _chunks: Dictionary = {}
var floor_body: StaticBody3D

func build_floor(height: float, ready := true) -> void:
	floor_body = StaticBody3D.new()
	floor_body.collision_layer = 1|32
	floor_body.collision_mask = 0
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(80,1,80)
	shape.shape = box
	floor_body.add_child(shape)
	add_child(floor_body)
	floor_body.add_to_group("native_terrain")
	lower_floor(height)
	set_owner_ready(ready)

func lower_floor(height: float) -> void:
	floor_body.position = Vector3(0,height-0.5,0)

func set_owner_ready(ready: bool) -> void:
	_chunks.clear()
	if ready: _chunks[Vector2i(18,18)] = floor_body

func _physical_landing_support(point: Vector3) -> Dictionary:
	var ray := PhysicsRayQueryParameters3D.create(point+Vector3.UP*100.0,point-Vector3.UP*100.0,32)
	var hit: Dictionary = get_world_3d().direct_space_state.intersect_ray(ray)
	if hit.is_empty() or not hit.collider.is_in_group("native_terrain"): return {"ready":false}
	return {"ready":true,"point":hit.position,"normal":hit.normal,"rid":hit.rid}
