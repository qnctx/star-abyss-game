extends Node

signal night_started()
signal day_started()
signal wave_spawned(wave_number: int)
signal base_health_changed(health: float)
signal base_shield_changed(shield: float, max_shield: float)
signal enemies_alive_changed(count: int)

var is_night: bool = false
var wave_number: int = 0
var enemies_alive: int = 0
var base_health: float = 100.0
var base_shield: float = 0.0
var max_base_shield: float = 0.0
var _cycle_token: int = 0

const MAX_BASE_HEALTH: float = 100.0
const DAY_DURATION: float = 960.0   # 16分钟白天
const NIGHT_DURATION: float = 480.0  # 8分钟夜晚
const ENEMIES_PER_WAVE_BASE: int = 3
const ENEMIES_PER_WAVE_INCREMENT: int = 2
const BASE_REPAIR_COST := {"iron": 10, "biomass": 5}
const BASE_REPAIR_AMOUNT: float = 25.0
const SHIELD_RECHARGE_RATE: float = 3.0


func _ready():
	set_process(true)
	start_day()


func _process(delta: float) -> void:
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
	enemies_alive_changed.emit(enemies_alive)
	base_health_changed.emit(base_health)
	base_shield_changed.emit(base_shield, max_base_shield)
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
	wave_number += 1
	night_started.emit()
	# Darken environment for night: reduce ambient light and thicken fog
	_apply_night_darkening(true)
	spawn_wave()
	await get_tree().create_timer(NIGHT_DURATION).timeout
	if token == _cycle_token and is_night:
		start_day()


func spawn_wave():
	var base_count = ENEMIES_PER_WAVE_BASE + int(wave_number * 0.5)
	wave_spawned.emit(wave_number)

	if is_boss_wave():
		spawn_enemy(true, false)  # 1 boss
		for i in range(max(0, base_count - 1)):
			spawn_enemy(false, false)
			await get_tree().create_timer(randf_range(1.0, 3.0)).timeout
	elif is_elite_wave():
		spawn_enemy(false, true)  # 1 elite
		for i in range(max(0, base_count - 1)):
			spawn_enemy(false, false)
			await get_tree().create_timer(randf_range(1.0, 3.0)).timeout
	else:
		for i in range(base_count):
			spawn_enemy(false, false)
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


func spawn_enemy(is_boss: bool = false, is_elite: bool = false):
	var enemy_scene = load("res://scenes/enemy.tscn")
	var enemy = enemy_scene.instantiate()
	get_tree().current_scene.add_child(enemy)
	enemy.global_position = WorldGenerator.get_spawn_position(8.0, 12.0)
	enemies_alive += 1
	enemies_alive_changed.emit(enemies_alive)

	# Apply boss/elite scaling
	if is_boss:
		enemy.speed *= 2.0
		enemy.health *= 5.0
		enemy.damage *= 3.0
		enemy.name = "Boss_Wave" + str(wave_number)
	elif is_elite:
		enemy.speed *= 1.5
		enemy.health *= 3.0
		enemy.damage *= 2.0
		enemy.name = "Elite_Wave" + str(wave_number)

	enemy.enemy_died.connect(_on_enemy_died)
	enemy.base_reached.connect(_on_base_reached)


func is_elite_wave() -> bool:
	return wave_number % 5 == 0 and wave_number % 10 != 0


func is_boss_wave() -> bool:
	return wave_number % 10 == 0


func _on_enemy_died():
	_drop_enemy_reward()
	enemies_alive -= 1
	enemies_alive_changed.emit(enemies_alive)


func _on_base_reached(damage: float):
	var remaining_damage := damage
	if base_shield > 0.0:
		var absorbed := minf(base_shield, remaining_damage)
		base_shield -= absorbed
		remaining_damage -= absorbed
		base_shield_changed.emit(base_shield, max_base_shield)
	if remaining_damage <= 0.0:
		return

	base_health = maxf(0.0, base_health - remaining_damage)
	base_health_changed.emit(base_health)
	if base_health <= 0:
		game_over()


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


func register_base_shield(amount: float) -> void:
	max_base_shield += amount
	base_shield = minf(max_base_shield, base_shield + amount)
	base_shield_changed.emit(base_shield, max_base_shield)


func unregister_base_shield(amount: float) -> void:
	max_base_shield = maxf(0.0, max_base_shield - amount)
	base_shield = minf(base_shield, max_base_shield)
	base_shield_changed.emit(base_shield, max_base_shield)


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
