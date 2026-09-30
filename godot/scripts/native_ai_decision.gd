extends RefCounted
class_name NativeAIDecision

# Tactical memory contains observations, never player input or private cooldowns.
const MEMORY_SECONDS := 4.5
const MAX_PREDICTION_SECONDS := 0.65
const MAX_OBSERVED_SPEED := 22.0

var last_seen := Vector3.ZERO
var last_velocity := Vector3.ZERO
var last_seen_at := -1000.0
var hurt_until := -1000.0
var wounded_until := -1000.0
var _threat: Dictionary = {}
var _threat_serial := 0
var _consumed_serial := -1
var _last_evade_at := -1000.0

func reset() -> void:
	last_seen = Vector3.ZERO
	last_velocity = Vector3.ZERO
	last_seen_at = -1000.0
	hurt_until = -1000.0
	wounded_until = -1000.0
	_threat.clear()
	_threat_serial = 0
	_consumed_serial = -1
	_last_evade_at = -1000.0

func observe(now: float, position: Vector3, visible: bool) -> void:
	if not visible or not position.is_finite() or not is_finite(now):
		return
	var elapsed := now - last_seen_at
	if elapsed >= 0.12 and elapsed <= 1.0:
		var measured := (position - last_seen) / elapsed
		last_velocity = measured if measured.length() <= MAX_OBSERVED_SPEED else Vector3.ZERO
	elif elapsed > 1.0:
		last_velocity = Vector3.ZERO
	last_seen = position
	last_seen_at = now

func remembers(now: float) -> bool:
	return is_finite(now) and now - last_seen_at <= MEMORY_SECONDS

func predict(now: float, lead_seconds: float) -> Vector3:
	if not remembers(now):
		return last_seen
	var age := clampf(now - last_seen_at, 0.0, 0.35)
	return last_seen + last_velocity * clampf(age + lead_seconds, 0.0, MAX_PREDICTION_SECONDS)

func register_hit(now: float, hp_ratio: float) -> void:
	hurt_until = maxf(hurt_until, now + 1.4)
	if hp_ratio <= 0.28:
		wounded_until = maxf(wounded_until, now + 3.5)

func should_withdraw(now: float, hp_ratio: float) -> bool:
	return hp_ratio <= 0.28 and now < wounded_until

func cautious(now: float) -> bool:
	return now < hurt_until

# Called only for a public, visible windup. All accepted fields are bounded.
func observe_public_threat(now: float, cue: Dictionary) -> bool:
	if not is_finite(now):
		return false
	if String(cue.get("phase", "")) != "windup":
		return false
	var shape := String(cue.get("shape", ""))
	if shape not in ["line", "cone", "sphere"]:
		return false
	var origin: Variant = cue.get("origin")
	var direction: Variant = cue.get("direction")
	if not origin is Vector3 or not direction is Vector3:
		return false
	if not origin.is_finite() or not direction.is_finite() or direction.length_squared() < 0.01:
		return false
	var reach := float(cue.get("range", -1.0))
	var radius := float(cue.get("radius", -1.0))
	var remaining := float(cue.get("release_remaining", -1.0))
	if not is_finite(reach) or not is_finite(radius) or not is_finite(remaining):
		return false
	if reach <= 0.0 or reach > 60.0 or radius <= 0.0 or radius > 15.0 or remaining < 0.08 or remaining > 2.0:
		return false
	_threat_serial += 1
	_threat = {"origin": origin, "direction": direction.normalized(), "range": reach, "radius": radius,
		"shape": shape, "expires": now + remaining + 0.15, "serial": _threat_serial}
	return true

func evade_goal(now: float, position: Vector3, side: float) -> Dictionary:
	if _threat.is_empty() or now >= float(_threat["expires"]) or int(_threat["serial"]) == _consumed_serial or now - _last_evade_at < 2.5:
		return {}
	var origin: Vector3 = _threat["origin"]
	var direction: Vector3 = _threat["direction"]
	var reach: float = _threat["range"]
	var radius: float = _threat["radius"]
	var projected := (position - origin).dot(direction)
	if projected < -0.6 or projected > reach + 0.8:
		return {}
	var closest := origin + direction * clampf(projected, 0.0, reach)
	var allowance := radius + 0.8
	match String(_threat["shape"]):
		"cone":
			allowance += projected * 0.32
		"sphere":
			closest = origin + direction * reach
	if position.distance_to(closest) > allowance:
		return {}
	var lateral := Vector3(-direction.z, 0.0, direction.x).normalized()
	if lateral.length_squared() < 0.01:
		lateral = Vector3.RIGHT
	var chosen_side := -1.0 if side < 0.0 else 1.0
	var goal := position + lateral * chosen_side * (allowance + 1.3) - Vector3(direction.x, 0.0, direction.z) * 0.8
	_consumed_serial = int(_threat["serial"])
	_last_evade_at = now
	return {"goal": goal, "serial": _consumed_serial}
