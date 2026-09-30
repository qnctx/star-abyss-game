extends Node3D
## Only presents authoritative martial events; owns no damage or collision.
const SHADER = preload("res://assets/martial-r4/martial_qi.gdshader")
var phase := "windup"
var age := 0.0
var phase_age := 0.0
var kind := "fist"
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
	projectile = _asset("pressure" if kind in ["break", "descent"] else kind)
	contact = _asset("impact")
	projectile.hide()
	contact.hide()
	follow(socket, heading, 0.0)

func _asset(label: String) -> Node3D:
	var scene: PackedScene = load("res://assets/martial-r4/" + label + ".glb")
	var node := scene.instantiate() as Node3D
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
	charge.scale = Vector3.ONE * (lerpf(0.45, 1.0, amount) if kind == "break" else 0.55)

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
	phase = "cancel"
	phase_age = 0.0
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
	if phase == "impact":
		contact.scale *= 1.0 + delta * 2.2
	elif phase == "cancel":
		charge.scale *= maxf(0.0, 1.0 - delta * 8.0)
