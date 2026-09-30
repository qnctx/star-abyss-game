extends SceneTree

# Independent full-main-scene regression. This file owns a dedicated save slot.
const SLOT := "user://star_abyss_native_r2_main_independent_verify.json"
var checks: Array[Dictionary] = []
var failures: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _check(label: String, passed: bool, detail: String = "") -> void:
	checks.append({"name": label, "pass": passed, "detail": detail})
	if not passed:
		failures.append(label + (": " + detail if not detail.is_empty() else ""))


func _run() -> void:
	var absolute_slot := ProjectSettings.globalize_path(SLOT)
	if FileAccess.file_exists(SLOT):
		DirAccess.remove_absolute(absolute_slot)
	var packed := load("res://scenes/main.tscn") as PackedScene
	_check("full main scene loads", packed != null)
	if packed == null:
		_finish(absolute_slot)
		return
	var game := packed.instantiate() as NativeMain
	game.save_path = SLOT
	root.add_child(game)
	await physics_frame
	await physics_frame
	game.set_physics_process(false)
	game.beast.set_physics_process(false)
	game.player.set_physics_process(false)
	game.ascension.set_physics_process(false)
	var p := game.player
	var r2 := p._r2 as NativeMotionR2
	var rigs: Array[Skeleton3D] = []
	_collect_rigs(p.get_node("Model"), rigs)
	_check("main scene owns exactly one R2 motion adapter", r2 != null and r2.is_inside_tree() and _count_r2(p.get_node("Model")) == 1, "adapter_count=" + str(_count_r2(p.get_node("Model"))))
	var rig_paths: Array[String] = []
	for rig_node in rigs:
		rig_paths.append(str(rig_node.get_path()) + " bones=" + str(rig_node.get_bone_count()))
	var display_meshes: Array[MeshInstance3D] = []
	var sampler_meshes: Array[MeshInstance3D] = []
	if r2 != null:
		_collect_meshes(r2.model, display_meshes)
		var sampler := r2.get_node_or_null("LocomotionSampler")
		if sampler != null:
			_collect_meshes(sampler, sampler_meshes)
	_check("old C2 absent; exactly one renderable R2 rig", r2 != null and p._model.get_child_count() == 1 and p._model.get_child(0) == r2 and display_meshes.size() > 0 and sampler_meshes.is_empty(), "rigs=" + JSON.stringify(rig_paths) + " render_meshes=" + str(display_meshes.size()) + " sampler_meshes=" + str(sampler_meshes.size()))
	if r2 == null or rigs.is_empty():
		game.initialized = false
		game.queue_free()
		await process_frame
		_finish(absolute_slot)
		return
	var old_clock: float = p._motion_clock
	p.teleport_to_ground(0.0, 190.0)
	p.horizontal_speed = 0.0
	p._update_visual(0.05)
	_check("ground idle reaches authored clip", r2.current == "idle", r2.current)
	p.horizontal_speed = 0.9
	p._update_visual(0.05)
	_check("ground walk reaches authored clip", r2.current == "walk", r2.current)
	p.horizontal_speed = 6.8
	p.velocity = Vector3(0.0, 0.0, -6.8)
	p._update_visual(0.05)
	_check("ground jog reaches authored clip at normal speed", r2.current == "jog", r2.current)
	p.horizontal_speed = 10.0
	p.velocity = Vector3(0.0, 0.0, -10.0)
	p._update_visual(0.05)
	_check("ground sprint reaches authored clip at Shift speed", r2.current == "sprint", r2.current)
	p.global_position.y += 4.0
	p.flight_active = true
	p.horizontal_speed = 5.0
	p.boosting = false
	p._update_visual(0.05)
	_check("ordinary flight reaches cruise clip", r2.current == "cruise" and p._model.rotation.is_zero_approx(), r2.current)
	p.boosting = true
	p._turn_bank = 0.7
	p.horizontal_speed = 80.0
	p._update_visual(0.25)
	_check("boost drives one banked full-body clip", r2.current == "boost" and absf(r2.rotation.z) > 0.01 and p._model.rotation.is_zero_approx(), r2.current + " bank=" + str(r2.rotation.z))
	p._first_person = true
	p._update_visual(0.05)
	_check("first person hides R2 mesh", not r2.visible and not p._model.visible)
	p._first_person = false
	p._update_visual(0.05)
	_check("single motion clock leaves legacy clock dormant", is_equal_approx(p._motion_clock, old_clock), "old_clock=" + str(p._motion_clock))
	var rig := rigs[0]
	var finite_rig := rig.get_bone_count() == 19
	for i in range(rig.get_bone_count()):
		finite_rig = finite_rig and rig.get_bone_global_pose(i).is_finite()
	_check("integrated rig has 19 finite bone poses", finite_rig, "bones=" + str(rig.get_bone_count()))

	# Real main-scene contact timer must agree with the R2 pose at first impact.
	game.world.update_stream(game.beast.global_position)
	var beast := game.beast
	var on_ground := p.teleport_to_ground(beast.global_position.x, beast.global_position.z + 2.0)
	_check("melee setup has safe ground", on_ground)
	p.rotation.y = 0.0
	p.energy = 100.0
	game.attack_ready = 0.0
	game.combo = 0
	var melee_hp := beast.hp
	game._try_attack()
	_check("melee starts without early damage", game.pending_contact > 0.0 and is_equal_approx(beast.hp, melee_hp))
	p._update_visual(0.08)
	var attack_fraction := r2.player.current_animation_position / maxf(0.001, r2.player.current_animation_length)
	_check("single action clock advances once before contact", absf(p._attack_elapsed - 0.08) < 0.001 and attack_fraction < 0.38, "elapsed=" + str(p._attack_elapsed) + " pose=" + str(attack_fraction))
	for i in range(2):
		game._physics_process(0.05)
	_check("authoritative melee timer withholds pre-contact damage", is_equal_approx(beast.hp, melee_hp))
	p._update_visual(0.07)
	attack_fraction = r2.player.current_animation_position / maxf(0.001, r2.player.current_animation_length)
	_check("R2 jab reaches contact pose at windup", absf(attack_fraction - 0.38) < 0.015 and absf(p._attack_elapsed - 0.15) < 0.001, "pose=" + str(attack_fraction))
	game._physics_process(0.05)
	_check("main applies exactly one jab at contact", absf(beast.hp - (melee_hp - 16500.0)) < 0.01, "hp=" + str(beast.hp))
	game._physics_process(0.05)
	_check("melee does not double hit after contact", absf(beast.hp - (melee_hp - 16500.0)) < 0.01)
	p._update_visual(0.35)
	_check("completed attack clears action state", p._attack_name.is_empty())
	for combo_case in [{"index": 1, "clip": "cross", "windup": 0.19, "damage": 16500.0}, {"index": 2, "clip": "kick", "windup": 0.27, "damage": 24000.0}]:
		game.attack_ready = 0.0
		game.combo = int(combo_case["index"])
		var before_combo := beast.hp
		game._try_attack()
		p._update_visual(float(combo_case["windup"]))
		var combo_fraction := r2.player.current_animation_position / maxf(0.001, r2.player.current_animation_length)
		_check(str(combo_case["clip"]) + " pose reaches its own contact windup", r2.current == str(combo_case["clip"]) and absf(combo_fraction - 0.38) < 0.015, "clip=" + r2.current + " pose=" + str(combo_fraction))
		for i in range(7):
			game._physics_process(0.05)
		_check(str(combo_case["clip"]) + " applies its authored damage once", absf(beast.hp - (before_combo - float(combo_case["damage"]))) < 0.01, "hp=" + str(beast.hp))
		p._update_visual(0.75)

	# Main selects an R4 aim and applies damage; the R2 blade only visualizes it.
	p.global_position = beast.global_position + Vector3(0.0, 6.0, 15.0)
	p.flight_active = true
	p.boosting = false
	p.realm = 4
	p.energy = 100.0
	p.velocity = Vector3.ZERO
	p._hurt_time = 0.0
	game.attack_ready = 0.0
	var camera := p.get_node("CameraPivot/Camera3D") as Camera3D
	camera.look_at(beast.global_position + Vector3.UP * 1.3)
	var cast_hp := beast.hp
	var old_effects := game.ascension._effects.size()
	game._try_air_cast()
	var blade := game.ascension._active_cast_vfx as NativeVfxR2
	_check("R4 main creates exactly one new blade", blade != null and game.ascension._effects.size() == old_effects and game.pending_cast_time > 0.0, "old_effects=" + str(game.ascension._effects.size()))
	if blade != null:
		blade.auto_tick = false
		var cast_aim: Vector3 = game.pending_cast.get("aim", Vector3.ZERO)
		for i in range(9):
			blade.advance(0.05)
			p._update_visual(0.05)
			game._physics_process(0.05)
		_check("R4 cast action plays through windup", r2.current == "air_cast" and p._cast_active and absf(p._cast_elapsed - 0.45) < 0.001, "clip=" + r2.current + " elapsed=" + str(p._cast_elapsed))
		_check("R4 charge and travel cause no early damage", is_equal_approx(beast.hp, cast_hp) and game.pending_cast_time > 0.0, "remaining=" + str(game.pending_cast_time))
		_check("blade remains short of authority contact before release", blade.global_position.distance_to(cast_aim) > 0.01, "distance=" + str(blade.global_position.distance_to(cast_aim)))
		for i in range(2):
			blade.advance(0.05)
			p._update_visual(0.05)
			game._physics_process(0.05)
		_check("R4 main resolves exact authoritative damage once", absf(beast.hp - (cast_hp - 28000.0)) < 0.01 and game.pending_cast.is_empty(), "hp=" + str(beast.hp))
		_check("blade reaches aim and stops at hit", blade.global_position.distance_to(cast_aim) < 0.02 and blade.impact_age >= 0.0 and game.ascension._active_cast_vfx == null, "gap=" + str(blade.global_position.distance_to(cast_aim)))
		game._physics_process(0.05)
		_check("cast contact does not double damage", absf(beast.hp - (cast_hp - 28000.0)) < 0.01)
	p._update_visual(0.75)
	_check("completed cast clears R2 action state", not p._cast_active)
	p.guarding = true
	p._hurt_time = 0.0
	p._update_visual(0.05)
	_check("guard reaches authored clip", r2.current == "air_guard", r2.current)
	var guarded_hp := p.health
	p.apply_hit(Vector3.BACK, 100.0)
	_check("guard still reduces authoritative incoming damage", absf(p.health - (guarded_hp - 25.0)) < 0.01, "health=" + str(p.health))
	p.guarding = false
	p._update_visual(0.05)
	_check("hit reaction reaches authored clip", r2.current == "air_hit", r2.current)

	# Preserve the earlier camera and energy recovery repairs in the same scene.
	p.teleport_to_ground(0.0, 190.0)
	p.energy = 21.0
	var blocked := not p._try_takeoff(true, false)
	var launch_frame := -1
	for i in range(120):
		if p._try_takeoff(true, false):
			launch_frame = i
			break
		p._step_ground(1.0 / 60.0, Vector2.ZERO, false, false)
	_check("held G recovers from 21 percent and relaunches", blocked and launch_frame >= 0 and launch_frame < 90 and p.flight_active, "frame=" + str(launch_frame) + " energy=" + str(p.energy))
	p.teleport_to_ground(-24.0, 174.0)
	var pivot := p.get_node("CameraPivot") as Node3D
	var follow_camera := p.get_node("CameraPivot/Camera3D") as Camera3D
	var found_occlusion := false
	var safe_occlusion := false
	for yaw in [0.0, PI * 0.5, PI, PI * 1.5]:
		p.rotation.y = yaw
		follow_camera.position = Vector3(0.0, 1.25, 5.0)
		var desired := PhysicsRayQueryParameters3D.create(pivot.global_position, follow_camera.global_position)
		desired.collision_mask = 1
		desired.exclude = [p.get_rid()]
		if p.get_world_3d().direct_space_state.intersect_ray(desired).is_empty():
			continue
		found_occlusion = true
		p._update_visual(0.05)
		var actual := PhysicsRayQueryParameters3D.create(pivot.global_position, follow_camera.global_position)
		actual.collision_mask = 1
		actual.exclude = [p.get_rid()]
		safe_occlusion = p.get_world_3d().direct_space_state.intersect_ray(actual).is_empty()
		break
	_check("camp wall still constrains follow camera", found_occlusion and safe_occlusion, "found=" + str(found_occlusion) + " safe=" + str(safe_occlusion))

	game.initialized = false
	game.queue_free()
	await process_frame
	_finish(absolute_slot)


func _collect_rigs(node: Node, result: Array[Skeleton3D]) -> void:
	if node is Skeleton3D:
		result.append(node as Skeleton3D)
	for child in node.get_children():
		_collect_rigs(child, result)


func _collect_meshes(node: Node, result: Array[MeshInstance3D]) -> void:
	if node is MeshInstance3D:
		result.append(node as MeshInstance3D)
	for child in node.get_children():
		_collect_meshes(child, result)


func _count_r2(node: Node) -> int:
	var count := 1 if node is NativeMotionR2 else 0
	for child in node.get_children():
		count += _count_r2(child)
	return count


func _finish(absolute_slot: String) -> void:
	print("NATIVE_R2_MAIN_INDEPENDENT_JSON=" + JSON.stringify({"total": checks.size(), "passed": checks.size() - failures.size(), "failed": failures, "checks": checks}))
	if FileAccess.file_exists(SLOT):
		DirAccess.remove_absolute(absolute_slot)
	quit(0 if failures.is_empty() else 1)
