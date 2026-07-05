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
const VISUAL_SIGNATURES = {
	"iron": "ore_cluster",
	"void_crystal": "crystal_cluster",
	"biomass": "spore_pod",
	"energy_core": "energy_core",
	"blueprint": "data_chip",
}

var bob_offset: float = randf_range(0.0, TAU)
var bob_speed: float = 2.0
var bob_height: float = 0.06
var _mesh_rest_y := 0.0
var _label_rest_y := 0.85


func _ready():
	add_to_group("resource_nodes")
	set_meta("aim_radius", 0.45)
	body_entered.connect(_on_body_entered)
	_set_appearance()
	_expand_pickup_collision()


func _process(delta):
	bob_offset += delta * bob_speed
	var bob := sin(bob_offset) * bob_height
	var mesh := get_node_or_null("ResourceMesh") as Node3D
	if mesh:
		mesh.position.y = _mesh_rest_y + bob
	var label := get_node_or_null("ResourceLabel") as Label3D
	if label:
		label.position.y = _label_rest_y + bob


func _set_appearance():
	var mesh := _ensure_visual_root()
	if mesh:
		_set_resource_shape(mesh)
	_add_label()
	if mesh:
		_mesh_rest_y = mesh.position.y


func _ensure_visual_root() -> MeshInstance3D:
	var mesh := get_node_or_null("ResourceMesh") as MeshInstance3D
	if mesh:
		return mesh
	mesh = MeshInstance3D.new()
	mesh.name = "ResourceMesh"
	add_child(mesh)
	return mesh


func _set_resource_shape(mesh: MeshInstance3D) -> void:
	mesh.mesh = null
	mesh.material_override = null
	mesh.scale = Vector3.ONE
	mesh.rotation = Vector3.ZERO
	_clear_visual_children(mesh)

	match resource_type:
		"iron":
			_build_iron_visual(mesh)
		"void_crystal":
			_build_crystal_visual(mesh)
		"biomass":
			_build_biomass_visual(mesh)
		"energy_core":
			_build_energy_core_visual(mesh)
		"blueprint":
			_build_blueprint_visual(mesh)
		_:
			var box = BoxMesh.new()
			box.size = Vector3(0.3, 0.24, 0.3)
			mesh.mesh = box
			mesh.material_override = _material(TYPE_COLORS.get(resource_type, Color.WHITE), 0.25, 0.2)
			mesh.position.y = 0.15


func get_visual_signature() -> String:
	return str(VISUAL_SIGNATURES.get(resource_type, "generic_chunk"))


func _clear_visual_children(parent: Node) -> void:
	for child in parent.get_children():
		child.queue_free()


func _build_iron_visual(root: MeshInstance3D) -> void:
	root.position.y = 0.06
	var rock_mat := _material(Color(0.28, 0.25, 0.22), 0.0, 0.0, 0.85)
	var ore_mat := _material(TYPE_COLORS["iron"], 0.35, 0.45, 0.42)
	var base := SphereMesh.new()
	base.radius = 0.25
	base.height = 0.24
	root.mesh = base
	root.scale = Vector3(1.25, 0.45, 1.0)
	root.material_override = rock_mat
	_add_part(root, "IronChunkA", _box(Vector3(0.34, 0.22, 0.25)), Vector3(-0.12, 0.16, 0.02), Vector3.ONE, ore_mat, Vector3(0.1, 0.4, -0.15))
	_add_part(root, "IronChunkB", _box(Vector3(0.24, 0.18, 0.32)), Vector3(0.16, 0.13, -0.08), Vector3.ONE, ore_mat, Vector3(-0.2, -0.35, 0.1))
	_add_part(root, "IronSeam", _box(Vector3(0.12, 0.08, 0.45)), Vector3(0.03, 0.25, 0.05), Vector3.ONE, ore_mat, Vector3(0.0, 0.85, 0.25))


func _build_crystal_visual(root: MeshInstance3D) -> void:
	root.position.y = 0.04
	var crystal_mat := _material(TYPE_COLORS["void_crystal"], 0.85, 0.1, 0.18)
	var base_mat := _material(Color(0.18, 0.14, 0.22), 0.0, 0.0, 0.85)
	var base := CylinderMesh.new()
	base.top_radius = 0.26
	base.bottom_radius = 0.32
	base.height = 0.1
	root.mesh = base
	root.material_override = base_mat
	_add_part(root, "CrystalTall", _crystal_mesh(0.12, 0.03, 0.78), Vector3(0.0, 0.44, 0.0), Vector3.ONE, crystal_mat, Vector3(0.08, 0.2, -0.04))
	_add_part(root, "CrystalSideA", _crystal_mesh(0.09, 0.02, 0.5), Vector3(-0.18, 0.3, 0.04), Vector3.ONE, crystal_mat, Vector3(-0.12, -0.45, 0.18))
	_add_part(root, "CrystalSideB", _crystal_mesh(0.08, 0.02, 0.42), Vector3(0.19, 0.25, -0.05), Vector3.ONE, crystal_mat, Vector3(0.16, 0.55, -0.12))


func _build_biomass_visual(root: MeshInstance3D) -> void:
	root.position.y = 0.1
	var stalk_mat := _material(Color(0.08, 0.38, 0.18), 0.15, 0.0, 0.75)
	var pod_mat := _material(TYPE_COLORS["biomass"], 0.55, 0.0, 0.45)
	var stalk := CylinderMesh.new()
	stalk.top_radius = 0.07
	stalk.bottom_radius = 0.11
	stalk.height = 0.3
	root.mesh = stalk
	root.material_override = stalk_mat
	_add_part(root, "BioPodMain", _sphere(0.22, 0.28), Vector3(0.0, 0.32, 0.0), Vector3(1.15, 1.0, 1.15), pod_mat)
	_add_part(root, "BioPodA", _sphere(0.13, 0.18), Vector3(-0.22, 0.18, 0.02), Vector3.ONE, pod_mat)
	_add_part(root, "BioPodB", _sphere(0.12, 0.16), Vector3(0.2, 0.16, -0.05), Vector3.ONE, pod_mat)


func _build_energy_core_visual(root: MeshInstance3D) -> void:
	root.position.y = 0.28
	var core_mat := _material(TYPE_COLORS["energy_core"], 1.1, 0.25, 0.12)
	var shell_mat := _material(Color(0.12, 0.18, 0.22), 0.15, 0.55, 0.35)
	var core := SphereMesh.new()
	core.radius = 0.18
	core.height = 0.36
	root.mesh = core
	root.material_override = core_mat
	_add_part(root, "CoreShellA", _box(Vector3(0.12, 0.45, 0.08)), Vector3(-0.23, 0.0, 0.0), Vector3.ONE, shell_mat, Vector3(0.0, 0.0, 0.2))
	_add_part(root, "CoreShellB", _box(Vector3(0.12, 0.45, 0.08)), Vector3(0.23, 0.0, 0.0), Vector3.ONE, shell_mat, Vector3(0.0, 0.0, -0.2))
	_add_part(root, "CoreRing", _cylinder(0.33, 0.33, 0.05), Vector3(0.0, 0.0, 0.0), Vector3(1.0, 1.0, 0.22), shell_mat, Vector3(PI / 2.0, 0.0, 0.0))


func _build_blueprint_visual(root: MeshInstance3D) -> void:
	root.position.y = 0.08
	var chip_mat := _material(TYPE_COLORS["blueprint"], 0.35, 0.35, 0.28)
	var line_mat := _material(Color(0.2, 0.85, 1.0), 0.8, 0.1, 0.2)
	var beacon_mat := _material(Color(1.0, 0.82, 0.12), 1.4, 0.0, 0.18)
	root.mesh = _box(Vector3(0.46, 0.04, 0.32))
	root.material_override = chip_mat
	_add_part(root, "BlueprintTraceA", _box(Vector3(0.34, 0.025, 0.035)), Vector3(0.0, 0.035, -0.06), Vector3.ONE, line_mat)
	_add_part(root, "BlueprintTraceB", _box(Vector3(0.18, 0.025, 0.035)), Vector3(-0.07, 0.04, 0.07), Vector3.ONE, line_mat, Vector3(0.0, 0.75, 0.0))
	_add_part(root, "BlueprintBeacon", _cylinder(0.035, 0.035, 1.35), Vector3(0.0, 0.72, 0.0), Vector3.ONE, beacon_mat)
	_add_part(root, "BlueprintBeaconCap", _sphere(0.11, 0.16), Vector3(0.0, 1.43, 0.0), Vector3.ONE, beacon_mat)


func _add_part(parent: Node3D, part_name: String, part_mesh: Mesh, pos: Vector3,
		scale_value: Vector3, mat: Material, rot: Vector3 = Vector3.ZERO) -> MeshInstance3D:
	var part := MeshInstance3D.new()
	part.name = part_name
	part.mesh = part_mesh
	part.position = pos
	part.scale = scale_value
	part.rotation = rot
	part.material_override = mat
	parent.add_child(part)
	return part


func _material(color: Color, emission_mult: float, metallic: float = 0.0,
		roughness: float = 0.45) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = roughness
	mat.metallic = metallic
	if emission_mult > 0.0:
		mat.emission_enabled = true
		mat.emission = color
		mat.emission_energy_multiplier = emission_mult
	return mat


func _box(size: Vector3) -> BoxMesh:
	var mesh := BoxMesh.new()
	mesh.size = size
	return mesh


func _sphere(radius: float, height: float) -> SphereMesh:
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = height
	return mesh


func _cylinder(top_radius: float, bottom_radius: float, height: float) -> CylinderMesh:
	var mesh := CylinderMesh.new()
	mesh.top_radius = top_radius
	mesh.bottom_radius = bottom_radius
	mesh.height = height
	mesh.radial_segments = 12
	return mesh


func _crystal_mesh(bottom_radius: float, top_radius: float, height: float) -> CylinderMesh:
	var mesh := _cylinder(top_radius, bottom_radius, height)
	mesh.radial_segments = 6
	return mesh


func _add_label() -> void:
	if has_node("ResourceLabel"):
		return
	var label := Label3D.new()
	label.name = "ResourceLabel"
	label.text = str(TYPE_LABELS.get(resource_type, resource_type.to_upper()))
	label.position = Vector3(0.0, 0.85, 0.0)
	if resource_type == "blueprint":
		label.position.y = 1.75
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font_size = 42
	if resource_type == "blueprint":
		label.font_size = 54
	label.pixel_size = 0.009
	label.modulate = TYPE_COLORS.get(resource_type, Color.WHITE)
	label.outline_size = 8
	label.outline_modulate = Color(0.02, 0.02, 0.02, 0.95)
	add_child(label)
	_label_rest_y = label.position.y


func _expand_pickup_collision() -> void:
	var collision := get_node_or_null("CollisionShape3D") as CollisionShape3D
	if not collision:
		return
	var sphere := collision.shape as SphereShape3D
	if sphere:
		sphere.radius = 0.85


func _on_body_entered(body: Node3D):
	if body.is_in_group("player"):
		collect()


func collect() -> bool:
	if is_queued_for_deletion():
		return false
	InventoryManager.add_resource(resource_type, amount)
	_spawn_pickup_vfx()
	queue_free()
	return true


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
