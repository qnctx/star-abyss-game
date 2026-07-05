extends Node

signal oxygen_canister_crafted()
signal oxygen_canister_used(amount: float)

const RESOURCE_TYPE := "oxygen_canister"
const CRAFT_COST := {"biomass": 2, "energy": 1}
const OXYGEN_RESTORE := 60.0


func _ready() -> void:
	_ensure_input_action("use_oxygen_canister", KEY_Q)
	_ensure_input_action("craft_oxygen_canister", KEY_H)


func _input(event: InputEvent) -> void:
	if event.is_action_pressed("use_oxygen_canister"):
		if use_canister():
			get_viewport().set_input_as_handled()
	elif event.is_action_pressed("craft_oxygen_canister"):
		if craft_canister():
			get_viewport().set_input_as_handled()


func craft_canister() -> bool:
	if not InventoryManager or not InventoryManager.has_resources(CRAFT_COST):
		return false
	if not InventoryManager.consume_resources(CRAFT_COST):
		return false
	InventoryManager.add_resource(RESOURCE_TYPE, 1)
	oxygen_canister_crafted.emit()
	return true


func use_canister(player: Node = null) -> bool:
	if not InventoryManager or int(InventoryManager.resources.get(RESOURCE_TYPE, 0)) <= 0:
		return false
	var target_player := player
	if not target_player:
		target_player = get_tree().get_first_node_in_group("player")
	if not target_player:
		return false
	var current_oxygen := float(target_player.get("current_oxygen"))
	var max_oxygen := float(target_player.get("max_oxygen"))
	if current_oxygen >= max_oxygen:
		return false
	if not InventoryManager.consume_resources({RESOURCE_TYPE: 1}):
		return false
	target_player.set("current_oxygen", minf(max_oxygen, current_oxygen + OXYGEN_RESTORE))
	target_player.emit_signal("oxygen_changed")
	oxygen_canister_used.emit(OXYGEN_RESTORE)
	return true


func get_supply_hint() -> String:
	var count := int(InventoryManager.resources.get(RESOURCE_TYPE, 0)) if InventoryManager else 0
	var craft_state := "READY" if InventoryManager and InventoryManager.has_resources(CRAFT_COST) else "NEED 2 biomass + 1 energy"
	return "O2 Kit: %d | Q use +%d O2 | H craft %s" % [count, roundi(OXYGEN_RESTORE), craft_state]


func _ensure_input_action(action_name: String, key: Key) -> void:
	if not InputMap.has_action(action_name):
		InputMap.add_action(action_name)
	for event in InputMap.action_get_events(action_name):
		var key_event := event as InputEventKey
		if key_event and key_event.physical_keycode == key:
			return
	var input_event := InputEventKey.new()
	input_event.physical_keycode = key
	InputMap.action_add_event(action_name, input_event)
