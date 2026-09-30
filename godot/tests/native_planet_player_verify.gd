extends SceneTree

# Controlled G/C inputs with real engine physics delta and the authored world
# collision. This is not a hardware keyboard or visible-window feel test.
const SLOT := "user://star_abyss_native_planet_player_verify.json"

class PlanetClock extends Node:
	var player: NativePlayer
	var world: Node3D
	var mode := "idle"
	var axes := Vector2.ZERO
	var lift := false
	var descend := false
	var shift := false
	var frames := 0
	var elapsed := 0.0
	var min_delta := INF
	var max_delta := 0.0

	func _physics_process(delta: float) -> void:
		frames += 1
		elapsed += delta
		min_delta = minf(min_delta, delta)
		max_delta = maxf(max_delta, delta)
		if player == null or mode == "idle":
			return
		world.call("update_stream", player.global_position)
		player._sync_canonical_before_motion()
		if player.flight_active:
			player._step_flight_planet(delta, axes, lift, descend, shift, false)
		else:
			player._step_ground_planet(delta, axes, shift, false, false)
		player._sync_canonical_after_motion()


var checks: Array[Dictionary] = []
var failures: Array[String] = []
var clock: PlanetClock


func _initialize() -> void:
	call_deferred("_run")


func _check(name: String, passed: bool, detail: String = "") -> void:
	checks.append({"name": name, "pass": passed, "detail": detail})
	if not passed:
		failures.append(name + ": " + detail)


func _frames(count: int) -> void:
	var until := clock.frames + count
	while clock.frames < until:
		await physics_frame
	await process_frame


func _ready_surface(world: Node3D, scene_position: Vector3) -> Dictionary:
	for i in range(24):
		world.call("update_stream", scene_position)
		await physics_frame
		var sample: Dictionary = world.call("surface_at", scene_position)
		if sample.get("ready", false) == true:
			return sample
	return world.call("surface_at", scene_position)


func _canonical_scene(canonical: Dictionary) -> Vector3:
	return Vector3(-float(canonical["z"]), float(canonical["x"]) - 120000.0, -float(canonical["y"]))


func _run() -> void:
	var game := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = SLOT
	root.add_child(game)
	await physics_frame
	await physics_frame
	game.set_physics_process(false)
	game.beast.set_physics_process(false)
	var player := game.player as NativePlayer
	var world := game.world as Node3D
	player.set_physics_process(false)
	_check("world exposes real planet collision API", world.get("planet_enabled") == true and world.has_method("surface_at") and world.has_method("sweep"))
	if checks[0].pass != true:
		await _finish(game)
		return
	clock = PlanetClock.new()
	clock.player = player
	clock.world = world
	root.add_child(clock)

	var home: Dictionary = await _ready_surface(world, Vector3(0.0, 0.0, 190.0))
	_check("basin surface is rendered and collidable", home.get("ready", false) == true, str(home))
	if home.get("ready", false) == true:
		var teleported := player.teleport_to_surface(home["point"])
		_check("player can stand on actual basin surface", teleported and player.global_position.distance_to(home["point"]) < 0.1, str(player.global_position))
		player.energy = 100.0
		var launched := player._try_takeoff(true, false)
		_check("G launches from physical planet ground", launched and player.flight_active, str(player.global_position))
		if launched:
			clock.mode = "auto"
			clock.lift = true
			await _frames(90)
			var above: Dictionary = world.call("surface_at", player.global_position)
			_check("G climbs with radial up", above.get("ready", false) == true and float(above.get("agl", 0.0)) > 2.0, str(above))
			clock.lift = false
			clock.descend = true
			for i in range(240):
				await _frames(1)
				if not player.flight_active:
					break
			var landed: Dictionary = world.call("surface_at", player.global_position)
			_check("C returns to physical ground", not player.flight_active and landed.get("ready", false) == true and absf(float(landed.get("agl", INF))) < 0.2, str(landed))
			clock.mode = "idle"

	var locations := {
		"past old square edge": Vector3(3400.0, -48.0, 200.0),
		"north polar region": _canonical_scene(NativePlanetCoordinates.to_cartesian(deg_to_rad(88.0), 0.3)),
		"back hemisphere": _canonical_scene(NativePlanetCoordinates.to_cartesian(0.15, PI))
	}
	for label: String in locations:
		var sample: Dictionary = await _ready_surface(world, locations[label])
		_check(label + " has physical terrain", sample.get("ready", false) == true, str(sample))
		if sample.get("ready", false) != true:
			continue
		var up: Vector3 = world.call("up_at", sample["point"])
		var target: Vector3 = sample["point"] + up * (maxf(0.0, float(sample.get("water_depth", 0.0))) + 100.0)
		await _ready_surface(world, target)
		var saved_player: Dictionary = player.snapshot()
		saved_player["flight_active"] = true
		var planet_data := {"version": NativePlanetCoordinates.PLANET_VERSION, "id": NativePlanetCoordinates.PLANET_ID,
			"seed": NativePlanetCoordinates.PLANET_SEED, "radius": NativePlanetCoordinates.DEFAULT_RADIUS,
			"position": player._canonical_from_scene(target), "forward": NativePlanetCoordinates.point(0.0, 0.0, -1.0),
			"velocity": NativePlanetCoordinates.point(0.0, 0.0, 0.0)}
		var rebuilt: Vector3 = player._scene_from_canonical(planet_data.position)
		var target_support: Dictionary = world.call("surface_at", rebuilt)
		var destination_clear := player._destination_clear(rebuilt)
		var restored := player.restore_canonical(saved_player, planet_data)
		var actual: Dictionary = player.snapshot_canonical()
		var actual_position: Dictionary = actual.get("position", {})
		var error := NativePlanetCoordinates.length(NativePlanetCoordinates.subtract(actual_position, planet_data.position)) if NativePlanetCoordinates.valid(actual_position) else INF
		_check(label + " restores canonical flight pose", restored and error < 0.25 and player.global_transform.basis.y.dot(up) > 0.999, "error=" + str(error) + " pose=" + str(player.global_position) + " support=" + str(target_support) + " clear=" + str(destination_clear))
		if float(sample.get("water_depth", 0.0)) > 500.0:
			var submerged := planet_data.duplicate(true)
			submerged["position"] = player._canonical_from_scene(sample["point"] + up * 100.0)
			var before_reject := player.global_position
			var rejected := not player.restore_canonical(saved_player, submerged)
			_check(label + " rejects submerged flight restore atomically", rejected and player.global_position.distance_to(before_reject) < 0.01)
			clock.descend = true
			clock.mode = "auto"
			await _frames(420)
			clock.mode = "idle"
			clock.descend = false
			var at_water: Dictionary = world.call("surface_at", player.global_position)
			var above_water := float(at_water.get("agl", -INF)) - float(at_water.get("water_depth", INF))
			_check(label + " C descent stops above ocean surface", player.flight_active and at_water.get("ready", false) == true and above_water >= NativePlayer.FLIGHT_CLEARANCE - 0.05 and above_water < 5.0,
				"margin=" + str(above_water) + " position=" + str(player.global_position))
			# Retain the original 420-frame time budget. Continue the same input to
			# distinguish a slow final approach from a five-metre steady hover.
			clock.descend = true
			clock.mode = "auto"
			await _frames(420)
			clock.mode = "idle"
			clock.descend = false
			var settled_water: Dictionary = world.call("surface_at", player.global_position)
			var settled_margin := float(settled_water.get("agl", -INF)) - float(settled_water.get("water_depth", INF))
			_check(label + " continued C converges to safe sea clearance", player.flight_active and settled_water.get("ready", false) == true and settled_margin >= NativePlayer.FLIGHT_CLEARANCE - 0.05 and settled_margin <= 1.0,
				"margin=" + str(settled_margin) + " position=" + str(player.global_position))

	_check("planet flight ceiling reaches orbit", player.flight_ceiling() >= 180000.0 and player.planet_orbit_blend(10000.0) > 0.99)
	_check("engine supplied real physics delta", clock.min_delta > 0.0 and clock.max_delta < 0.05 and clock.elapsed > 1.0, "range=" + str(clock.min_delta) + ".." + str(clock.max_delta))
	await _finish(game)


func _finish(game: NativeMain) -> void:
	var timing := {"physics_frames": clock.frames if clock != null else 0, "elapsed_delta": clock.elapsed if clock != null else 0.0,
		"min_delta": clock.min_delta if clock != null else 0.0, "max_delta": clock.max_delta if clock != null else 0.0}
	if clock != null:
		clock.queue_free()
	game.initialized = false
	game.queue_free()
	await process_frame
	if FileAccess.file_exists(SLOT):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SLOT))
	print("NATIVE_PLANET_PLAYER_JSON=" + JSON.stringify({"total": checks.size(), "passed": checks.size() - failures.size(), "failures": failures, "checks": checks, "timing": timing}))
	quit(0 if failures.is_empty() else 1)
