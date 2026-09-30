extends CharacterBody3D
class_name NativeAICampNpc

# Instances the existing skinned C2 explorer and its authored idle/walk clips.
const REPAIR := Vector3(17.0, 0.0, 190.0)
const INSPECT := Vector3(5.0, 0.0, 194.0)
const REST := Vector3(3.0, 0.0, 185.0)
const CAMP_CENTER := Vector3(9.0, 0.0, 190.0)

var world: NativeWorld
var player: NativePlayer
var mind := NativeAINpc.new()
var clock := 0.0
var purpose := "repair"
var _motion: NativeMotionR2
var _visible_player := false
var _next_sense := 0.0

func setup(w: NativeWorld, p: NativePlayer) -> void:
	world = w
	player = p
	name = "CampTechnician"
	collision_layer = 4
	collision_mask = 1
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.42
	capsule.height = 1.72
	var collider := CollisionShape3D.new()
	collider.shape = capsule
	collider.position.y = 0.86
	add_child(collider)
	_motion = NativeMotionR2.new()
	_motion.name = "ExistingExplorerVisual"
	add_child(_motion)
	global_position = Vector3(REPAIR.x, world.height_at(REPAIR.x, REPAIR.z), REPAIR.z)

func _physics_process(delta: float) -> void:
	if world == null or not is_instance_valid(player) or delta <= 0.0:
		return
	clock += delta
	if Vector2(player.global_position.x - CAMP_CENTER.x, player.global_position.z - CAMP_CENTER.z).length() > 180.0:
		_visible_player = false
		purpose = mind.purpose(clock)
		return
	if clock >= _next_sense:
		_next_sense = clock + 0.28
		_visible_player = global_position.distance_to(player.global_position) <= 20.0 and _line_clear(player.global_position + Vector3.UP, global_position + Vector3.UP)
	purpose = mind.purpose(clock)
	var destination := REPAIR if purpose == "repair" else INSPECT if purpose == "inspect" else REST
	if purpose == "avoid" and _visible_player:
		var away := global_position - player.global_position
		away.y = 0.0
		if away.length_squared() > 0.01:
			destination = CAMP_CENTER + away.normalized() * 13.0
	var flat := Vector3(destination.x - global_position.x, 0.0, destination.z - global_position.z)
	var speed := 0.0
	if flat.length() > 0.45:
		var direction := flat.normalized()
		var step := direction * minf(delta * (3.0 if purpose == "avoid" else 1.55), flat.length() - 0.4)
		var next := global_position + step
		if not world.is_solid_at(next, 0.42, 1.8):
			var before := global_position
			move_and_collide(step)
			speed = Vector2(global_position.x - before.x, global_position.z - before.z).length() / delta
			if speed > 0.1:
				rotation.y = rotate_toward(rotation.y, atan2(-direction.x, -direction.z), delta * 4.0)
	var floor_y := world.height_at(global_position.x, global_position.z)
	global_position.y = floor_y
	if _motion != null:
		_motion.step(delta, {"speed": speed, "airborne": false, "local_velocity": Vector3(0.0, 0.0, -speed)})

func can_interact() -> bool:
	return is_instance_valid(player) and global_position.distance_to(player.global_position) <= 3.2 and _line_clear(player.global_position + Vector3.UP, global_position + Vector3.UP)

func try_interact() -> Dictionary:
	return mind.interact(clock, can_interact(), global_position.distance_to(player.global_position))

func observe_survey() -> void:
	if global_position.distance_to(player.global_position) <= 18.0 and _line_clear(player.global_position + Vector3.UP, global_position + Vector3.UP):
		mind.observe_event("survey", clock, true)

func observe_combat_event(record: Dictionary) -> void:
	if String(record.get("phase", "")) != "start" or String(record.get("side", "player")) != "player":
		return
	var source: Variant = record.get("player_position")
	if source is Vector3 and source.distance_to(global_position) <= 18.0 and _line_clear(source + Vector3.UP, global_position + Vector3.UP):
		mind.observe_event("combat", clock, true)

func _line_clear(origin: Vector3, destination: Vector3) -> bool:
	if not origin.is_finite() or not destination.is_finite():
		return false
	var query := PhysicsRayQueryParameters3D.create(origin, destination, 1)
	return get_world_3d().direct_space_state.intersect_ray(query).is_empty()

func snapshot() -> Dictionary:
	var data := mind.snapshot()
	data["routine_time"] = fposmod(clock, NativeAINpc.ROUTINE_SECONDS)
	return data

func restore(data: Dictionary) -> void:
	mind.restore(data)
	var saved_clock := float(data.get("routine_time", 0.0))
	clock = clampf(saved_clock, 0.0, NativeAINpc.ROUTINE_SECONDS) if is_finite(saved_clock) else 0.0
