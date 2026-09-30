extends SceneTree

const SLOT := "user://star_abyss_native_planet_doorway_verify.json"

class GroundClock extends Node:
	var player: NativePlayer
	var frames := 0
	var elapsed := 0.0
	var min_delta := INF
	var max_delta := 0.0

	func _physics_process(delta: float) -> void:
		frames += 1
		elapsed += delta
		min_delta = minf(min_delta, delta)
		max_delta = maxf(max_delta, delta)
		player._step_ground_planet(delta, Vector2(0.0, 1.0), false, false, false)


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var game := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = SLOT
	root.add_child(game)
	await physics_frame
	await physics_frame
	game.set_physics_process(false)
	game.beast.set_physics_process(false)
	var player := game.player as NativePlayer
	player.set_physics_process(false)
	var teleported := player.teleport_to_ground(-17.0, 180.0)
	game.world.update_stream(player.global_position)
	player.rotation.y = 0.0
	var clock := GroundClock.new()
	clock.player = player
	root.add_child(clock)
	while clock.frames < 90:
		await physics_frame
	await process_frame
	var passed := teleported and player.global_position.z < 173.0 and absf(player.global_position.x + 17.0) < 0.5 and player.global_position.y > 0.65
	var floor_samples: Array[Dictionary] = []
	for z in [180.0, 179.5, 179.0, 178.5, 178.0, 177.5, 177.0]:
		floor_samples.append({"z": z, "terrain": game.world.height_at(-17.0, z), "support": player._support_at(-17.0, z, 2.0)})
	var result := {"passed": passed, "teleported": teleported, "position": str(player.global_position),
		"physics_frames": clock.frames, "elapsed_delta": clock.elapsed, "min_delta": clock.min_delta, "max_delta": clock.max_delta, "floor_samples": floor_samples}
	clock.queue_free()
	game.initialized = false
	game.queue_free()
	await process_frame
	if FileAccess.file_exists(SLOT):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SLOT))
	print("NATIVE_PLANET_DOORWAY_JSON=" + JSON.stringify(result))
	quit(0 if passed else 1)
