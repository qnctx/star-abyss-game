extends SceneTree

var game: NativeMain
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("_run")

func check(name: String, passed: bool) -> void:
	if not passed:
		failures.append(name)
		printerr("FAIL ", name)

func frames(count: int) -> void:
	for i in range(count):
		await physics_frame

func _run() -> void:
	var owned_save := "user://native_ai_runtime_test_only.json"
	if FileAccess.file_exists(owned_save):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(owned_save))
	game = (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = owned_save
	root.add_child(game)
	game.set_physics_process(false)
	game.set_process(false)
	game.player.set_physics_process(false)
	game.ascension.set_physics_process(false)
	game.player.global_position = Vector3(0.0, game.world.height_at(0.0, 190.0), 190.0)
	await frames(4)
	var npc := game.camp_npc
	npc.mind.restore({})
	check("camp NPC has existing skinned motion", is_instance_valid(npc) and npc.get_node_or_null("ExistingExplorerVisual") is NativeMotionR2)
	var start := npc.global_position
	npc.clock = 109.9
	await frames(140)
	check("NPC walks the open inspection route on physics frames", npc.global_position.distance_to(start) > 1.0 and npc.global_position.distance_to(NativeAICampNpc.INSPECT) < start.distance_to(NativeAICampNpc.INSPECT))
	var inspect_position := npc.global_position
	npc.clock = 169.9
	await frames(120)
	check("NPC can follow the medical-front route without walking through walls", npc.global_position.distance_to(NativeAICampNpc.REST) < inspect_position.distance_to(NativeAICampNpc.REST))
	game.player.global_position = npc.global_position + Vector3(0.0, 0.0, 2.0)
	game.player.global_position.y = game.world.height_at(game.player.global_position.x, game.player.global_position.z)
	await frames(20)
	check("E interaction is range and sight limited", npc.try_interact().get("handled", false) == true)
	var talks := npc.mind.talks
	game.player.global_position = npc.global_position + Vector3(0.0, 0.0, 10.0)
	await frames(20)
	check("distant interaction is refused", npc.try_interact().get("handled", false) == false and npc.mind.talks == talks)
	game.investigated.erase("beacon")
	game.player.global_position = Vector3(0.0, game.world.height_at(0.0, 196.0), 196.0)
	game._try_investigate()
	check("visible beacon investigation enters NPC memory", game.investigated.has("beacon") and npc.mind.surveyed)
	var saved_file := FileAccess.open(game.save_path, FileAccess.READ)
	var saved_data: Variant = JSON.parse_string(saved_file.get_as_text()) if saved_file != null else {}
	check("additive NPC memory is saved in independent slot", saved_data is Dictionary and saved_data.get("camp_npc") is Dictionary and saved_data["camp_npc"].get("surveyed", false) == true)
	game.player.global_position = npc.global_position + Vector3(0.0, 0.0, 6.0)
	game.player.global_position.y = game.world.height_at(game.player.global_position.x, game.player.global_position.z)
	var camp_wall := StaticBody3D.new()
	var camp_shape := CollisionShape3D.new()
	var camp_box := BoxShape3D.new()
	camp_box.size = Vector3(6.0, 3.0, 0.5)
	camp_shape.shape = camp_box
	camp_wall.add_child(camp_shape)
	game.add_child(camp_wall)
	camp_wall.global_position = npc.global_position + Vector3(0.0, 1.4, 3.0)
	await frames(2)
	game.combat_event.emit({"phase": "start", "side": "player", "player_position": game.player.global_position})
	check("camp wall blocks witnessed player combat", not npc.mind.witnessed_combat)
	camp_wall.queue_free()
	await frames(2)
	game.combat_event.emit({"phase": "start", "side": "player", "player_position": game.player.global_position})
	check("visible player combat changes NPC purpose", npc.mind.witnessed_combat and npc.mind.purpose(npc.clock) == "avoid")
	var npc_before_remote := npc.global_position
	var enemy := game.beast
	# Main's streaming loop is disabled in this isolated fixture; load the arena
	# explicitly before asking the enemy to move or take off there.
	game.world.update_stream(enemy.home)
	await frames(4)
	check("arena has physical support before enemy movement", game.world.surface_at(enemy.home).get("ready", false) == true)
	enemy.restore({"hp": enemy.max_hp, "position": [enemy.home.x, enemy.home.y, enemy.home.z], "mode": "ground"})
	for kind in NativeEnemyR3.MOVES:
		enemy.cooldowns[kind] = enemy.clock + 5.0
	game.player.global_position = enemy.home + Vector3(0.0, 0.0, -3.5)
	game.player.global_position.y = game.world.height_at(game.player.global_position.x, game.player.global_position.z)
	await frames(25)
	check("real physics sight acquires ground target", enemy._perceived)
	enemy._decision_ready = enemy.clock
	var cue := {"phase": "windup", "shape": "line", "origin": game.player.global_position + Vector3.UP, "direction": (enemy.global_position - game.player.global_position).normalized(), "range": 12.0, "radius": 1.2, "release_remaining": 0.7}
	var accepted := enemy.observe_public_threat(cue)
	var pre_dodge := enemy.global_position
	await frames(16)
	var dodged := accepted and enemy.global_position.distance_to(pre_dodge) > 0.2 and enemy._evade_until > 0.0
	if not dodged:
		print("CUE_DIAGNOSTIC ", JSON.stringify({"accepted": accepted, "phase": enemy.phase, "mode": enemy.mode, "perceived": enemy._perceived, "returning": enemy._returning, "cue_los": enemy._line_clear(enemy.global_position + Vector3.UP * 1.25, cue["origin"]), "decision_ready": enemy._decision_ready, "aggro_until": enemy.aggro_until, "threat_serial": enemy._ai._threat_serial, "consumed_serial": enemy._ai._consumed_serial, "last_evade_at": enemy._ai._last_evade_at, "tactic": enemy.tactic, "moved": enemy.global_position.distance_to(pre_dodge), "evade_until": enemy._evade_until, "clock": enemy.clock}))
	check("visible public cue produces physical sidestep", dodged)
	enemy.restore({"hp": enemy.max_hp, "position": [enemy.home.x, enemy.home.y, enemy.home.z], "mode": "ground"})
	var wall := StaticBody3D.new()
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(8.0, 4.0, 0.6)
	shape.shape = box
	wall.add_child(shape)
	game.add_child(wall)
	wall.global_position = enemy.home + Vector3(0.0, 1.5, -1.8)
	enemy._next_sense = 0.0
	await frames(20)
	check("real wall blocks both perception and cue", not enemy._perceived and not enemy.observe_public_threat(cue))
	var remembered_before_hit := enemy._ai.last_seen
	enemy.receive_combat_hit({"damage": 10.0})
	check("covered hit does not reveal exact hidden player position", enemy._last_seen.distance_to(enemy.global_position) < 0.01 and enemy._ai.last_seen == remembered_before_hit)
	wall.queue_free()
	await frames(3)
	enemy.restore({"hp": enemy.max_hp, "position": [enemy.home.x, enemy.home.y, enemy.home.z], "mode": "ground"})
	game.player.health = 1000000.0
	game.player.global_position = enemy.home + Vector3(0.0, 8.0, -10.0)
	game.player.global_position.y = game.world.height_at(game.player.global_position.x, game.player.global_position.z) + 8.0
	game.player.flight_active = true
	await frames(240)
	var became_air := enemy.mode == "air" and enemy.global_position.y > enemy.home.y + 3.0
	if not became_air:
		print("AIR_DIAGNOSTIC ", JSON.stringify({"mode": enemy.mode, "perceived": enemy._perceived, "tactic": enemy.tactic, "enemy_y": enemy.global_position.y, "home_y": enemy.home.y, "player_y": game.player.global_position.y, "target_agl": game.player.global_position.y - game.world.height_at(game.player.global_position.x, game.player.global_position.z)}))
	check("observed airborne target changes elite to air pursuit", became_air)
	# Put the landed player where this airborne enemy can actually see the
	# descent; a hidden target should not cause an omniscient air-to-ground swap.
	game.player.global_position = Vector3(enemy.global_position.x, 0.0, enemy.global_position.z)
	game.player.global_position.y = game.world.height_at(game.player.global_position.x, game.player.global_position.z)
	game.player.flight_active = false
	await frames(25)
	var saw_landing := enemy._perceived and enemy._last_seen.y - game.world.height_at(enemy._last_seen.x, enemy._last_seen.z) < 1.0
	check("enemy actually sees the ground target", saw_landing)
	await frames(350)
	var landed := became_air and saw_landing and enemy.mode in ["ground", "landing"] and enemy.global_position.y < enemy.home.y + 1.5
	if not landed:
		print("LAND_DIAGNOSTIC ", JSON.stringify({"mode": enemy.mode, "phase": enemy.phase, "tactic": enemy.tactic, "clock": enemy.clock, "mode_since": enemy.mode_since, "perceived": enemy._perceived, "last_seen_agl": enemy._last_seen.y - game.world.height_at(enemy._last_seen.x, enemy._last_seen.z), "actual_target_agl": game.player.global_position.y - game.world.height_at(game.player.global_position.x, game.player.global_position.z), "support_ready": game.world.surface_at(enemy.global_position).get("ready", false), "enemy_y": enemy.global_position.y, "ground_y": game.world.height_at(enemy.global_position.x, enemy.global_position.z), "distance": enemy.global_position.distance_to(game.player.global_position), "returning": enemy._returning}))
	check("observed landing target returns elite to ground", landed)
	check("remote camp NPC suspends expensive offscreen motion", npc.global_position.distance_to(npc_before_remote) < 0.01)
	# The same controller remains playable without a service URL or key.
	check("offline enemy remains local and live", enemy.world == game.world and enemy.target == game.player and enemy._ai != null)
	print("NATIVE_AI_RUNTIME_VERIFY ", JSON.stringify({"passed": failures.is_empty(), "failures": failures, "npc_position": [npc.global_position.x, npc.global_position.y, npc.global_position.z]}))
	game.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
