extends Control

const WEAPON_ICONS = {
	"pistol": "手枪",
	"shotgun": "霰弹枪",
	"rifle": "步枪",
	"flamethrower": "火焰",
	"ice_ray": "冰冻",
}

var weapon_controller = null
@onready var weapon_label: Label = null
@onready var ammo_label: Label = null


func _ready():
	weapon_label = Label.new()
	weapon_label.add_theme_font_size_override("font_size", 18)
	weapon_label.add_theme_color_override("font_color", Color(1, 0.85, 0.3))
	weapon_label.position = Vector2(10, 10)
	add_child(weapon_label)

	ammo_label = Label.new()
	ammo_label.add_theme_font_size_override("font_size", 14)
	ammo_label.add_theme_color_override("font_color", Color(1, 1, 1))
	ammo_label.position = Vector2(10, 35)
	add_child(ammo_label)

	call_deferred("_connect_weapon")


func _connect_weapon():
	var player = get_tree().get_first_node_in_group("player")
	if player:
		weapon_controller = player.get_node_or_null("WeaponController")
		if weapon_controller:
			weapon_controller.weapon_changed.connect(_on_weapon_changed)
			weapon_controller.ammo_changed.connect(_on_ammo_changed)
			_on_weapon_changed(weapon_controller.current_weapon, _get_ammo())


func _on_weapon_changed(weapon_name: String, _ammo_count: int):
	var display_name = WEAPON_ICONS.get(weapon_name, weapon_name)
	weapon_label.text = "%s" % display_name
	_update_ammo_text()


func _on_ammo_changed(_weapon_name: String, _ammo_count: int):
	_update_ammo_text()


func _update_ammo_text():
	if not weapon_controller:
		return
	var current = weapon_controller.current_weapon
	var data = weapon_controller.weapon_data[current]
	var infinite = data.get("ammo_per_shot", 1) == 0
	if infinite:
		ammo_label.text = "∞"
	else:
		ammo_label.text = "弹药: %d" % weapon_controller.ammo.get(current, 0)


func _get_ammo() -> int:
	if not weapon_controller:
		return 0
	return weapon_controller.ammo.get(weapon_controller.current_weapon, 0)
