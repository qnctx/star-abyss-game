extends Control

@onready var progress_bar: ProgressBar = $ProgressBar
@onready var label: Label = $Label
@onready var zone_label: Label = $ZoneLabel
@onready var game_over_panel: Panel = $GameOverPanel
@onready var game_over_label: Label = $GameOverPanel/GameOverLabel
@onready var restart_button: Button = $GameOverPanel/RestartButton

const ZONE_EMOJI = {
	0: "O",
	1: "❄",
	2: "🔥",
	3: "◈",
}

var _is_game_over := false


func _ready():
	game_over_panel.visible = false
	restart_button.pressed.connect(_on_restart_pressed)

	var player = get_tree().get_first_node_in_group("player")
	if player:
		player.oxygen_changed.connect(_on_oxygen_changed)
		player.player_died.connect(_on_player_died)

	if ZoneManager:
		ZoneManager.zone_changed.connect(_on_zone_changed)
		_on_zone_changed(ZoneManager.get_zone_name())


func _on_oxygen_changed():
	if _is_game_over:
		return

	var player = get_tree().get_first_node_in_group("player")
	if not player:
		return
	var current = player.current_oxygen
	var maximum = player.max_oxygen
	progress_bar.value = current / maximum * 100
	label.text = "O2: %.0f%%" % (current / maximum * 100)

	if current / maximum < 0.25:
		progress_bar.modulate = Color.RED
	elif current / maximum < 0.5:
		progress_bar.modulate = Color.YELLOW
	else:
		progress_bar.modulate = Color.WHITE


func _on_player_died():
	_is_game_over = true
	label.text = "O2: DEAD"
	progress_bar.modulate = Color.DARK_RED
	game_over_panel.visible = true
	game_over_label.text = "GAME OVER\n氧气耗尽"


func _on_restart_pressed():
	_is_game_over = false
	game_over_panel.visible = false
	# Request game restart via GameManager if it exists
	var player = get_tree().get_first_node_in_group("player")
	if player and player.is_dead:
		player.respawn()
	progress_bar.value = 100
	label.text = "O2: 100%"
	progress_bar.modulate = Color.WHITE


func _on_zone_changed(zone_name: String):
	var zone = ZoneManager.current_zone if ZoneManager else 0
	var level = ZoneManager.adaptations.get(zone, 0) if ZoneManager else 0
	var icon = ZONE_EMOJI.get(zone, "?")
	var bars = ["░░░░", "█░░░", "██░░", "███░", "████"]
	zone_label.text = "%s %s | 适应: %s Lv%d" % [icon, zone_name, bars[min(level, 4)], level]
