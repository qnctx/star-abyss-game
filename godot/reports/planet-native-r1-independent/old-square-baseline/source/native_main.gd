extends Node3D
class_name NativeMain

signal combat_event(record: Dictionary)

@export var save_path := "user://star_abyss_native_v1.json"
const BEAST_MODEL := "res://assets/enemy-r3/riftwing-r3.glb"
const GROUND_ENEMY_MODEL := "res://assets/enemy-r3/rift-prowler-r3.glb"
const SKIMMER_MODEL := "res://assets/survey-skimmer-cockpit-v1.glb"
const AIR_CAST_RULES := {
	4: {"name": "元婴拳劲", "windup": 0.50, "recovery": 0.75, "reach": 32.0, "radius": 1.25, "cost": 3.0, "damage": 28000.0},
	5: {"name": "化神掌波", "windup": 0.42, "recovery": 0.65, "reach": 38.0, "radius": 1.45, "cost": 4.0, "damage": 35000.0},
	6: {"name": "炼虚横扫", "windup": 0.65, "recovery": 0.85, "reach": 42.0, "radius": 2.3, "cost": 8.0, "damage": 50000.0},
	7: {"name": "合体横扫", "windup": 0.65, "recovery": 0.80, "reach": 46.0, "radius": 3.0, "cost": 10.0, "damage": 60000.0},
	8: {"name": "星劫下劈", "windup": 1.8, "recovery": 1.5, "reach": 50.0, "radius": 6.0, "cost": 18.0, "damage": 85000.0},
	9: {"name": "道源压掌", "windup": 2.2, "recovery": 1.8, "reach": 60.0, "radius": 9.0, "cost": 24.0, "damage": 110000.0},
}
const R3_CAST_COOLDOWNS := {4: 1.5, 5: 1.5, 6: 2.0, 7: 2.2, 8: 4.0, 9: 5.0}
const ATTACK_BUFFER_WINDOW := 0.16
const ATTACK_BUFFER_LIFETIME := 0.22
const COMBO_RESET_TIME := 1.15
const ATTACK_HITSTOP := [0.045, 0.06, 0.075]
const SITES := [
	{"id": "beacon", "label": "返回信标", "x": 0.0, "z": 196.0},
	{"id": "signal", "label": "失真的求救信号", "x": 12.0, "z": -330.0},
	{"id": "breach", "label": "船体破口", "x": 0.0, "z": -472.0},
	{"id": "fuse", "label": "备用电芯", "x": -29.0, "z": -544.0},
	{"id": "power", "label": "应急配电箱", "x": -5.0, "z": -579.0},
	{"id": "log", "label": "值班员记录", "x": 26.0, "z": -635.0},
	{"id": "blackbox", "label": "黑匣子", "x": 0.0, "z": -766.0},
	{"id": "echo", "label": "无名石碑", "x": -420.0, "z": -160.0},
	{"id": "capsule", "label": "空的逃生舱", "x": 610.0, "z": -450.0},
	{"id": "rift", "label": "地下回声源", "x": -300.0, "z": -520.0},
]
@onready var world: NativeWorld = $World
@onready var camp: NativeCamp = $Camp
@onready var player: NativePlayer = $Player
@onready var beast: NativeRiftwing = $Riftwing
@onready var ascension: NativeAscension = $Ascension
@onready var status: Label = $Hud/TopLeft/Status
@onready var hint: Label = $Hud/Hint
var enemies: Array[NativeEnemyR3] = []
var skimmer := CharacterBody3D.new()
var skimmer_camera := Camera3D.new()
var mounted := false
var vehicle_speed := 0.0
var attack_ready := 0.0
var combo := 0
var pending_contact := -1.0
var pending_combo := 0
var pending_attack_serial := -1
var queued_attack := false
var queued_attack_until := 0.0
var combo_expires_at := -1.0
var pending_cast_time := -1.0
var pending_cast: Dictionary = {}
var cast_cooldown_until := 0.0
var last_combat_physics_delta := 0.0
var training_enemy_slots: Array[int] = []
var fragments := 0
var investigated: Array[String] = []
var message := ""
var message_until := 0.0
var time := 0.0
var hud_clock := 0.0
var save_clock := 0.0
var initialized := false
var repaired_legacy_positions := false
var _beast_camera_blocker: StaticBody3D
var _beast_wing_meshes: Array[MeshInstance3D] = []

func _ready() -> void:
	world.setup_world()
	if not camp.setup_camp(world):
		push_error("Native camp failed to load")
	player.set_world(world)
	player.set_support_provider(camp)
	player.process_physics_priority = -1
	player.global_position = Vector3(0.0, world.height_at(0.0, 190.0), 190.0)
	_load_asset(BEAST_MODEL, beast.get_node("Model"))
	_install_beast_camera_blocker()
	beast.setup(world, player)
	ascension.setup(world, player)
	beast.defeated.connect(_on_beast_defeated)
	beast.enemy_attack_requested.connect(_on_enemy_attack_requested)
	beast.enemy_skill_event.connect(_on_enemy_skill_event)
	var ground_enemy := NativeEnemyR3.new()
	ground_enemy.name = "RiftProwler"
	ground_enemy.configure_variant("ground", Vector3(1338.0, 0.0, -1020.0))
	add_child(ground_enemy)
	var ground_model := Node3D.new()
	ground_model.name = "Model"
	ground_enemy.add_child(ground_model)
	_load_asset(GROUND_ENEMY_MODEL, ground_model)
	ground_enemy.setup(world, player)
	ground_enemy.enemy_attack_requested.connect(_on_enemy_attack_requested)
	ground_enemy.enemy_skill_event.connect(_on_enemy_skill_event)
	ground_enemy.enemy_defeated.connect(_on_ground_enemy_defeated)
	enemies.append(ground_enemy)
	skimmer.name = "SurveySkimmer"
	skimmer.collision_layer = 1
	skimmer.collision_mask = 1
	add_child(skimmer)
	# Keep the original browser-world parking spot clear of the landing beacon.
	skimmer.global_position = Vector3(72.0, world.height_at(72.0, 80.0), 80.0)
	var skimmer_shape := BoxShape3D.new()
	skimmer_shape.size = Vector3(2.2, 1.4, 4.0)
	var skimmer_collider := CollisionShape3D.new()
	skimmer_collider.name = "VehicleContact"
	skimmer_collider.shape = skimmer_shape
	skimmer_collider.position = Vector3(0.0, 1.0, 0.0)
	skimmer.add_child(skimmer_collider)
	_load_asset(SKIMMER_MODEL, skimmer)
	skimmer_camera.position = Vector3(0.0, 3.0, 7.0)
	skimmer_camera.rotation.x = -0.15
	skimmer.add_child(skimmer_camera)
	_restore_save()
	world.update_stream(player.global_position)
	initialized = true
	_notice("原生盆地已加载；F2 前往裂翼巡猎兽测试地空战斗")
	_update_hud()
	_recover_restored_overlap()

func _load_asset(path: String, parent: Node3D) -> void:
	var resource := load(path)
	if resource is PackedScene:
		parent.add_child((resource as PackedScene).instantiate())
	else:
		push_error("Required native asset could not load: " + path)
		_notice("模型加载失败：" + path)


func _install_beast_camera_blocker() -> void:
	# The rendered wing has no gameplay collider. Keep the follow camera outside
	# its broad membrane without changing the player's melee/flight collision.
	var blocker := StaticBody3D.new()
	blocker.name = "CameraOnlyWingBlocker"
	blocker.collision_layer = NativePlayer.CAMERA_ONLY_LAYER
	blocker.collision_mask = 0
	var collider := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(6.2, 3.3, 4.2)
	collider.shape = shape
	collider.position = Vector3(0.0, 1.5, 0.0)
	blocker.add_child(collider)
	beast.add_child(blocker)
	_beast_camera_blocker = blocker
	for node in beast.find_children("*", "MeshInstance3D", true, false):
		if "MembraneWings" in node.name:
			_beast_wing_meshes.append(node as MeshInstance3D)


func _process(_delta: float) -> void:
	if not initialized or _beast_camera_blocker == null:
		return
	var pivot := player.get_node("CameraPivot") as Node3D
	var local_anchor := _beast_camera_blocker.to_local(pivot.global_position)
	var inside_wing_space := absf(local_anchor.x) < 3.2 and absf(local_anchor.y - 1.5) < 1.75 and absf(local_anchor.z) < 2.2
	for mesh in _beast_wing_meshes:
		mesh.transparency = 0.82 if inside_wing_space and not mounted else 0.0

func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		match event.physical_keycode:
			KEY_F2:
				if not mounted:
					player.teleport_to_ground(1370.0, -1022.0)
					world.update_stream(player.global_position)
					_notice("已到裂翼岭；F3 可重置试玩对手，不重复产出掉落")
			KEY_F3:
				_reset_duel()
			KEY_H:
				_try_pickup()
			KEY_E:
				_try_investigate()
			KEY_F:
				_toggle_vehicle()
			KEY_F5:
				_save_game()
				_notice("原生档已保存")
			KEY_F6:
				player.realm = 4 + (player.realm - 3) % 6
				_notice("试玩境界 R" + str(player.realm) + " · 正式进阶尚未迁入")
			KEY_Q:
				if mounted:
					_notice("先下车再瞬移")
				else:
					var result := ascension.try_blink("long" if event.alt_pressed else "short")
					if result.get("ok", false):
						_cancel_melee()
						_cancel_cast()
					_notice(String(result.get("reason", "瞬移失败")))
			KEY_R:
				if not mounted:
					_try_r3_cast()
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed and Input.get_mouse_mode() == Input.MOUSE_MODE_CAPTURED and not mounted:
		_try_attack()

func _physics_process(delta: float) -> void:
	if not initialized:
		return
	var dt := minf(delta, 0.05)
	last_combat_physics_delta = delta
	time += dt
	attack_ready = maxf(0.0, attack_ready - dt)
	if player._hurt_time > 0.0 or player.health <= 0.0 or mounted:
		queued_attack = false
		combo = 0
	if pending_contact >= 0.0 and (pending_attack_serial != player._attack_serial or player._attack_name.is_empty() or player._hurt_time > 0.0 or mounted):
		_cancel_melee()
	if pending_cast_time >= 0.0 and (not pending_cast.get("r3", false) or pending_cast.get("stage", "windup") == "windup") and (not player._cast_active or player._hurt_time > 0.0 or mounted or (pending_cast.get("r3", false) and int(player.get("combat_serial")) != int(pending_cast.get("serial", -1)))):
		_cancel_cast()
	if pending_contact >= 0.0:
		pending_contact -= dt
		if pending_contact < 0.0:
			_resolve_attack_contact()
	if pending_cast_time >= 0.0:
		if pending_cast.get("r3", false) and pending_cast.get("stage", "windup") == "windup":
			ascension.follow_r3_cast(_cast_socket_transform(String(pending_cast.get("socket", "hand_r"))))
		pending_cast_time -= dt
		if pending_cast_time < 0.0:
			_resolve_air_cast()
	if queued_attack:
		if time > queued_attack_until or player._hurt_time > 0.0 or player.guarding or player._cast_active or mounted:
			queued_attack = false
		elif attack_ready <= 0.0:
			_start_attack()
	if mounted:
		_drive(dt)
	else:
		world.update_stream(player.global_position)
	save_clock += dt
	if save_clock >= 12.0:
		save_clock = 0.0
		_save_game()
	hud_clock += dt
	if hud_clock >= 0.12:
		hud_clock = 0.0
		_update_hud()

func _drive(dt: float) -> void:
	var throttle := float(Input.is_physical_key_pressed(KEY_W)) - float(Input.is_physical_key_pressed(KEY_S))
	var steer := float(Input.is_physical_key_pressed(KEY_A)) - float(Input.is_physical_key_pressed(KEY_D))
	var desired := throttle * (35.0 if Input.is_physical_key_pressed(KEY_SHIFT) else 18.0)
	vehicle_speed = move_toward(vehicle_speed, desired, 22.0 * dt)
	skimmer.rotation.y += steer * minf(1.0, absf(vehicle_speed) / 8.0) * dt * 1.3
	var candidate := skimmer.global_position - skimmer.global_transform.basis.z * vehicle_speed * dt
	candidate.y = world.height_at(candidate.x, candidate.z)
	if not world.is_solid_at(candidate, 1.3, 2.2):
		if skimmer.move_and_collide(candidate - skimmer.global_position) != null:
			vehicle_speed = 0.0
	else:
		vehicle_speed = 0.0
	world.update_stream(skimmer.global_position)

func _toggle_vehicle() -> void:
	if mounted:
		if absf(vehicle_speed) > 2.0:
			_notice("先停稳勘探车再下车")
			return
		var exit_point := _vehicle_exit_position()
		if not exit_point.is_finite() or not player.teleport_to_ground(exit_point.x, exit_point.z):
			_notice("车旁没有安全落脚点，请挪车后再下车")
			return
		mounted = false
		player.show()
		player.set_physics_process(true)
		player.get_node("CameraPivot/Camera3D").current = true
		_notice("已离开勘探车")
	elif player.global_position.distance_to(skimmer.global_position) < 5.0:
		mounted = true
		_cancel_melee()
		_cancel_cast()
		player.cancel_combat_action()
		player.hide()
		player.set_physics_process(false)
		skimmer_camera.current = true
		_notice("驾驶勘探车 · WASD · Shift 加速 · 停稳后 F 下车")

func _vehicle_exit_position() -> Vector3:
	for offset in [Vector3(2.8, 0.0, 0.0), Vector3(-2.8, 0.0, 0.0), Vector3(0.0, 0.0, 3.4), Vector3(0.0, 0.0, -3.4)]:
		var point: Vector3 = skimmer.global_position + skimmer.global_transform.basis * offset
		point.y = player._support_at(point.x, point.z, world.height_at(point.x, point.z) + 1.0)
		if player._inside_world(point) and player._destination_clear(point):
			return point
	return Vector3(INF, INF, INF)

func _try_attack() -> void:
	if player.health <= 0.0 or player.guarding or player._hurt_time > 0.0 or player._cast_active:
		return
	if attack_ready > 0.0:
		if not player._attack_name.is_empty() and attack_ready <= ATTACK_BUFFER_WINDOW:
			queued_attack = true
			queued_attack_until = time + ATTACK_BUFFER_LIFETIME
		return
	_start_attack()

func _start_attack() -> void:
	if player.health <= 0.0 or player.guarding or player._hurt_time > 0.0 or player._cast_active or mounted:
		queued_attack = false
		return
	if time > combo_expires_at:
		combo = 0
	var contact := player.play_attack(combo)
	if contact < 0.0:
		queued_attack = false
		return
	pending_combo = combo
	pending_contact = contact
	pending_attack_serial = player._attack_serial
	attack_ready = player._attack_cancel_after
	combo_expires_at = time + COMBO_RESET_TIME
	queued_attack = false
	combo = (combo + 1) % 3
	_combat_event("start", player._attack_name, false)

func _resolve_attack_contact() -> void:
	if player.health <= 0.0 or pending_attack_serial != player._attack_serial or player._attack_name.is_empty() or player._hurt_time > 0.0:
		_cancel_melee()
		return
	var contact_point := player.attack_contact_point_world(pending_combo)
	var limb_radius := 0.30 if pending_combo == 2 else 0.24
	var forward := -player.global_transform.basis.z
	var chosen: NativeEnemyR3 = null
	var nearest_gap := INF
	for enemy in _combat_targets():
		if enemy.mode == "dead":
			continue
		var offset := enemy.global_position - player.global_position
		var distance := Vector2(offset.x, offset.z).length()
		var facing := Vector2(forward.x, forward.z).normalized().dot(Vector2(offset.x, offset.z).normalized()) if distance > 0.001 else 1.0
		if distance > 3.0 or absf(offset.y) > 2.5 or facing < 0.18 or not contact_point.is_finite():
			continue
		if not _cast_los_clear(contact_point, enemy.global_position + Vector3.UP * 1.3, enemy):
			continue
		var gap := enemy.body_contact_distance(contact_point)
		if gap < nearest_gap:
			chosen = enemy
			nearest_gap = gap
	if chosen == null or nearest_gap > limb_radius:
		_combat_event("impact", player._attack_name, false)
		_notice("拳脚落空 · 手脚尚未触及目标")
		return
	var damage := 24000.0 if pending_combo == 2 else 16500.0
	var hitstop: float = ATTACK_HITSTOP[pending_combo]
	var result := chosen.receive_combat_hit({"action_id": player._attack_name, "damage": damage, "stagger": 0.24, "knockback": forward * 2.0, "hitstop": hitstop, "source": contact_point})
	if not bool(result.get("landed", false)):
		_combat_event("impact", player._attack_name, false)
		return
	player.begin_visual_hitstop(hitstop)
	attack_ready += hitstop
	_combat_event("impact", player._attack_name, true)
	_notice(("上挑踢" if pending_combo == 2 else ("左直拳" if pending_combo == 0 else "右直拳")) + "命中 · " + ("裂翼兽" if chosen == beast else "裂脊兽") + "生命 " + str(ceili(chosen.hp)))

func _combat_targets() -> Array[NativeEnemyR3]:
	var targets: Array[NativeEnemyR3] = [beast]
	for enemy in enemies:
		targets.append(enemy)
	return targets

func _cancel_melee() -> void:
	pending_contact = -1.0
	pending_attack_serial = -1
	queued_attack = false
	combo = 0
	combo_expires_at = -1.0

func _cancel_cast() -> void:
	if pending_cast.get("r3", false):
		ascension.cancel_r3_cast()
		_combat_event("cancel", String(pending_cast.get("action", "")), false)
	else:
		ascension.cancel_air_cast()
	pending_cast_time = -1.0
	pending_cast.clear()

func _cast_socket_transform(socket: String) -> Transform3D:
	return player.combat_socket_transform_world(socket)

func _r3_rank() -> int:
	return clampi(player.realm, 4, 9)

func _cast_aim(source: Vector3, direction: Vector3, reach: float, radius: float) -> Vector3:
	var nearest_along := reach
	for enemy in _combat_targets():
		if enemy.mode == "dead":
			continue
		var body := enemy.global_position + Vector3.UP * 1.3
		var offset := body - source
		var along := offset.dot(direction)
		var miss := (offset - direction * along).length()
		if along > 0.0 and along < nearest_along and miss <= maxf(radius, 2.2):
			nearest_along = along
	return source + direction * nearest_along

func _try_r3_cast() -> void:
	if player.health <= 0.0 or player.guarding or player._hurt_time > 0.0 or player._cast_active:
		return
	if attack_ready > 0.0 or pending_cast_time >= 0.0:
		return
	var rank := _r3_rank()
	var rule: Dictionary = AIR_CAST_RULES[rank]
	if player.energy < float(rule["cost"]):
		_notice("灵息不足，武技无法凝聚")
		return
	if time < cast_cooldown_until:
		_notice("武技冷却剩余 %.1f 秒" % (cast_cooldown_until - time))
		return
	var profile: Dictionary = NativeMotionR2.cast_profile(player.realm)
	if profile.is_empty():
		_notice("当前境界武技尚未就绪")
		return
	var socket := String(profile.get("socket", "hand_r"))
	var transform := _cast_socket_transform(socket)
	if not transform.origin.is_finite():
		_notice("释放骨点尚未就绪")
		return
	var camera := player.get_node("CameraPivot/Camera3D") as Camera3D
	var direction := -camera.global_transform.basis.z.normalized()
	var aim := _cast_aim(transform.origin, direction, float(rule["reach"]), float(rule["radius"]))
	if not player.play_combat_action(profile):
		return
	if not ascension.start_r3_cast(player.realm, profile, transform, aim):
		player.cancel_combat_action()
		_notice("武技特效尚未就绪")
		return
	player.energy -= float(rule["cost"])
	pending_cast = {"r3": true, "stage": "windup", "rank": rank, "rule": rule, "profile": profile, "action": String(profile["action"]), "socket": socket, "serial": int(player.get("combat_serial"))}
	pending_cast_time = float(profile.get("release_time", rule["windup"]))
	attack_ready = float(profile.get("duration", pending_cast_time + float(rule["recovery"])))
	cast_cooldown_until = time + float(R3_CAST_COOLDOWNS[rank])
	_combat_event("start", String(profile["action"]), false)
	_notice(String(rule["name"]) + " · 聚势中")

func _try_air_cast() -> void:
	if not player.flight_active or player.health <= 0.0:
		_notice("升空后才能施放空战术式")
		return
	if attack_ready > 0.0 or pending_cast_time >= 0.0:
		return
	var rank := _r3_rank()
	var rule: Dictionary = AIR_CAST_RULES[rank]
	var cost := float(rule["cost"])
	if player.energy < cost:
		_notice("灵息不足，术式无法凝聚")
		return
	var camera := player.get_node("CameraPivot/Camera3D") as Camera3D
	var direction: Vector3 = -camera.global_transform.basis.z.normalized()
	var origin := player.global_position + Vector3.UP * 1.3
	var body := beast.global_position + Vector3.UP * 1.3
	var offset := body - origin
	var along := offset.dot(direction)
	var miss := (offset - direction * along).length()
	var reach := float(rule["reach"])
	var radius := float(rule["radius"])
	var aim := origin + direction * (along if beast.mode != "dead" and along > 0.0 and along <= reach and miss <= maxf(radius, 2.2) else reach)
	if not player.play_air_cast(float(rule["windup"])):
		return
	if not ascension.spawn_air_cast(rank, origin, aim, float(rule["windup"])):
		_notice("术式模型载入失败")
		return
	player.energy -= cost
	pending_cast = {"rank": rank, "origin": origin, "aim": aim, "direction": direction, "rule": rule}
	pending_cast_time = float(rule["windup"])
	attack_ready = float(rule["windup"]) + float(rule["recovery"])
	_notice(String(rule["name"]) + " · 聚势中")

func _resolve_air_cast() -> void:
	if pending_cast.get("r3", false):
		if pending_cast.get("stage", "windup") == "windup":
			_release_r3_cast()
		else:
			_impact_r3_cast()
		return
	if pending_cast.is_empty() or beast.mode == "dead" or player.health <= 0.0:
		_cancel_cast()
		return
	var rule: Dictionary = pending_cast["rule"]
	var origin: Vector3 = pending_cast["origin"]
	var aim: Vector3 = pending_cast["aim"]
	var direction: Vector3 = pending_cast["direction"]
	var body := beast.global_position + Vector3.UP * 1.3
	var offset := body - origin
	var along := offset.dot(direction)
	var radius := float(rule["radius"])
	var is_rift := int(pending_cast["rank"]) >= 6
	var in_range := body.distance_to(aim) <= radius + 1.2 if is_rift else along >= 0.0 and along <= float(rule["reach"]) and (offset - direction * along).length() <= radius + 1.2
	var ray := PhysicsRayQueryParameters3D.create(origin, body)
	ray.collision_mask = 1
	ray.exclude = [player.get_rid()]
	var clear := get_world_3d().direct_space_state.intersect_ray(ray).is_empty()
	var hit := in_range and clear
	ascension.resolve_air_cast(hit)
	if hit:
		beast.receive_hit(float(rule["damage"]))
		_notice(String(rule["name"]) + "命中 · 裂翼兽生命 " + str(ceili(beast.hp)))
	else:
		_notice(String(rule["name"]) + "落空 · 调整瞄准或避开遮挡")
	pending_cast.clear()

func _release_r3_cast() -> void:
	if pending_cast.is_empty() or player.health <= 0.0 or int(player.get("combat_serial")) != int(pending_cast.get("serial", -1)):
		_cancel_cast()
		return
	var transform := _cast_socket_transform(String(pending_cast["socket"]))
	if not transform.origin.is_finite():
		_cancel_cast()
		_notice("释放骨点丢失，武技已中断")
		return
	var camera := player.get_node("CameraPivot/Camera3D") as Camera3D
	var direction := -camera.global_transform.basis.z.normalized()
	var rule: Dictionary = pending_cast["rule"]
	var aim := _cast_aim(transform.origin, direction, float(rule["reach"]), float(rule["radius"]))
	var travel := 0.12 if int(pending_cast["rank"]) >= 6 else minf(0.18, transform.origin.distance_to(aim) / 160.0)
	ascension.release_r3_cast(transform, aim, travel)
	pending_cast["stage"] = "travel"
	pending_cast["origin"] = transform.origin
	pending_cast["aim"] = aim
	pending_cast["direction"] = (aim - transform.origin).normalized()
	pending_cast_time = travel
	_combat_event("release", String(pending_cast["action"]), false)

func _impact_r3_cast() -> void:
	if pending_cast.is_empty():
		return
	var rule: Dictionary = pending_cast["rule"]
	var origin: Vector3 = pending_cast["origin"]
	var aim: Vector3 = pending_cast["aim"]
	var direction: Vector3 = pending_cast["direction"]
	var radius := float(rule["radius"])
	var is_rift := int(pending_cast["rank"]) >= 6
	var hit_count := 0
	var impact_point := aim
	var last_enemy: NativeEnemyR3 = null
	for enemy in _combat_targets():
		if enemy.mode == "dead":
			continue
		var body := enemy.global_position + Vector3.UP * 1.3
		var offset := body - origin
		var along := offset.dot(direction)
		var in_range := body.distance_to(aim) <= radius + 1.2 if is_rift else along >= 0.0 and along <= float(rule["reach"]) and (offset - direction * along).length() <= radius + 1.2
		if not in_range or not _cast_los_clear(origin, body, enemy):
			continue
		var result: Dictionary = enemy.receive_combat_hit({"action_id": pending_cast["action"], "damage": float(rule["damage"]), "stagger": 0.32, "guard_break": int(pending_cast["rank"]) >= 8, "knockback": direction * 4.0, "hitstop": 0.06, "source": origin})
		if bool(result.get("landed", false)):
			hit_count += 1
			impact_point = body
			last_enemy = enemy
			if not is_rift:
				break
	ascension.impact_r3_cast(impact_point, hit_count > 0)
	_combat_event("impact", String(pending_cast["action"]), hit_count > 0)
	_notice(String(rule["name"]) + ("命中" + str(hit_count) + "目标 · " + ("裂翼兽" if last_enemy == beast else "裂脊兽") + "生命 " + str(ceili(last_enemy.hp)) if hit_count > 0 else "落空 · 调整瞄准或避开遮挡"))
	pending_cast_time = -1.0
	pending_cast.clear()

func _cast_los_clear(origin: Vector3, target_point: Vector3, enemy: NativeEnemyR3) -> bool:
	var ray := PhysicsRayQueryParameters3D.create(origin, target_point)
	ray.collision_mask = 1
	ray.exclude = [player.get_rid()]
	var hit := get_world_3d().direct_space_state.intersect_ray(ray)
	if hit.is_empty():
		return true
	var node: Node = hit.get("collider") as Node
	while node != null:
		if node == enemy:
			return true
		node = node.get_parent()
	return false

func _combat_event(phase: String, action: String, hit: bool) -> void:
	combat_event.emit({"phase": phase, "action": action, "hit": hit, "time": time, "physics_delta": last_combat_physics_delta, "player_position": player.global_position})

func _try_pickup() -> void:
	var nearest: NativeEnemyR3 = null
	var distance := 4.0
	for enemy in _combat_targets():
		var current := player.global_position.distance_to(enemy.global_position)
		if enemy.mode == "dead" and enemy.loot_left > 0 and current < distance:
			nearest = enemy
			distance = current
	if nearest == null:
		_notice("附近没有可拾取物")
		return
	var slot := -1 if nearest == beast else enemies.find(nearest)
	if training_enemy_slots.has(slot):
		_notice("试玩重置的对手不重复产出掉落")
		return
	nearest.loot_left -= 1
	fragments += 1
	_save_game()
	_notice("拾取" + ("裂翼羽片" if nearest == beast else "裂脊晶片") + " +1 · 已持有 " + str(fragments))

func _reset_duel() -> void:
	if mounted:
		_notice("先下车再重置试玩对手")
		return
	beast.restore({"hp": beast.max_hp, "mode": "ground", "position": [NativeRiftwing.HOME_X, world.height_at(NativeRiftwing.HOME_X, NativeRiftwing.HOME_Z), NativeRiftwing.HOME_Z], "loot_left": 0})
	for i in range(enemies.size()):
		var enemy := enemies[i]
		enemy.restore({"hp": enemy.max_hp, "mode": "ground", "position": [enemy.home.x, world.height_at(enemy.home.x, enemy.home.z), enemy.home.z], "loot_left": 0})
	training_enemy_slots.clear()
	training_enemy_slots.append(-1)
	for i in range(enemies.size()):
		training_enemy_slots.append(i)
	player.teleport_to_ground(1370.0, -1022.0)
	world.update_stream(player.global_position)
	_save_game()
	_notice("裂翼岭试玩对手已重置 · 再次击杀不重复产出掉落")

func _try_investigate() -> void:
	for site in SITES:
		var point := Vector3(float(site["x"]), world.height_at(float(site["x"]), float(site["z"])), float(site["z"]))
		if player.global_position.distance_to(point) <= 8.0:
			if String(site["id"]) not in investigated:
				investigated.append(String(site["id"]))
				_save_game()
			_notice("记录地标：" + String(site["label"]) + " · " + str(investigated.size()) + "/" + str(SITES.size()))
			return
	_notice("靠近目标地标再按 E")

func _on_beast_defeated() -> void:
	_save_game()
	_notice("裂翼巡猎兽已击杀 · 落地靠近尸体按 H 拾取")

func _on_ground_enemy_defeated(_event: Dictionary) -> void:
	_save_game()
	_notice("裂脊兽已击杀 · 靠近尸体按 H 拾取")

func _on_enemy_skill_event(event: Dictionary) -> void:
	combat_event.emit({"phase": String(event.get("phase", "")), "action": String(event.get("attack_id", "")), "side": "enemy", "hit": false, "time": time, "physics_delta": last_combat_physics_delta, "source_id": int(event.get("source_id", 0))})

func _on_enemy_attack_requested(event: Dictionary) -> void:
	var enemy := event.get("enemy") as NativeEnemyR3
	if enemy == null or enemy.mode == "dead" or player.health <= 0.0 or mounted:
		return
	var origin: Vector3 = event.get("origin", Vector3(INF, INF, INF))
	var direction: Vector3 = event.get("direction", Vector3.ZERO)
	var reach := float(event.get("reach", 0.0))
	var radius := float(event.get("radius", 0.0))
	if not origin.is_finite() or not direction.is_finite() or direction.length_squared() < 0.001 or reach < 0.0 or radius < 0.0:
		return
	var center := player.global_position + Vector3.UP * 0.86
	var end := origin + direction.normalized() * reach
	var nearest := Geometry3D.get_closest_point_to_segment(center, origin, end)
	var in_range := nearest.distance_to(center) <= radius + 0.42
	var ray := PhysicsRayQueryParameters3D.create(origin, center)
	ray.collision_mask = 1
	ray.exclude = [player.get_rid()]
	var clear := get_world_3d().direct_space_state.intersect_ray(ray).is_empty()
	var landed := false
	var blocked := false
	if in_range and clear:
		var result := player.receive_combat_hit(event)
		landed = bool(result.get("landed", false))
		blocked = bool(result.get("blocked", false))
		if landed:
			_combat_event("enemy_impact", String(event.get("attack_id", "")), true)
			_notice(("格挡" if blocked else "受击") + " · " + ("裂翼兽" if enemy == beast else "裂脊兽") + " " + String(event.get("attack_id", "")))
	enemy.acknowledge_attack_result(int(event.get("serial", -1)), landed, blocked)

func _notice(text: String) -> void:
	message = text
	message_until = time + 5.0

func _update_hud() -> void:
	var flight := "御空" if player.flight_active else "步行"
	var speed := roundi(player.horizontal_speed)
	var opponent := "裂翼兽 " + str(roundi(beast.hp / NativeRiftwing.MAX_HP * 100.0)) + "%"
	if not enemies.is_empty():
		var ground_enemy := enemies[0]
		opponent += " · 裂脊兽 " + str(roundi(ground_enemy.hp / ground_enemy.max_hp * 100.0)) + "%"
	var mode := "驾驶勘探车" if mounted else flight
	var altitude := maxf(0.0, player.global_position.y - player._foot_support_here())
	var altitude_text := "%.1f" % altitude if altitude < 5.0 else str(roundi(altitude))
	var flight_status := "按 G 起飞" if not player.flight_active else "G 上升 · C 着陆"
	if not player.flight_active and player.energy < NativePlayer.LAUNCH_ENERGY - 0.001:
		var seconds := ceili((NativePlayer.LAUNCH_ENERGY - player.energy) / NativePlayer.GROUND_ENERGY_RECOVERY)
		flight_status = "回息中 · G 起飞需 25% · 约 " + str(seconds) + " 秒"
	elif player.flight_active and player.energy <= 0.0:
		flight_status = "灵息耗尽 · 正在安全降落"
	elif player.flight_active and player.energy < NativePlayer.BOOST_MIN_ENERGY:
		flight_status = "低灵息 · 暂不可加速"
	if mounted:
		flight_status = "驾车中 · 停稳后按 F 下车"
	status.text = "星渊 · 原生盆地 6km · 境界 R" + str(player.realm) + "\n" + mode + " · " + str(speed) + " 米/秒 · 离地 " + altitude_text + " 米\n生命 " + str(roundi(player.health)) + " · 灵息 " + str(roundi(player.energy)) + "% · 羽片 " + str(fragments) + "\n" + flight_status + "\n" + opponent + " · 地标 " + str(investigated.size()) + "/" + str(SITES.size()) + "\n" + _site_guidance()
	hint.text = message if time < message_until else _combat_hint_text()
	if Input.get_mouse_mode() != Input.MOUSE_MODE_CAPTURED:
		hint.text = "点击游戏画面恢复控制 · WASD 移动 · Esc 释放鼠标"

func _combat_hint_text() -> String:
	var skill: Dictionary = AIR_CAST_RULES[_r3_rank()]
	var cooldown := maxf(0.0, cast_cooldown_until - time)
	var skill_hint := String(skill["name"]) + " 灵息" + str(roundi(float(skill["cost"]))) + (" 冷却%.1fs" % cooldown if cooldown > 0.0 else " 已就绪")
	var blink_hint := " · Q/Alt+Q 瞬移" if player.realm >= 6 else ""
	return "WASD 移动 · Space 跳跃 · G/C 御空 · Shift 加速 · V 视角 · E 调查 · F 载具 · H 拾取\n左键连击 · 右键格挡 · R " + skill_hint + " · F2/F3 对打 · F6 境界" + blink_hint

func _site_guidance() -> String:
	var closest: Dictionary = {}
	var best := INF
	for site in SITES:
		if investigated.has(String(site["id"])):
			continue
		var dx := float(site["x"]) - player.global_position.x
		var dz := float(site["z"]) - player.global_position.z
		var d := Vector2(dx, dz).length()
		if d < best:
			best = d
			closest = site
	if closest.is_empty():
		return "所有地标已记录"
	var east := float(closest["x"]) - player.global_position.x
	var south := float(closest["z"]) - player.global_position.z
	var bearing := "东" if absf(east) > absf(south) and east >= 0.0 else ("西" if absf(east) > absf(south) else ("南" if south >= 0.0 else "北"))
	return "下个地标：" + String(closest["label"]) + " · " + bearing + " " + str(roundi(best)) + "米"

func _save_game() -> void:
	if not initialized or not player.is_inside_tree() or not beast.is_inside_tree() or not skimmer.is_inside_tree():
		return
	var player_data := player.snapshot()
	if mounted:
		var exit_point := _vehicle_exit_position()
		if exit_point.is_finite():
			player_data.merge({"x": exit_point.x, "y": exit_point.y, "z": exit_point.z, "flight_active": false, "vx": 0.0, "vy": 0.0, "vz": 0.0}, true)
	var enemy_data: Array[Dictionary] = []
	for enemy in enemies:
		enemy_data.append(enemy.snapshot())
	var data := {"version": 1, "player": player_data, "riftwing": beast.snapshot(), "enemy_r3": enemy_data, "ascension": ascension.snapshot(), "combat": {"cast_cooldown_remaining": maxf(0.0, cast_cooldown_until - time), "training_enemy_slots": training_enemy_slots}, "skimmer": [skimmer.global_position.x, skimmer.global_position.y, skimmer.global_position.z], "fragments": fragments, "investigated": investigated}
	var file := FileAccess.open(save_path, FileAccess.WRITE)
	if file == null:
		push_error("Native save write failed: " + str(FileAccess.get_open_error()))
		return
	file.store_string(JSON.stringify(data))
	file.flush()

func _restore_save() -> void:
	if not FileAccess.file_exists(save_path):
		return
	var file := FileAccess.open(save_path, FileAccess.READ)
	if file == null:
		return
	var raw: Variant = JSON.parse_string(file.get_as_text())
	if not (raw is Dictionary) or int(raw.get("version", 0)) != 1:
		return
	# An early build saved all three global transforms after scene teardown.
	# Repair only that unmistakable signature; retain progression and inventory.
	var saved_player: Dictionary = raw.get("player", {})
	var saved_beast: Dictionary = raw.get("riftwing", {})
	if saved_player.has_all(["x", "y", "z"]) and Vector3(float(saved_player.x), float(saved_player.y), float(saved_player.z)).is_zero_approx() and _zero_saved_position(raw.get("skimmer")) and _zero_saved_position(saved_beast.get("position")):
		_backup_position_save()
		saved_player.merge({"x": 0.0, "y": world.height_at(0.0, 190.0), "z": 190.0, "flight_active": false, "vx": 0.0, "vy": 0.0, "vz": 0.0}, true)
		raw["skimmer"] = [72.0, world.height_at(72.0, 80.0), 80.0]
		saved_beast["position"] = [NativeRiftwing.HOME_X, world.height_at(NativeRiftwing.HOME_X, NativeRiftwing.HOME_Z), NativeRiftwing.HOME_Z]
		repaired_legacy_positions = true
	if raw.get("player") is Dictionary:
		player.restore(raw["player"])
	if raw.get("riftwing") is Dictionary:
		beast.restore(raw["riftwing"])
	var saved_enemies: Variant = raw.get("enemy_r3", [])
	if saved_enemies is Array:
		for i in range(mini(enemies.size(), saved_enemies.size())):
			if saved_enemies[i] is Dictionary:
				enemies[i].restore(saved_enemies[i])
	if raw.get("ascension") is Dictionary:
		ascension.restore(raw["ascension"])
	if raw.get("combat") is Dictionary:
		cast_cooldown_until = time + clampf(float(raw["combat"].get("cast_cooldown_remaining", 0.0)), 0.0, 30.0)
		for slot in raw["combat"].get("training_enemy_slots", []):
			if slot is int or slot is float:
				var index := int(slot)
				if is_equal_approx(float(slot), float(index)) and index >= -1 and index < enemies.size() and not training_enemy_slots.has(index):
					training_enemy_slots.append(index)
	var position: Array = raw.get("skimmer", [])
	if position.size() == 3 and absf(float(position[0])) <= 2997.0 and absf(float(position[2])) <= 2997.0:
		skimmer.global_position = Vector3(float(position[0]), world.height_at(float(position[0]), float(position[2])), float(position[2]))
	fragments = clampi(int(raw.get("fragments", 0)), 0, 100000)
	for id in raw.get("investigated", []):
		if id is String and not investigated.has(id):
			investigated.append(id)

func _zero_saved_position(value: Variant) -> bool:
	return value is Array and value.size() == 3 and Vector3(float(value[0]), float(value[1]), float(value[2])).is_zero_approx()

func _backup_position_save() -> void:
	var backup := save_path + ".before-position-repair.bak"
	if FileAccess.file_exists(save_path) and not FileAccess.file_exists(backup):
		DirAccess.copy_absolute(ProjectSettings.globalize_path(save_path), ProjectSettings.globalize_path(backup))

func _recover_restored_overlap() -> void:
	# Wait for restored physics transforms before checking real vehicle/wall shapes.
	var resume_player_physics := player.is_physics_processing()
	player.set_physics_process(false)
	await get_tree().physics_frame
	await get_tree().physics_frame
	if not is_inside_tree() or not initialized:
		return
	if not player._destination_clear(player.global_position):
		_backup_position_save()
		var origin := player.global_position
		var recovered := false
		for radius in [3.0, 5.0, 8.0]:
			for i in range(8):
				var angle := TAU * float(i) / 8.0
				if player.teleport_to_ground(origin.x + cos(angle) * radius, origin.z + sin(angle) * radius):
					recovered = true
					break
			if recovered:
				break
		if not recovered:
			player.teleport_to_ground(0.0, 190.0)
		repaired_legacy_positions = true
	if repaired_legacy_positions:
		_notice("已修复旧档位置重叠，进度保留；点击画面后 WASD 移动")
		_save_game()
	player.set_physics_process(resume_player_physics)

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		_save_game()
		get_tree().quit()

