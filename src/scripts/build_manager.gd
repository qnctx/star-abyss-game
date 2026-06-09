extends Node3D

const TURRET_SCENE := preload("res://scenes/turret.tscn")
const TURRET_COST := {"iron": 20, "void_crystal": 5}
const PLACEMENT_RANGE: float = 18.0
const BUILD_DISTANCE: float = 6.0
const MIN_BASE_DISTANCE: float = 2.5
const MIN_TURRET_DISTANCE: float = 2.0

var build_mode: bool = false
var _preview: MeshInstance3D = null
var _preview_material: StandardMaterial3D = null
var _can_place: bool = false
var _position_is_valid: bool = false
var _placement_position: Vector3 = Vector3.ZERO


func _ready() -> void:
	_create_preview()
	set_process(false)


func _input(event: InputEvent) -> void:
	if event.is_action_pressed("build_mode") or (event is InputEventKey and event.pressed and event.physical_keycode == KEY_B):
		_set_build_mode(not build_mode)
		get_viewport().set_input_as_handled()
		return

	if not build_mode:
		return

	if event is InputEventKey and event.pressed and event.physical_keycode == KEY_ESCAPE:
		_set_build_mode(false)
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_LEFT:
			_try_place_turret()
			get_viewport().set_input_as_handled()
		elif event.button_index == MOUSE_BUTTON_RIGHT:
			_set_build_mode(false)
			get_viewport().set_input_as_handled()


func _process(_delta: float) -> void:
	_update_preview()


func _set_build_mode(enabled: bool) -> void:
	build_mode = enabled
	set_process(build_mode)
	if _preview:
		_preview.visible = build_mode


func _create_preview() -> void:
	_preview = MeshInstance3D.new()
	_preview.name = "TurretBuildPreview"
	var mesh := CylinderMesh.new()
	mesh.top_radius = 0.55
	mesh.bottom_radius = 0.75
	mesh.height = 1.2
	_preview.mesh = mesh
	_preview_material = StandardMaterial3D.new()
	_preview_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_preview_material.albedo_color = Color(0.2, 1.0, 0.45, 0.45)
	_preview.material_override = _preview_material
	_preview.visible = false
	add_child(_preview)


func _update_preview() -> void:
	if not _preview:
		return

	var target_pos := _get_build_target_position()
	_placement_position = _snap_to_terrain(target_pos)
	_position_is_valid = _validate_position(_placement_position)
	var has_resources := InventoryManager.has_resources(TURRET_COST)
	_can_place = _position_is_valid and has_resources

	_preview.global_position = _placement_position
	if _can_place:
		_preview_material.albedo_color = Color(0.2, 1.0, 0.45, 0.45)
	elif _position_is_valid:
		_preview_material.albedo_color = Color(1.0, 0.85, 0.15, 0.45)
	else:
		_preview_material.albedo_color = Color(1.0, 0.2, 0.15, 0.45)


func _try_place_turret() -> void:
	if not _can_place:
		return
	if not InventoryManager.has_resources(TURRET_COST):
		return

	InventoryManager.consume_resources(TURRET_COST)
	var turret = TURRET_SCENE.instantiate()
	get_tree().current_scene.add_child(turret)
	turret.global_position = _placement_position
	turret.add_to_group("built_turrets")


func _get_build_target_position() -> Vector3:
	var player := get_tree().get_first_node_in_group("player") as Node3D
	if not player:
		return Vector3.ZERO

	var forward := -player.global_transform.basis.z
	forward.y = 0.0
	if forward.length() <= 0.01:
		forward = Vector3.FORWARD
	return player.global_position + forward.normalized() * BUILD_DISTANCE


func _snap_to_terrain(pos: Vector3) -> Vector3:
	var x: float = clamp(pos.x, -50.0, 50.0)
	var z: float = clamp(pos.z, -50.0, 50.0)
	var y: float = 0.0
	if WorldGenerator:
		y = clamp(WorldGenerator.get_height_at(Vector2(x, z)), -5.0, 15.0)
	return Vector3(x, y + 0.75, z)


func _validate_position(pos: Vector3) -> bool:
	var player := get_tree().get_first_node_in_group("player") as Node3D
	if player and player.global_position.distance_to(pos) > PLACEMENT_RANGE:
		return false
	if WorldGenerator and pos.distance_to(WorldGenerator.base_position) < MIN_BASE_DISTANCE:
		return false
	for turret in get_tree().get_nodes_in_group("turrets"):
		if turret is Node3D and turret.global_position.distance_to(pos) < MIN_TURRET_DISTANCE:
			return false
	return true
