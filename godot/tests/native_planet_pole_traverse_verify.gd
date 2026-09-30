extends SceneTree

# Fixture starts 0.01° from the north pole; normal Main/Player physics then
# carries a tangent flight across the pole and cube-face seam.
const SLOT := "user://star_abyss_native_planet_pole_traverse_verify.json"

var checks: Array[Dictionary] = []
var failures: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _check(name: String, passed: bool, detail: String = "") -> void:
	checks.append({"name": name, "pass": passed, "detail": detail})
	if not passed:
		failures.append(name + ": " + detail)


func _scene(canonical: Dictionary) -> Vector3:
	return Vector3(-float(canonical["z"]), float(canonical["x"]) - 120000.0, -float(canonical["y"]))


func _run() -> void:
	var game := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = SLOT
	root.add_child(game)
	await physics_frame
	await physics_frame
	game.set_physics_process(false)
	var player := game.player as NativePlayer
	var world := game.world as NativeWorld
	var lat := deg_to_rad(89.99)
	var lon := 0.3
	var scene_probe := _scene(NativePlanetCoordinates.to_cartesian(lat, lon, 100.0))
	var sample: Dictionary = {}
	for i in range(24):
		world.update_stream(scene_probe)
		await physics_frame
		sample = world.surface_at(scene_probe)
		if sample.get("ready", false) == true:
			break
	_check("north polar flight footprint has collidable tile", sample.get("ready", false) == true, str(sample))
	if checks[0].pass == true:
		var up := world.up_at(scene_probe)
		var target: Vector3 = sample["point"] + up * (float(sample.get("water_depth", 0.0)) + 100.0)
		for i in range(24):
			world.update_stream(target)
			await physics_frame
			if world.surface_at(target).get("ready", false) == true:
				break
		var frame := NativePlanetCoordinates.tangent_frame(lat, lon)
		var north: Dictionary = NativePlanetCoordinates.scale(frame["south"], -500.0)
		var saved_player: Dictionary = player.snapshot()
		saved_player["flight_active"] = true
		saved_player["energy"] = 100.0
		var planet_data := {"version": NativePlanetCoordinates.PLANET_VERSION, "id": NativePlanetCoordinates.PLANET_ID,
			"seed": NativePlanetCoordinates.PLANET_SEED, "radius": NativePlanetCoordinates.DEFAULT_RADIUS,
			"position": player._canonical_from_scene(target), "forward": NativePlanetCoordinates.unit(north), "velocity": north}
		var restored := player.restore_canonical(saved_player, planet_data)
		_check("polar tangent flight pose restores", restored, str(player.global_position))
		var first_geo: Dictionary = NativePlanetCoordinates.to_geodetic(player.snapshot_canonical().get("position", {}))
		var final_geo := first_geo
		var unready := 0
		var min_agl := INF
		var min_up_dot := 1.0
		var progress: Array[Dictionary] = []
		game.set_physics_process(true)
		for i in range(42):
			await physics_frame
			var support: Dictionary = world.surface_at(player.global_position)
			if support.get("ready", false) != true:
				unready += 1
			else:
				min_agl = minf(min_agl, float(support["agl"]))
			min_up_dot = minf(min_up_dot, player.global_transform.basis.y.dot(world.up_at(player.global_position)))
			final_geo = NativePlanetCoordinates.to_geodetic(player.snapshot_canonical().get("position", {}))
			if i < 8 or i == 41:
				progress.append({"frame": i, "lat": final_geo.get("lat"), "lon": final_geo.get("lon"), "speed": player.velocity.length(), "flight": player.flight_active})
		var lon_shift := absf(wrapf(float(final_geo.get("lon", 0.0)) - float(first_geo.get("lon", 0.0)), -PI, PI))
		_check("automatic physics crosses north pole and face seam", float(final_geo.get("lat", 0.0)) < float(first_geo.get("lat", 0.0)) - 0.0002 and lon_shift > 2.0 and unready == 0 and min_agl > 0.4 and min_up_dot > 0.999,
			"start=" + str(first_geo) + " end=" + str(final_geo) + " lon_shift=" + str(lon_shift) + " unready=" + str(unready) + " min_agl=" + str(min_agl) + " min_up=" + str(min_up_dot) + " progress=" + str(progress))
	game.initialized = false
	game.queue_free()
	await process_frame
	if FileAccess.file_exists(SLOT):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SLOT))
	print("NATIVE_PLANET_POLE_TRAVERSE_JSON=" + JSON.stringify({"total": checks.size(), "passed": checks.size() - failures.size(), "failures": failures, "checks": checks}))
	quit(0 if failures.is_empty() else 1)
