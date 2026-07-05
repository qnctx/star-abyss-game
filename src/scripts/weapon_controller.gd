extends Node3D

signal weapon_fired()
signal weapon_changed(weapon_name: String, ammo_count: int)
signal ammo_changed(weapon_name: String, ammo_count: int)

const AIM_TARGETING := preload("res://scripts/aim_targeting.gd")

@export var current_weapon: String = "pistol"

var weapon_data = {
	"pistol": {"damage": 10, "fire_rate": 2.0, "spread": 0.05, "projectile_speed": 20.0, "ammo_per_shot": 0, "label": "手枪"},
	"shotgun": {"damage": 8, "fire_rate": 0.8, "spread": 0.3, "projectile_speed": 15.0, "ammo_per_shot": 1, "pellets": 5, "label": "霰弹枪"},
	"rifle": {"damage": 25, "fire_rate": 3.0, "spread": 0.02, "projectile_speed": 30.0, "ammo_per_shot": 1, "label": "步枪"},
	"flamethrower": {"damage": 5, "fire_rate": 10.0, "spread": 0.4, "projectile_speed": 8.0, "ammo_per_shot": 1, "label": "火焰喷射器"},
	"ice_ray": {"damage": 15, "fire_rate": 1.5, "spread": 0.01, "projectile_speed": 25.0, "ammo_per_shot": 1, "slow_amount": 0.5, "label": "冰冻射线"},
}

const QUALITY_NAMES = ["normal", "fine", "rare", "epic", "legendary"]
const QUALITY_MULTIPLIERS = {"normal": 1.0, "fine": 1.25, "rare": 1.45, "epic": 1.7, "legendary": 1.9}

var weapon_quality: String = "normal"
var weapon_qualities: Dictionary = {}  # weapon_name -> quality string
var can_fire: bool = true
var ammo = {"rifle": 30, "shotgun": 15, "flamethrower": 50, "ice_ray": 20}
var infinite_ammo_weapons = ["pistol"]
var unlocked_weapons = ["pistol", "rifle", "shotgun"]

const PROJECTILE_SCENE_PATH = "res://scenes/player_projectile.tscn"
var projectile_scene = null


func _ready():
	projectile_scene = load(PROJECTILE_SCENE_PATH)
	weapon_changed.emit(current_weapon, _get_current_ammo())


func _process(_delta):
	if not _weapon_tool_active():
		return
	if Input.is_action_pressed("shoot") and can_fire:
		fire()

	# Weapon switching
	if _toolbelt_exists():
		return
	for i in range(5):
		if Input.is_action_just_pressed("weapon_switch_" + str(i + 1)):
			var weapons = unlocked_weapons
			if i < weapons.size():
				switch_weapon(weapons[i])


func fire():
	var data = weapon_data[current_weapon]
	var pellets = data.get("pellets", 1)

	for pellet_i in range(pellets):
		var spread_angle = randf_range(-data.spread, data.spread)
		var aim_dir = get_aim_direction()
		if aim_dir == Vector3.ZERO:
			aim_dir = Vector3.FORWARD

		# Apply spread as rotation around Y axis
		var spread_offset = aim_dir.rotated(Vector3.UP, spread_angle)

		var proj = projectile_scene.instantiate()
		get_tree().current_scene.add_child(proj)
		proj.global_position = global_position + Vector3(0, 0.5, 0)
		proj.direction = spread_offset.normalized()
		proj.speed = data.projectile_speed
		proj.damage = data.damage * QUALITY_MULTIPLIERS[_get_weapon_quality(current_weapon)]
		proj.slow_amount = data.get("slow_amount", 0)
		proj.weapon_type = current_weapon

	# Ammo consumption
	if current_weapon not in infinite_ammo_weapons:
		ammo[current_weapon] -= data.ammo_per_shot
		ammo_changed.emit(current_weapon, ammo[current_weapon])
		if ammo[current_weapon] <= 0:
			switch_weapon("pistol")
			return

	can_fire = false
	weapon_fired.emit()
	await get_tree().create_timer(1.0 / data.fire_rate).timeout
	can_fire = true


func get_aim_direction() -> Vector3:
	var ray := AIM_TARGETING.new().get_aim_ray(get_viewport(), 80.0)
	if not bool(ray.get("valid", false)):
		return (global_transform.basis * Vector3.FORWARD).normalized()
	return (ray["direction"] as Vector3).normalized()


func switch_weapon(weapon_name: String):
	if weapon_name in weapon_data and weapon_name in unlocked_weapons:
		current_weapon = weapon_name
		weapon_quality = _get_weapon_quality(weapon_name)
		weapon_changed.emit(current_weapon, _get_current_ammo())


func get_quality_damage_mult() -> float:
	return QUALITY_MULTIPLIERS[_get_weapon_quality(current_weapon)]


func _get_weapon_quality(weapon_name: String) -> String:
	return weapon_qualities.get(weapon_name, "normal")


func get_label() -> String:
	return weapon_data[current_weapon].get("label", current_weapon)


func _get_current_ammo() -> int:
	if current_weapon in infinite_ammo_weapons:
		return -1  # infinite
	return ammo.get(current_weapon, 0)


func _weapon_tool_active() -> bool:
	var toolbelt := get_tree().current_scene.get_node_or_null("ToolbeltManager") if get_tree().current_scene else null
	return not toolbelt or str(toolbelt.get("current_tool")) == "weapon"


func _toolbelt_exists() -> bool:
	return get_tree().current_scene and get_tree().current_scene.get_node_or_null("ToolbeltManager") != null


func get_weapon_unlock_status(weapon_name: String) -> bool:
	return weapon_name in unlocked_weapons


func unlock_weapon(weapon_name: String):
	if weapon_name in weapon_data and weapon_name not in unlocked_weapons:
		unlocked_weapons.append(weapon_name)


func apply_quality_upgrade(weapon_name: String, new_quality: String):
	weapon_qualities[weapon_name] = new_quality
	if weapon_name == current_weapon:
		weapon_quality = new_quality
