extends Control

const ZONE_TAB_NAMES = ["Crash", "极寒", "熔岩", "重力"]
const ZONE_TAB_ICONS = ["O", "❄", "🔥", "◈"]
const RESOURCE_LABELS = {"iron": "铁", "void_crystal": "晶", "biomass": "质", "energy_core": "能", "blueprint": "图"}
const LEVEL_BARS = ["░░░░", "█░░░", "██░░", "███░", "████"]

var selected_zone: int = 0

func _ready():
	visible = false
	_setup_ui()

func _setup_ui():
	# Background
	var bg = ColorRect.new()
	bg.color = Color(0.05, 0.02, 0.08, 0.94)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)

	# Title
	var title = Label.new()
	title.text = "血清调制台"
	title.add_theme_font_size_override("font_size", 28)
	title.add_theme_color_override("font_color", Color(0.3, 0.9, 0.5))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.position = Vector2(400, 20)
	title.size = Vector2(200, 40)
	add_child(title)

	var close_hint = Label.new()
	close_hint.text = "[F] 关闭"
	close_hint.add_theme_font_size_override("font_size", 14)
	close_hint.add_theme_color_override("font_color", Color(0.6, 0.6, 0.6))
	close_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	close_hint.position = Vector2(720, 560)
	close_hint.size = Vector2(200, 20)
	add_child(close_hint)

func _input(event):
	if visible and event.is_action_pressed("interact"):
		_on_close()
		accept_event()

func _on_close():
	visible = false
	Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)

func open():
	visible = true
	selected_zone = ZoneManager.current_zone if ZoneManager else 0
	_refresh_display()
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)

func _refresh_display():
	# Clear dynamic children (keep bg, title, close_hint at indices 0,1,2)
	while get_child_count() > 3:
		get_child(3).queue_free()

	# Zone tabs on left
	var tab_y = 80.0
	for i in range(4):
		var btn = Button.new()
		btn.text = ZONE_TAB_ICONS[i] + " " + ZONE_TAB_NAMES[i]
		btn.position = Vector2(30, tab_y)
		btn.size = Vector2(130, 32)
		btn.modulate = Color(0.5, 1.0, 0.5) if i == selected_zone else Color(0.5, 0.5, 0.5)
		var zi = i
		btn.pressed.connect(func(): _select_zone(zi))
		add_child(btn)

		var level = ZoneManager.adaptations.get(i, 0) if ZoneManager else 0
		var level_label = Label.new()
		level_label.text = "适应: Lv%d" % level
		level_label.add_theme_font_size_override("font_size", 10)
		level_label.add_theme_color_override("font_color", Color(0.5, 0.8, 0.5))
		level_label.position = Vector2(170, tab_y + 8)
		level_label.size = Vector2(100, 16)
		add_child(level_label)

		tab_y += 40

	# Recipes in center
	var card_x = 240.0
	var card_y = 80.0
	for id in SerumRecipes.recipes:
		var recipe = SerumRecipes.recipes[id]
		if recipe.zone != selected_zone:
			continue

		var current_level = ZoneManager.adaptations[recipe.zone] if ZoneManager else 0
		var already_have = current_level >= recipe.level
		var can_afford = InventoryManager.has_resources(recipe.cost)

		# Recipe card background
		var card_bg = ColorRect.new()
		card_bg.position = Vector2(card_x, card_y)
		card_bg.size = Vector2(340, 70)
		card_bg.color = Color(0.08, 0.05, 0.12, 0.9) if not already_have else Color(0.05, 0.08, 0.05, 0.6)
		add_child(card_bg)

		# Level name
		var lv_label = Label.new()
		lv_label.text = SerumRecipes.LEVEL_NAMES[recipe.level - 1]
		lv_label.add_theme_font_size_override("font_size", 15)
		lv_label.add_theme_color_override("font_color", Color(0.3, 0.9, 0.5) if not already_have else Color(0.3, 0.5, 0.3))
		lv_label.position = Vector2(card_x + 8, card_y + 4)
		add_child(lv_label)

		# Cost
		var cost_text = "消耗: "
		for res in recipe.cost:
			cost_text += "%sx%d " % [RESOURCE_LABELS.get(res, res), recipe.cost[res]]
		var cost_label = Label.new()
		cost_label.text = cost_text
		cost_label.add_theme_font_size_override("font_size", 11)
		cost_label.add_theme_color_override("font_color", Color(1, 1, 0.5) if can_afford else Color(1, 0.3, 0.3))
		cost_label.position = Vector2(card_x + 8, card_y + 24)
		add_child(cost_label)

		# Brew button
		if not already_have:
			var brew_btn = Button.new()
			brew_btn.text = "调制" if recipe.unlocked else "未解锁"
			brew_btn.position = Vector2(card_x + 250, card_y + 20)
			brew_btn.size = Vector2(80, 30)
			brew_btn.disabled = not can_afford or not recipe.unlocked
			var rid = id
			brew_btn.pressed.connect(func(): _brew_serum(rid))
			add_child(brew_btn)
		else:
			var done_label = Label.new()
			done_label.text = "已调制"
			done_label.add_theme_font_size_override("font_size", 13)
			done_label.add_theme_color_override("font_color", Color(0.2, 0.6, 0.2))
			done_label.position = Vector2(card_x + 280, card_y + 28)
			add_child(done_label)

		card_y += 80

	# Material inventory on right
	var inv_x = 620.0
	var inv_y = 80.0
	var inv_title = Label.new()
	inv_title.text = "库存材料"
	inv_title.add_theme_font_size_override("font_size", 16)
	inv_title.add_theme_color_override("font_color", Color(0.7, 0.7, 0.5))
	inv_title.position = Vector2(inv_x, inv_y)
	add_child(inv_title)

	inv_y += 30
	for res in InventoryManager.resources:
		var amount = InventoryManager.resources[res]
		var line = Label.new()
		line.text = "%s: %d" % [RESOURCE_LABELS.get(res, res), amount]
		line.add_theme_font_size_override("font_size", 13)
		line.add_theme_color_override("font_color", Color(0.6, 0.6, 0.6) if amount == 0 else Color(0.8, 0.8, 0.6))
		line.position = Vector2(inv_x, inv_y)
		add_child(line)
		inv_y += 22

func _select_zone(zone: int):
	selected_zone = zone
	_refresh_display()

func _brew_serum(recipe_id: String):
	var recipe = SerumRecipes.recipes[recipe_id]
	if not recipe.unlocked:
		return
	if not InventoryManager.has_resources(recipe.cost):
		return

	var current_level = ZoneManager.adaptations[recipe.zone]
	if current_level >= recipe.level:
		return

	if not InventoryManager.consume_resources(recipe.cost):
		return
	ZoneManager.adaptations[recipe.zone] = recipe.level

	# Unlock next level recipe
	var next_level = recipe.level + 1
	var prefix = ""
	match recipe.zone:
		0: prefix = "crash"
		1: prefix = "cold"
		2: prefix = "heat"
		3: prefix = "grav"
	var next_id = "%s_%d" % [prefix, next_level]
	SerumRecipes.unlock_recipe(next_id)

	_refresh_display()
