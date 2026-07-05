extends Node

signal tool_changed(tool_id: String)

const AIM_TARGETING := preload("res://scripts/aim_targeting.gd")
const TOOL_WEAPON := "weapon"
const TOOL_HARVESTER := "harvester"
const TOOL_SCANNER := "scanner"
const TOOL_BUILD := "build"
const TOOL_REPAIR := "repair"
const TOOL_ORDER := [TOOL_WEAPON, TOOL_HARVESTER, TOOL_SCANNER, TOOL_BUILD, TOOL_REPAIR]
const TOOL_LABELS := {
	TOOL_WEAPON: "Weapon",
	TOOL_HARVESTER: "Harvester",
	TOOL_SCANNER: "Scanner",
	TOOL_BUILD: "Build",
	TOOL_REPAIR: "Repair",
}

const HARVEST_RANGE := 4.2
const AIM_RESOURCE_RANGE := 6.0
const AIM_RESOURCE_RADIUS := 1.45

var current_tool: String = TOOL_WEAPON
var last_status: String = ""


func _ready() -> void:
	_select_tool(TOOL_WEAPON)


func _input(event: InputEvent) -> void:
	if not (event is InputEventKey) and not (event is InputEventMouseButton):
		return
	if event is InputEventKey and event.pressed and not event.echo:
		if event.shift_pressed and event.physical_keycode in [KEY_1, KEY_2, KEY_3, KEY_4, KEY_5, KEY_6, KEY_7]:
			return
		match event.physical_keycode:
			KEY_1:
				_select_tool(TOOL_WEAPON)
			KEY_2:
				_select_tool(TOOL_HARVESTER)
			KEY_3:
				_select_tool(TOOL_SCANNER)
			KEY_4:
				_select_tool(TOOL_BUILD)
			KEY_5:
				_select_tool(TOOL_REPAIR)
			_:
				return
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if current_tool == TOOL_HARVESTER:
			_try_harvest()
			get_viewport().set_input_as_handled()
		elif current_tool == TOOL_REPAIR:
			_try_repair()
			get_viewport().set_input_as_handled()


func get_toolbelt_text() -> String:
	var parts: Array[String] = []
	for i in range(TOOL_ORDER.size()):
		var tool_id: String = str(TOOL_ORDER[i])
		var label: String = "%d %s" % [i + 1, str(TOOL_LABELS[tool_id])]
		parts.append("[%s]" % label if tool_id == current_tool else label)
	return "Tools: %s" % " | ".join(parts)


func get_status_text() -> String:
	if not last_status.is_empty():
		return last_status
	return _default_status_text()


func _default_status_text() -> String:
	if current_tool == TOOL_HARVESTER:
		var target := _aimed_buried_resource(true)
		if not target:
			target = _nearest_buried_resource(true)
		if target:
			return "Harvester: %s | LMB dig" % target.get_harvest_hint()
		var resource := _aimed_visible_resource()
		if resource:
			return "Harvester: %s | LMB collect" % str(resource.get("resource_type"))
		return "Harvester: use 3 Scanner to reveal buried resources"
	if current_tool == TOOL_SCANNER:
		return "Scanner equipped | G cycle signal"
	if current_tool == TOOL_BUILD:
		return "Build tool: choose building with 1-7 | RMB/Esc exit"
	if current_tool == TOOL_REPAIR:
		return "Repair tool: aim damaged structure | LMB repair"
	return "Weapon ready"


func is_tool_active(tool_id: String) -> bool:
	return current_tool == tool_id


func set_tool(tool_id: String) -> void:
	_select_tool(tool_id)


func _select_tool(tool_id: String) -> void:
	if tool_id not in TOOL_ORDER:
		return
	current_tool = tool_id
	last_status = ""
	if tool_id == TOOL_BUILD:
		var build_manager := _build_manager()
		if build_manager and build_manager.has_method("_set_build_mode"):
			build_manager.call("_set_build_mode", true)
	else:
		var build_manager := _build_manager()
		if build_manager and build_manager.get("build_mode") == true and build_manager.has_method("_set_build_mode"):
			build_manager.call("_set_build_mode", false)
	tool_changed.emit(current_tool)


func _try_harvest() -> bool:
	var target := _aimed_buried_resource(true)
	if not target:
		target = _nearest_buried_resource(true)
	if not target:
		var resource := _aimed_visible_resource()
		if resource and resource.has_method("collect") and bool(resource.call("collect")):
			last_status = "Harvester: collected %s +%d" % [str(resource.get("resource_type")), int(resource.get("amount"))]
			return true
		last_status = "Harvester: aim at revealed dig marker or visible resource"
		return false
	if not target.harvest_once():
		last_status = target.get_harvest_hint()
		return false
	last_status = "Harvester: collected %s +%d" % [target.resource_type, int(target.get("amount"))]
	return true


func _try_repair() -> void:
	var build_manager := _build_manager()
	if build_manager and build_manager.has_method("_try_repair_structure"):
		build_manager.call("_try_repair_structure")


func _aimed_buried_resource(require_revealed: bool) -> Node:
	return AIM_TARGETING.new().find_aimed_group(
		get_viewport(),
		get_tree(),
		"buried_resources",
		AIM_RESOURCE_RANGE,
		AIM_RESOURCE_RADIUS,
		func(node: Node3D) -> bool:
			return (not require_revealed or node.get("is_revealed") == true)
	)


func _aimed_visible_resource() -> Node:
	return AIM_TARGETING.new().find_aimed_group(
		get_viewport(),
		get_tree(),
		"resource_nodes",
		AIM_RESOURCE_RANGE,
		AIM_RESOURCE_RADIUS,
		func(node: Node3D) -> bool:
			return node.has_method("collect")
	)


func _nearest_buried_resource(require_revealed: bool) -> Node:
	var player := get_tree().get_first_node_in_group("player") as Node3D
	if not player:
		return null
	var nearest: Node = null
	var nearest_distance := HARVEST_RANGE
	for node in get_tree().get_nodes_in_group("buried_resources"):
		var buried := node as Node3D
		if not buried or not is_instance_valid(buried) or buried.is_queued_for_deletion():
			continue
		if require_revealed and buried.get("is_revealed") != true:
			continue
		var distance := _flat_distance(player.global_position, buried.global_position)
		if distance < nearest_distance:
			nearest_distance = distance
			nearest = buried
	return nearest


func _flat_distance(a: Vector3, b: Vector3) -> float:
	a.y = 0.0
	b.y = 0.0
	return a.distance_to(b)


func _build_manager() -> Node:
	return get_tree().current_scene.get_node_or_null("BuildManager") if get_tree().current_scene else null


func _build_manager_is_active() -> bool:
	var build_manager := _build_manager()
	return build_manager and build_manager.get("build_mode") == true
