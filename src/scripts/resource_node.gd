extends Area3D
class_name ResourceNode

@export var resource_type: String = "iron"
@export var amount: int = 1

const TYPE_COLORS = {
	"iron": Color(0.95, 0.58, 0.24),
	"void_crystal": Color(0.75, 0.35, 1.0),
	"biomass": Color(0.2, 0.9, 0.35),
	"energy_core": Color(0.25, 0.75, 1.0),
	"blueprint": Color(0.9, 0.7, 0.1),
}

const TYPE_LABELS = {
	"iron": "IRON",
	"void_crystal": "CRYSTAL",
	"biomass": "BIO",
	"energy_core": "CORE",
	"blueprint": "BP",
}

var bob_offset: float = randf_range(0.0, TAU)
var bob_speed: float = 2.0
var bob_height: float = 0.2
var base_y: float = 0.0


func _ready():
	add_to_group("resource_nodes")
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
		# Enhanced glow for energy cores and void crystals
		if resource_type == "energy_core":
			# Cyan glow for energy cores
			mat.emission = Color(0.3, 0.8, 1.0)
			mat.emission_energy_multiplier = 0.5
		elif resource_type == "void_crystal":
			# Purple glow for void crystals
			mat.emission = Color(0.5, 0.2, 1.0)
			mat.emission_energy_multiplier = 0.4
		else:
			mat.emission = TYPE_COLORS[resource_type]
			mat.emission_energy_multiplier = 0.4
	mat.roughness = 0.3
	mat.metallic = 0.4

	var mesh = get_node_or_null("ResourceMesh")
	if mesh:
		mesh.material_override = mat
		# Set distinct shape based on resource type
		_set_resource_shape(mesh)
	_add_label()


func _set_resource_shape(mesh: MeshInstance3D) -> void:
	# Remove existing mesh
	mesh.mesh = null

	match resource_type:
		"iron":
			var box = BoxMesh.new()
			box.size = Vector3(0.38, 0.28, 0.38)
			mesh.mesh = box
			mesh.position.y = 0.14
		"void_crystal":
			var box = BoxMesh.new()
			box.size = Vector3(0.18, 0.62, 0.18)
			mesh.mesh = box
			mesh.position.y = 0.31
		"biomass":
			var sphere = SphereMesh.new()
			sphere.radius = 0.2
			sphere.height = 0.4
			mesh.mesh = sphere
			mesh.scale = Vector3(1.25, 1.55, 1.25)
			mesh.position.y = 0.24
		"energy_core":
			var cyl = CylinderMesh.new()
			cyl.top_radius = 0.15
			cyl.bottom_radius = 0.15
			cyl.height = 0.55
			mesh.mesh = cyl
			mesh.position.y = 0.28
		_:
			# Default cube
			var box = BoxMesh.new()
			box.size = Vector3(0.2, 0.3, 0.2)
			mesh.mesh = box
			mesh.position.y = 0.15


func _add_label() -> void:
	if has_node("ResourceLabel"):
		return
	var label := Label3D.new()
	label.name = "ResourceLabel"
	label.text = str(TYPE_LABELS.get(resource_type, resource_type.to_upper()))
	label.position = Vector3(0.0, 0.85, 0.0)
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font_size = 42
	label.pixel_size = 0.009
	label.modulate = TYPE_COLORS.get(resource_type, Color.WHITE)
	label.outline_size = 8
	label.outline_modulate = Color(0.02, 0.02, 0.02, 0.95)
	add_child(label)


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
