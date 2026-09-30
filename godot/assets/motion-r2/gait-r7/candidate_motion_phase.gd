extends "res://assets/motion-r2/gait-r7/candidate_motion.gd"
## Isolated candidate: synchronize supporting-leg event across gait switches.
## Keeps production code, thresholds, strides and floor-lift bound unchanged.
var _last_ground_gait := "idle"

func step(dt: float, state: Dictionary) -> void:
	var speed := float(state.get("speed",0.0))
	var target := "idle" if speed <= 0.15 else "walk" if speed < 2.5 else "jog" if speed < 8.0 else "sprint"
	if not bool(state.get("airborne",false)) and String(state.get("action","")).is_empty() and not bool(state.get("guard",false)):
		if target != _last_ground_gait and target in ["walk","jog","sprint"] and _last_ground_gait in ["walk","jog","sprint"]:
			var old_stance: float = GAIT_STANCE[_last_ground_gait]
			var next_stance: float = GAIT_STANCE[target]
			var left := fposmod(gait_phase,1.0)
			var right := fposmod(gait_phase+0.5,1.0)
			# Choose the most recent support in double support. During flight,
			# choose the leg closest to its forthcoming ground contact.
			var shift := 0.0
			var leg_phase := left
			if (right < old_stance and (left >= old_stance or right < left)) or (left >= old_stance and right >= old_stance and right > left):
				shift = 0.5
				leg_phase = right
			var mapped := leg_phase/old_stance*next_stance if leg_phase < old_stance else next_stance+(leg_phase-old_stance)/(1.0-old_stance)*(1.0-next_stance)
			gait_phase = fposmod(mapped-shift,1.0)
		_last_ground_gait = target
	else:
		_last_ground_gait = "idle"
	super.step(dt,state)
