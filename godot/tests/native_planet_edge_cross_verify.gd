extends SceneTree

# Normal Main/Player physics carries a saved in-flight tangent velocity across
# the former x=3000 square edge. No movement method is called by this script.
const SLOT := "user://star_abyss_native_planet_edge_cross_verify.json"

var checks: Array[Dictionary] = []
var failures: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _check(name: String, passed: bool, detail: String = "") -> void:
	checks.append({"name": name, "pass": passed, "detail": detail})
	if not passed:
		failures.append(name + ": " + detail)


func _run() -> void:
	var game := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = SLOT
	root.add_child(game)
	await physics_frame
	await physics_frame
	# Hold only Main's streamer while the remote fixture loads. Re-enable it
	# before observing movement across the edge.
	game.set_physics_process(false)
	var player := game.player as NativePlayer
	var world := game.world as NativeWorld
	var start := Vector3(2995.0, 100.0, 0.0)
	var sample: Dictionary = {}
	for i in range(20):
		world.update_stream(start)
		await physics_frame
		sample = world.surface_at(start)
		if sample.get("ready", false) == true:
			break
	_check("former square-edge start has real collision", sample.get("ready", false) == true, str(sample))
	if checks[0].pass == true:
		var up := world.up_at(sample["point"])
		var target: Vector3 = sample["point"] + up * 100.0
		for i in range(20):
			world.update_stream(target)
			await physics_frame
			if world.surface_at(target).get("ready", false) == true:
				break
		var saved_player: Dictionary = player.snapshot()
		saved_player["flight_active"] = true
		saved_player["energy"] = 100.0
		var planet_data := {"version": NativePlanetCoordinates.PLANET_VERSION, "id": NativePlanetCoordinates.PLANET_ID,
			"seed": NativePlanetCoordinates.PLANET_SEED, "radius": NativePlanetCoordinates.DEFAULT_RADIUS,
			"position": player._canonical_from_scene(target), "forward": NativePlanetCoordinates.point(0.0, 0.0, -1.0),
			"velocity": NativePlanetCoordinates.point(0.0, 0.0, -100.0)}
		var restored := player.restore_canonical(saved_player, planet_data)
		_check("safe in-flight pose restores before old edge", restored and player.global_position.x < 3000.0, str(player.global_position))
		game.set_physics_process(true)
		var max_x := player.global_position.x
		var min_agl := INF
		var unready := 0
		for i in range(36):
			await physics_frame
			var s: Dictionary = world.surface_at(player.global_position)
			max_x = maxf(max_x, player.global_position.x)
			if s.get("ready", false) == true:
				min_agl = minf(min_agl, float(s["agl"]))
			else:
				unready += 1
		_check("normal physics crosses former x=3000 boundary", max_x > 3002.0 and unready == 0 and min_agl > 0.4, "max_x=" + str(max_x) + " min_agl=" + str(min_agl) + " unready=" + str(unready))
	game.initialized = false
	game.queue_free()
	await process_frame
	if FileAccess.file_exists(SLOT):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SLOT))
	print("NATIVE_PLANET_EDGE_CROSS_JSON=" + JSON.stringify({"total": checks.size(), "passed": checks.size() - failures.size(), "failures": failures, "checks": checks}))
	quit(0 if failures.is_empty() else 1)
