extends SceneTree

var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("_run")

func check(name: String, passed: bool) -> void:
	if not passed:
		failures.append(name)
		printerr("FAIL ", name)

func _run() -> void:
	var ai := NativeAIDecision.new()
	ai.observe(0.0, Vector3(0, 0, 0), true)
	ai.observe(0.2, Vector3(1, 0, 0), true)
	check("observed velocity leads a committed attack", ai.predict(0.2, 0.3).x > 2.0)
	ai.observe(0.4, Vector3(50, 0, 0), false)
	check("hidden player position never enters memory", ai.last_seen.x == 1.0)
	ai.observe(0.4, Vector3(100, 0, 0), true)
	check("teleports do not grant impossible velocity prediction", ai.last_velocity == Vector3.ZERO)
	check("memory expires", not ai.remembers(5.0))
	ai.register_hit(5.0, 0.2)
	check("low health creates bounded withdrawal", ai.should_withdraw(6.0, 0.2) and not ai.should_withdraw(9.0, 0.2))
	var cue := {"phase": "windup", "shape": "line", "origin": Vector3.ZERO, "direction": Vector3.FORWARD, "range": 12.0, "radius": 1.0, "release_remaining": 0.5}
	check("public cue accepts safe geometry", ai.observe_public_threat(10.0, cue))
	check("near line gives one lateral evasion", not ai.evade_goal(10.0, Vector3(0, 1, -4), 1.0).is_empty() and ai.evade_goal(10.0, Vector3(0, 1, -4), 1.0).is_empty())
	check("arbitrary command is rejected", not ai.observe_public_threat(11.0, {"phase":"windup", "shape":"execute", "command":"quit()", "origin": Vector3.ZERO, "direction": Vector3.FORWARD, "range": 12.0, "radius": 1.0, "release_remaining": 0.5}))
	check("evade has cooldown", ai.observe_public_threat(11.0, cue) and ai.evade_goal(11.0, Vector3(0, 1, -4), 1.0).is_empty())
	var npc := NativeAINpc.new()
	check("camp shift has distinct purposes", npc.purpose(20.0) == "repair" and npc.purpose(130.0) == "inspect" and npc.purpose(210.0) == "rest")
	check("conversation needs visibility and reach", not npc.interact(2.0, false, 1.0)["handled"] and not npc.interact(2.0, true, 7.0)["handled"])
	check("first greeting is authored", npc.interact(2.0, true, 2.0)["handled"] and npc.talks == 1)
	check("survey memory needs observation", not npc.observe_event("survey", 3.0, false) and npc.observe_event("survey", 3.0, true) and npc.surveyed)
	check("observed combat causes temporary avoidance", npc.observe_event("combat", 4.0, true) and npc.purpose(5.0) == "avoid" and npc.purpose(40.0) != "avoid")
	var saved := npc.snapshot()
	var restored := NativeAINpc.new()
	restored.restore(saved)
	check("NPC relationship memory survives save", restored.surveyed and restored.witnessed_combat and restored.talks == 1)
	var actor := NativeAICampNpc.new()
	actor.clock = 188.0
	var actor_copy := NativeAICampNpc.new()
	actor_copy.restore(actor.snapshot())
	check("NPC routine phase survives save", is_equal_approx(actor_copy.clock, 188.0) and actor_copy.mind.purpose(actor_copy.clock) == "rest")
	actor.free()
	actor_copy.free()
	print("NATIVE_AI_LOGIC_VERIFY ", JSON.stringify({"passed": failures.is_empty(), "failures": failures}))
	quit(0 if failures.is_empty() else 1)
