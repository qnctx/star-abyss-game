extends "res://assets/motion-r2/gait-r7/candidate_motion.gd"
## Candidate-only event-synchronized live outgoing gait blend.
## No edits to shared Motion/Player and no larger floor-lift cap.
var _last_ground_gait := "idle"
var _outgoing := ""
var _outgoing_phase := 0.0
var _fade_remaining := 0.0
var transition_count := 0

func mapped_phase(phase: float, from_stance: float, to_stance: float) -> float:
	var left := fposmod(phase,1.0)
	var right := fposmod(phase+0.5,1.0)
	var shift := 0.0
	var leg := left
	if (right < from_stance and (left >= from_stance or right < left)) or (left >= from_stance and right >= from_stance and right > left):
		shift = 0.5
		leg = right
	var mapped := leg/from_stance*to_stance if leg < from_stance else to_stance+(leg-from_stance)/(1.0-from_stance)*(1.0-to_stance)
	return fposmod(mapped-shift,1.0)

func step(dt: float, state: Dictionary) -> void:
	var speed := float(state.get("speed",0.0))
	var target := "idle" if speed <= 0.15 else "walk" if speed < 2.5 else "jog" if speed < 8.0 else "sprint"
	var ordinary := not bool(state.get("airborne",false)) and String(state.get("action","")).is_empty() and not bool(state.get("guard",false)) and _combat_hold <= 0.0
	if ordinary:
		if target != _last_ground_gait:
			_outgoing = _last_ground_gait
			_outgoing_phase = gait_phase
			_fade_remaining = 0.15
			transition_count += 1
			if target in ["walk","jog","sprint"] and _outgoing in ["walk","jog","sprint"]:
				gait_phase = mapped_phase(gait_phase,float(GAIT_STANCE[_outgoing]),float(GAIT_STANCE[target]))
			_blend_key = target+":ground"
			_blend_age = 0.0
		_last_ground_gait = target
		if _fade_remaining > 0.0 and names.has(_outgoing):
			_base_rig.reset_bone_poses()
			_base_player.play(names[_outgoing],0.0)
			if _outgoing in ["walk","jog","sprint"]:
				if target in ["walk","jog","sprint"]:
					var next_phase := fposmod(gait_phase+dt*speed/float(GAIT_STRIDE[target]),1.0)
					_outgoing_phase = mapped_phase(next_phase,float(GAIT_STANCE[target]),float(GAIT_STANCE[_outgoing]))
				else:
					_outgoing_phase = fposmod(_outgoing_phase+dt*speed/float(GAIT_STRIDE[_outgoing]),1.0)
				_base_player.seek(_outgoing_phase*_base_player.current_animation_length,true)
			else:
				_base_player.seek(0.0,true)
			_blend_from.clear()
			for i in range(_rig.get_bone_count()):
				_blend_from.append(_base_rig.get_bone_pose(i))
			_fade_remaining = maxf(0.0,_fade_remaining-dt)
	else:
		_last_ground_gait = "idle"
		_fade_remaining = 0.0
	super.step(dt,state)
