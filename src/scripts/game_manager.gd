extends Node

signal night_started()
signal day_started()
signal wave_spawned(wave_number: int)
signal base_health_changed(health: float)
signal base_shield_changed(shield: float, max_shield: float)
signal enemies_alive_changed(count: int)
signal wave_direction_changed(direction: String)

var is_night: bool = false
var wave_number: int = 0
var enemies_alive: int = 0
var base_health: float = 100.0
var base_shield: float = 0.0
var max_base_shield: float = 0.0
var phase_time_remaining: float = 0.0
var last_wave_direction: String = "--"
var _cycle_token: int = 0
var _wave_direction_reported: bool = false

const MAX_BASE_HEALTH: float = 100.0
const DAY_DURATION: float = 960.0   # 16分钟白天
const NIGHT_DURATION: float = 480.0  # 8分钟夜晚
const ENEMIES_PER_WAVE_BASE: int = 3
const ENEMIES_PER_WAVE_INCREMENT: int = 2
const BASE_REPAIR_COST := {"iron": 10, "biomass": 5}
const BASE_REPAIR_AMOUNT: float = 25.0
const SHIELD_RECHARGE_RATE: float = 3.0
const STRUCTURE_DAMAGE_RADIUS: float = 4.5
const STRUCTURE_MAX_HEALTH: float = 100.0


func _ready():
	set_process(true)
	start_day()


func _process(delta: float) -> void:
	phase_time_remaining = maxf(0.0, phase_time_remaining - delta)

	if max_base_shield <= 0.0 or base_shield >= max_base_shield:
		return
	base_shield = minf(max_base_shield, base_shield + SHIELD_RECHARGE_RATE * delta)
	base_shield_changed.emit(base_shield, max_base_shield)


func start_day():
	_cycle_token += 1
	var token := _cycle_token
	is_night = false
	wave_number = 0
	enemies_alive = 0
	phase_time_remaining = DAY_DURATION
	last_wave_direction = "--"
	enemies_alive_changed.emit(enemies_alive)
	base_health_changed.emit(base_health)
	base_shield_changed.emit(base_shield, max_base_shield)
	wave_direction_changed.emit(last_wave_direction)
	# Restore daylight environment settings
	_apply_night_darkening(false)
	day_started.emit()
	spawn_resources()
	await get_tree().create_timer(DAY_DURATION).timeout
	if token != _cycle_token or is_night:
		return
	start_night()


func start_night():
	if is_night:
		return
	_cycle_token += 1
	var token := _cycle_token
	is_night = true
	phase_time_remaining = NIGHT_DURATION
	wave_number += 1
	night_started.emit()
	# Darken environment for night: reduce ambient light and thicken fog
	_apply_night_darkening(true)
	spawn_wave()
	await get_tree().create_timer(NIGHT_DURATION).timeout
	if token == _cycle_token and is_night:
		start_day()


func spawn_wave() -> void:
	var base_count: int = ENEMIES_PER_WAVE_BASE + int(wave_number * 0.5)
	_wave_direction_reported = false
	wave_spawned.emit(wave_number)
	var wave_variant := get_wave_variant()

	if wave_variant == "boss":
		spawn_enemy("boss")  # 1 boss
		for i in range(max(0, base_count - 1)):
			spawn_enemy("normal")
			await get_tree().create_timer(randf_range(1.0, 3.0)).timeout
	elif wave_variant == "elite":
		spawn_enemy("elite")  # 1 elite
		for i in range(max(0, base_count - 1)):
			spawn_enemy("normal")
			await get_tree().create_timer(randf_range(1.0, 3.0)).timeout
	elif wave_variant == "scout":
		spawn_enemy("scout")
		for i in range(max(0, base_count - 1)):
			spawn_enemy("normal")
			await get_tree().create_timer(randf_range(0.8, 2.2)).timeout
	elif wave_variant == "tank":
		spawn_enemy("tank")
		for i in range(max(0, base_count - 1)):
			spawn_enemy("normal")
			await get_tree().create_timer(randf_range(1.2, 3.2)).timeout
	else:
		for i in range(base_count):
			spawn_enemy("normal")
			await get_tree().create_timer(randf_range(1.0, 3.0)).timeout

	# Wait for all enemies to die or day to break
	while enemies_alive > 0 and is_night:
		await get_tree().create_timer(1.0).timeout

	# Spawn next wave if still night
	if is_night:
		await get_tree().create_timer(5.0).timeout
		wave_number += 1
		wave_spawned.emit(wave_number)
		spawn_wave()


func spawn_enemy(variant: String = "normal") -> Node:
	var enemy_scene = load("res://scenes/enemy.tscn")
	var enemy = enemy_scene.instantiate()
	get_tree().current_scene.add_child(enemy)
	enemy.global_position = WorldGenerator.get_spawn_position(8.0, 12.0)
	if not _wave_direction_reported:
		_wave_direction_reported = true
		last_wave_direction = _direction_label(WorldGenerator.base_position, enemy.global_position)
		wave_direction_changed.emit(last_wave_direction)
	enemies_alive += 1
	enemies_alive_changed.emit(enemies_alive)

	# Apply variant scaling
	if variant == "boss":
		enemy.speed *= 2.0
		enemy.health *= 5.0
		enemy.damage *= 3.0
		enemy.name = "Boss_Wave" + str(wave_number)
	elif variant == "elite":
		enemy.speed *= 1.5
		enemy.health *= 3.0
		enemy.damage *= 2.0
		enemy.name = "Elite_Wave" + str(wave_number)
	elif variant == "scout":
		enemy.speed *= 1.8
		enemy.health *= 0.7
		enemy.damage *= 0.75
		enemy.scale = Vector3.ONE * 0.85
		enemy.name = "Scout_Wave" + str(wave_number)
	elif variant == "tank":
		enemy.speed *= 0.7
		enemy.health *= 2.8
		enemy.damage *= 1.7
		enemy.scale = Vector3.ONE * 1.35
		enemy.name = "Tank_Wave" + str(wave_number)

	enemy.set_meta("wave_variant", variant)
	enemy.set_meta("wave_variant_label", get_wave_variant_label(variant))
	_apply_enemy_variant_visual(enemy, variant)
	enemy.enemy_died.connect(_on_enemy_died)
	enemy.base_reached.connect(_on_base_reached)
	return enemy


func is_elite_wave() -> bool:
	return wave_number % 5 == 0 and wave_number % 10 != 0


func is_boss_wave() -> bool:
	return wave_number % 10 == 0


func is_scout_wave() -> bool:
	return wave_number % 3 == 0 and not is_elite_wave() and not is_boss_wave()


func is_tank_wave() -> bool:
	return wave_number % 4 == 0 and not is_elite_wave() and not is_boss_wave() and not is_scout_wave()


func get_wave_variant() -> String:
	if is_boss_wave():
		return "boss"
	if is_elite_wave():
		return "elite"
	if is_scout_wave():
		return "scout"
	if is_tank_wave():
		return "tank"
	return "normal"


func get_wave_variant_label(variant: String = "") -> String:
	if variant.is_empty():
		variant = get_wave_variant()
	match variant:
		"boss":
			return "Boss"
		"elite":
			return "Elite"
		"scout":
			return "Scout"
		"tank":
			return "Tank"
		_:
			return "Normal"


func get_wave_variant_color(variant: String = "") -> Color:
	if variant.is_empty():
		variant = get_wave_variant()
	match variant:
		"boss":
			return Color(1.0, 0.12, 0.08, 1.0)
		"elite":
			return Color(0.7, 0.2, 1.0, 1.0)
		"scout":
			return Color(0.2, 0.85, 1.0, 1.0)
		"tank":
			return Color(0.95, 0.72, 0.18, 1.0)
		_:
			return Color(0.35, 0.1, 0.1, 1.0)


func _apply_enemy_variant_visual(enemy: Node, variant: String) -> void:
	var color := get_wave_variant_color(variant)
	var emission_strength := 0.0 if variant == "normal" else 0.45
	for child in enemy.find_children("*", "CSGPrimitive3D", true, false):
		var csg_shape := child as CSGPrimitive3D
		var material := StandardMaterial3D.new()
		material.albedo_color = color
		material.roughness = 0.55
		material.metallic = 0.12
		if emission_strength > 0.0:
			material.emission_enabled = true
			material.emission = color
			material.emission_energy_multiplier = emission_strength
		csg_shape.material = material


func _on_enemy_died():
	_drop_enemy_reward()
	enemies_alive -= 1
	enemies_alive_changed.emit(enemies_alive)


func _on_base_reached(damage: float, hit_position: Vector3 = Vector3.ZERO):
	var remaining_damage := damage
	if base_shield > 0.0:
		var absorbed := minf(base_shield, remaining_damage)
		base_shield -= absorbed
		remaining_damage -= absorbed
		base_shield_changed.emit(base_shield, max_base_shield)
	if remaining_damage <= 0.0:
		return

	var impact_position := hit_position
	if impact_position == Vector3.ZERO and WorldGenerator:
		impact_position = WorldGenerator.base_position
	_damage_nearby_structures(impact_position, remaining_damage)
	base_health = maxf(0.0, base_health - remaining_damage)
	base_health_changed.emit(base_health)
	if base_health <= 0:
		game_over()


func _damage_nearby_structures(center: Vector3, damage: float) -> int:
	var damaged_count := 0
	var scene := get_tree().current_scene
	if not scene:
		return damaged_count
	for structure in get_tree().get_nodes_in_group("built_structures"):
		var structure_node := structure as Node3D
		if not structure_node or not is_instance_valid(structure_node):
			continue
		if structure_node.global_position.distance_to(center) > STRUCTURE_DAMAGE_RADIUS:
			continue
		_ensure_structure_health(structure_node)
		var max_health: float = float(structure_node.get_meta("structure_max_health", STRUCTURE_MAX_HEALTH))
		var current_health: float = float(structure_node.get_meta("structure_health", max_health))
		var next_health: float = maxf(0.0, current_health - damage)
		structure_node.set_meta("structure_health", next_health)
		damaged_count += 1
		if next_health <= 0.0:
			structure_node.queue_free()
	return damaged_count


func _ensure_structure_health(structure: Node) -> void:
	if not structure:
		return
	if not structure.has_meta("structure_max_health"):
		structure.set_meta("structure_max_health", STRUCTURE_MAX_HEALTH)
	if not structure.has_meta("structure_health"):
		structure.set_meta("structure_health", float(structure.get_meta("structure_max_health", STRUCTURE_MAX_HEALTH)))


func can_repair_base() -> bool:
	return base_health < MAX_BASE_HEALTH and InventoryManager.has_resources(BASE_REPAIR_COST)


func repair_base() -> bool:
	if base_health >= MAX_BASE_HEALTH:
		return false
	if not InventoryManager.has_resources(BASE_REPAIR_COST):
		return false

	InventoryManager.consume_resources(BASE_REPAIR_COST)
	base_health = minf(MAX_BASE_HEALTH, base_health + BASE_REPAIR_AMOUNT)
	base_health_changed.emit(base_health)
	return true


func force_start_night() -> bool:
	if is_night:
		return false
	start_night()
	return true


func get_base_repair_cost_text() -> String:
	return "10 iron + 5 biomass"


func get_phase_timer_text() -> String:
	var total_seconds := ceili(phase_time_remaining)
	var minutes := int(total_seconds / 60)
	var seconds := total_seconds % 60
	var label := "Night ends" if is_night else "Next night"
	return "%s %02d:%02d" % [label, minutes, seconds]


func register_base_shield(amount: float) -> void:
	max_base_shield += amount
	base_shield = minf(max_base_shield, base_shield + amount)
	base_shield_changed.emit(base_shield, max_base_shield)


func unregister_base_shield(amount: float) -> void:
	max_base_shield = maxf(0.0, max_base_shield - amount)
	base_shield = minf(base_shield, max_base_shield)
	base_shield_changed.emit(base_shield, max_base_shield)


func _direction_label(from_pos: Vector3, to_pos: Vector3) -> String:
	var delta := to_pos - from_pos
	var parts: Array[String] = []
	if delta.z < -2.0:
		parts.append("N")
	elif delta.z > 2.0:
		parts.append("S")
	if delta.x > 2.0:
		parts.append("E")
	elif delta.x < -2.0:
		parts.append("W")
	if parts.is_empty():
		return "CENTER"
	return "".join(parts)


func spawn_resources():
	var count = 15
	var types = ["iron", "iron", "iron", "iron", "void_crystal", "void_crystal", "biomass", "biomass", "biomass"]
	for i in range(count):
		var angle = randf_range(0, TAU)
		var distance = randf_range(3.0, 12.0)
		var pos = Vector3(cos(angle) * distance, 0.3, sin(angle) * distance)
		var node = load("res://scenes/resource_node.tscn").instantiate()
		if node and node.has_method("resource_type"):
			node.position = pos
			node.resource_type = types[i % types.size()]
			node.amount = randi_range(1, 3)
			get_tree().current_scene.add_child(node)


func _apply_night_darkening(night: bool) -> void:
	## Adjust environment lighting for day/night cycle.
	## Reduces ambient light and increases fog density at night for a darker atmosphere.
	var env = get_tree().current_scene.get_node_or_null("WorldEnvironment")
	if env and env.environment:
		if night:
			env.environment.ambient_light_energy = 0.05
			env.environment.fog_density = 0.035
			env.environment.background_color = Color(0.02, 0.01, 0.03, 1)
		else:
			env.environment.ambient_light_energy = 0.3
			env.environment.fog_density = 0.025
			env.environment.background_color = Color(0.1, 0.05, 0.15, 1)


func game_over():
	get_tree().paused = true
	print("GAME OVER - Base destroyed!")


func _drop_enemy_reward() -> void:
	var roll := randf()
	if roll < 0.60:
		InventoryManager.add_resource("iron", randi_range(1, 3))
	elif roll < 0.85:
		InventoryManager.add_resource("biomass", randi_range(1, 2))
	elif roll < 0.97:
		InventoryManager.add_resource("void_crystal", 1)
	else:
		InventoryManager.add_resource("energy_core", 1)
