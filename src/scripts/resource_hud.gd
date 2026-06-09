extends Control

const DISPLAY_ORDER := ["iron", "void_crystal", "biomass", "energy", "energy_core", "blueprint", "oxygen_canister"]
const DISPLAY_NAMES = {
	"iron": "IRON",
	"void_crystal": "CRYSTAL",
	"biomass": "BIO",
	"energy": "ENERGY",
	"energy_core": "CORE",
	"blueprint": "BP",
	"oxygen_canister": "O2 KIT",
}

var _inventory_label: Label


func _ready():
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_TOP_RIGHT)
	position = Vector2(-610.0, 10.0)
	size = Vector2(600.0, 52.0)
	_inventory_label = Label.new()
	_inventory_label.name = "InventoryLabel"
	_inventory_label.size = size
	_inventory_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_inventory_label.add_theme_font_size_override("font_size", 15)
	_inventory_label.add_theme_color_override("font_color", Color(0.92, 0.97, 1.0))
	add_child(_inventory_label)
	InventoryManager.resource_changed.connect(_on_resource_changed)
	_update_display()


func _on_resource_changed(_type: String, _amount: int):
	_update_display()


func _update_display():
	if not _inventory_label:
		return
	_inventory_label.text = get_inventory_text()


func get_inventory_text() -> String:
	if not InventoryManager:
		return "Inventory unavailable"
	var first_row: Array[String] = []
	var second_row: Array[String] = []
	for i in range(DISPLAY_ORDER.size()):
		var resource_type: String = str(DISPLAY_ORDER[i])
		var item: String = "%s %d" % [
			str(DISPLAY_NAMES.get(resource_type, resource_type.to_upper())),
			int(InventoryManager.resources.get(resource_type, 0))
		]
		if i < 4:
			first_row.append(item)
		else:
			second_row.append(item)
	return "Inventory: %s\n%s" % [" | ".join(first_row), " | ".join(second_row)]
