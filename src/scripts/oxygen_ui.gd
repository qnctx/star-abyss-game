extends Control

@onready var progress_bar: ProgressBar = $ProgressBar
@onready var label: Label = $Label
@onready var zone_label: Label = $ZoneLabel

const ZONE_EMOJI = {
	0: "O",
	1: "❄",
	2: "🔥",
	3: "◈",
}

func _ready():
	var player = get_tree().get_first_node_in_group("player")
	if player:
		player.oxygen_changed.connect(_on_oxygen_changed)
		player.player_died.connect(_on_player_died)

	if ZoneManager:
		ZoneManager.zone_changed.connect(_on_zone_changed)
		_on_zone_changed(ZoneManager.get_zone_name())


func _on_oxygen_changed():
	var player = get_tree().get_first_node_in_group("player")
	if not player:
		return
	var current = player.current_oxygen
	var maximum = player.max_oxygen
	progress_bar.value = current / maximum * 100
	label.text = "O2: %.0f%%" % (current / maximum * 100)

	if current / maximum < 0.25:
		progress_bar.modulate = Color.RED
	else:
		progress_bar.modulate = Color.WHITE


func _on_player_died():
	label.text = "O2: DEAD"
	progress_bar.modulate = Color.DARK_RED


func _on_zone_changed(zone_name: String):
	var zone = ZoneManager.current_zone if ZoneManager else 0
	var level = ZoneManager.adaptations.get(zone, 0) if ZoneManager else 0
	var icon = ZONE_EMOJI.get(zone, "?")
	var bars = ["░░░░", "█░░░", "██░░", "███░", "████"]
	zone_label.text = "%s %s | 适应: %s Lv%d" % [icon, zone_name, bars[min(level, 4)], level]
