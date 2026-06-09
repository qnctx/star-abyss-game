extends Node

signal radio_log_unlocked(log_id: String, message: String)
signal signal_cache_spawned(cache_id: String)
signal signal_cache_collected(cache_id: String)

const SIGNAL_CACHE_SCRIPT := preload("res://scripts/signal_cache.gd")

const MILESTONES := [
	{"id": "signal_25", "progress": 25.0, "message": "Radio: weak automated ping detected beyond the crash basin."},
	{"id": "signal_50", "progress": 50.0, "message": "Radio: broken survivor code repeats from crystal caves."},
	{"id": "signal_75", "progress": 75.0, "message": "Radio: buried relay answers with pre-crash coordinates."},
	{"id": "signal_100", "progress": 100.0, "message": "Radio: rescue ping locked. Hold the base until extraction."}
]
const CACHE_DEFS := {
	"signal_25": {"position": [22.0, -18.0], "rewards": {"iron": 12, "energy": 3}},
	"signal_50": {"position": [-30.0, 24.0], "rewards": {"void_crystal": 6, "blueprint": 1}},
	"signal_75": {"position": [38.0, 32.0], "rewards": {"biomass": 10, "energy": 6}},
	"signal_100": {"position": [-42.0, -36.0], "rewards": {"energy_core": 1, "blueprint": 2}}
}

var unlocked_logs: Dictionary = {}
var collected_caches: Dictionary = {}
var latest_message := ""


func _ready() -> void:
	reset_logs()


func reset_logs() -> void:
	unlocked_logs.clear()
	collected_caches.clear()
	latest_message = ""
	_clear_active_caches()


func register_signal_progress(progress: float) -> void:
	for milestone in MILESTONES:
		var log_id := str(milestone["id"])
		if progress >= float(milestone["progress"]) and not bool(unlocked_logs.get(log_id, false)):
			_unlock_log(log_id, str(milestone["message"]))


func capture_save_data() -> Dictionary:
	return {
		"unlocked_logs": unlocked_logs.duplicate(true),
		"collected_caches": collected_caches.duplicate(true),
		"latest_message": latest_message
	}


func apply_save_data(data: Variant) -> void:
	reset_logs()
	if typeof(data) != TYPE_DICTIONARY:
		return
	var logs: Variant = data.get("unlocked_logs", {})
	if typeof(logs) == TYPE_DICTIONARY:
		for log_id in logs:
			unlocked_logs[str(log_id)] = bool(logs[log_id])
	var caches: Variant = data.get("collected_caches", {})
	if typeof(caches) == TYPE_DICTIONARY:
		for cache_id in caches:
			collected_caches[str(cache_id)] = bool(caches[cache_id])
	latest_message = str(data.get("latest_message", _latest_unlocked_message()))
	_spawn_uncollected_caches()


func get_latest_message() -> String:
	return latest_message


func is_log_unlocked(log_id: String) -> bool:
	return bool(unlocked_logs.get(log_id, false))


func is_cache_collected(cache_id: String) -> bool:
	return bool(collected_caches.get(cache_id, false))


func mark_cache_collected(cache_id: String) -> void:
	if cache_id.is_empty():
		return
	collected_caches[cache_id] = true
	signal_cache_collected.emit(cache_id)


func get_cache_hint() -> String:
	var player := get_tree().get_first_node_in_group("player") as Node3D
	if not player:
		return ""
	var nearest_cache: Node3D = null
	var nearest_distance := INF
	for cache in get_tree().get_nodes_in_group("signal_caches"):
		var cache_node := cache as Node3D
		if not cache_node or not is_instance_valid(cache_node) or cache_node.is_queued_for_deletion():
			continue
		var distance := _flat_distance(player.global_position, cache_node.global_position)
		if distance < nearest_distance:
			nearest_distance = distance
			nearest_cache = cache_node
	if not nearest_cache:
		return ""
	return "Cache: %dm %s | radio lead" % [
		roundi(nearest_distance),
		_direction_label(player.global_position, nearest_cache.global_position)
	]


func _unlock_log(log_id: String, message: String) -> void:
	unlocked_logs[log_id] = true
	latest_message = message
	_spawn_cache_for_log(log_id)
	radio_log_unlocked.emit(log_id, message)


func _latest_unlocked_message() -> String:
	for index in range(MILESTONES.size() - 1, -1, -1):
		var milestone: Dictionary = MILESTONES[index]
		if bool(unlocked_logs.get(str(milestone["id"]), false)):
			return str(milestone["message"])
	return ""


func _spawn_uncollected_caches() -> void:
	for log_id in unlocked_logs:
		if bool(unlocked_logs[log_id]):
			_spawn_cache_for_log(str(log_id))


func _spawn_cache_for_log(log_id: String) -> void:
	if not CACHE_DEFS.has(log_id) or not get_tree().current_scene:
		return
	if is_cache_collected(log_id) or _cache_exists(log_id):
		return
	var cache := SIGNAL_CACHE_SCRIPT.new()
	var cache_def: Dictionary = CACHE_DEFS[log_id]
	cache.setup(log_id, cache_def.get("rewards", {}))
	get_tree().current_scene.add_child(cache)
	cache.global_position = _cache_position(cache_def.get("position", [0.0, 0.0]))
	signal_cache_spawned.emit(log_id)


func _cache_exists(cache_id: String) -> bool:
	for cache in get_tree().get_nodes_in_group("signal_caches"):
		var cache_node := cache as Node
		if cache_node and is_instance_valid(cache_node) and not cache_node.is_queued_for_deletion() and str(cache_node.get("cache_id")) == cache_id:
			return true
	return false


func _clear_active_caches() -> void:
	for cache in get_tree().get_nodes_in_group("signal_caches"):
		if cache and is_instance_valid(cache):
			cache.free()


func _cache_position(value: Variant) -> Vector3:
	var x := 0.0
	var z := 0.0
	if typeof(value) == TYPE_ARRAY and value.size() >= 2:
		x = float(value[0])
		z = float(value[1])
	var y := 0.75
	if WorldGenerator:
		y = clamp(WorldGenerator.get_height_at(Vector2(x, z)), -5.0, 15.0) + 0.75
	return Vector3(x, y, z)


func _flat_distance(a: Vector3, b: Vector3) -> float:
	a.y = 0.0
	b.y = 0.0
	return a.distance_to(b)


func _direction_label(from_pos: Vector3, to_pos: Vector3) -> String:
	var delta := to_pos - from_pos
	var parts: Array[String] = []
	if abs(delta.z) > 1.0:
		parts.append("N" if delta.z < 0.0 else "S")
	if abs(delta.x) > 1.0:
		parts.append("E" if delta.x > 0.0 else "W")
	return "".join(parts) if not parts.is_empty() else "here"
