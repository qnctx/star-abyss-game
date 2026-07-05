extends Area3D

var direction: Vector3 = Vector3.FORWARD
var speed: float = 20.0
var damage: float = 10.0
var slow_amount: float = 0.0
var lifetime: float = 3.0

const SLOW_SOURCE_ID := "player_projectile"
const WEAPON_COLORS = {
	"pistol": Color(1.0, 0.85, 0.2),
	"shotgun": Color(1.0, 0.5, 0.1),
	"rifle": Color(0.2, 0.5, 1.0),
	"flamethrower": Color(1.0, 0.2, 0.1),
	"ice_ray": Color(0.1, 0.8, 1.0),
}

var weapon_type: String = "pistol"


func _ready():
	body_entered.connect(_on_body_entered)
	area_entered.connect(_on_area_entered)
	var mesh = get_node_or_null("ProjectileMesh")
	if mesh and weapon_type in WEAPON_COLORS:
		var mat = StandardMaterial3D.new()
		mat.albedo_color = WEAPON_COLORS[weapon_type]
		mat.emission_enabled = true
		mat.emission = WEAPON_COLORS[weapon_type]
		mat.emission_energy_multiplier = 0.5
		mesh.material_override = mat


func _physics_process(delta):
	global_position += direction * speed * delta
	lifetime -= delta
	if lifetime <= 0:
		queue_free()


func _on_body_entered(body: Node3D):
	if body.is_in_group("enemies"):
		if body.has_method("take_damage"):
			body.take_damage(damage)
		if slow_amount > 0 and body.has_method("apply_slow"):
			body.apply_slow(SLOW_SOURCE_ID, slow_amount)
	queue_free()


func _on_area_entered(_area: Area3D):
	pass
