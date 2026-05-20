extends Area3D

var player_in_range: bool = false
var forge_ui = null


func _ready():
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)


func _process(_delta):
	if not player_in_range:
		return
	if Input.is_action_just_pressed("interact"):
		if forge_ui:
			if forge_ui.visible:
				forge_ui._close()
			else:
				_open_forge()


func _on_body_entered(body: Node3D):
	if body.is_in_group("player"):
		player_in_range = true


func _on_body_exited(body: Node3D):
	if body.is_in_group("player"):
		player_in_range = false


func _open_forge():
	var player = get_tree().get_first_node_in_group("player")
	if not player:
		return
	var wc = player.get_node_or_null("WeaponController")
	if not wc:
		return
	if not forge_ui:
		forge_ui = get_tree().current_scene.get_node_or_null("ForgeUI")
	if forge_ui and wc:
		forge_ui.open(wc)
