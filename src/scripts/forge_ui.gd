extends Control

var forge_recipes = {
	"pistol": {
		"fine": {"iron": 10},
		"rare": {"iron": 20, "void_crystal": 5},
		"epic": {"iron": 30, "void_crystal": 15, "blueprint": 1},
		"legendary": {"iron": 50, "void_crystal": 30, "energy_core": 1, "blueprint": 2}
	},
	"shotgun": {
		"unlock": {"iron": 20, "blueprint": 1},
		"fine": {"iron": 15, "void_crystal": 3},
		"rare": {"iron": 30, "void_crystal": 10},
		"epic": {"iron": 50, "void_crystal": 20, "blueprint": 2},
		"legendary": {"iron": 80, "void_crystal": 50, "energy_core": 2, "blueprint": 3}
	},
	"rifle": {
		"fine": {"iron": 12, "void_crystal": 2},
		"rare": {"iron": 25, "void_crystal": 8},
		"epic": {"iron": 40, "void_crystal": 18, "blueprint": 1},
		"legendary": {"iron": 60, "void_crystal": 35, "energy_core": 1, "blueprint": 3}
	},
	"flamethrower": {
		"unlock": {"iron": 30, "biomass": 15, "blueprint": 2},
		"fine": {"iron": 20, "biomass": 5},
		"rare": {"iron": 40, "biomass": 15, "void_crystal": 10},
		"epic": {"iron": 60, "biomass": 30, "void_crystal": 20, "blueprint": 2},
		"legendary": {"iron": 90, "biomass": 50, "void_crystal": 40, "energy_core": 2, "blueprint": 3}
	},
	"ice_ray": {
		"unlock": {"iron": 25, "void_crystal": 20, "blueprint": 2},
		"fine": {"iron": 18, "void_crystal": 8},
		"rare": {"iron": 35, "void_crystal": 20},
		"epic": {"iron": 55, "void_crystal": 35, "blueprint": 2},
		"legendary": {"iron": 85, "void_crystal": 60, "energy_core": 2, "blueprint": 3}
	}
}

const QUALITY_NAMES = ["normal", "fine", "rare", "epic", "legendary"]
const QUALITY_LABELS = ["普通", "精良", "稀有", "史诗", "传说"]
const QUALITY_COLORS = ["#888888", "#00cc00", "#4488ff", "#cc44ff", "#ff8800"]
const RESOURCE_LABELS = {"iron": "铁", "void_crystal": "晶", "biomass": "质", "energy_core": "能", "blueprint": "图"}

var weapon_controller = null
var selected_weapon: String = "pistol"


func _ready():
	visible = false
	_setup_ui()


func _setup_ui():
	# Title
	var title = Label.new()
	title.text = "锻造台"
	title.add_theme_font_size_override("font_size", 28)
	title.add_theme_color_override("font_color", Color(1, 0.8, 0.3))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.position = Vector2(400, 30)
	title.size = Vector2(200, 40)
	add_child(title)

	var close_hint = Label.new()
	close_hint.text = "[E] 关闭"
	close_hint.add_theme_font_size_override("font_size", 14)
	close_hint.add_theme_color_override("font_color", Color(0.6, 0.6, 0.6))
	close_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	close_hint.position = Vector2(700, 550)
	close_hint.size = Vector2(200, 20)
	add_child(close_hint)

	# Weapon list on left
	var weapon_list_label = Label.new()
	weapon_list_label.text = "武器"
	weapon_list_label.add_theme_font_size_override("font_size", 18)
	weapon_list_label.position = Vector2(40, 80)
	weapon_list_label.size = Vector2(150, 30)
	add_child(weapon_list_label)

	# Info and upgrade button on right - created dynamically on refresh
	pass


func _input(event):
	if visible and event.is_action_pressed("interact"):
		_close()
		accept_event()


func open(controller):
	weapon_controller = controller
	selected_weapon = weapon_controller.current_weapon
	visible = true
	_refresh_display()
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)


func _close():
	visible = false
	Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)


func _refresh_display():
	# Clear dynamic children (keep title and close hint at indices 0,1)
	while get_child_count() > 2:
		get_child(2).queue_free()

	# Weapon buttons on left
	var y = 120.0
	var unlocked = weapon_controller.unlocked_weapons
	var all_weapons = weapon_controller.weapon_data.keys()
	for w_name in all_weapons:
		var btn = Button.new()
		var is_unlocked = w_name in unlocked
		var label_text = weapon_controller.weapon_data[w_name].get("label", w_name)
		btn.text = label_text + (" [已解锁]" if is_unlocked else " [锁定]")
		btn.position = Vector2(40, y)
		btn.size = Vector2(160, 32)
		btn.disabled = not is_unlocked
		var wn = w_name  # capture
		btn.pressed.connect(func(): _select_weapon(wn))
		add_child(btn)

		if w_name not in unlocked and w_name in forge_recipes and "unlock" in forge_recipes[w_name]:
			var cost_label = Label.new()
			cost_label.text = "  需: " + _format_cost(forge_recipes[w_name]["unlock"])
			cost_label.add_theme_font_size_override("font_size", 10)
			cost_label.add_theme_color_override("font_color", Color(0.7, 0.5, 0.0))
			cost_label.position = Vector2(210, y + 8)
			cost_label.size = Vector2(300, 16)
			add_child(cost_label)

		y += 40

	# Selected weapon info in center
	var info_x = 280.0
	var info_label = Label.new()
	var data = weapon_controller.weapon_data[selected_weapon]
	var current_quality = weapon_controller.weapon_quality if selected_weapon == weapon_controller.current_weapon else weapon_controller._get_weapon_quality(selected_weapon)
	var quality_idx = QUALITY_NAMES.find(current_quality)
	var quality_label = QUALITY_LABELS[quality_idx]
	var q_color_str = QUALITY_COLORS[quality_idx]
	var damage = data.damage * weapon_controller.QUALITY_MULTIPLIERS[current_quality]
	info_label.text = "[center]%s[/center]\n品质: [color=%s]%s[/color]\n伤害: %.0f\n射速: %.1f/s" % [
		data.get("label", selected_weapon), q_color_str, quality_label, damage, data.fire_rate
	]
	info_label.bbcode_enabled = true
	info_label.add_theme_font_size_override("font_size", 16)
	info_label.position = Vector2(info_x, 80)
	info_label.size = Vector2(250, 120)
	add_child(info_label)

	# Upgrade button on right
	var next_idx = quality_idx + 1
	if next_idx < QUALITY_NAMES.size():
		var next_quality = QUALITY_NAMES[next_idx]
		if selected_weapon in forge_recipes and next_quality in forge_recipes[selected_weapon]:
			var cost = forge_recipes[selected_weapon][next_quality]
			var can_afford = InventoryManager.has_resources(cost)

			var upgrade_btn = Button.new()
			upgrade_btn.text = "升级到 " + QUALITY_LABELS[next_idx]
			upgrade_btn.position = Vector2(580, 160)
			upgrade_btn.size = Vector2(180, 40)
			upgrade_btn.disabled = not can_afford
			upgrade_btn.pressed.connect(func(): _upgrade_weapon(selected_weapon))
			add_child(upgrade_btn)

			var cost_label = Label.new()
			cost_label.text = "消耗: " + _format_cost(cost)
			cost_label.add_theme_font_size_override("font_size", 14)
			cost_label.add_theme_color_override("font_color", Color(1, 1, 0.5) if can_afford else Color(1, 0.3, 0.3))
			cost_label.position = Vector2(580, 210)
			cost_label.size = Vector2(200, 20)
			add_child(cost_label)
		else:
			var max_label = Label.new()
			max_label.text = "已达最高品质"
			max_label.add_theme_font_size_override("font_size", 16)
			max_label.add_theme_color_override("font_color", Color(0.3, 0.3, 0.3))
			max_label.position = Vector2(580, 180)
			max_label.size = Vector2(200, 30)
			add_child(max_label)
	else:
		var max_label = Label.new()
		max_label.text = "已达最高品质"
		max_label.add_theme_font_size_override("font_size", 16)
		max_label.add_theme_color_override("font_color", Color(1, 0.7, 0.0))
		max_label.position = Vector2(580, 180)
		max_label.size = Vector2(200, 30)
		add_child(max_label)

	# Also add unlock button for locked weapons
	if selected_weapon not in weapon_controller.unlocked_weapons:
		if selected_weapon in forge_recipes and "unlock" in forge_recipes[selected_weapon]:
			var cost = forge_recipes[selected_weapon]["unlock"]
			var can_afford = InventoryManager.has_resources(cost)

			var unlock_btn = Button.new()
			unlock_btn.text = "解锁武器"
			unlock_btn.position = Vector2(580, 160)
			unlock_btn.size = Vector2(180, 40)
			unlock_btn.disabled = not can_afford
			unlock_btn.pressed.connect(func(): _unlock_weapon(selected_weapon))
			add_child(unlock_btn)

			var cost_label = Label.new()
			cost_label.text = "消耗: " + _format_cost(cost)
			cost_label.add_theme_font_size_override("font_size", 14)
			cost_label.add_theme_color_override("font_color", Color(1, 1, 0.5) if can_afford else Color(1, 0.3, 0.3))
			cost_label.position = Vector2(580, 210)
			cost_label.size = Vector2(200, 20)
			add_child(cost_label)


func _select_weapon(weapon_name: String):
	selected_weapon = weapon_name
	_refresh_display()


func _upgrade_weapon(weapon_name: String):
	var current_quality = weapon_controller.weapon_quality if weapon_name == weapon_controller.current_weapon else weapon_controller._get_weapon_quality(weapon_name)
	var next_idx = QUALITY_NAMES.find(current_quality) + 1
	if next_idx >= QUALITY_NAMES.size():
		return

	var next_quality = QUALITY_NAMES[next_idx]
	if not (weapon_name in forge_recipes and next_quality in forge_recipes[weapon_name]):
		return

	var cost = forge_recipes[weapon_name][next_quality]
	if InventoryManager.has_resources(cost):
		InventoryManager.consume_resources(cost)
		weapon_controller.apply_quality_upgrade(weapon_name, next_quality)
		_refresh_display()


func _unlock_weapon(weapon_name: String):
	if weapon_name in forge_recipes and "unlock" in forge_recipes[weapon_name]:
		var cost = forge_recipes[weapon_name]["unlock"]
		if InventoryManager.has_resources(cost):
			InventoryManager.consume_resources(cost)
			weapon_controller.unlock_weapon(weapon_name)
			_refresh_display()


func _format_cost(cost: Dictionary) -> String:
	var parts: Array[String] = []
	for res in cost:
		parts.append(RESOURCE_LABELS.get(res, res) + "x" + str(cost[res]))
	return " ".join(parts)
