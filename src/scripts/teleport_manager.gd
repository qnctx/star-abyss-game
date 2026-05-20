extends Node

var beacons: Dictionary = {}  # zone_name -> beacon_node

signal beacon_placed(zone: String)
signal teleport_executed(from_zone: String, to_zone: String)

func register_beacon(beacon: Node3D, zone: String):
	if zone not in beacons:
		beacons[zone] = []
	beacons[zone].append(beacon)
	beacon_placed.emit(zone)

func get_beacons_for_zone(zone: String) -> Array:
	return beacons.get(zone, [])

func teleport_to_base(player: CharacterBody3D, from_zone: String):
	player.position = Vector3(0, 1, 0)
	teleport_executed.emit(from_zone, "base")

func teleport_to_beacon(player: CharacterBody3D, to_zone: String):
	if to_zone in beacons and not beacons[to_zone].is_empty():
		var beacon = beacons[to_zone][0]
		player.position = beacon.position
		teleport_executed.emit("base", to_zone)
