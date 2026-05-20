extends Area3D

@export var zone_type: int = 0

func _ready():
	body_entered.connect(_on_body_entered)

func _on_body_entered(body):
	if body.is_in_group("player"):
		ZoneManager.current_zone = zone_type
		ZoneManager.zone_changed.emit(ZoneManager.get_zone_name())
