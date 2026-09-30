extends SceneTree

# Runs Main and Player with their normal physics; uses the game's E/F2 input
# and a dedicated save slot, without touching a player's session.
class InputProbe extends Node:
	var e_down := 0
	func _input(event: InputEvent) -> void:
		if event is InputEventKey and event.pressed and event.physical_keycode == KEY_E:
			e_down += 1

var checks: Array[Dictionary] = []

func _initialize() -> void:
	call_deferred("_run")

func check(name: String, passed: bool, detail: Variant = null) -> void:
	checks.append({"name": name, "pass": passed, "detail": detail})
	if not passed:
		printerr("FAIL ", name, " ", detail)

func frames(count: int) -> void:
	for i in range(count):
		await physics_frame

func press(key: Key) -> void:
	var event := InputEventKey.new()
	event.physical_keycode = key
	event.pressed = true
	Input.parse_input_event(event)
	event = InputEventKey.new()
	event.physical_keycode = key
	event.pressed = false
	Input.parse_input_event(event)

func _run() -> void:
	var owned_save := "user://native_ai_product_test_only.json"
	if FileAccess.file_exists(owned_save):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(owned_save))
	var game := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = owned_save
	root.add_child(game)
	var probe := InputProbe.new()
	root.add_child(probe)
	await frames(10)
	check("normal Main and Player physics are enabled", game.is_physics_processing() and game.player.is_physics_processing())
	game.player.global_position = game.camp_npc.global_position + Vector3(0.0, 0.0, 2.0)
	game.player.global_position.y = game.world.height_at(game.player.global_position.x, game.player.global_position.z)
	await frames(60)
	var npc_ready := game.initialized and game.pending_planet_restore.is_empty() and game.camp_npc.can_interact()
	check("technician is in real E sight and reach", npc_ready, {"initialized": game.initialized, "planet_pending": not game.pending_planet_restore.is_empty(), "distance": game.player.global_position.distance_to(game.camp_npc.global_position), "mouse_mode": Input.get_mouse_mode()})
	press(KEY_E)
	await frames(4)
	check("E event reaches the real scene input path", probe.e_down == 1, probe.e_down)
	check("real E input selects visible nearby technician", npc_ready and game.camp_npc.mind.talks == 1 and game.message.begins_with("营地技师："), {"message": game.message, "talks": game.camp_npc.mind.talks, "mouse_mode": Input.get_mouse_mode()})
	var before := game.beast.global_position
	press(KEY_F2)
	await frames(100)
	check("real F2 path loads arena support", game.world.surface_at(game.beast.home).get("ready", false) == true)
	check("real F2 path places a live ground player at arena", game.player.global_position.distance_to(Vector3(1370.0, game.world.height_at(1370.0, -1022.0), -1022.0)) < 8.0 and game.player.health > 0.0, game.player.global_position)
	check("enemy acquires and acts on visible player in normal Main loop", game.beast.aggro_until > game.beast.clock and (game.beast.global_position.distance_to(before) > 0.2 or game.beast.attack_serial > 0), game.beast.get_combat_snapshot())
	var failed := checks.filter(func(item: Dictionary) -> bool: return not item.pass)
	print("NATIVE_AI_PRODUCT_VERIFY ", JSON.stringify({"passed": checks.size() - failed.size(), "total": checks.size(), "failed": failed}))
	probe.queue_free()
	game.queue_free()
	await process_frame
	quit(0 if failed.is_empty() else 1)
