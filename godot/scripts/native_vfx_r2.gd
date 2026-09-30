class_name NativeVfxR2
extends Node3D
## Visual-only directional effect. Owner supplies collision/impact and damage.
const BLADE = preload("res://assets/vfx-r2/qi-blade-r2.glb")
var mesh_root: Node3D
var material: ShaderMaterial
var age := 0.0
var direction := Vector3.FORWARD
var origin := Vector3.ZERO
var travel_speed := 24.0
var impact_age := -1.0
var auto_tick := true
var charge_duration := 0.18
var flight_end := 0.65
var lifetime := 0.8
var max_travel := INF
var stationary := false
var visual_scale := 1.0

func _ready() -> void:
	mesh_root = BLADE.instantiate()
	add_child(mesh_root)
	var shader := Shader.new()
	shader.code = """shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled;
uniform float intensity = 0.0;
uniform vec3 tint = vec3(1.4,2.8,3.4);
void fragment() {
 float edge = pow(max(0.0, 1.0-abs(UV.y*2.0-1.0)), 1.4);
 float tip = smoothstep(0.0,0.12,UV.x)*smoothstep(0.0,0.12,1.0-UV.x);
 ALBEDO = tint;
 ALPHA = edge * tip * intensity * 0.8 * smoothstep(0.65,1.6,length(VERTEX));
}
"""
	material = ShaderMaterial.new()
	material.shader = shader
	_apply_material(mesh_root)

func _apply_material(node: Node) -> void:
	if node is MeshInstance3D:
		node.material_override = material
		node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	for child in node.get_children():
		_apply_material(child)

func launch(hand_world: Vector3, aim: Vector3, speed := 24.0) -> void:
	direction = aim.normalized() if aim.length_squared() > 0.00001 else Vector3.FORWARD
	origin = hand_world + direction * 0.45
	global_position = origin
	var up := Vector3.RIGHT if absf(direction.dot(Vector3.UP)) > 0.98 else Vector3.UP
	look_at(origin + direction, up)
	travel_speed = speed
	age = 0.0
	impact_age = -1.0
	charge_duration = 0.18
	flight_end = 0.65
	lifetime = 0.8
	max_travel = INF
	stationary = false
	visual_scale = 1.0
	material.set_shader_parameter("tint",Vector3(1.4,2.8,3.4))

func launch_tier(realm: int, hand_world: Vector3, target: Vector3, contact_time: float) -> void:
	if realm < 6:
		launch_toward(hand_world,target,contact_time)
		return
	launch(hand_world,target-hand_world)
	var asset := "qi-dao-r2" if realm >= 9 else "qi-fracture-r2" if realm >= 8 else "qi-domain-r2"
	mesh_root.free()
	mesh_root = load("res://assets/vfx-r2/"+asset+".glb").instantiate()
	add_child(mesh_root)
	_apply_material(mesh_root)
	origin = target
	global_position = target
	stationary = true
	# Aim points on large creatures sit low inside opaque body/terrain. Lift the
	# open halo mesh (not the authoritative target) so its upper arcs remain legible.
	mesh_root.position = global_basis.inverse() * Vector3.UP * 0.9
	visual_scale = 1.5 if realm >= 8 else 1.4
	charge_duration = maxf(0.02,contact_time*0.7)
	flight_end = maxf(0.05,contact_time)
	lifetime = flight_end + 0.25
	material.set_shader_parameter("tint",Vector3(3.2,2.6,1.5) if realm >= 9 else Vector3(2.1,1.8,3.4) if realm >= 8 else Vector3(1.4,2.8,3.4))

func launch_toward(hand_world: Vector3, target: Vector3, contact_time: float) -> void:
	launch(hand_world, target - hand_world)
	charge_duration = minf(0.18, maxf(0.01, contact_time * 0.35))
	flight_end = maxf(charge_duration + 0.01, contact_time)
	lifetime = flight_end + 0.15
	max_travel = maxf(0.0, (target - origin).dot(direction))
	travel_speed = max_travel / (flight_end - charge_duration)

func impact() -> void:
	impact_age = age

func _process(dt: float) -> void:
	if auto_tick:
		advance(dt)

func advance(dt: float) -> void:
	age += dt
	var release := maxf(0.0, age - charge_duration)
	if impact_age < 0.0 and not stationary:
		global_position = origin + direction * minf(max_travel, release * travel_speed)
	var grow := smoothstep(0.0, charge_duration + 0.07, age)
	var fade := 1.0 - smoothstep(flight_end, lifetime, age)
	if impact_age >= 0.0:
		fade *= 1.0 - smoothstep(0.0, 0.12, age - impact_age)
	mesh_root.scale = Vector3.ONE * lerpf(0.15, visual_scale, grow)
	material.set_shader_parameter("intensity", grow * fade)
	if age >= lifetime or impact_age >= 0.0 and age - impact_age >= 0.12:
		queue_free()
