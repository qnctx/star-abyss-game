extends Control

var _status_label: Label
var _build_label: Label
var _base_label: Label


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_status_label = Label.new()
	_status_label.position = Vector2(10, 88)
	_status_label.size = Vector2(420, 70)
	_status_label.add_theme_font_size_override("font_size", 18)
	add_child(_status_label)

	_build_label = Label.new()
	_build_label.position = Vector2(10, 158)
	_build_label.size = Vector2(920, 48)
	_build_label.add_theme_font_size_override("font_size", 16)
	add_child(_build_label)

	_base_label = Label.new()
	_base_label.position = Vector2(10, 206)
	_base_label.size = Vector2(560, 42)
	_base_label.add_theme_font_size_override("font_size", 16)
	add_child(_base_label)

	if GameManager:
		GameManager.base_health_changed.connect(_on_base_health_changed)
		GameManager.base_shield_changed.connect(_on_base_shield_changed)
		GameManager.wave_spawned.connect(_on_wave_spawned)
		GameManager.enemies_alive_changed.connect(_on_enemies_alive_changed)
		GameManager.day_started.connect(_refresh)
		GameManager.night_started.connect(_refresh)
	if InventoryManager:
		InventoryManager.resource_changed.connect(_on_resource_changed)

	_refresh()


func _process(_delta: float) -> void:
	_refresh_build_hint()
	_refresh_base_hint()


func _on_base_health_changed(_health: float) -> void:
	_refresh()


func _on_base_shield_changed(_shield: float, _max_shield: float) -> void:
	_refresh()


func _on_wave_spawned(_wave_number: int) -> void:
	_refresh()


func _on_enemies_alive_changed(_count: int) -> void:
	_refresh()


func _on_resource_changed(_type: String, _amount: int) -> void:
	_refresh_build_hint()
	_refresh_base_hint()


func _refresh() -> void:
	if not GameManager:
		return
	var phase := "Night" if GameManager.is_night else "Day"
	_status_label.text = "Base HP: %d%% | Shield %d/%d\n%s | Wave %d | Enemies %d" % [
		roundi(GameManager.base_health),
		roundi(GameManager.base_shield),
		roundi(GameManager.max_base_shield),
		phase,
		GameManager.wave_number,
		GameManager.enemies_alive
	]
	_refresh_build_hint()
	_refresh_base_hint()


func _refresh_build_hint() -> void:
	var build_manager := get_tree().current_scene.get_node_or_null("BuildManager") if get_tree().current_scene else null
	if build_manager and build_manager.build_mode:
		var afford := InventoryManager.has_resources(build_manager.get_selected_cost()) if InventoryManager else false
		_build_label.text = "Build: 1 Turret 2 O2 3 Shield 4 Solar 5 Research | %s: %s | LMB | %s" % [
			build_manager.get_selected_label(),
			build_manager.get_selected_cost_text(),
			"READY" if afford else "NEED RESOURCES"
		]
	else:
		_build_label.text = "Press B to build | 1 Turret, 2 O2, 3 Shield, 4 Solar, 5 Research"


func _refresh_base_hint() -> void:
	var base_interaction := get_tree().current_scene.get_node_or_null("BaseInteraction") if get_tree().current_scene else null
	var parts: Array[String] = []
	if base_interaction:
		var repair_hint: String = base_interaction.get_repair_hint()
		if repair_hint:
			parts.append(repair_hint)
	if GameManager and not GameManager.is_night:
		parts.append("N start night test")
	_base_label.text = " | ".join(parts)
