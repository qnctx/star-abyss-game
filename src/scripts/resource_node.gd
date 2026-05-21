extends Area3D

@export var resource_type: String = "iron"
@export var amount: int = 1

const TYPE_COLORS = {
	"iron": Color(0.5, 0.45, 0.4),
	"void_crystal": Color(0.6, 0.2, 0.8),
	"biomass": Color(0.2, 0.7, 0.3),
	"energy_core": Color(0.2, 0.4, 1.0),
	"blueprint": Color(0.9, 0.7, 0.1),
}

var bob_offset: float = randf_range(0.0, TAU)
var bob_speed: float = 2.0
var bob_height: float = 0.2
var base_y: float = 0.0


func _ready():
	body_entered.connect(_on_body_entered)
	base_y = global_position.y
	_set_appearance()


func _process(delta):
	bob_offset += delta * bob_speed
	global_position.y = base_y + sin(bob_offset) * bob_height


func _set_appearance():
	var mat = StandardMaterial3D.new()
	if resource_type in TYPE_COLORS:
		mat.albedo_color = TYPE_COLORS[resource_type]
		mat.emission_enabled = true
		mat.emission = TYPE_COLORS[resource_type]
		mat.emission_energy_multiplier = 0.3
	mat.roughness = 0.3
	mat.metallic = 0.4

	var mesh = get_node_or_null("ResourceMesh")
	if mesh:
		mesh.material_override = mat


func _on_body_entered(body: Node3D):
	if body.is_in_group("player"):
		InventoryManager.add_resource(resource_type, amount)
		_spawn_pickup_vfx()
		queue_free()


func _spawn_pickup_vfx():
	var particles = GPUParticles3D.new()
	particles.emitting = true
	particles.one_shot = true
	particles.lifetime = 0.5
	particles.amount = 8
	get_tree().current_scene.add_child(particles)
	particles.global_position = global_position

	var mat = ParticleProcessMaterial.new()
	mat.direction = Vector3(0, 1, 0)
	mat.spread = 90.0
	mat.initial_velocity_min = 1.0
	mat.initial_velocity_max = 3.0
	mat.gravity = Vector3(0, -2.0, 0)
	mat.scale_min = 0.02
	mat.scale_max = 0.06
	if resource_type in TYPE_COLORS:
		mat.color = TYPE_COLORS[resource_type]

	var mesh = QuadMesh.new()
	mesh.size = Vector2(0.05, 0.05)
	particles.draw_pass_1 = mesh

	var mat_override = StandardMaterial3D.new()
	mat_override.albedo_color = TYPE_COLORS.get(resource_type, Color.WHITE)
	mat_override.emission_enabled = true
	mat_override.emission = TYPE_COLORS.get(resource_type, Color.WHITE)
	mat_override.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	particles.material_override = mat_override

	particles.process_material = mat
	await get_tree().create_timer(0.6).timeout
	if is_instance_valid(particles):
		particles.queue_free()
