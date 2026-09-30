extends Node3D
## Only presents authoritative martial events; owns no damage or collision.
const SHADER = preload("res://assets/martial-r4-candidate-01/martial_qi.gdshader")
var phase := "windup"
var age := 0.0
var phase_age := 0.0
var kind := "fist"
var wake_nodes: Array[Node3D] = []
var charge: Node3D
var projectile: Node3D
var contact: Node3D
var materials: Array[ShaderMaterial] = []
var source := Vector3.ZERO
var direction := Vector3.FORWARD
var up := Vector3.UP

func begin(skill: String, socket: Transform3D, heading: Vector3, local_up: Vector3) -> void:
	kind = skill
	up = local_up
	direction = heading
	source = socket.origin
	charge = _asset("charge" if kind in ["break", "descent"] else "fist")
	if kind == "descent":
		projectile = Node3D.new()
		add_child(projectile)
		for index in range(3):
			var wake := _asset("descent_wake")
			wake.reparent(projectile)
			wake_nodes.append(wake)
	else:
		projectile = _asset("pressure" if kind == "break" else kind)
	contact = _asset("impact")
	projectile.hide()
	contact.hide()
	follow(socket, heading, 0.0)

func _asset(label: String) -> Node3D:
	var asset_dir := "res://assets/martial-r4-candidate-01/" if label in ["charge", "pressure", "descent_wake"] else "res://assets/martial-r4/"
	var node: Node3D
	if label in ["charge", "pressure", "descent_wake"]:
		node = preload("res://assets/martial-r4-candidate-01/native_martial_candidate_library.gd").scene_from_glb(asset_dir + label + ".glb") as Node3D
	else:
		var scene: PackedScene = load(asset_dir + label + ".glb")
		node = scene.instantiate() as Node3D
	add_child(node)
	for child in node.find_children("*", "MeshInstance3D", true, false):
		var material := ShaderMaterial.new()
		material.shader = SHADER
		material.set_shader_parameter("tint", Vector3(0.10, 0.62, 0.86))
		material.set_shader_parameter("intensity", 0.65)
		child.material_override = material
		child.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		materials.append(material)
	return node

func follow(socket: Transform3D, heading: Vector3, amount: float) -> void:
	if phase != "windup":
		return
	source = socket.origin
	direction = heading
	global_position = source
	_orient(direction)
	charge.scale = Vector3(1.0, lerpf(0.45, 1.0, amount), lerpf(0.45, 1.0, amount)) if kind == "break" else Vector3.ONE * 0.55

func _orient(heading: Vector3) -> void:
	var stable_up := up if absf(heading.dot(up)) < 0.98 else Vector3.RIGHT
	if absf(heading.dot(stable_up)) > 0.98:
		stable_up = Vector3.FORWARD
	global_basis = Basis.looking_at(heading, stable_up)

func release(at: Vector3, heading: Vector3) -> void:
	phase = "travel"
	phase_age = 0.0
	charge.hide()
	projectile.show()
	global_position = at
	_orient(heading)

func travel(at: Vector3) -> void:
	if phase == "travel":
		global_position = at

func follow_descent_anchors(owner_player: Node3D, local_up: Vector3) -> void:
	if phase != "travel" or kind != "descent": return
	global_transform = Transform3D.IDENTITY
	var rig: Skeleton3D = owner_player._r2._rig
	var anchors := ["shoulderL", "shoulderR", "elbowR"]
	var tangent := owner_player.global_basis.z.slide(local_up).normalized()
	if tangent.is_zero_approx(): tangent = Vector3.FORWARD.slide(local_up).normalized()
	for index in range(wake_nodes.size()):
		var bone := rig.find_bone(anchors[index])
		if bone < 0:
			wake_nodes[index].hide()
			continue
		wake_nodes[index].global_transform = Transform3D(Basis.looking_at(-local_up, tangent), (rig.global_transform * rig.get_bone_global_pose(bone)).origin)

func impact(at: Vector3, normal: Vector3, landed: bool, scale_factor := 1.0) -> void:
	phase = "impact" if landed else "miss"
	phase_age = 0.0
	projectile.hide()
	charge.hide()
	global_position = at
	if landed:
		_orient(normal)
		contact.scale = Vector3.ONE * clampf(scale_factor, 0.3, 2.5)
		contact.show()

func cancel() -> void:
	var was_travelling := phase == "travel"
	phase = "cancel"
	phase_age = 0.0
	if not (kind == "descent" and was_travelling):
		projectile.hide()
	contact.hide()

func shock(at: Vector3, normal: Vector3, radius: float) -> void:
	impact(at, normal, true, 1.0)
	# The authored broken arcs expand from the actual collision point only.
	contact.scale = Vector3.ONE * maxf(1.0, radius * 0.55)

func _physics_process(delta: float) -> void:
	age += delta
	phase_age += delta
	if age > 5.0 or (phase in ["miss", "cancel"] and phase_age > 0.14) or (phase == "impact" and phase_age > 0.32):
		queue_free()
		return
	var fade := 1.0 - clampf(phase_age / (0.32 if phase == "impact" else 0.14), 0.0, 1.0) if phase in ["miss", "cancel", "impact"] else 1.0
	for material in materials:
		material.set_shader_parameter("intensity", fade * 0.90)
		material.set_shader_parameter("phase_age", phase_age)
		material.set_shader_parameter("flow_direction", -1.0 if phase == "cancel" else 1.0)
	if phase == "impact":
		contact.scale *= 1.0 + delta * 2.2
	elif phase == "cancel":
		if kind == "descent":
			for wake in wake_nodes:
				wake.global_position += up * delta * 0.4
				wake.scale *= 1.0 + delta * 1.5
		else:
			charge.position.z += delta * 0.9
			charge.scale.x *= 1.0 + delta * 2.0
			charge.scale.y *= maxf(0.0, 1.0 - delta * 4.0)
