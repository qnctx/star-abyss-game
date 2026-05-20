extends Node

signal night_started()
signal day_started()
signal wave_spawned(wave_number: int)

var is_night: bool = false
var wave_number: int = 0
var enemies_alive: int = 0
var base_health: float = 100.0

const DAY_DURATION: float = 120.0
const NIGHT_DURATION: float = 60.0
const ENEMIES_PER_WAVE_BASE: int = 3
const ENEMIES_PER_WAVE_INCREMENT: int = 2


func _ready():
	start_day()


func start_day():
	is_night = false
	wave_number = 0
	enemies_alive = 0
	day_started.emit()
	spawn_resources()
	await get_tree().create_timer(DAY_DURATION).timeout
	start_night()


func start_night():
	is_night = true
	wave_number += 1
	night_started.emit()
	spawn_wave()


func spawn_wave():
	var count = ENEMIES_PER_WAVE_BASE + (wave_number - 1) * ENEMIES_PER_WAVE_INCREMENT
	wave_spawned.emit(wave_number)
	for i in range(count):
		spawn_enemy()
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
	else:
		start_day()


func spawn_enemy():
	var enemy_scene = load("res://scenes/enemy.tscn")
	var enemy = enemy_scene.instantiate()
	var angle = randf_range(0, TAU)
	var distance = randf_range(8.0, 12.0)
	enemy.position = Vector3(cos(angle) * distance, 1, sin(angle) * distance)
	get_tree().current_scene.add_child(enemy)
	enemies_alive += 1
	enemy.enemy_died.connect(_on_enemy_died)
	enemy.base_reached.connect(_on_base_reached)


func _on_enemy_died():
	enemies_alive -= 1


func _on_base_reached(damage: float):
	base_health -= damage
	if base_health <= 0:
		game_over()


func spawn_resources():
	var count = 15
	var types = ["iron", "iron", "iron", "iron", "void_crystal", "void_crystal", "biomass", "biomass", "biomass"]
	for i in range(count):
		var angle = randf_range(0, TAU)
		var distance = randf_range(3.0, 12.0)
		var pos = Vector3(cos(angle) * distance, 0.3, sin(angle) * distance)
		var node = load("res://scenes/resource_node.tscn").instantiate()
		node.position = pos
		node.resource_type = types[i % types.size()]
		node.amount = randi_range(1, 3)
		get_tree().current_scene.add_child(node)


func game_over():
	get_tree().paused = true
	print("GAME OVER - Base destroyed!")
