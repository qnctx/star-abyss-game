extends SceneTree

class PhysicsSamples extends Node:
	var elapsed := 0.0
	var deltas: Array[float] = []
	var valid := true
	func _physics_process(delta: float) -> void:
		elapsed += delta
		deltas.append(delta)
		valid = valid and Engine.is_in_physics_frame()

var checks: Array[Dictionary] = []
var events: Array[Dictionary] = []
var phases: Array[Dictionary] = []
var samples: PhysicsSamples
var game: NativeMain
var beast: NativeRiftwing
var player: NativePlayer

func _initialize() -> void:
	call_deferred("_run")

func _check(label: String, passed: bool, detail: Variant = null) -> void:
	checks.append({"name": label, "pass": passed, "detail": detail})
	if not passed:
		printerr("FAIL ", label, " ", detail)

func _wait(seconds: float) -> void:
	var until := samples.elapsed + seconds
	while samples.elapsed < until:
		await physics_frame

func _place(offset: Vector3) -> void:
	player.global_position = beast.home + offset
	player.global_position.y = game.world.height_at(player.global_position.x, player.global_position.z) + offset.y
	player.health = 1000000.0
	player.flight_active = offset.y > 0.2

func _reset() -> void:
	beast.restore({"hp": NativeRiftwing.MAX_HP, "position": [beast.home.x, beast.home.y, beast.home.z], "mode": "ground"})
	beast.rotation.y = 0.0
	beast._next_sense = 0.0
	beast.aggro_until = 0.0
	beast._decision_ready = 0.0
	beast._last_attack_result = -1
	events.clear()
	phases.clear()

func _on_attack(event: Dictionary) -> void:
	var copy := event.duplicate()
	copy.erase("enemy")
	copy["physics_frame"] = Engine.is_in_physics_frame()
	copy["observed_time"] = samples.elapsed
	events.append(copy)

func _on_phase(event: Dictionary) -> void:
	var copy := event.duplicate()
	copy.erase("enemy")
	copy["observed_time"] = samples.elapsed
	phases.append(copy)

func _run() -> void:
	game = (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = "user://enemy_r3_owned_test_only.json"
	root.add_child(game)
	game.initialized = false
	game.set_physics_process(false)
	game.set_process(false)
	player = game.player
	player.set_physics_process(false)
	game.ascension.set_physics_process(false)
	beast = game.beast
	for connection in beast.enemy_attack_requested.get_connections():
		beast.enemy_attack_requested.disconnect(connection.callable)
	beast.enemy_attack_requested.connect(_on_attack)
	beast.enemy_skill_event.connect(_on_phase)
	samples = PhysicsSamples.new()
	root.add_child(samples)
	await _wait(0.1)
	_reset()
	_place(Vector3(0.0, 0.0, -2.2))
	await _wait(0.25)
	_check("autonomous claw has a visible windup", beast.phase == "windup" and events.is_empty(), beast.get_combat_snapshot())
	var committed := beast._locked_direction
	_place(Vector3(6.0, 0.0, -2.2))
	await _wait(0.5)
	_check("committed attack does not read new target position", beast._locked_direction.distance_to(committed) < 0.001)
	_check("one request from a real bone on a real physics frame", events.size() == 1 and bool(events[0]["physics_frame"]) and (events[0]["origin"] as Vector3).is_finite(), events)
	if not events.is_empty() and not phases.is_empty():
		_check("no damage request before advertised windup", float(events[0]["observed_time"]) - float(phases[0]["observed_time"]) >= 0.475)
	await _wait(0.3)
	_check("attack recovery leaves a counter window", beast.phase == "recovery", beast.phase)
	_reset()
	_place(Vector3(0.0, 0.0, -2.2))
	await _wait(0.2)
	var outcome := beast.receive_combat_hit({"damage": 1000.0, "stagger": 0.6, "hitstop": 0.05, "knockback": Vector3(2, 0, 0)})
	await _wait(0.5)
	_check("player hit cancels the pending enemy contact", outcome["interrupted"] and events.is_empty() and beast.hp == NativeRiftwing.MAX_HP - 1000.0, beast.get_combat_snapshot())
	_check("knockback moves physical root", beast.global_position.x > beast.home.x + 0.02, beast.global_position)
	_reset()
	_place(Vector3(0.0, 8.0, -10.0))
	await _wait(4.0)
	_check("elite follows actual height into air", beast.mode == "air" and beast.global_position.y > beast.home.y + 3.0, beast.get_combat_snapshot())
	_place(Vector3(0.0, 0.0, -30.0))
	await _wait(4.0)
	_check("airborne enemy returns to ground on player landing", beast.mode in ["ground", "landing"] and beast.global_position.y < beast.home.y + 1.5, beast.get_combat_snapshot())
	_reset()
	_place(Vector3(0.0, 0.0, -200.0))
	beast.global_position = beast.home + Vector3(8.0, 0.0, 0.0)
	beast.global_position.y = game.world.height_at(beast.global_position.x, beast.global_position.z)
	beast.hp -= 1234.0
	await _wait(3.0)
	_check("leash returns home without erasing player damage", beast.global_position.distance_to(beast.home) < 0.8 and beast.hp == NativeRiftwing.MAX_HP - 1234.0, beast.get_combat_snapshot())
	_reset()
	_place(Vector3(0.0, 0.0, -6.0))
	var wall := StaticBody3D.new()
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(14.0, 6.0, 0.6)
	shape.shape = box
	wall.add_child(shape)
	game.add_child(wall)
	wall.global_position = beast.home + Vector3(0, 2.0, -3.0)
	await _wait(0.5)
	_check("real wall occludes perception", not beast._perceived and events.is_empty())
	beast._last_seen = player.global_position
	beast.aggro_until = beast.clock + 2.0
	await _wait(1.0)
	_check("world collision prevents pursuit through wall", beast.global_position.z > wall.global_position.z + 0.5, beast.global_position)
	wall.queue_free()
	await _wait(0.1)
	# Each authored skill advances through the real engine callback. Only its
	# starting fixture is explicit; no private simulation step is called.
	for skill in ["claw", "lunge", "tail", "rise", "shard", "sweep", "dive"]:
		_reset()
		var offset: Vector3 = {"claw": Vector3(0, 0, -1.85), "lunge": Vector3(0, 0, -5.0), "tail": Vector3(0, 0, 1.6), "rise": Vector3(0, 2.5, -2.3), "shard": Vector3(0, 0, -16), "sweep": Vector3(1.4, 7.0, -1.0), "dive": Vector3(0, 4.0, -5.0)}[skill]
		_place(offset)
		if skill in ["sweep", "dive"]:
			beast.mode = "air"
			beast.global_position.y = beast.home.y + 7.0
		beast._last_seen = player.global_position
		beast.aggro_until = beast.clock + 30.0
		beast._next_sense = beast.clock + 30.0
		beast._decision_ready = beast.clock + 30.0
		beast._attack(skill)
		var rule: Dictionary = NativeEnemyR3.MOVES[skill]
		await _wait(float(rule["windup"]) + float(rule["active"]) + (0.85 if skill == "shard" else 0.15))
		_check(skill + " has one actual contact request", events.size() == 1, events)
		if not events.is_empty():
			var event: Dictionary = events[0].duplicate()
			event["enemy"] = beast
			var before_hp := player.health
			# The real Main bridge must accept the emitted bone/trajectory geometry.
			game._on_enemy_attack_requested(event)
			_check(skill + " reaches a plausible target through Main", player.health < before_hp, {"source": event["origin"], "player": player.global_position})
		beast._clear_shot()
	var drops := [0]
	beast.defeated.connect(func(): drops[0] += 1)
	beast.receive_combat_hit({"damage": 999999.0})
	beast.receive_combat_hit({"damage": 999999.0})
	var saved := beast.snapshot()
	beast.restore(saved)
	_check("death is once, old save persists corpse and loot", drops[0] == 1 and beast.mode == "dead" and beast.loot_left == 2 and beast.hp == 0.0, saved)
	_check("all samples use actual normal physics delta", samples.valid and samples.deltas.size() > 100 and samples.deltas.min() > 0.0 and Engine.time_scale == 1.0, {"samples": samples.deltas.size(), "minimum": samples.deltas.min(), "maximum": samples.deltas.max(), "sum": samples.elapsed})
	var failed := checks.filter(func(item: Dictionary) -> bool: return not item.pass)
	var report := {"checks": checks, "passed": checks.size() - failed.size(), "total": checks.size(), "deltas": samples.deltas, "manual_feel_verified": false}
	DirAccess.make_dir_recursive_absolute("res://reports/enemy-r3")
	var output := FileAccess.open("res://reports/enemy-r3/physics-report.json", FileAccess.WRITE)
	output.store_string(JSON.stringify(report, "\t"))
	output.close()
	print("ENEMY_R3_VERIFY ", JSON.stringify({"passed": checks.size() - failed.size(), "total": checks.size(), "failed": failed}))
	game.initialized = false
	game.queue_free()
	await process_frame
	quit(0 if failed.is_empty() else 1)
