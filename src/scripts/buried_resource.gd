extends Node3D
class_name BuriedResource

@export var resource_type: String = "iron"
@export var amount: int = 3
@export var depth: float = 1.2
@export var dig_required: int = 3

var dig_progress: int = 0
var is_revealed: bool = false

const TYPE_COLORS := {
	"iron": Color(0.95, 0.58, 0.24),
	"void_crystal": Color(0.75, 0.35, 1.0),
	"biomass": Color(0.2, 0.9, 0.35),
	"energy_core": Color(0.25, 0.75, 1.0),
}
const TYPE_LABELS := {
	"iron": "IRON",
	"void_crystal": "CRYSTAL",
	"biomass": "BIO",
	"energy_core": "CORE",
}

var _marker: MeshInstance3D
var _icon: MeshInstance3D
var _beam: MeshInstance3D
var _label: Label3D


func _ready() -> void:
	add_to_group("buried_resources")
	set_meta("aim_radius", 0.65)
	_create_marker()
	_set_marker_visible(false)


func reveal() -> void:
	is_revealed = true
	_set_marker_visible(true)


func harvest_once() -> bool:
	if not is_revealed:
		return false
	dig_progress += 1
	_update_label()
	if dig_progress < dig_required:
		return false
	if InventoryManager:
		InventoryManager.add_resource(resource_type, amount)
	queue_free()
	return true


func get_scan_hint() -> String:
	return "buried %s depth %.1fm" % [_resource_label(), depth]


func get_harvest_hint() -> String:
	return "%s %d/%d" % [_resource_label(), dig_progress, dig_required]


func _create_marker() -> void:
	_marker = MeshInstance3D.new()
	_marker.name = "BuriedResourceMarker"
	var mesh := CylinderMesh.new()
	mesh.top_radius = 0.72
	mesh.bottom_radius = 0.72
	mesh.height = 0.08
	_marker.mesh = mesh
	_marker.position = Vector3(0.0, 0.06, 0.0)
	var material := StandardMaterial3D.new()
	var color: Color = TYPE_COLORS.get(resource_type, Color.WHITE)
	material.albedo_color = Color(color.r, color.g, color.b, 0.35)
	material.emission_enabled = true
	material.emission = color
	material.emission_energy_multiplier = 0.25
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_marker.material_override = material
	add_child(_marker)

	_beam = MeshInstance3D.new()
	_beam.name = "BuriedResourceBeam"
	var beam_mesh := CylinderMesh.new()
	beam_mesh.top_radius = 0.045
	beam_mesh.bottom_radius = 0.045
	beam_mesh.height = 1.4
	_beam.mesh = beam_mesh
	_beam.position = Vector3(0.0, 0.72, 0.0)
	_beam.material_override = material
	add_child(_beam)

	_icon = MeshInstance3D.new()
	_icon.name = "BuriedResourceIcon"
	_icon.position = Vector3(0.0, 0.48, 0.0)
	_icon.material_override = material
	_set_icon_mesh()
	add_child(_icon)

	_label = Label3D.new()
	_label.name = "BuriedResourceLabel"
	_label.position = Vector3(0.0, 1.58, 0.0)
	_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_label.font_size = 46
	_label.pixel_size = 0.009
	_label.modulate = color
	_label.outline_size = 8
	_label.outline_modulate = Color(0.02, 0.02, 0.02, 0.95)
	add_child(_label)
	_update_label()


func _set_marker_visible(visible: bool) -> void:
	if _marker:
		_marker.visible = visible
	if _beam:
		_beam.visible = visible
	if _icon:
		_icon.visible = visible
	if _label:
		_label.visible = visible


func _update_label() -> void:
	if _label:
		_label.text = "DIG %s %d/%d" % [_resource_label(), dig_progress, dig_required]


func _resource_label() -> String:
	return str(TYPE_LABELS.get(resource_type, resource_type.to_upper()))


func _set_icon_mesh() -> void:
	if not _icon:
		return
	match resource_type:
		"iron":
			var box := BoxMesh.new()
			box.size = Vector3(0.34, 0.18, 0.28)
			_icon.mesh = box
			_icon.rotation = Vector3(0.1, 0.45, -0.12)
		"void_crystal":
			var crystal := CylinderMesh.new()
			crystal.top_radius = 0.025
			crystal.bottom_radius = 0.12
			crystal.height = 0.48
			crystal.radial_segments = 6
			_icon.mesh = crystal
			_icon.position.y = 0.76
		"biomass":
			var sphere := SphereMesh.new()
			sphere.radius = 0.19
			sphere.height = 0.26
			_icon.mesh = sphere
			_icon.scale = Vector3(1.25, 1.0, 1.25)
			_icon.position.y = 0.58
		"energy_core":
			var core := SphereMesh.new()
			core.radius = 0.18
			core.height = 0.36
			_icon.mesh = core
			_icon.position.y = 0.64
		_:
			var mesh := CylinderMesh.new()
			mesh.top_radius = 0.18
			mesh.bottom_radius = 0.18
			mesh.height = 0.16
			_icon.mesh = mesh
