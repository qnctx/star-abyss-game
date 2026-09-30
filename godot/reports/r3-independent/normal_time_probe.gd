extends SceneTree

# Product nodes retain normal physics processing. Only scenario setup teleports.
# Input is injected into Godot; this is not a human keyboard-feel assessment.
const OUT := "res://reports/r3-independent/normal-time-samples.json"
var game: Node
var observer: Node
var rows: Array = []
var index := 0
var last_usec := 0
var started_utc := ""
var slot := ""
var phase := "warmup"
var held: Array = []
var previous := Vector3.ZERO
var signatures: Dictionary = {}

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	started_utc = Time.get_datetime_string_from_system(true)
	slot = "user://r3_independent_" + str(Time.get_ticks_usec()) + ".json"
	var dir := DirAccess.open("res://scripts")
	for file in dir.get_files():
		if file.ends_with(".gd"):
			signatures[file] = FileAccess.get_sha256("res://scripts/" + file)
	game = load("res://scenes/main.tscn").instantiate()
	if not "save_path" in game:
		printerr("R3_PROBE_ABORT main scene script unavailable")
		game.free()
		quit(2)
		return
	game.save_path = slot
	root.add_child(game)
	observer = Node.new()
	observer.set_script(load("res://reports/r3-independent/physics_observer.gd"))
	observer.probe = self
	observer.process_physics_priority = 10000
	root.add_child(observer)
	previous = game.player.global_position
	last_usec = Time.get_ticks_usec()

func sample(delta: float) -> void:
	var p = game.player
	var now := Time.get_ticks_usec()
	var feet: Dictionary = {}
	var rig: Skeleton3D = p._r2.skeleton if "skeleton" in p._r2 else _rig(p.get_node("Model"))
	if rig != null:
		for i in range(rig.get_bone_count()):
			var label := rig.get_bone_name(i)
			if "ankle" in label.to_lower() or "toe" in label.to_lower() or "foot" in label.to_lower():
				var pos: Vector3 = rig.global_transform * rig.get_bone_global_pose(i).origin
				feet[label] = {"world": _v(pos), "terrain_gap": pos.y - game.world.height_at(pos.x, pos.z)}
	var keys_down: Array = []
	for key in held:
		if Input.is_physical_key_pressed(key): keys_down.append(key)
	rows.append({"frame": Engine.get_physics_frames(), "phase": phase, "physics": Engine.is_in_physics_frame(), "delta": delta, "wall_delta": (now-last_usec)/1000000.0, "mouse_mode": Input.get_mouse_mode(), "requested_keys": held.duplicate(), "observed_keys": keys_down, "position": _v(p.global_position), "velocity": _v(p.velocity), "measured_speed": p.global_position.distance_to(previous)/maxf(delta,0.00001), "pitch": p._look_pitch, "flight": p.flight_active, "boost": p.boosting, "energy": p.energy, "cast": p._cast_active, "pending_cast": game.pending_cast_time, "clip": p._r2.current, "feet": feet})
	last_usec = now
	previous = p.global_position
	index += 1
	match index:
		60: _ground("walk", [KEY_CTRL, KEY_W])
		120: _capture("walk")
		180: _ground("jog", [KEY_W])
		240: _capture("jog")
		300: _ground("sprint", [KEY_SHIFT, KEY_W])
		360: _capture("sprint")
		420: _ground("space", [KEY_SPACE])
		480: _air("pitch_up", [KEY_W], 0.65)
		600: _air("pitch_down", [KEY_W], -0.65)
		720: _air("descend", [KEY_C], 0.0)
		840: _air("descend_boost", [KEY_C, KEY_SHIFT], 0.0)
		960: _air("air_space", [KEY_SPACE], 0.0)
		1020: _finish()

func _rig(n: Node) -> Skeleton3D:
	if n is Skeleton3D:
		return n
	for c in n.get_children():
		var result := _rig(c)
		if result != null: return result
	return null

func _keys(keys: Array) -> void:
	for key in held:
		_event(key, false)
	held = keys
	for key in held:
		_event(key, true)

func _event(key: int, down: bool) -> void:
	var e := InputEventKey.new()
	e.physical_keycode = key
	e.keycode = key
	e.pressed = down
	Input.parse_input_event(e)

func _ground(label: String, keys: Array) -> void:
	_keys([])
	Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)
	game.player.teleport_to_ground(0.0, 260.0)
	game.player.rotation.y = 0.0
	phase = label
	previous = game.player.global_position
	_keys(keys)

func _air(label: String, keys: Array, pitch: float) -> void:
	_ground(label, [])
	var p = game.player
	p.global_position.y += 400.0
	p.flight_active = true
	p.energy = 100.0
	var e := InputEventMouseMotion.new()
	e.relative = Vector2(0.0, (p._look_pitch - pitch)/p.mouse_sensitivity)
	Input.parse_input_event(e)
	previous = p.global_position
	_keys(keys)

func _v(value: Vector3) -> Array:
	return [value.x, value.y, value.z]

func _capture(label: String) -> void:
	if DisplayServer.get_name() == "headless": return
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://reports/r3-independent/" + label + ".png")

func _finish() -> void:
	observer.set_physics_process(false)
	_keys([])
	var changed: Array = []
	for file in signatures:
		if FileAccess.get_sha256("res://scripts/"+file) != signatures[file]: changed.append(file)
	var file := FileAccess.open(OUT, FileAccess.WRITE)
	file.store_string(JSON.stringify({"utc": started_utc, "time_scale": Engine.time_scale, "ticks_per_second": Engine.physics_ticks_per_second, "source_sha256": signatures, "changed_during_run": changed, "mode": "automated engine input, normal product physics", "rows": rows}))
	file.close()
	game.initialized = false
	game.queue_free()
	print("R3_NORMAL_TIME_PROBE samples=", rows.size(), " changed=", changed)
	quit()
