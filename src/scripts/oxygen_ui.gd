extends Control

@onready var progress_bar: ProgressBar = $ProgressBar
@onready var label: Label = $Label


func _ready():
	var player = get_tree().get_first_node_in_group("player")
	if player:
		player.oxygen_changed.connect(_on_oxygen_changed)
		player.player_died.connect(_on_player_died)


func _on_oxygen_changed(current: float, maximum: float):
	progress_bar.value = current / maximum * 100
	label.text = "O2: %.0f%%" % (current / maximum * 100)

	# Visual warning when low
	if current / maximum < 0.25:
		progress_bar.modulate = Color.RED
	else:
		progress_bar.modulate = Color.WHITE


func _on_player_died():
	label.text = "O2: DEAD"
	progress_bar.modulate = Color.DARK_RED
