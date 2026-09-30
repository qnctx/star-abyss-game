extends SceneTree

# Independent, headless acceptance probe. It uses only this dedicated save slot.
const SAVE_SLOT := "user://star_abyss_native_verify.json"
var checks: Array[Dictionary] = []
var failures: Array[String] = []
var perf_samples: Array[Dictionary] = []
var pending_blink_result: Dictionary = {}

class DoorwayGroundClock extends Node:
	var player: NativePlayer
	var frames := 0
	func _physics_process(delta: float) -> void:
		frames += 1
		player._step_ground_planet(delta, Vector2(0.0, 1.0), false, false, false)


func _initialize() -> void:
	if OS.get_cmdline_user_args().has("--visual"):
		call_deferred("_run_visual")
	elif OS.get_cmdline_user_args().has("--perf"):
		call_deferred("_run_perf")
	else:
		call_deferred("_run")


func _check(name: String, ok: bool, detail: String = "") -> void:
	checks.append({"name": name, "pass": ok, "detail": detail})
	if not ok:
		failures.append(name + (": " + detail if not detail.is_empty() else ""))

func _on_pending_blink_resolved(result: Dictionary) -> void:
	pending_blink_result = result

func _wait_for_blink(initial: Dictionary) -> Dictionary:
	if initial.get("pending", false) != true:
		return initial
	for i in range(300):
		await physics_frame
		if not pending_blink_result.is_empty():
			return pending_blink_result
	return {"ok": false, "reason": "瞬移准备超过300物理帧"}


func _run() -> void:
	paused = true
	var absolute_path := ProjectSettings.globalize_path(SAVE_SLOT)
	if FileAccess.file_exists(SAVE_SLOT):
		DirAccess.remove_absolute(absolute_path)
	var packed := load("res://scenes/main.tscn") as PackedScene
	_check("main scene parses", packed != null)
	if packed == null:
		_finish(absolute_path)
		return
	var game := packed.instantiate() as NativeMain
	_check("main has native script", game != null)
	if game == null:
		_finish(absolute_path)
		return
	game.save_path = SAVE_SLOT
	root.add_child(game)
	await process_frame
	var world := game.world
	var player := game.player
	var beast := game.beast
	_check("main initializes without gameplay startup failure", game.initialized and world != null and player != null and beast != null)
	_check("six kilometre chapter bounds", NativeWorld.HALF_SIZE == 3000.0 and NativeWorld.GRID_SEGMENTS * NativeWorld.GRID_STEP == 6000.0)
	_check("terrain streams actual meshes and physics", _has_terrain_chunk(world), _terrain_chunk_detail(world))
	var far_visual := world.get_node_or_null("BasinTerrainChunks/SixKilometreFarBasin") as MeshInstance3D
	var far_mesh := far_visual.mesh as ArrayMesh if far_visual != null else null
	_check("full six kilometre far basin has real shader mesh", far_mesh != null and far_visual.visible and far_visual.get_aabb().size.x >= 5999.0 and far_mesh.surface_get_array_len(0) >= 22000 and far_mesh.surface_get_array_index_len(0) >= 130000 and far_mesh.surface_get_material(0) is ShaderMaterial, "vertices=" + str(far_mesh.surface_get_array_len(0)) + " indices=" + str(far_mesh.surface_get_array_index_len(0)) if far_mesh != null else "no far mesh")
	var inside := Vector3(2998.0, world.height_at(2998.0, 0.0), 0.0)
	var outside := Vector3(3010.0, world.height_at(2999.0, 0.0), 0.0)
	var edge_ready := false
	for i in range(60):
		var edge_route: Dictionary = world.prepare_route(inside, outside, 0.42, 1.72)
		if edge_route.get("ready", false) == true:
			edge_ready = true
			break
		await physics_frame
	var inner_surface: Dictionary = world.surface_at(inside)
	var outer_surface: Dictionary = world.surface_at(outside)
	_check("terrain accepts loaded old-basin edge foot volume", edge_ready and inner_surface.get("ready", false) == true and not world.is_solid_at(inner_surface.get("point", inside), 0.42, 1.72))
	_check("planet continues beyond old 3km edge with real support", outer_surface.get("ready", false) == true and not world.is_solid_at(outer_surface.get("point", outside), 0.42, 1.72))
	var from_ground: Vector3 = inner_surface.get("point", inside)
	var to_ground: Vector3 = outer_surface.get("point", outside)
	_check("player ground path has no square-wall rejection", edge_ready and player._ground_path_clear(from_ground, to_ground))
	var air_from := from_ground + world.up_at(from_ground) * 8.0
	var air_to := to_ground + world.up_at(to_ground) * 8.0
	_check("flight path has no square-wall rejection", edge_ready and player._air_path_clear(air_from, air_to))
	world.release_prepared_route()
	_check("height queries remain finite at corners and sites", _finite_heights(world))

	var player_stats := _asset_stats(game.get_node("Player/Model"))
	var beast_stats := _asset_stats(game.get_node("Riftwing/Model"))
	var skimmer_stats := _asset_stats(game.get_node("SurveySkimmer"))
	var camp_stats := _camp_stats(game.camp)
	_check("camp imports three authored visible GLBs", game.camp.building_count() == 3 and camp_stats["all_visible"] and camp_stats["all_meshed"], JSON.stringify(camp_stats))
	_check("camp uses three real triangle collision bodies", camp_stats["triangle_bodies"] == 3, JSON.stringify(camp_stats))
	_check("C2 has imported mesh and skeleton", int(player_stats["meshes"]) > 0 and int(player_stats["skeletons"]) > 0, JSON.stringify(player_stats))
	_check("riftwing has imported mesh and skeleton", int(beast_stats["meshes"]) > 0 and int(beast_stats["skeletons"]) > 0, JSON.stringify(beast_stats))
	var expected_clips := ["ground-idle", "ground-walk", "ground-claw", "takeoff", "flight", "dive", "sweep", "land", "hit", "death"]
	_check("riftwing imports all ten authored clips", _has_clips(beast_stats["clips"], expected_clips), JSON.stringify(beast_stats["clips"]))
	_check("skimmer imports real mesh", int(skimmer_stats["meshes"]) > 0, JSON.stringify(skimmer_stats))

	player.teleport_to_ground(0.0, 190.0)
	player._step_ground(0.05, Vector2.ZERO, false, true)
	var space_jumped := not player.flight_active and player._ground_vertical_speed > 0.0 and player.global_position.y > world.height_at(0.0, 190.0)
	player.teleport_to_ground(0.0, 190.0)
	_check("ground jump rises without toggling flight", space_jumped, "jump_speed=" + str(player._ground_vertical_speed))
	_check("low altitude is speed limited", is_equal_approx(player._flight_speed(0.0, false), 48.0) and is_equal_approx(player._flight_speed(0.0, true), 48.0))
	_check("realm four high altitude boost exceeds cruise", is_equal_approx(player._flight_speed(350.0, false), 420.0) and is_equal_approx(player._flight_speed(350.0, true), 600.0))
	player.global_position = Vector3(0.0, world.height_at(0.0, 190.0) + 400.0, 190.0)
	player.flight_active = true
	player.energy = 100.0
	player.velocity = Vector3.ZERO
	player._step_flight(0.05, Vector2(0.0, 1.0), false, false, true, false)
	player._update_visual(0.5)
	var boost_clip := player._r2.current if player._r2 != null else ""
	var boost_pose_weight := player._r2.flight_pose_weight if player._r2 != null else 0.0
	_check("boost drives the sole R2 C2 animator", player.boosting and player.horizontal_speed > 0.0 and boost_clip == "boost" and boost_pose_weight > 0.95 and player._skeleton == null, "speed=" + str(player.horizontal_speed) + " weight=" + str(boost_pose_weight))
	player._step_flight(0.05, Vector2(0.0, 1.0), false, false, false, false)
	player._update_visual(0.5)
	var cruise_pose_weight := player._r2.flight_pose_weight if player._r2 != null else 1.0
	_check("slow flight blends back toward authored cruise", not player.boosting and player._r2.flight_mode == "cruise" and cruise_pose_weight < boost_pose_weight and cruise_pose_weight > 0.0, "weight=" + str(cruise_pose_weight))
	player.teleport_to_ground(0.0, 190.0)
	perf_samples.append(_sample_cpu_stream(game, "spawn stream", 180))
	var f2 := InputEventKey.new()
	f2.physical_keycode = KEY_F2
	f2.pressed = true
	var jump_start := Time.get_ticks_usec()
	game._input(f2)
	var jump_ms := float(Time.get_ticks_usec() - jump_start) / 1000.0
	var rift_stream := _sample_cpu_stream(game, "F2 ridge stream", 180)
	rift_stream["f2_teleport_ms"] = jump_ms
	perf_samples.append(rift_stream)
	_check("streaming stays within bounded visible chunks", world.loaded_chunk_count() > 0 and world.loaded_chunk_count() <= 81, "chunks=" + str(world.loaded_chunk_count()))

	world.update_stream(game.skimmer.global_position)
	player.teleport_to_ground(game.skimmer.global_position.x, game.skimmer.global_position.z)
	game._toggle_vehicle()
	_check("skimmer can be mounted", game.mounted and not player.is_physics_processing())
	var parked := game.skimmer.global_position
	game.vehicle_speed = 12.0
	game._drive(0.05)
	_check("native skimmer chassis actually drives", game.skimmer.global_position.distance_to(parked) > 0.1, "distance=" + str(game.skimmer.global_position.distance_to(parked)))
	game.vehicle_speed = 0.0
	game._toggle_vehicle()
	_check("skimmer can be dismounted", not game.mounted and player.is_physics_processing())
	game.skimmer.global_position = Vector3(7.0, world.height_at(7.0, 188.0), 188.0)
	game.skimmer.rotation.y = 0.0
	game.vehicle_speed = 35.0
	for i in range(40):
		game._drive(0.05)
	_check("native skimmer stops at medical real mesh wall", game.skimmer.global_position.z > 178.0 and game.vehicle_speed <= 0.01, "z=" + str(game.skimmer.global_position.z) + " speed=" + str(game.vehicle_speed))
	game.skimmer.global_position = parked
	game.vehicle_speed = 0.0
	player.teleport_to_ground(0.0, 196.0)
	game._try_investigate()
	_check("original beacon investigation records once", game.investigated.has("beacon"))
	game._try_investigate()
	_check("repeated investigation does not duplicate", game.investigated.size() == 1)
	player.teleport_to_ground(-17.0, 180.0)
	world.update_stream(player.global_position)
	player.rotation.y = 0.0
	if world.get("planet_enabled") == true:
		var game_was_processing := game.is_physics_processing()
		var player_was_processing := player.is_physics_processing()
		var beast_was_processing := beast.is_physics_processing()
		game.set_physics_process(false)
		player.set_physics_process(false)
		beast.set_physics_process(false)
		paused = false
		var doorway_clock := DoorwayGroundClock.new()
		doorway_clock.player = player
		root.add_child(doorway_clock)
		while doorway_clock.frames < 90:
			await physics_frame
		await process_frame
		doorway_clock.queue_free()
		paused = true
		game.set_physics_process(game_was_processing)
		player.set_physics_process(player_was_processing)
		beast.set_physics_process(beast_was_processing)
	else:
		for i in range(25):
			player._step_ground(0.05, Vector2(0.0, 1.0), false, false)
	_check("character crosses command authored doorway", player.global_position.z < 173.0 and absf(player.global_position.x + 17.0) < 0.5, "position=" + str(player.global_position))

	player.teleport_to_ground(NativeRiftwing.HOME_X, NativeRiftwing.HOME_Z - 2.2)
	var close_health := player.health
	for i in range(32):
		beast._physics_process(0.05)
	var close_distance := Vector2(player.global_position.x - beast.global_position.x, player.global_position.z - beast.global_position.z).length()
	_check("close start cannot overlap or nullify claw", player.health < close_health and close_distance >= 1.8, "distance=" + str(close_distance) + " health=" + str(player.health) + " phase=" + beast.phase)
	_reset_beast(beast, world, player)
	player.health = player.max_health
	player.teleport_to_ground(NativeRiftwing.HOME_X, NativeRiftwing.HOME_Z - 5.0)
	beast._physics_process(0.05)
	var start_health := player.health
	for i in range(32):
		beast._physics_process(0.05)
	var to_target := player.global_position - beast.global_position
	_check("same beast performs ground claw with real damage", beast.mode == "ground" and player.health < start_health, "phase=" + beast.phase + " health=" + str(player.health) + " distance=" + str(to_target.length()) + " facing=" + str(-beast.global_transform.basis.z.dot(to_target.normalized())))
	player.global_position.y = world.height_at(player.global_position.x, player.global_position.z) + 4.0
	player.flight_active = true
	var same_beast := beast.get_instance_id()
	var saw_takeoff := false
	var saw_air := false
	var saw_air_attack := false
	var highest_y := beast.global_position.y
	for i in range(120):
		beast._physics_process(0.05)
		saw_takeoff = saw_takeoff or beast.mode == "takeoff"
		saw_air = saw_air or beast.mode == "air"
		saw_air_attack = saw_air_attack or beast.mode == "air" and beast.attack_kind in ["dive", "sweep"] and beast.phase in ["windup", "attack"]
		highest_y = maxf(highest_y, beast.global_position.y)
	_check("same beast takes off and follows player", saw_takeoff and saw_air and highest_y > world.height_at(beast.global_position.x, beast.global_position.z) + 0.3 and beast.get_instance_id() == same_beast, "mode=" + beast.mode + " max_y=" + str(highest_y))
	# This paused SceneTree steps the AI manually; the new telegraphed attack can
	# legitimately miss a stationary four-metre-high target. Damage, guard and
	# projectile contact are covered by the separate live-physics R3 combat run.
	_check("same beast enters a telegraphed air dive or sweep", saw_air_attack, "attack=" + beast.attack_kind + " phase=" + beast.phase)
	player.teleport_to_ground(NativeRiftwing.HOME_X, NativeRiftwing.HOME_Z - 2.2)
	var saw_landing := false
	for i in range(140):
		beast._physics_process(0.05)
		saw_landing = saw_landing or beast.mode == "landing"
	_check("same beast lands back on terrain", saw_landing and beast.mode == "ground" and beast.get_instance_id() == same_beast and absf(beast.global_position.y - world.height_at(beast.global_position.x, beast.global_position.z)) < 0.06, "mode=" + beast.mode)

	player.teleport_to_ground(beast.global_position.x, beast.global_position.z + 2.0)
	player.rotation.y = 0.0
	var initial_hp := beast.hp
	game.attack_ready = 0.0
	game._try_attack()
	_check("authored jab delays hit until contact", beast.hp == initial_hp and game.pending_contact > 0.0)
	for i in range(8):
		player._update_visual(0.05)
		game._physics_process(0.05)
	_check("left click handler damages living grounded beast", beast.hp < initial_hp and beast.hp > 0.0, "hp=" + str(beast.hp))
	for i in range(40):
		if beast.mode == "dead":
			break
		game.attack_ready = 0.0
		game._try_attack()
		for frame in range(8):
			player._update_visual(0.05)
			game._physics_process(0.05)
	_check("ground melee kills same actor once", beast.mode == "dead" and beast.get_instance_id() == same_beast and beast.loot_left == 2)
	game._try_pickup()
	game._try_pickup()
	game._try_pickup()
	_check("H pickup yields two fragments only", game.fragments == 2 and beast.loot_left == 0)
	game._save_game()
	_check("native save written to isolated slot", FileAccess.file_exists(SAVE_SLOT))
	game.initialized = false
	game.queue_free()
	await process_frame
	await process_frame

	var reloaded := packed.instantiate() as NativeMain
	reloaded.save_path = SAVE_SLOT
	root.add_child(reloaded)
	await process_frame
	_check("native reload keeps beast dead and loot exhausted", reloaded.beast.mode == "dead" and reloaded.beast.loot_left == 0 and reloaded.fragments == 2)
	_check("native reload keeps investigation", reloaded.investigated.has("beacon"))
	_check("native reload keeps player and skimmer in bounds", absf(reloaded.player.global_position.x) <= NativePlayer.WORLD_HALF and absf(reloaded.skimmer.global_position.x) <= 2997.0)
	var ascension := reloaded.ascension
	var caster := reloaded.player
	caster.realm = 4
	caster.energy = 100.0
	var locked := ascension.try_blink("short")
	_check("R4 cannot blink or spend energy", not locked.get("ok", false) and is_equal_approx(caster.energy, 100.0) and ascension.serial == 0)
	caster.realm = 6
	caster.global_position = Vector3(0.0, reloaded.world.height_at(0.0, 190.0) + 450.0, 190.0)
	caster.flight_active = true
	caster.rotation.y = PI
	caster.energy = 100.0
	var blink_origin := caster.global_position
	var short_result := ascension.try_blink("short")
	_check("R6 short blink commits 12m and two GLB portals", short_result.get("ok", false) and absf(caster.global_position.distance_to(blink_origin) - 12.0) < 0.05 and is_equal_approx(caster.energy, 88.0) and ascension.serial == 1 and _effect_meshes(ascension) >= 2, JSON.stringify(short_result))
	var cooldown_position := caster.global_position
	var denied := ascension.try_blink("long")
	_check("blink cooldown blocks without spending", not denied.get("ok", false) and caster.global_position.distance_to(cooldown_position) < 0.001 and is_equal_approx(caster.energy, 88.0))
	ascension.ability_time = ascension.cooldown_until
	var long_origin := caster.global_position
	var long_result := ascension.try_blink("long")
	_check("R6 long blink commits 60m for 25 energy", long_result.get("ok", false) and absf(caster.global_position.distance_to(long_origin) - 60.0) < 0.05 and is_equal_approx(caster.energy, 63.0) and ascension.serial == 2, JSON.stringify(long_result))
	reloaded._save_game()
	reloaded.initialized = false
	reloaded.queue_free()
	await process_frame
	await process_frame
	var ability_reloaded := packed.instantiate() as NativeMain
	ability_reloaded.save_path = SAVE_SLOT
	root.add_child(ability_reloaded)
	await process_frame
	_check("native reload keeps realm and blink cooldown", ability_reloaded.player.realm == 6 and ability_reloaded.ascension.serial == 2 and ability_reloaded.ascension.cooldown_until > 0.0)
	var veteran := ability_reloaded.player
	var ability := ability_reloaded.ascension
	ability.blink_resolved.connect(_on_pending_blink_resolved)
	veteran.set_physics_process(false)
	paused = false
	veteran.realm = 9
	veteran.global_position = Vector3(0.0, ability_reloaded.world.height_at(0.0, 0.0) + 500.0, 0.0)
	veteran.flight_active = true
	veteran.rotation.y = PI
	veteran.energy = 100.0
	ability.cooldown_until = ability.ability_time
	var far_origin := veteran.global_position
	pending_blink_result.clear()
	var far_result: Dictionary = await _wait_for_blink(ability.try_blink("long"))
	_check("R9 long blink travels 1800m inside basin", far_result.get("ok", false) and absf(veteran.global_position.distance_to(far_origin) - 1800.0) < 0.1 and is_equal_approx(veteran.energy, 75.0), JSON.stringify(far_result))
	veteran.global_position = Vector3(2890.0, ability_reloaded.world.height_at(2890.0, 0.0) + 500.0, 0.0)
	veteran.rotation.y = -PI * 0.5
	veteran.energy = 100.0
	ability.cooldown_until = ability.ability_time
	var boundary_origin := veteran.global_position
	pending_blink_result.clear()
	var outside_result: Dictionary = await _wait_for_blink(ability.try_blink("long"))
	_check("blink crosses old basin edge onto planet", outside_result.get("ok", false) and veteran.global_position.x > 3000.0 and absf(veteran.global_position.distance_to(boundary_origin) - 1800.0) < 2.0 and is_equal_approx(veteran.energy, 75.0), JSON.stringify(outside_result))
	paused = true
	veteran.set_physics_process(true)
	_reset_beast(ability_reloaded.beast, ability_reloaded.world, veteran)
	veteran.realm = 8
	veteran.teleport_to_ground(NativeRiftwing.HOME_X, NativeRiftwing.HOME_Z + 10.0)
	veteran.global_position.y += 4.0
	veteran.flight_active = true
	veteran.energy = 100.0
	veteran.rotation.y = 0.0
	veteran.get_node("CameraPivot").rotation.x = 0.0
	ability_reloaded.attack_ready = 0.0
	var cast_hp := ability_reloaded.beast.hp
	ability_reloaded._try_air_cast()
	var r8_cast_vfx := ability_reloaded.ascension._active_cast_vfx
	_check("R8 air cast loads R2 fracture GLB during windup", ability_reloaded.pending_cast_time > 0.0 and r8_cast_vfx != null and r8_cast_vfx.mesh_root != null and _asset_stats(r8_cast_vfx.mesh_root)["meshes"] > 0 and is_equal_approx(ability_reloaded.beast.hp, cast_hp), "vfx=" + str(r8_cast_vfx))
	for frame in range(40):
		ability_reloaded._physics_process(0.05)
	_check("R8 air cast damages only at release", ability_reloaded.beast.hp < cast_hp and ability_reloaded.pending_cast.is_empty(), "hp=" + str(ability_reloaded.beast.hp))
	ability_reloaded.initialized = false
	ability_reloaded.queue_free()
	await process_frame
	_finish(absolute_path)


func _has_terrain_chunk(world: NativeWorld) -> bool:
	if world.loaded_chunk_count() == 0:
		return false
	for chunk in world._chunks.values():
		var mesh := (chunk as Node3D).get_node_or_null("Basalt") as MeshInstance3D
		var body := (chunk as Node3D).get_node_or_null("TerrainCollision") as StaticBody3D
		var shape := _first_collision_shape(body)
		if mesh != null and mesh.mesh != null and body != null and shape != null and shape.shape is ConcavePolygonShape3D:
			return true
	return false


func _terrain_chunk_detail(world: NativeWorld) -> String:
	if world._chunks.is_empty():
		return "no chunks"
	var chunk := world._chunks.values()[0] as Node3D
	var mesh := chunk.get_node_or_null("Basalt") as MeshInstance3D
	var body := chunk.get_node_or_null("TerrainCollision") as StaticBody3D
	var shape := _first_collision_shape(body)
	return JSON.stringify({"count": world.loaded_chunk_count(), "children": chunk.get_children().map(func(n: Node): return n.name), "mesh": mesh != null, "has_mesh": mesh != null and mesh.mesh != null, "body": body != null, "shape": shape != null, "shape_type": shape.shape.get_class() if shape != null and shape.shape != null else "none"})


func _first_collision_shape(body: StaticBody3D) -> CollisionShape3D:
	if body == null:
		return null
	for child in body.get_children():
		if child is CollisionShape3D:
			return child as CollisionShape3D
	return null


func _camp_stats(camp: NativeCamp) -> Dictionary:
	var result := {"all_visible": true, "all_meshed": true, "triangle_bodies": 0, "buildings": []}
	for id in ["command", "medical", "workshop"]:
		var placed := camp.building(id)
		if placed == null:
			result["all_visible"] = false
			result["all_meshed"] = false
			continue
		var meshes := int(_asset_stats(placed)["meshes"])
		var body := placed.get_node_or_null("AuthoredMeshCollision") as StaticBody3D
		var shapes := 0
		if body != null:
			for child in body.get_children():
				if child is CollisionShape3D and (child as CollisionShape3D).shape is ConcavePolygonShape3D:
					shapes += 1
		if shapes > 0 and body.collision_layer != 0:
			result["triangle_bodies"] += 1
		result["all_visible"] = result["all_visible"] and placed.visible
		result["all_meshed"] = result["all_meshed"] and meshes > 0
		result["buildings"].append({"id": id, "meshes": meshes, "triangle_shapes": shapes})
	return result


func _effect_meshes(ascension: NativeAscension) -> int:
	var total := 0
	for effect in ascension._effects:
		total += int(_asset_stats(effect["node"])["meshes"])
	return total


func _reset_beast(beast: NativeRiftwing, world: NativeWorld, player: NativePlayer) -> void:
	beast.hp = NativeRiftwing.MAX_HP
	beast.mode = "ground"
	beast.phase = "idle"
	beast.clock = 0.0
	beast.mode_since = 0.0
	beast.phase_since = 0.0
	beast.aggro_until = 0.0
	beast.attack_kind = ""
	beast.contacted = false
	beast.loot_left = 0
	beast.cooldowns.clear()
	beast._next_sense = 0.0
	beast._decision_ready = 0.0
	beast._perceived = false
	beast._returning = false
	beast._hitstop_left = 0.0
	beast._hurt_left = 0.0
	beast._impulse = Vector3.ZERO
	beast.rotation.y = 0.0
	beast.setup(world, player)


func _sample_cpu_stream(game: NativeMain, label: String, frames: int) -> Dictionary:
	var start := Time.get_ticks_usec()
	var worst_us := 0
	for i in range(frames):
		var step_start := Time.get_ticks_usec()
		game._physics_process(1.0 / 60.0)
		worst_us = maxi(worst_us, Time.get_ticks_usec() - step_start)
	return {"label": label, "frames": frames, "wall_ms": float(Time.get_ticks_usec() - start) / 1000.0, "worst_step_ms": float(worst_us) / 1000.0, "chunks": game.world.loaded_chunk_count()}


func _finite_heights(world: NativeWorld) -> bool:
	for point in [Vector2(-3000.0, -3000.0), Vector2(3000.0, 3000.0), Vector2(1370.0, -1030.0), Vector2(0.0, -766.0)]:
		var h := world.height_at(point.x, point.y)
		if is_nan(h) or is_inf(h):
			return false
	return true


func _asset_stats(node: Node) -> Dictionary:
	var result := {"meshes": 0, "skeletons": 0, "clips": []}
	_scan_asset(node, result)
	return result


func _scan_asset(node: Node, result: Dictionary) -> void:
	if node is MeshInstance3D:
		result["meshes"] += 1
	if node is Skeleton3D:
		result["skeletons"] += 1
	if node is AnimationPlayer:
		for animation_name in (node as AnimationPlayer).get_animation_list():
			result["clips"].append(String(animation_name))
	for child in node.get_children():
		_scan_asset(child, result)


func _has_clips(actual: Array, expected: Array) -> bool:
	for clip in expected:
		var found := false
		for name in actual:
			if String(name) == clip or String(name).ends_with("/" + clip):
				found = true
		if not found:
			return false
	return true


func _finish(absolute_path: String) -> void:
	print("NATIVE_VERIFY_JSON=" + JSON.stringify({"total": checks.size(), "passed": checks.size() - failures.size(), "failed": failures, "checks": checks, "cpu_stream_samples": perf_samples}))
	if FileAccess.file_exists(SAVE_SLOT):
		DirAccess.remove_absolute(absolute_path)
	quit(0 if failures.is_empty() else 1)


func _run_visual() -> void:
	var absolute_path := ProjectSettings.globalize_path(SAVE_SLOT)
	if FileAccess.file_exists(SAVE_SLOT):
		DirAccess.remove_absolute(absolute_path)
	var game := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = SAVE_SLOT
	root.add_child(game)
	game.set_physics_process(false)
	game.player.set_physics_process(false)
	game.beast.set_physics_process(false)
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	await process_frame
	await _capture_native("native-camp-opening")
	var player := game.player
	player.teleport_to_ground(0.0, 190.0)
	game.world.update_stream(player.global_position)
	player.horizontal_speed = 0.0
	await _pose_frames(player, 5, 0.1)
	await _capture_native("c2-ground-idle")
	player.horizontal_speed = 1.8
	await _pose_frames(player, 7, 0.1)
	await _capture_native("c2-ground-walk")
	player.global_position.y = game.world.height_at(player.global_position.x, player.global_position.z) + 3.0
	player.flight_active = true
	player.horizontal_speed = 0.0
	await _pose_frames(player, 5, 0.1)
	await _capture_native("c2-hover")
	player.boosting = true
	player.horizontal_speed = 55.0
	await _pose_frames(player, 6, 0.1)
	await _capture_native("c2-boost")
	player.boosting = false
	player.horizontal_speed = 5.0
	for combo_index in range(3):
		player.play_attack(combo_index)
		await _pose_frames(player, 3, 0.075 if combo_index < 2 else 0.1)
		await _capture_native(["c2-left-jab", "c2-right-cross", "c2-rising-kick"][combo_index])
	player._attack_name = ""
	player.guarding = true
	await _pose_frames(player, 5, 0.1)
	await _capture_native("c2-air-guard")
	player.guarding = false
	player.apply_hit(Vector3.BACK, 6221.0)
	await _pose_frames(player, 1, 0.1)
	await _capture_native("c2-hit-launch")
	player._hurt_time = 0.17
	await _pose_frames(player, 2, 0.02)
	await _capture_native_side("c2-hit-launch-side", player)
	player._hurt_time = 0.0
	player.boosting = true
	await _pose_frames(player, 5, 0.1)
	await _capture_native_side("c2-boost-side", player)
	player.boosting = false
	player.play_attack(0)
	await _pose_frames(player, 3, 0.075)
	await _capture_native_side("c2-left-jab-side", player)
	player.play_attack(2)
	await _pose_frames(player, 3, 0.1)
	await _capture_native_side("c2-rising-kick-side", player)
	player._attack_name = ""
	player.guarding = true
	await _pose_frames(player, 5, 0.1)
	await _capture_native_side("c2-air-guard-side", player)
	player.guarding = false
	player.teleport_to_ground(0.0, 190.0)
	player.horizontal_speed = 0.0
	await _pose_frames(player, 5, 0.1)
	await _capture_native_side("c2-ground-idle-side", player)
	player.horizontal_speed = 1.8
	await _pose_frames(player, 7, 0.1)
	await _capture_native_side("c2-ground-walk-side", player)
	var camera := player.get_node("CameraPivot/Camera3D") as Camera3D
	player.teleport_to_ground(0.0, 190.0)
	player.global_position.y += 800.0
	player.flight_active = true
	player.horizontal_speed = 0.0
	player.boosting = false
	player._attack_name = ""
	player.get_node("CameraPivot").rotation.x = -0.55
	camera.position = Vector3(0.0, 1.25, 5.0)
	camera.rotation = Vector3.ZERO
	game.world.update_stream(player.global_position)
	await _pose_frames(player, 5, 0.1)
	game._update_hud()
	await _capture_native("native-high-altitude")
	player.get_node("CameraPivot").rotation.x = -0.18
	await _pose_frames(player, 3, 0.1)
	await _capture_native("native-high-altitude-horizon")
	player.teleport_to_ground(NativeRiftwing.HOME_X, NativeRiftwing.HOME_Z + 10.0)
	player.global_position.y += 4.0
	player.flight_active = true
	player.realm = 8
	player.energy = 100.0
	player.rotation.y = 0.0
	player.get_node("CameraPivot").rotation.x = 0.0
	camera.position = Vector3(0.0, 1.25, 5.0)
	camera.rotation = Vector3.ZERO
	game.world.update_stream(player.global_position)
	game._try_air_cast()
	game.ascension._physics_process(0.4)
	await _pose_frames(player, 3, 0.1)
	game._update_hud()
	await _capture_native("r8-void-cast-third-person")
	game.initialized = false
	game.queue_free()
	await process_frame
	if FileAccess.file_exists(SAVE_SLOT):
		DirAccess.remove_absolute(absolute_path)
	quit()


func _pose_frames(player: NativePlayer, count: int, dt: float) -> void:
	for i in range(count):
		player._update_visual(dt)
		await process_frame


func _capture_native(name: String) -> void:
	await RenderingServer.frame_post_draw
	var path := "res://reports/" + name + ".png"
	var result := root.get_texture().get_image().save_png(path)
	print("NATIVE_VISUAL=" + name + ":" + str(result) + ":" + ProjectSettings.globalize_path(path))


func _capture_native_side(name: String, player: NativePlayer) -> void:
	var camera := player.get_node("CameraPivot/Camera3D") as Camera3D
	camera.global_position = player.global_position + Vector3(3.0, 2.2, 1.2)
	camera.fov = 55.0
	camera.look_at(player.global_position + Vector3.UP * 1.1, Vector3.UP)
	await _capture_native(name)


func _run_perf() -> void:
	var absolute_path := ProjectSettings.globalize_path(SAVE_SLOT)
	if FileAccess.file_exists(SAVE_SLOT):
		DirAccess.remove_absolute(absolute_path)
	var game := (load("res://scenes/main.tscn") as PackedScene).instantiate() as NativeMain
	game.save_path = SAVE_SLOT
	root.add_child(game)
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	await _warm_window(0.75)
	var camp := await _sample_window_frames("camp idle", 5.0)
	var player := game.player
	player.teleport_to_ground(0.0, 190.0)
	player.global_position.y += 800.0
	player.flight_active = true
	player.get_node("CameraPivot").rotation.x = -0.55
	game.world.update_stream(player.global_position)
	await _warm_window(0.75)
	var altitude := await _sample_window_frames("800m hover", 5.0)
	print("NATIVE_FRAME_JSON=" + JSON.stringify({"renderer": "OpenGL Compatibility", "adapter": RenderingServer.get_video_adapter_name(), "resolution": "1280x720", "vsync_mode": DisplayServer.window_get_vsync_mode(), "samples": [camp, altitude]}))
	game.initialized = false
	game.queue_free()
	await process_frame
	if FileAccess.file_exists(SAVE_SLOT):
		DirAccess.remove_absolute(absolute_path)
	quit()


func _warm_window(seconds: float) -> void:
	var deadline := Time.get_ticks_usec() + int(seconds * 1000000.0)
	while Time.get_ticks_usec() < deadline:
		await process_frame


func _sample_window_frames(label: String, seconds: float) -> Dictionary:
	var elapsed_frames: Array[float] = []
	var start := Time.get_ticks_usec()
	var previous := start
	var deadline := start + int(seconds * 1000000.0)
	while Time.get_ticks_usec() < deadline:
		await process_frame
		var now := Time.get_ticks_usec()
		elapsed_frames.append(float(now - previous) / 1000.0)
		previous = now
	elapsed_frames.sort()
	var count := elapsed_frames.size()
	var total_ms := float(previous - start) / 1000.0
	var sum_ms := 0.0
	for duration_ms in elapsed_frames:
		sum_ms += duration_ms
	return {"label": label, "frames": count, "wall_ms": total_ms, "fps": float(count) * 1000.0 / total_ms, "mean_ms": sum_ms / float(count), "median_ms": elapsed_frames[count / 2], "p95_ms": elapsed_frames[mini(int(ceil(0.95 * float(count))) - 1, count - 1)], "worst_ms": elapsed_frames[count - 1]}
