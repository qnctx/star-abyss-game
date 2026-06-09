extends Node

signal death_drop_spawned()
signal death_drop_collected()

const DEATH_DROP_SCRIPT := preload("res://scripts/death_drop.gd")
const DROP_RATIO := 0.5

var active_payload: Dictionary = {}
var active_position := Vector3.ZERO


func reset_drop() -> void:
	active_payload.clear()
	active_position = Vector3.ZERO
	_clear_active_drop_node()


func record_player_death(player: Node3D) -> bool:
	if not player or not InventoryManager:
		return false
	var dropped := _take_drop_from_inventory()
	if dropped.is_empty():
		return false
	if not active_payload.is_empty():
		for resource_type in active_payload:
			dropped[str(resource_type)] = int(dropped.get(str(resource_type), 0)) + int(active_payload[resource_type])
	active_payload = dropped
	active_position = _drop_position(player.global_position)
	_spawn_drop_node()
	death_drop_spawned.emit()
	return true


func collect_active_drop() -> bool:
	if active_payload.is_empty() or not InventoryManager:
		return false
	for resource_type in active_payload:
		InventoryManager.add_resource(str(resource_type), int(active_payload[resource_type]))
	reset_drop()
	death_drop_collected.emit()
	return true


func has_active_drop() -> bool:
	return not active_payload.is_empty()


func get_drop_hint() -> String:
	if active_payload.is_empty():
		return ""
	var player := get_tree().get_first_node_in_group("player") as Node3D
	if not player:
		return "Drop: recover lost resources"
	var distance := _flat_distance(player.global_position, active_position)
	return "Drop: %dm %s | recover %s" % [
		roundi(distance),
		_direction_label(player.global_position, active_position),
		_payload_text(active_payload)
	]


func capture_save_data() -> Dictionary:
	return {
		"payload": active_payload.duplicate(true),
		"position": [active_position.x, active_position.y, active_position.z]
	}


func apply_save_data(data: Variant) -> void:
	reset_drop()
	if typeof(data) != TYPE_DICTIONARY:
		return
	var payload_value: Variant = data.get("payload", {})
	if typeof(payload_value) == TYPE_DICTIONARY:
		for resource_type in payload_value:
			var amount := int(payload_value[resource_type])
			if amount > 0:
				active_payload[str(resource_type)] = amount
	if active_payload.is_empty():
		return
	active_position = _array_to_vector(data.get("position", [0.0, 0.75, 0.0]))
	_spawn_drop_node()


func _take_drop_from_inventory() -> Dictionary:
	var dropped: Dictionary = {}
	for resource_type in InventoryManager.resources:
		var amount := int(InventoryManager.resources[resource_type])
		if amount <= 0:
			continue
		var drop_amount := maxi(1, int(floor(float(amount) * DROP_RATIO)))
		drop_amount = mini(drop_amount, amount)
		dropped[str(resource_type)] = drop_amount
		InventoryManager.resources[resource_type] = amount - drop_amount
		InventoryManager.resource_changed.emit(str(resource_type), int(InventoryManager.resources[resource_type]))
	return dropped


func _spawn_drop_node() -> void:
	if not get_tree().current_scene or active_payload.is_empty():
		return
	_clear_active_drop_node()
	var drop := DEATH_DROP_SCRIPT.new()
	drop.setup(active_payload)
	get_tree().current_scene.add_child(drop)
	drop.global_position = active_position


func _clear_active_drop_node() -> void:
	for drop in get_tree().get_nodes_in_group("death_drops"):
		if drop and is_instance_valid(drop):
			drop.free()


func _drop_position(value: Vector3) -> Vector3:
	var x := clampf(value.x, -50.0, 50.0)
	var z := clampf(value.z, -50.0, 50.0)
	var y := clampf(value.y, -5.0, 15.0)
	if WorldGenerator:
		y = clampf(WorldGenerator.get_height_at(Vector2(x, z)), -5.0, 15.0) + 0.75
	return Vector3(x, y, z)


func _array_to_vector(value: Variant) -> Vector3:
	if typeof(value) == TYPE_ARRAY and value.size() >= 3:
		return Vector3(float(value[0]), float(value[1]), float(value[2]))
	return Vector3.ZERO


func _flat_distance(a: Vector3, b: Vector3) -> float:
	a.y = 0.0
	b.y = 0.0
	return a.distance_to(b)


func _direction_label(from_pos: Vector3, to_pos: Vector3) -> String:
	var delta := to_pos - from_pos
	var parts: Array[String] = []
	if abs(delta.z) > 1.0:
		parts.append("N" if delta.z < 0.0 else "S")
	if abs(delta.x) > 1.0:
		parts.append("E" if delta.x > 0.0 else "W")
	return "".join(parts) if not parts.is_empty() else "here"


func _payload_text(payload: Dictionary) -> String:
	var parts: Array[String] = []
	for resource_type in payload:
		parts.append("%d %s" % [int(payload[resource_type]), _resource_label(str(resource_type))])
	return " + ".join(parts)


func _resource_label(resource_type: String) -> String:
	match resource_type:
		"void_crystal":
			return "crystal"
		"energy_core":
			return "core"
		_:
			return resource_type
