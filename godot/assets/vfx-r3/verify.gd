extends SceneTree
const FX = preload("res://scripts/native_vfx_r3.gd")
var records: Array = []
var failures: Array = []
var elapsed := 0.0
var fx: Node3D

func _initialize() -> void:
	call_deferred("run")

func sample_for(seconds: float) -> void:
	var deadline := elapsed + seconds
	while elapsed < deadline:
		await physics_frame
		var delta: float = root.get_physics_process_delta_time()
		elapsed += delta
		records.append({"frame": Engine.get_physics_frames(), "delta": delta, "elapsed": elapsed, "snapshot": fx.debug_snapshot() if is_instance_valid(fx) else {"active_count": 0}})

func check(ok: bool, detail: String) -> void:
	if not ok:
		failures.append(detail)

func run() -> void:
	fx = FX.new()
	root.add_child(fx)
	var events: Array = []
	fx.visual_event.connect(func(serial: int, phase: String, data: Dictionary): events.append({"serial":serial,"phase":phase,"data":data}))
	var id: int = fx.start_action({"source": Vector3(1, 1.5, 0), "direction": Vector3.FORWARD, "action_id": "sweep", "windup": 0.3})
	await sample_for(0.08)
	fx.update_action(id, {"source": Vector3(1.5, 1.7, 0), "progress": 0.5})
	var s: Dictionary = fx.debug_snapshot().actions[0]
	check(s.root_position.distance_to(Vector3(1.5,1.7,0)) < 0.0001, "windup must track current socket exactly")
	check(not s.released and not s.impact_visible, "charge must not release/impact autonomously")
	var strike := {"source": Vector3(1.7,1.8,0), "aim": Vector3(1.7,1.8,-2), "direction": Vector3.FORWARD, "phase": "release"}
	fx.strike_action(id, strike)
	fx.strike_action(id, strike)
	fx.update_action(id, {"source": Vector3(15,15,15)})
	s = fx.debug_snapshot().actions[0]
	check(s.release_source.distance_to(Vector3(1.7,1.8,0)) < 0.0001, "release source must be authoritative socket")
	check(s.root_position.distance_to(Vector3(1.7,1.8,0)) < 0.0001, "released effects must detach from player")
	await sample_for(0.1)
	fx.strike_action(id, {"phase":"impact","hit":true,"aim":Vector3(1.7,1.8,-2)})
	fx.strike_action(id, {"phase":"impact","hit":true,"aim":Vector3(1.7,1.8,-2)})
	check(events.filter(func(e): return e.phase == "release").size() == 1, "release event must be idempotent")
	check(events.filter(func(e): return e.phase == "impact").size() == 1, "impact event must be idempotent")
	await sample_for(0.6)
	check(fx.debug_snapshot().active_count == 0, "expired visuals must be removed")
	var miss_id: int = fx.start_action({"source":Vector3.ZERO,"realm":4})
	fx.strike_action(miss_id,{"phase":"release","source":Vector3.ZERO,"aim":Vector3(0,0,-3)})
	await sample_for(0.05)
	fx.strike_action(miss_id,{"phase":"impact","hit":false,"aim":Vector3(0,0,-3)})
	fx.strike_action(miss_id,{"phase":"impact","hit":false,"aim":Vector3(0,0,-3)})
	var missed: Dictionary = fx.debug_snapshot().actions[0]
	check(missed.missed and not missed.impacted and not missed.impact_visible, "miss must dissipate without a target impact flash")
	check(events.filter(func(e): return e.phase == "miss").size() == 1, "miss feedback must be idempotent")
	await sample_for(0.12)
	check(fx.debug_snapshot().active_count == 0, "miss must clear after its short fade")
	for i in range(10):
		fx.start_action({"source":Vector3.ZERO,"realm":9,"windup":2.2})
	check(fx.debug_snapshot().active_count == 6, "concurrency must be bounded")
	fx.clear()
	check(fx.debug_snapshot().active_count == 0, "cancel must remove active effects immediately")
	check(fx.start_action({"source":Vector3(INF,0,0)}) == -1, "invalid socket must not spawn a fake center effect")
	for shape in ["fist","palm","sweep","cleave","skyfall"]:
		fx.begin_cast(4,{"action":"cast_"+shape},Transform3D.IDENTITY,Vector3.FORWARD)
		check(fx.debug_snapshot().actions[0].shape == shape, "profile.action must override realm for " + shape)
		fx.begin_cast(4,{"action_id":"air_cast_"+shape},Transform3D.IDENTITY,Vector3.FORWARD)
		check(fx.debug_snapshot().actions[0].shape == shape, "profile.action_id must normalize air_cast_ for " + shape)
	var hand_basis := Basis(Vector3.UP,0.7) * Basis(Vector3.RIGHT,0.3)
	for hand in ["hand_l","hand_r"]:
		fx.begin_cast(5,{"action":"cast_palm","socket":hand,"gesture":"palm"},Transform3D(hand_basis,Vector3.ZERO),Vector3.FORWARD)
		var expected: Vector3 = hand_basis.x * (1.0 if hand == "hand_l" else -1.0)
		check(fx.debug_snapshot().actions[0].charge_normal.distance_to(expected) < 0.0001, "charge must follow authored palm normal " + hand)
	fx.begin_cast(4,{"action":"cast_fist","socket":"hand_r","gesture":"fist"},Transform3D(hand_basis,Vector3.ZERO),Vector3.FORWARD)
	check(fx.debug_snapshot().actions[0].charge_normal.distance_to(hand_basis.y) < 0.0001, "fist charge must follow finger direction")
	fx.queue_free()
	await process_frame
	fx = FX.new()
	root.add_child(fx)
	fx.begin_cast(9,{"windup":2.2},Transform3D(Basis.IDENTITY,Vector3(0,1,0)),Vector3(0,1,-3))
	await sample_for(2.25)
	check(is_instance_valid(fx) and fx.debug_snapshot().active_count == 1, "R9 long windup must survive")
	fx.release(Transform3D(Basis.IDENTITY,Vector3(0,1,0)),Vector3(0,1,-3),0.12)
	fx.impact(Vector3(0,1,-3))
	await sample_for(0.6)
	check(not is_instance_valid(fx), "single-cast instance must auto-free")
	var out := FileAccess.open("res://assets/vfx-r3/verification.json",FileAccess.WRITE)
	out.store_string(JSON.stringify({"mode":"real physics_frame at time_scale=1; no manual advance","failures":failures,"events":events,"records":records},"\t"))
	print("VFX_R3_VERIFY ", "PASS" if failures.is_empty() else str(failures), " physics_samples=",records.size())
	quit(0 if failures.is_empty() else 1)
