extends Node

signal radio_log_unlocked(log_id: String, message: String)
signal signal_cache_spawned(cache_id: String)
signal signal_cache_collected(cache_id: String)
signal extraction_holdout_started(duration: float)
signal extraction_holdout_completed()

const SIGNAL_CACHE_SCRIPT := preload("res://scripts/signal_cache.gd")
const EXTRACTION_HOLDOUT_DURATION := 180.0

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
var extraction_holdout_active := false
var extraction_holdout_complete := false
var extraction_time_remaining := 0.0


func _ready() -> void:
	reset_logs()
	set_process(true)


func _process(delta: float) -> void:
	if not extraction_holdout_active or extraction_holdout_complete:
		return
	extraction_time_remaining = maxf(0.0, extraction_time_remaining - delta)
	if is_zero_approx(extraction_time_remaining):
		_complete_extraction_holdout()


func reset_logs() -> void:
	unlocked_logs.clear()
	collected_caches.clear()
	latest_message = ""
	extraction_holdout_active = false
	extraction_holdout_complete = false
	extraction_time_remaining = 0.0
	_clear_active_caches()


func register_signal_progress(progress: float, trigger_extraction: bool = true) -> void:
	for milestone in MILESTONES:
		var log_id := str(milestone["id"])
		if progress >= float(milestone["progress"]) and not bool(unlocked_logs.get(log_id, false)):
			_unlock_log(log_id, str(milestone["message"]), trigger_extraction)


func capture_save_data() -> Dictionary:
	return {
		"unlocked_logs": unlocked_logs.duplicate(true),
		"collected_caches": collected_caches.duplicate(true),
		"latest_message": latest_message,
		"extraction_holdout_active": extraction_holdout_active,
		"extraction_holdout_complete": extraction_holdout_complete,
		"extraction_time_remaining": extraction_time_remaining
	}


func apply_save_data(data: Variant) -> void:
	reset_logs()
	if typeof(data) != TYPE_DICTIONARY:
		return
	var has_extraction_state: bool = bool(data.has("extraction_holdout_active") or data.has("extraction_holdout_complete"))
	var logs: Variant = data.get("unlocked_logs", {})
	if typeof(logs) == TYPE_DICTIONARY:
		for log_id in logs:
			unlocked_logs[str(log_id)] = bool(logs[log_id])
	var caches: Variant = data.get("collected_caches", {})
	if typeof(caches) == TYPE_DICTIONARY:
		for cache_id in caches:
			collected_caches[str(cache_id)] = bool(caches[cache_id])
	latest_message = str(data.get("latest_message", _latest_unlocked_message()))
	extraction_holdout_complete = bool(data.get("extraction_holdout_complete", false))
	extraction_holdout_active = bool(data.get("extraction_holdout_active", false)) and not extraction_holdout_complete
	extraction_time_remaining = clampf(float(data.get("extraction_time_remaining", EXTRACTION_HOLDOUT_DURATION)), 0.0, EXTRACTION_HOLDOUT_DURATION)
	# Do not complete extraction during load — let _process handle it naturally
	# on the next frame so signals/HUD have time to wire up.
	if extraction_holdout_active and is_zero_approx(extraction_time_remaining):
		extraction_time_remaining = 0.1
	elif not has_extraction_state and is_log_unlocked("signal_100"):
		_start_extraction_holdout(false)
	_spawn_uncollected_caches()


func get_latest_message() -> String:
	return latest_message


func is_log_unlocked(log_id: String) -> bool:
	return bool(unlocked_logs.get(log_id, false))


func is_cache_collected(cache_id: String) -> bool:
	return bool(collected_caches.get(cache_id, false))


func is_extraction_active() -> bool:
	return extraction_holdout_active and not extraction_holdout_complete


func is_extraction_complete() -> bool:
	return extraction_holdout_complete


func get_extraction_status_text() -> String:
	if extraction_holdout_complete:
		return "Extraction: rescue shuttle landed | victory"
	if extraction_holdout_active:
		return "Extraction: hold %s | defend base" % _format_time(extraction_time_remaining)
	return ""


func get_extraction_time_text() -> String:
	return _format_time(extraction_time_remaining)


func get_extraction_objective_text() -> String:
	if extraction_holdout_complete:
		return "Objective: Extraction complete | secure victory"
	if extraction_holdout_active:
		return "Objective: Defend extraction zone | %s" % _format_time(extraction_time_remaining)
	return ""


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


func _unlock_log(log_id: String, message: String, trigger_extraction: bool = true) -> void:
	unlocked_logs[log_id] = true
	latest_message = message
	_spawn_cache_for_log(log_id)
	if log_id == "signal_100" and trigger_extraction:
		_start_extraction_holdout()
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


func _start_extraction_holdout(force_night: bool = true) -> void:
	if extraction_holdout_active or extraction_holdout_complete:
		return
	extraction_holdout_active = true
	extraction_time_remaining = EXTRACTION_HOLDOUT_DURATION
	if force_night and GameManager and not GameManager.is_night:
		GameManager.force_start_night()
	extraction_holdout_started.emit(EXTRACTION_HOLDOUT_DURATION)


func _complete_extraction_holdout() -> void:
	if extraction_holdout_complete:
		return
	extraction_holdout_active = false
	extraction_holdout_complete = true
	extraction_time_remaining = 0.0
	extraction_holdout_completed.emit()


func _format_time(seconds: float) -> String:
	var total_seconds := ceili(seconds)
	var minutes := int(total_seconds / 60)
	var remainder := total_seconds % 60
	return "%02d:%02d" % [minutes, remainder]
