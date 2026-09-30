extends SceneTree

# Real NativeMain combat timers and collision, advanced at 60 Hz against an
# isolated save. The beast's autonomous AI is frozen so the same attack and
# interruption sequence can be repeated without changing its combat rules.
const SLOT := "user://star_abyss_native_combat_flow_verify.json"
const DT := 1.0 / 60.0
var checks: Array[Dictionary] = []
var physics_context_ok := true


func _initialize() -> void:
	call_deferred("_run")


func _check(name: String, passed: bool, detail := "") -> void:
	checks.append({"name": name, "pass": passed, "detail": detail})
	if not passed:
		printerr("FAIL " + name + " " + detail)


func _ground_frame(game: NativeMain, axes := Vector2.ZERO, sprint := false) -> void:
	await physics_frame
	physics_context_ok = physics_context_ok and Engine.is_in_physics_frame()
	var player := game.player
	player._hurt_time = maxf(0.0, player._hurt_time - DT)
	player._step_ground(DT, axes, sprint, false)
	player._update_visual(DT)
	game._physics_process(DT)


func _air_frame(game: NativeMain) -> void:
	await physics_frame
	physics_context_ok = physics_context_ok and Engine.is_in_physics_frame()
	var player := game.player
	player._hurt_time = maxf(0.0, player._hurt_time - DT)
	player._update_visual(DT)
	game._physics_process(DT)


func _run() -> void:
	var previous_ticks := Engine.physics_ticks_per_second
	Engine.physics_ticks_per_second = 60
	if FileAccess.file_exists(SLOT):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SLOT))
	var game := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = SLOT
	root.add_child(game)
	for i in range(4):
		await physics_frame
	game.set_physics_process(false)
	game.player.set_physics_process(false)
	game.beast.set_physics_process(false)
	for enemy in game.enemies:
		enemy.set_physics_process(false)
	game.ascension.set_physics_process(false)
	var player := game.player
	var beast := game.beast
	var r2 := player._r2

	# Starting from a sprint must not carry 10 m/s through a planted strike.
	for case in [
		{"index": 0, "duration": 0.42, "min_move": 0.35, "max_move": 0.44, "name": "jab"},
		{"index": 1, "duration": 0.50, "min_move": 0.30, "max_move": 0.41, "name": "cross"},
		{"index": 2, "duration": 0.68, "min_move": 0.0, "max_move": 0.07, "name": "kick"},
	]:
		player.teleport_to_ground(0.0, 190.0)
		player.velocity = Vector3(0.0, 0.0, -10.0)
		player.horizontal_speed = 10.0
		game.attack_ready = 0.0
		game.combo = int(case["index"])
		game.combo_expires_at = INF
		var origin := player.global_position
		game._try_attack()
		var started := player._attack_name != "" and game.pending_contact > 0.0
		for i in range(ceili(float(case["duration"]) / DT)):
			await _ground_frame(game, Vector2(0.0, 1.0), true)
		var moved := Vector2(player.global_position.x - origin.x, player.global_position.z - origin.z).length()
		_check("sprint into " + String(case["name"]) + " uses its bounded physical footwork", started and moved >= float(case["min_move"]) and moved <= float(case["max_move"]), "moved=" + str(moved))
		_check(String(case["name"]) + " miss adds no hitstop", player._visual_hitstop <= 0.0001)
	var wall := StaticBody3D.new()
	wall.collision_layer = 1
	wall.collision_mask = 0
	var wall_shape := CollisionShape3D.new()
	var wall_box := BoxShape3D.new()
	wall_box.size = Vector3(4.0, 3.0, 1.0)
	wall_shape.shape = wall_box
	wall.add_child(wall_shape)
	game.add_child(wall)
	wall.global_position = Vector3(0.0, 1.5, 189.0)
	await physics_frame
	player.teleport_to_ground(0.0, 190.0)
	player.rotation.y = 0.0
	game.attack_ready = 0.0
	game.combo = 0
	game.combo_expires_at = -1.0
	game._try_attack()
	var wall_attack_started := game.pending_contact > 0.0
	for frame in range(18):
		await _ground_frame(game)
	_check("jab's physical step stops at a real wall", wall_attack_started and player.global_position.z >= 189.9, "z=" + str(player.global_position.z))
	wall.queue_free()
	await physics_frame

	# The R3 authored torso lean and physical lead-foot step extend the visible
	# hand. Check both sides of the resulting contact boundary using the bone.
	beast.hp = NativeRiftwing.MAX_HP
	player.teleport_to_ground(beast.global_position.x, beast.global_position.z + 2.6)
	player.rotation.y = 0.0
	game.attack_ready = 0.0
	game.combo = 0
	game.combo_expires_at = -1.0
	game._try_attack()
	var distant_gap := INF
	for frame in range(26):
		var before_contact := game.pending_contact
		await _ground_frame(game)
		if before_contact >= 0.0 and game.pending_contact < 0.0:
			distant_gap = beast.body_contact_distance(player.attack_contact_point_world(0))
	_check("2.6 m jab misses outside glove reach", absf(beast.hp - NativeRiftwing.MAX_HP) < 0.01 and player._visual_hitstop <= 0.0001)
	_check("2.6 m authored hand stays outside the body", distant_gap > 0.24, "gap=" + str(distant_gap))

	player.teleport_to_ground(beast.global_position.x, beast.global_position.z + 2.3)
	player.rotation.y = 0.0
	game.attack_ready = 0.0
	game.combo = 0
	game.combo_expires_at = -1.0
	game._try_attack()
	var boundary_gap := INF
	for frame in range(26):
		var before_contact := game.pending_contact
		await _ground_frame(game)
		if before_contact >= 0.0 and game.pending_contact < 0.0:
			boundary_gap = beast.body_contact_distance(player.attack_contact_point_world(0))
	_check("2.3 m jab connects where the new visible glove reaches", absf(beast.hp - (NativeRiftwing.MAX_HP - 16500.0)) < 0.01 and boundary_gap <= 0.24, "gap=" + str(boundary_gap) + " hp=" + str(beast.hp))

	# Input just before each recovery window should queue exactly one next hit.
	beast.restore({"hp": NativeRiftwing.MAX_HP, "mode": "ground", "position": [beast.global_position.x, beast.global_position.y, beast.global_position.z], "loot_left": 0})
	player.teleport_to_ground(beast.global_position.x, beast.global_position.z + 2.0)
	player.rotation.y = 0.0
	game.attack_ready = 0.0
	game.combo = 0
	game.combo_expires_at = -1.0
	game._try_attack()
	var first_serial := player._attack_serial
	var queued_cross := false
	var queued_kick := false
	var saw_cross := false
	var saw_kick := false
	var saw_hitstop := false
	var first_jab_gap := INF
	for frame in range(100):
		if not queued_cross and game.pending_combo == 0 and game.attack_ready > 0.0 and game.attack_ready <= 0.12:
			game._try_attack()
			queued_cross = game.queued_attack
		if saw_cross and not queued_kick and game.pending_combo == 1 and game.attack_ready > 0.0 and game.attack_ready <= 0.12:
			game._try_attack()
			queued_kick = game.queued_attack
		var before_contact := game.pending_contact
		await _ground_frame(game)
		if game.pending_combo == 0 and before_contact >= 0.0 and game.pending_contact < 0.0:
			first_jab_gap = beast.body_contact_distance(player.attack_contact_point_world(0))
		saw_cross = saw_cross or game.pending_combo == 1 and player._attack_serial == first_serial + 1
		saw_kick = saw_kick or game.pending_combo == 2 and player._attack_serial == first_serial + 2
		saw_hitstop = saw_hitstop or player._visual_hitstop > 0.0
		if saw_kick and game.pending_contact < 0.0 and beast.hp < NativeRiftwing.MAX_HP - 50000.0:
			break
	_check("late clicks buffer a full jab cross kick combo", queued_cross and queued_kick and saw_cross and saw_kick, "serial=" + str(player._attack_serial))
	_check("combo deals each contact once", absf(beast.hp - (NativeRiftwing.MAX_HP - 57000.0)) < 0.01, "hp=" + str(beast.hp))
	_check("2.0 m jab touches the visible torso at release", first_jab_gap <= 0.24, "gap=" + str(first_jab_gap))
	_check("real hits cause local visual hitstop", saw_hitstop and beast._hitstop_left > 0.0)

	# The next attack after a genuine pause must return to jab.
	for frame in range(90):
		await _ground_frame(game)
	game.attack_ready = 0.0
	game._try_attack()
	_check("combo resets to jab after idle window", game.pending_combo == 0 and player._attack_name == "left-jab")
	var hp_before_interrupt := beast.hp
	await _ground_frame(game)
	player.apply_hit(Vector3.BACK, 100.0)
	for frame in range(22):
		await _ground_frame(game)
	_check("hit cancels pending fist before contact", absf(beast.hp - hp_before_interrupt) < 0.01 and game.pending_contact < 0.0 and not game.queued_attack)
	_check("interrupted fist does not survive as a visual action", player._attack_name.is_empty() and r2.current != "jab")

	# A cast interruption must also cancel the pending authoritative damage.
	player.teleport_to_ground(beast.global_position.x, beast.global_position.z + 15.0)
	player.global_position.y += 6.0
	player.flight_active = true
	player.realm = 4
	player.energy = 100.0
	game.attack_ready = 0.0
	var camera := player.get_node("CameraPivot/Camera3D") as Camera3D
	camera.look_at(beast.global_position + Vector3.UP * 1.3)
	var cast_hp := beast.hp
	game._try_air_cast()
	var cast_started := game.pending_cast_time > 0.0
	for frame in range(6):
		await _air_frame(game)
	player.apply_hit(Vector3.BACK, 100.0)
	for frame in range(38):
		await _air_frame(game)
	_check("hit cancels the airborne cast and its visual", cast_started and game.pending_cast.is_empty() and game.pending_cast_time < 0.0 and game.ascension._active_cast_vfx == null)
	_check("interrupted cast cannot deal delayed damage", absf(beast.hp - cast_hp) < 0.01)

	player.teleport_to_ground(0.0, 190.0)
	player.guarding = true
	var guarded_hp := player.health
	player.apply_hit(Vector3.BACK, 100.0)
	player._update_visual(0.05)
	_check("block reduces damage and keeps raised guard", absf(player.health - (guarded_hp - 25.0)) < 0.01 and r2.current == "guard", "clip=" + r2.current)
	await _ground_frame(game)
	var guard_agl := player.global_position.y - game.world.height_at(player.global_position.x, player.global_position.z)
	_check("guarded shove is one grounded impulse", guard_agl < 0.02 and player.horizontal_speed < 2.0 and player._hit_impulse.is_zero_approx(), "agl=" + str(guard_agl) + " speed=" + str(player.horizontal_speed))

	player.teleport_to_ground(0.0, 190.0)
	player.guarding = false
	player.apply_hit(Vector3.BACK, 1000.0)
	await _ground_frame(game)
	var impact_agl := player.global_position.y - game.world.height_at(player.global_position.x, player.global_position.z)
	_check("ordinary impact slides without levitating", impact_agl < 0.02 and player.horizontal_speed <= 6.05 and r2.current == "hit", "agl=" + str(impact_agl) + " speed=" + str(player.horizontal_speed))

	player.teleport_to_ground(0.0, 190.0)
	player.apply_hit(Vector3.BACK, 6221.0)
	var highest_agl := 0.0
	var saw_air_hit := false
	for frame in range(25):
		await _ground_frame(game)
		var agl := player.global_position.y - game.world.height_at(player.global_position.x, player.global_position.z)
		highest_agl = maxf(highest_agl, agl)
		saw_air_hit = saw_air_hit or agl > 0.08 and r2.current == "air_hit"
	_check("strong launch raises collider and selects air hit", highest_agl > 0.08 and highest_agl < 2.0 and saw_air_hit, "max_agl=" + str(highest_agl) + " clip=" + r2.current)
	_check("all physical samples use the matching 60 Hz physics frame", physics_context_ok and Engine.physics_ticks_per_second == 60)

	game.initialized = false
	game.queue_free()
	await process_frame
	if FileAccess.file_exists(SLOT):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SLOT))
	Engine.physics_ticks_per_second = previous_ticks
	var failed := checks.filter(func(item: Dictionary) -> bool: return not bool(item["pass"]))
	print("NATIVE_COMBAT_FLOW_JSON=" + JSON.stringify({"checks": checks, "passed": checks.size() - failed.size(), "total": checks.size(), "failed": failed}))
	quit(0 if failed.is_empty() else 1)
