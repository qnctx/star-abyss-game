extends Node

signal radio_log_unlocked(log_id: String, message: String)

const MILESTONES := [
	{"id": "signal_25", "progress": 25.0, "message": "Radio: weak automated ping detected beyond the crash basin."},
	{"id": "signal_50", "progress": 50.0, "message": "Radio: broken survivor code repeats from crystal caves."},
	{"id": "signal_75", "progress": 75.0, "message": "Radio: buried relay answers with pre-crash coordinates."},
	{"id": "signal_100", "progress": 100.0, "message": "Radio: rescue ping locked. Hold the base until extraction."}
]

var unlocked_logs: Dictionary = {}
var latest_message := ""


func _ready() -> void:
	reset_logs()


func reset_logs() -> void:
	unlocked_logs.clear()
	latest_message = ""


func register_signal_progress(progress: float) -> void:
	for milestone in MILESTONES:
		var log_id := str(milestone["id"])
		if progress >= float(milestone["progress"]) and not bool(unlocked_logs.get(log_id, false)):
			_unlock_log(log_id, str(milestone["message"]))


func capture_save_data() -> Dictionary:
	return {
		"unlocked_logs": unlocked_logs.duplicate(true),
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
	latest_message = str(data.get("latest_message", _latest_unlocked_message()))


func get_latest_message() -> String:
	return latest_message


func is_log_unlocked(log_id: String) -> bool:
	return bool(unlocked_logs.get(log_id, false))


func _unlock_log(log_id: String, message: String) -> void:
	unlocked_logs[log_id] = true
	latest_message = message
	radio_log_unlocked.emit(log_id, message)


func _latest_unlocked_message() -> String:
	for index in range(MILESTONES.size() - 1, -1, -1):
		var milestone: Dictionary = MILESTONES[index]
		if bool(unlocked_logs.get(str(milestone["id"]), false)):
			return str(milestone["message"])
	return ""
