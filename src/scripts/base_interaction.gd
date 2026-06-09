extends Node

const REPAIR_RADIUS: float = 5.0


func _input(event: InputEvent) -> void:
	if _is_night_test_pressed(event):
		if GameManager.force_start_night():
			get_viewport().set_input_as_handled()
		return

	if _is_interact_pressed(event) and is_player_near_base():
		if GameManager.repair_base():
			get_viewport().set_input_as_handled()


func is_player_near_base() -> bool:
	var player := get_tree().get_first_node_in_group("player") as Node3D
	if not player:
		return false

	var player_pos := player.global_position
	var base_pos := WorldGenerator.base_position
	player_pos.y = 0.0
	base_pos.y = 0.0
	return player_pos.distance_to(base_pos) <= REPAIR_RADIUS


func get_repair_hint() -> String:
	if not is_player_near_base():
		return ""
	if GameManager.base_health >= GameManager.MAX_BASE_HEALTH:
		return "Base full"
	if GameManager.can_repair_base():
		return "Near base: E repair (%s)" % GameManager.get_base_repair_cost_text()
	return "Need %s to repair base" % GameManager.get_base_repair_cost_text()


func _is_interact_pressed(event: InputEvent) -> bool:
	return event.is_action_pressed("interact") or _is_physical_key_pressed(event, KEY_E)


func _is_night_test_pressed(event: InputEvent) -> bool:
	return event.is_action_pressed("night_test") or _is_physical_key_pressed(event, KEY_N)


func _is_physical_key_pressed(event: InputEvent, keycode: Key) -> bool:
	return event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == keycode
