extends SceneTree
var events: Array = []
var checks: Array = []
var samples: Array = []
func _initialize() -> void:
	call_deferred("_run")
func _check(label: String, passed: bool) -> void:
	checks.append({"label":label,"pass":passed})
func _run() -> void:
	var script := load("res://scripts/native_vfx_r3.gd")
	var sha := FileAccess.get_sha256("res://scripts/native_vfx_r3.gd")
	var fx = script.new()
	root.add_child(fx)
	fx.visual_event.connect(func(serial: int, phase: String, details: Dictionary): events.append({"serial":serial,"phase":phase,"details":details}))
	var serial: int = fx.start_action({"action_id":"palm","realm":5,"source":Vector3(1,2,3),"direction":Vector3.FORWARD,"windup":0.5})
	var then := Time.get_ticks_usec()
	for i in range(35):
		await physics_frame
		var now := Time.get_ticks_usec()
		fx.update_action(serial,{"source":Vector3(1+i*0.01,2,3)})
		var state: Dictionary = fx.debug_snapshot()
		samples.append({"physics":Engine.is_in_physics_frame(),"wall_delta":(now-then)/1000000.0,"snapshot":state})
		then = now
	var initial: Dictionary = fx.debug_snapshot()
	_check("charge tracks current source", initial.actions[0].root_position.distance_to(Vector3(1.34,2,3))<0.001)
	_check("charge has not auto released", not initial.actions[0].released)
	fx.strike_action(serial,{"source":Vector3(2,2,3),"aim":Vector3(2,2,-5),"flight_time":0.5})
	fx.strike_action(serial,{"source":Vector3(99,99,99)})
	fx.update_action(serial,{"source":Vector3(88,88,88)})
	var released: Dictionary = fx.debug_snapshot()
	_check("release remains at authority source", released.actions[0].release_source.distance_to(Vector3(2,2,3))<0.001)
	_check("released root stops following charge", released.actions[0].root_position.distance_to(Vector3(2,2,3))<0.001)
	for i in range(12): await physics_frame
	fx.strike_action(serial,{"phase":"impact","impact_position":Vector3(2,2,-5),"hit":true})
	fx.strike_action(serial,{"phase":"impact","impact_position":Vector3(2,2,-5),"hit":true})
	_check("one release event", events.filter(func(e):return e.phase=="release").size()==1)
	_check("one impact event", events.filter(func(e):return e.phase=="impact").size()==1)
	fx.end_action(serial,true)
	_check("cancel immediately clears active action",fx.debug_snapshot().active_count==0)
	var prefix: int = fx.start_action({"action_id":"cast_sweep","realm":4,"source":Vector3.ZERO})
	_check("cast prefix preserves sweep shape",fx.debug_snapshot().actions[0].shape=="sweep")
	fx.end_action(prefix,true)
	for i in range(45): await physics_frame
	_check("no active actions remain",fx.debug_snapshot().active_count==0)
	_check("source unchanged",sha==FileAccess.get_sha256("res://scripts/native_vfx_r3.gd"))
	var output := FileAccess.open("res://reports/r3-independent/vfx-contract.json",FileAccess.WRITE)
	output.store_string(JSON.stringify({"utc":Time.get_datetime_string_from_system(true),"sha256":sha,"checks":checks,"events":events,"samples":samples,"evidence":"module only; no new-art or keyboard-feel claim"}))
	output.close()
	print("R3_VFX_INDEPENDENT ",JSON.stringify(checks))
	fx.queue_free()
	quit(1 if checks.any(func(c):return not c.pass) else 0)
