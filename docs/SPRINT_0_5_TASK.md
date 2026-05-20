# Sprint 0.5 Task: Enemy + Turret + Day/Night + Windows Export

## CONTEXT
You already built a Godot 4 project at `/Users/qnctx/projects/star-abyss-game/src/`. It has:
- Top-down 3D scene (main.tscn) with dark purple fog, ground plane, orthogonal camera
- Player (CharacterBody3D, WASD + sprint, O₂ drain, death/respawn)
- O₂ UI (progress bar, red warning <25%)
- Base marker (green cube at 0,0,0)

Your job: ADD enemies, turrets, day/night cycle, and a Windows export.

## CRITICAL RULES
- Use GDScript only, NO C#, NO plugins
- Existing files: DO NOT DELETE or BREAK
- All new files go in src/scripts/ and src/scenes/
- Snake_case for variables, PascalCase for classes
- Comment in English

---

## STEP 1: GameManager Autoload (src/scripts/game_manager.gd)

Create a global singleton:
```gdscript
extends Node

signal night_started()
signal day_started()
signal wave_spawned(wave_number: int)

var is_night: bool = false
var wave_number: int = 0
var enemies_alive: int = 0
var base_health: float = 100.0

const DAY_DURATION: float = 120.0  # 2 min for testing
const NIGHT_DURATION: float = 60.0  # 1 min for testing
const ENEMIES_PER_WAVE_BASE: int = 3
const ENEMIES_PER_WAVE_INCREMENT: int = 2

func _ready():
    start_day()

func start_day():
    is_night = false
    wave_number = 0
    enemies_alive = 0
    day_started.emit()
    await get_tree().create_timer(DAY_DURATION).timeout
    start_night()

func start_night():
    is_night = true
    wave_number += 1
    night_started.emit()
    spawn_wave()

func spawn_wave():
    var count = ENEMIES_PER_WAVE_BASE + (wave_number - 1) * ENEMIES_PER_WAVE_INCREMENT
    wave_spawned.emit(wave_number)
    for i in range(count):
        spawn_enemy()
        await get_tree().create_timer(randf_range(1.0, 3.0)).timeout  # stagger spawns
    
    # Wait for enemies to die or night to end
    while enemies_alive > 0:
        await get_tree().create_timer(1.0).timeout
    
    # If still night, spawn next wave
    if is_night:
        await get_tree().create_timer(5.0).timeout
        wave_number += 1
        wave_spawned.emit(wave_number)
        spawn_wave()
    else:
        start_day()

func spawn_enemy():
    var enemy_scene = load("res://scenes/enemy.tscn")
    var enemy = enemy_scene.instantiate()
    # Spawn at random position around map edge
    var angle = randf_range(0, TAU)
    var distance = randf_range(8.0, 12.0)
    enemy.position = Vector3(cos(angle) * distance, 1, sin(angle) * distance)
    get_tree().current_scene.add_child(enemy)
    enemies_alive += 1
    enemy.enemy_died.connect(_on_enemy_died)
    enemy.base_reached.connect(_on_base_reached)

func _on_enemy_died():
    enemies_alive -= 1

func _on_base_reached(damage: float):
    base_health -= damage
    if base_health <= 0:
        game_over()

func game_over():
    get_tree().paused = true
    print("GAME OVER - Base destroyed!")
```

Register as Autoload in project.godot:
```ini
[autoload]
GameManager="*res://scripts/game_manager.gd"
```

---

## STEP 2: Enemy (src/scripts/enemy.gd + src/scenes/enemy.tscn)

```gdscript
extends CharacterBody3D

@export var speed: float = 3.0
@export var health: float = 30.0
@export var damage: float = 10.0
@export var attack_range: float = 2.0

var target_position: Vector3 = Vector3(0, 0, 0)  # base position

signal enemy_died()
signal base_reached(damage: float)

func _ready():
    add_to_group("enemies")

func _physics_process(delta):
    var direction = (target_position - global_position).normalized()
    direction.y = 0
    velocity = direction * speed
    move_and_slide()
    
    # Check if reached base
    if global_position.distance_to(target_position) < attack_range:
        base_reached.emit(damage)
        die()

func take_damage(amount: float):
    health -= amount
    if health <= 0:
        die()

func die():
    enemy_died.emit()
    queue_free()
```

Enemy scene (scenes/enemy.tscn):
- Root: CharacterBody3D
- CollisionShape3D: CylinderShape3D (radius 0.5, height 1.5)
- MeshInstance3D: BoxMesh (1x1.5x1), red material (#ff4444)
- Attach enemy.gd script

---

## STEP 3: Turret (src/scripts/turret.gd + src/scenes/turret.tscn)

```gdscript
extends StaticBody3D

@export var range: float = 8.0
@export var fire_rate: float = 1.0  # shots per second
@export var damage: float = 15.0

var can_fire: bool = true
var current_target: Node3D = null

func _ready():
    add_to_group("turrets")
    # Detection area
    var area = Area3D.new()
    var shape = CollisionShape3D.new()
    shape.shape = SphereShape3D.new()
    shape.shape.radius = range
    area.add_child(shape)
    add_child(area)
    area.body_entered.connect(_on_body_entered)
    area.body_exited.connect(_on_body_exited)

func _process(delta):
    if not current_target or not is_instance_valid(current_target):
        current_target = find_nearest_enemy()
        return
    
    if not can_fire:
        return
    
    # Look at target
    look_at(current_target.global_position, Vector3.UP)
    
    # Fire
    fire_projectile()
    can_fire = false
    await get_tree().create_timer(1.0 / fire_rate).timeout
    can_fire = true

func find_nearest_enemy() -> Node3D:
    var enemies = get_tree().get_nodes_in_group("enemies")
    var nearest: Node3D = null
    var nearest_dist = range
    
    for enemy in enemies:
        var dist = global_position.distance_to(enemy.global_position)
        if dist < nearest_dist:
            nearest_dist = dist
            nearest = enemy
    
    return nearest

func fire_projectile():
    var proj = load("res://scenes/projectile.tscn").instantiate()
    proj.global_position = global_position + Vector3(0, 0.5, 0)
    proj.target = current_target
    proj.damage = damage
    get_tree().current_scene.add_child(proj)

func _on_body_entered(body):
    if body.is_in_group("enemies"):
        if not current_target or not is_instance_valid(current_target):
            current_target = body

func _on_body_exited(body):
    if body == current_target:
        current_target = find_nearest_enemy()
```

Turret scene (scenes/turret.tscn):
- Root: StaticBody3D
- CollisionShape3D: BoxShape3D (1x1.5x1)
- MeshInstance3D: CylinderMesh (top narrow, like a gun barrel), blue-grey (#556688)
- Base mesh: small box at bottom

---

## STEP 4: Projectile (src/scripts/projectile.gd + src/scenes/projectile.tscn)

```gdscript
extends Area3D

@export var speed: float = 10.0
var target: Node3D = null
var damage: float = 15.0

func _physics_process(delta):
    if not target or not is_instance_valid(target):
        queue_free()
        return
    
    var direction = (target.global_position - global_position).normalized()
    global_position += direction * speed * delta
    
    if global_position.distance_to(target.global_position) < 0.5:
        if target.has_method("take_damage"):
            target.take_damage(damage)
        queue_free()
```

Projectile scene (scenes/projectile.tscn):
- Root: Area3D
- CollisionShape3D: SphereShape3D (radius 0.2)
- MeshInstance3D: SphereMesh (radius 0.2), yellow/orange glowing (#ffaa00)

---

## STEP 5: Day/Night UI Indicator

Update `scripts/oxygen_ui.gd` to also show day/night state:
- Add a Label at the top-right showing "☀️ Day" or "🌙 Night Wave X"
- Connect to GameManager signals

---

## STEP 6: Update main.tscn

Add to the main scene:
1. A turret near the base (position 3, 0, 2)
2. The GameManager node is already autoloaded, no need to add to scene

---

## STEP 7: Windows Export

After all code is done, create the export preset and build:

```bash
# Find Godot binary
GODOT=/Applications/Godot.app/Contents/MacOS/Godot

# Create export_presets.cfg
cat > /Users/qnctx/projects/star-abyss-game/src/export_presets.cfg << 'PRESETS'
[preset.0]
name="Windows Desktop"
platform="Windows Desktop"
runnable=true
dedicated_server=false
custom_features=""
export_filter="all_resources"
include_filter=""
exclude_filter=""
export_path="../build/star-abyss.exe"
patches=PackedStringArray()
ssh_remote_deploy_enabled=false

[preset.0.options]
custom_template/debug=""
custom_template/release=""
binary_format/embed_pck=false
texture_format/bptc=false
texture_format/s3tc=true
texture_format/etc=false
texture_format/etc2=false
texture_format/no_bptc_fallbacks=true
binary_format/architecture="x86_64"
codesign/enable=false
application/modify_resources=true
application/icon=""
application/console_wrapper_icon=""
application/icon_interpolation=4
application/file_version="1.0.0"
application/product_version="1.0.0"
application/company_name="Star Abyss"
application/file_description="Star Abyss Voyage - Survival Tower Defense"
application/copyright=""
application/trademarks=""
PRESETS

# Try to export (headless)
$GODOT --headless --path /Users/qnctx/projects/star-abyss-game/src --export-release "Windows Desktop" 2>&1
```

Note: Exporting to Windows from macOS headless requires the Windows export templates. If they're not installed, just note this in the output — the `.exe` can be created from the Godot editor GUI.

## OUTPUT
List all created files, confirm project structure, and report any issues with the Windows export.
