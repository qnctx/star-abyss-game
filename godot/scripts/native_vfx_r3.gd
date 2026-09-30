class_name NativeVfxR3
extends Node3D
## Visual-only manager. Main owns release, hit, cancellation and all damage.
## All time advances from actual physics delta; event calls never advance time.
signal visual_event(serial: int, phase: String, details: Dictionary)

const RIBBON_SHADER = preload("res://assets/vfx-r3/qi_ribbon.gdshader")
const MAX_ACTIVE := 6
const MAX_LIFETIME := 6.0
const FADE_TIME := 0.18
const SHAPES := {
	"fist": "res://assets/vfx-r3/qi-fist-r3.glb",
	"palm": "res://assets/vfx-r3/qi-palm-r3.glb",
	"sweep": "res://assets/vfx-r3/qi-sweep-r3.glb",
	"cleave": "res://assets/vfx-r3/qi-cleave-r3.glb",
	"skyfall": "res://assets/vfx-r3/qi-skyfall-r3.glb",
}
const R2_PREVIEW := "res://assets/vfx-r2/qi-blade-r2.glb"
var auto_tick := true
var _serial := 0
var _actions: Dictionary = {}
var _scenes: Dictionary = {}
var _last_delta := 0.0
var _physics_samples := 0
var _single_serial := -1
var _single_target := Vector3.ZERO
var resource_version := "r2-contract-preview"

func begin_cast(realm: int, profile: Dictionary, socket: Transform3D, target: Vector3) -> void:
	clear()
	_single_target = target
	var action := String(profile.get("action_id", profile.get("action", "cast")))
	_single_serial = start_action({"action_id": action, "realm": realm, "source": socket.origin, "socket_basis": socket.basis, "socket": profile.get("socket", "hand_r"), "gesture": profile.get("gesture", "fist" if action.ends_with("fist") else "palm"), "direction": target - socket.origin, "windup": profile.get("windup", 0.25)})
	if _actions.has(_single_serial):
		resource_version = _actions[_single_serial].resource_version

func follow_socket(socket: Transform3D) -> void:
	update_action(_single_serial, {"source": socket.origin, "socket_basis": socket.basis, "direction": _single_target - socket.origin})

func release(socket: Transform3D, target: Vector3, travel_seconds := 0.12) -> void:
	_single_target = target
	strike_action(_single_serial, {"phase": "release", "source": socket.origin, "socket_basis": socket.basis, "direction": target - socket.origin, "aim": target, "flight_time": travel_seconds})

func impact(at: Vector3, normal := Vector3.UP, hit := true) -> void:
	strike_action(_single_serial, {"phase": "impact", "impact_position": at, "normal": normal, "hit": hit})

func cancel() -> void:
	end_action(_single_serial, true)
	queue_free()

func _physics_process(delta: float) -> void:
	if auto_tick:
		advance(delta)

func start_action(event: Dictionary) -> int:
	var source: Vector3 = event.get("source", Vector3(INF, INF, INF))
	if not source.is_finite():
		return -1
	if _actions.size() >= MAX_ACTIVE:
		end_action(int(_actions.keys()[0]), true)
	_serial += 1
	var shape := _shape_for(event)
	var effect := Node3D.new()
	effect.name = "QiR3_%d_%s" % [_serial, shape]
	add_child(effect)
	effect.top_level = true
	var ready_assets := ResourceLoader.exists(String(SHAPES[shape])) and ResourceLoader.exists("res://assets/vfx-r3/qi-charge-r3.glb") and ResourceLoader.exists("res://assets/vfx-r3/qi-impact-r3.glb")
	var release_path := String(SHAPES[shape]) if ready_assets else R2_PREVIEW
	var charge_path := "res://assets/vfx-r3/qi-charge-r3.glb" if ready_assets else R2_PREVIEW
	var impact_path := "res://assets/vfx-r3/qi-impact-r3.glb" if ready_assets else R2_PREVIEW
	var tint := _tint(int(event.get("realm", 4)))
	var charge := _layer(effect, charge_path, tint)
	var travel := _layer(effect, release_path, tint)
	var impact := _layer(effect, impact_path, tint)
	travel.node.visible = false
	impact.node.visible = false
	var state := {
		"root": effect, "charge": charge, "travel": travel, "impact": impact,
		"shape": shape, "realm": int(event.get("realm", 4)),
		"action_id": String(event.get("action_id", "cast")),
		"socket": String(event.get("socket", "hand_r")), "gesture": String(event.get("gesture", "palm")),
		"resource_version": "r3-existing-reference" if ready_assets else "r2-contract-preview",
		"phase": "windup", "age": 0.0, "phase_age": 0.0,
		"source": source, "release_source": source, "target": source,
		"direction": _direction(event), "released": false, "impacted": false,
		"windup": maxf(0.03, float(event.get("windup", 0.25))),
		"progress": 0.0, "flight_time": 0.12, "impact_age": -1.0,
		"impact_position": source, "ending": false, "end_age": 0.0, "end_duration": FADE_TIME, "missed": false,
		"release_frame": -1, "start_frame": Engine.get_physics_frames(),
	}
	_actions[_serial] = state
	_follow(state, event)
	_update_visual(state)
	visual_event.emit(_serial, "start", _event_details(state))
	return _serial

func update_action(serial: int, event: Dictionary) -> void:
	if not _actions.has(serial):
		return
	var state: Dictionary = _actions[serial]
	if state.released or state.ending:
		return
	_follow(state, event)
	state.progress = clampf(float(event.get("progress", state.progress)), 0.0, 1.0)
	_update_visual(state)

func strike_action(serial: int, event: Dictionary) -> void:
	if not _actions.has(serial):
		return
	var state: Dictionary = _actions[serial]
	if state.ending:
		return
	var phase := String(event.get("phase", "release"))
	if phase == "impact":
		if state.released:
			if bool(event.get("hit", true)):
				_impact(serial, state, event)
			else:
				_miss(serial, state)
		return
	if state.released:
		return
	var release_source: Vector3 = event.get("source", state.source)
	if not release_source.is_finite():
		return
	_follow(state, event)
	state.released = true
	state.phase = "release"
	state.phase_age = 0.0
	state.release_frame = Engine.get_physics_frames()
	state.release_source = state.source
	var aim: Vector3 = event.get("aim", state.source + state.direction * 2.0)
	if not aim.is_finite():
		aim = state.source + state.direction * 2.0
	state.target = aim
	state.flight_time = clampf(float(event.get("flight_time", 0.12)), 0.016, 1.4)
	state.travel.node.visible = true
	_update_visual(state)
	visual_event.emit(serial, "release", _event_details(state))
	if bool(event.get("hit", false)):
		_impact(serial, state, event)

func end_action(serial: int, cancelled: bool) -> void:
	if not _actions.has(serial):
		return
	var state: Dictionary = _actions[serial]
	if cancelled:
		# Hide immediately, then defer memory release to the safe frame boundary.
		state.root.visible = false
		state.root.queue_free()
		_actions.erase(serial)
		visual_event.emit(serial, "cancel", _event_details(state))
	elif not state.ending:
		state.ending = true
		state.end_age = state.age

func clear() -> void:
	for serial in _actions.keys():
		end_action(int(serial), true)

func advance(delta: float) -> void:
	if not is_finite(delta) or delta <= 0.0:
		return
	_last_delta = delta
	_physics_samples += 1
	for serial in _actions.keys():
		var state: Dictionary = _actions[serial]
		state.age += delta
		state.phase_age += delta
		if state.age >= MAX_LIFETIME or (state.ending and state.age - state.end_age >= state.end_duration) or (state.released and state.phase_age >= state.flight_time + 0.34):
			state.root.queue_free()
			_actions.erase(serial)
			visual_event.emit(int(serial), "finished", _event_details(state))
			continue
		_update_visual(state)
	if _single_serial >= 0 and _actions.is_empty():
		queue_free()

func debug_snapshot() -> Dictionary:
	var active: Array = []
	for serial in _actions:
		var state: Dictionary = _actions[serial]
		var item := _event_details(state)
		item["serial"] = serial
		item["root_position"] = state.root.global_position
		item["travel_position"] = state.travel.node.global_position
		item["impact_visible"] = state.impact.node.visible
		item["charge_normal"] = -state.charge.node.global_basis.z.normalized()
		active.append(item)
	return {"active_count": _actions.size(), "max_active": MAX_ACTIVE, "last_delta": _last_delta, "physics_samples": _physics_samples, "actions": active}

func _follow(state: Dictionary, event: Dictionary) -> void:
	var source: Vector3 = event.get("source", state.source)
	if not source.is_finite():
		return
	state.source = source
	state.direction = _direction(event, state.direction)
	state.root.global_transform = Transform3D(_aim_basis(state.direction), source)
	if event.has("socket_basis"):
		var hand_basis: Basis = event.socket_basis
		if hand_basis.is_finite() and absf(hand_basis.determinant()) > 0.0001:
			# Authored palm axes confirmed by motion owner: R outward=-X,
			# L outward=+X, finger direction=+Y. Only charge follows the palm.
			var palm_normal := hand_basis.x * (1.0 if state.socket == "hand_l" else -1.0)
			var palm_up := hand_basis.y
			if state.gesture == "fist":
				palm_normal = hand_basis.y
				palm_up = hand_basis.z
			state.charge.node.global_basis = Basis.looking_at(palm_normal.normalized(), palm_up.normalized())

func _impact(serial: int, state: Dictionary, event: Dictionary) -> void:
	if state.impacted:
		return
	var at: Vector3 = event.get("impact_position", event.get("aim", state.target))
	if not at.is_finite():
		return
	state.impacted = true
	state.impact_age = state.phase_age
	state.impact_position = at
	state.impact.node.visible = true
	var normal: Vector3 = event.get("normal", -state.direction)
	if not normal.is_finite() or normal.length_squared() < 0.0001:
		normal = -state.direction
	state.impact.node.global_transform = Transform3D(_aim_basis(normal.normalized()), at)
	_update_visual(state)
	visual_event.emit(serial, "impact", _event_details(state))

func _miss(serial: int, state: Dictionary) -> void:
	if state.impacted or state.missed:
		return
	state.missed = true
	state.phase = "dissipate"
	state.ending = true
	state.end_age = state.age
	state.end_duration = 0.085
	state.impact.node.visible = false
	visual_event.emit(serial, "miss", _event_details(state))

func _update_visual(state: Dictionary) -> void:
	var ending_fade := 1.0 - smoothstep(0.0, state.end_duration, state.age - state.end_age) if state.ending else 1.0
	if not state.released:
		var p := clampf(maxf(state.progress, state.phase_age / state.windup), 0.0, 1.0)
		state.charge.node.scale = Vector3.ONE * lerpf(0.55, 0.85, p)
		_set_layer(state.charge, (0.25 + p * 0.6) * ending_fade, state.phase_age, 0.15)
		return
	var age: float = state.phase_age
	_set_layer(state.charge, (1.0 - smoothstep(0.0, 0.065, age)) * 0.5 * ending_fade, age, 0.2)
	# A short launch hold makes the release socket visible even when several
	# physics ticks run per rendered frame. Arrival still matches Main's deadline.
	var launch_hold := minf(0.034, state.flight_time * 0.28)
	var progress := clampf((age - launch_hold) / maxf(0.001, state.flight_time - launch_hold), 0.0, 1.0)
	state.travel.node.global_position = state.release_source.lerp(state.target, progress)
	var shape_size := 1.0 if state.action_id == "cast" or String(state.action_id).contains("cast_") else 0.72
	state.travel.node.scale = Vector3.ONE * shape_size * lerpf(0.5, 1.0, smoothstep(0.0, 0.045, age))
	var travel_fade := 1.0 - smoothstep(state.flight_time, state.flight_time + 0.14, age)
	if state.impacted:
		travel_fade *= 1.0 - smoothstep(0.0, 0.11, age - state.impact_age)
	_set_layer(state.travel, travel_fade * 0.83 * ending_fade, age, 0.28)
	if state.impacted:
		var hit_age: float = age - state.impact_age
		state.impact.node.scale = Vector3.ONE * lerpf(0.4, 1.4, smoothstep(0.0, 0.2, hit_age))
		_set_layer(state.impact, (1.0 - smoothstep(0.025, 0.24, hit_age)) * 0.9 * ending_fade, hit_age, 0.75)

func _layer(parent: Node3D, path: String, tint: Vector3) -> Dictionary:
	if not _scenes.has(path):
		_scenes[path] = load(path)
	var node: Node3D = _scenes[path].instantiate()
	parent.add_child(node)
	var material := ShaderMaterial.new()
	material.shader = RIBBON_SHADER
	material.set_shader_parameter("tint", tint)
	_apply_material(node, material)
	return {"node": node, "material": material}

func _apply_material(node: Node, material: ShaderMaterial) -> void:
	if node is MeshInstance3D:
		node.material_override = material
		node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	for child in node.get_children():
		_apply_material(child, material)

func _set_layer(layer: Dictionary, intensity: float, age: float, core: float) -> void:
	layer.material.set_shader_parameter("intensity", intensity)
	layer.material.set_shader_parameter("phase_age", age)
	layer.material.set_shader_parameter("core_strength", core)
	layer.node.visible = intensity > 0.004

func _shape_for(event: Dictionary) -> String:
	var action := String(event.get("action_id", "cast"))
	action = action.trim_prefix("air_").trim_prefix("cast_")
	if action in ["fist", "palm", "sweep", "cleave", "skyfall"]:
		return action
	if action != "cast":
		return "fist"
	var realm := int(event.get("realm", 4))
	return "skyfall" if realm >= 9 else "cleave" if realm >= 8 else "sweep" if realm >= 6 else "palm" if realm >= 5 else "fist"

func _direction(event: Dictionary, fallback := Vector3.FORWARD) -> Vector3:
	var aim: Vector3 = event.get("direction", fallback)
	return aim.normalized() if aim.is_finite() and aim.length_squared() > 0.0001 else fallback

func _aim_basis(direction: Vector3) -> Basis:
	return Basis.looking_at(direction, Vector3.RIGHT if absf(direction.y) > 0.98 else Vector3.UP)

func _tint(realm: int) -> Vector3:
	return Vector3(1.0, 0.8, 0.4) if realm >= 9 else Vector3(0.6, 0.5, 1.0) if realm >= 8 else Vector3(0.25, 0.8, 1.0)

func _event_details(state: Dictionary) -> Dictionary:
	return {"phase": state.phase, "action_id": state.action_id, "shape": state.shape, "resource_version": state.resource_version, "age": state.age, "phase_age": state.phase_age, "source": state.source, "release_source": state.release_source, "release_frame": state.release_frame, "released": state.released, "impacted": state.impacted, "missed": state.missed, "delta": _last_delta, "physics_frame": Engine.get_physics_frames()}
