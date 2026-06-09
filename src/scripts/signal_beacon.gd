extends Node3D

signal signal_progress_changed(progress: float, max_progress: float)

const ENERGY_COST := {"energy": 1}
const SIGNAL_INTERVAL := 6.0
const SIGNAL_PROGRESS_PER_CYCLE := 10.0
const SIGNAL_MAX := 100.0

var signal_progress := 0.0
var signal_power_timer := 0.0


func _ready() -> void:
	add_to_group("signal_beacons")
	_create_visuals()
	set_process(true)


func _process(delta: float) -> void:
	if is_signal_complete():
		return
	signal_power_timer += delta
	while signal_power_timer >= SIGNAL_INTERVAL and not is_signal_complete():
		signal_power_timer -= SIGNAL_INTERVAL
		_try_transmit_signal()


func is_signal_complete() -> bool:
	return signal_progress >= SIGNAL_MAX


func get_signal_status_text() -> String:
	if is_signal_complete():
		return "Signal: locked 100/100 | rescue ping ready"
	if InventoryManager and InventoryManager.has_resources(ENERGY_COST):
		return "Signal: %d/100 | transmitting" % roundi(signal_progress)
	return "Signal: %d/100 | needs energy" % roundi(signal_progress)


func _try_transmit_signal() -> void:
	if not InventoryManager or not InventoryManager.has_resources(ENERGY_COST):
		return
	InventoryManager.consume_resources(ENERGY_COST)
	signal_progress = minf(SIGNAL_MAX, signal_progress + SIGNAL_PROGRESS_PER_CYCLE)
	if SignalLogManager:
		SignalLogManager.register_signal_progress(signal_progress)
	signal_progress_changed.emit(signal_progress, SIGNAL_MAX)


func _create_visuals() -> void:
	var mast := MeshInstance3D.new()
	mast.name = "SignalMast"
	var mast_mesh := CylinderMesh.new()
	mast_mesh.top_radius = 0.12
	mast_mesh.bottom_radius = 0.18
	mast_mesh.height = 1.8
	mast.mesh = mast_mesh
	mast.position = Vector3(0.0, 0.75, 0.0)
	mast.material_override = _make_material(Color(0.3, 0.75, 1.0))
	add_child(mast)

	var dish := MeshInstance3D.new()
	dish.name = "SignalDish"
	var dish_mesh := CylinderMesh.new()
	dish_mesh.top_radius = 0.75
	dish_mesh.bottom_radius = 0.35
	dish_mesh.height = 0.18
	dish.mesh = dish_mesh
	dish.position = Vector3(0.0, 1.65, -0.15)
	dish.rotation_degrees.x = 65.0
	dish.material_override = _make_material(Color(0.85, 0.95, 1.0))
	add_child(dish)

	var core := MeshInstance3D.new()
	core.name = "SignalCore"
	var core_mesh := SphereMesh.new()
	core_mesh.radius = 0.22
	core_mesh.height = 0.44
	core.mesh = core_mesh
	core.position = Vector3(0.0, 0.35, 0.0)
	core.material_override = _make_material(Color(1.0, 0.82, 0.3))
	add_child(core)


func _make_material(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.emission_enabled = true
	material.emission = color * 0.35
	return material
