extends Control

const ICONS = {
	"iron": "石",
	"void_crystal": "晶",
	"biomass": "质",
	"energy": "电",
	"energy_core": "能",
	"blueprint": "图",
}
const COLORS = {
	"iron": Color(0.5, 0.45, 0.4),
	"void_crystal": Color(0.6, 0.2, 0.8),
	"biomass": Color(0.2, 0.7, 0.3),
	"energy": Color(1.0, 0.85, 0.25),
	"energy_core": Color(0.2, 0.4, 1.0),
	"blueprint": Color(0.9, 0.7, 0.1),
}

const COLORS_NAMES = {
	"iron": "铁",
	"void_crystal": "晶",
	"biomass": "质",
	"energy": "电",
	"energy_core": "能",
	"blueprint": "图",
}

var resource_labels: Dictionary = {}


func _ready():
	InventoryManager.resource_changed.connect(_on_resource_changed)
	_update_display()


func _on_resource_changed(_type: String, _amount: int):
	_update_display()


func _update_display():
	# Clear old labels
	for child in get_children():
		child.queue_free()
	resource_labels.clear()

	var y_offset = 10.0
	for type in InventoryManager.resources:
		var amount = InventoryManager.resources[type]
		if amount > 0:
			var label = Label.new()
			label.text = "%s%s x %d" % [ICONS.get(type, "?"), COLORS_NAMES.get(type, type), amount]
			label.add_theme_color_override("font_color", COLORS.get(type, Color.WHITE))
			label.add_theme_font_size_override("font_size", 14)
			label.position = Vector2(10, y_offset)
			add_child(label)
			resource_labels[type] = label
			y_offset += 20
