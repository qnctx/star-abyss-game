extends Node
class_name ResourceScanner

const SCAN_RADIUS: float = 45.0
const SCAN_INTERVAL: float = 0.25
const RESOURCE_TYPES := ["iron", "biomass", "void_crystal", "energy_core"]

var selected_index: int = 0
var nearest_resource: Node3D = null
var nearest_distance: float = 0.0
var nearest_direction: String = ""
var _scan_timer: float = 0.0


func _ready() -> void:
	set_process(true)


func _input(event: InputEvent) -> void:
	if event.is_action_pressed("scanner_cycle") or _is_physical_key_pressed(event, KEY_G):
		selected_index = (selected_index + 1) % RESOURCE_TYPES.size()
		_scan_now()
		get_viewport().set_input_as_handled()


func _process(delta: float) -> void:
	_scan_timer += delta
	if _scan_timer < SCAN_INTERVAL:
		return
	_scan_timer = 0.0
	_scan_now()


func get_scan_hint() -> String:
	var selected_type := get_selected_resource_type()
	if nearest_resource:
		return "Scanner: %s %dm %s | G type" % [
			_resource_label(selected_type),
			roundi(nearest_distance),
			nearest_direction
		]
	return "Scanner: no %s within %dm | G type" % [_resource_label(selected_type), roundi(SCAN_RADIUS)]


func get_selected_resource_type() -> String:
	return RESOURCE_TYPES[selected_index]


func _scan_now() -> void:
	nearest_resource = null
	nearest_distance = 0.0
	nearest_direction = ""

	var player := get_tree().get_first_node_in_group("player") as Node3D
	if not player:
		return

	var selected_type := get_selected_resource_type()
	var best_distance := SCAN_RADIUS + 1.0
	for node in get_tree().get_nodes_in_group("resource_nodes"):
		var resource_node := node as Node3D
		if not resource_node:
			continue
		if str(resource_node.get("resource_type")) != selected_type:
			continue
		var distance := _flat_distance(player.global_position, resource_node.global_position)
		if distance < best_distance:
			best_distance = distance
			nearest_resource = resource_node

	if nearest_resource:
		nearest_distance = best_distance
		nearest_direction = _direction_label(player.global_position, nearest_resource.global_position)


func _flat_distance(a: Vector3, b: Vector3) -> float:
	a.y = 0.0
	b.y = 0.0
	return a.distance_to(b)


func _direction_label(from_pos: Vector3, to_pos: Vector3) -> String:
	var delta := to_pos - from_pos
	var parts: Array[String] = []
	if delta.z < -2.0:
		parts.append("N")
	elif delta.z > 2.0:
		parts.append("S")
	if delta.x > 2.0:
		parts.append("E")
	elif delta.x < -2.0:
		parts.append("W")
	if parts.is_empty():
		return "here"
	return "".join(parts)


func _resource_label(resource_type: String) -> String:
	if resource_type == "void_crystal":
		return "crystal"
	if resource_type == "energy_core":
		return "core"
	return resource_type


func _is_physical_key_pressed(event: InputEvent, keycode: Key) -> bool:
	return event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == keycode
