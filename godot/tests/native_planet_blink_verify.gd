extends SceneTree

## Controlled stationary cast fixture using real streamed basin/planet collision.
## Player physics is paused so ordinary flight drift cannot cancel prefetch.
var failures: Array[String] = []
var checks := 0
var resolved: Array[Dictionary] = []

func _initialize() -> void:
	call_deferred("_run")

func _check(name: String, passed: bool) -> void:
	checks += 1
	print(("PASS: " if passed else "FAIL: ") + name)
	if not passed:
		failures.append(name)

func _on_resolved(result: Dictionary) -> void:
	resolved.append(result)

func _cast_and_wait(ascension: NativeAscension, mode := "long") -> Dictionary:
	resolved.clear()
	var result: Dictionary = ascension.try_blink(mode)
	if result.get("pending", false) != true:
		return result
	for i in range(300):
		await physics_frame
		if not resolved.is_empty():
			return resolved[-1]
	return {"ok": false, "reason": "预加载超过300物理帧"}

func _run() -> void:
	var main := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	main.save_path = "user://star_abyss_planet_blink_verify_%d.json" % Time.get_ticks_usec()
	var slot := main.save_path
	root.add_child(main)
	for i in range(5):
		await physics_frame
	main.player.set_physics_process(false)
	main.ascension.blink_resolved.connect(_on_resolved)
	main.player.realm = 9
	main.player.energy = 100.0
	main.player.flight_active = true
	main.player.velocity = Vector3.ZERO
	main.player.global_position = Vector3(0.0, main.world.height_at(0.0, 0.0) + 500.0, 0.0)
	main.player.rotation.y = PI
	main.world.update_stream(main.player.global_position)
	main.ascension.cooldown_until = main.ascension.ability_time
	var before := main.player.global_position
	var first: Dictionary = await _cast_and_wait(main.ascension)
	_check("R9 long blink prefetches real basin collision and commits", first.get("ok", false) == true and absf(main.player.global_position.distance_to(before) - 1800.0) < 1.0 and absf(main.player.energy - 75.0) < 0.01)
	main.player.global_position = Vector3(0.0, main.world.height_at(0.0, 0.0) + 500.0, 0.0)
	main.player.rotation.y = 0.0
	main.player.energy = 100.0
	main.ascension.cooldown_until = main.ascension.ability_time
	resolved.clear()
	var pending: Dictionary = main.ascension.try_blink("long")
	if pending.get("pending", false) == true:
		main.player.global_position += Vector3.RIGHT
		await physics_frame
	_check("moving during route preparation cancels without energy cost", pending.get("pending", false) == true and not resolved.is_empty() and resolved[-1].get("ok", true) == false and main.ascension.get("_pending_blink").is_empty() and absf(main.player.energy - 100.0) < 0.01)
	main.player.global_position = Vector3(2890.0, main.world.height_at(2890.0, 0.0) + 500.0, 0.0)
	main.player.rotation.y = -PI * 0.5
	main.player.energy = 100.0
	main.ascension.cooldown_until = main.ascension.ability_time
	main.world.update_stream(main.player.global_position)
	var second: Dictionary = await _cast_and_wait(main.ascension)
	_check("R9 blink crosses old 3km edge onto collidable planet", second.get("ok", false) == true and main.player.global_position.x > 3000.0 and absf(main.player.energy - 75.0) < 0.01)
	var remote_canonical: Dictionary = NativePlanetCoordinates.to_cartesian(0.0, 17000.0 / NativePlanetCoordinates.DEFAULT_RADIUS)
	var remote_rough: Vector3 = NativePlanetCoordinates.canonical_to_local(remote_canonical, NativePlanetCoordinates.tangent_frame())
	main.player.global_position = remote_rough + main.world.up_at(remote_rough) * 10.0
	var remote_surface: Dictionary = {}
	for i in range(360):
		main.world.update_stream(remote_rough)
		remote_surface = main.world.surface_at(remote_rough)
		if remote_surface.get("ready", false) == true:
			break
		await physics_frame
	_check("remote ground blink origin has a real dry collider", remote_surface.get("ready", false) == true and float(remote_surface.get("water_depth", INF)) <= 0.15)
	if remote_surface.get("ready", false) == true and float(remote_surface.get("water_depth", INF)) <= 0.15:
		var ground_start: Vector3 = remote_surface["point"]
		var up: Vector3 = main.world.up_at(ground_start)
		main.player.global_position = ground_start
		main.player.global_basis = Basis.looking_at(Vector3.RIGHT.slide(up).normalized(), up)
		main.player.realm = 6
		main.player.flight_active = false
		main.player.energy = 100.0
		main.player.velocity = Vector3.ZERO
		main.ascension.cooldown_until = main.ascension.ability_time
		var ground_cast: Dictionary = await _cast_and_wait(main.ascension, "short")
		_check("R6 ground blink uses real remote terrain without self-blocking", ground_cast.get("ok", false) == true and main.player.global_position.distance_to(ground_start) > 11.0 and absf(main.player.energy - 88.0) < 0.01)
		var terrain_sweep: Dictionary = main.world.sweep(ground_start + up * 8.0, ground_start - up * 4.0, 0.42, 1.72)
		var terrain_preview: Dictionary = main.ascension._preview(ground_start + up * 8.0, -up, 12.0)
		_check("air blink into collidable planet terrain is rejected", terrain_sweep.get("ready", false) == true and terrain_sweep.get("clear", true) == false and terrain_preview.get("ok", true) == false)
	main.initialized = false
	main.queue_free()
	await process_frame
	DirAccess.remove_absolute(ProjectSettings.globalize_path(slot))
	print(JSON.stringify({"passed": checks - failures.size(), "total": checks, "failed": failures}))
	quit(0 if failures.is_empty() else 1)
