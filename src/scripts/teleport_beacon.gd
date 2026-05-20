extends Node3D

@export var zone_name: String = "crash"
var is_placed: bool = false

func place():
	is_placed = true
	add_to_group("beacons")

func teleport_to_base(player: CharacterBody3D):
	player.position = Vector3(0, 1, 0)
