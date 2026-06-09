# Sprint 0 Task: Core Prototype

This document contains the exact task for Claude Code.

---

## TASK: Build Godot 4 Core Prototype

You are building a top-down 2.5D survival game prototype in Godot 4.3.

### Step 1: Create Godot Project

```bash
cd /Users/qnctx/projects/star-abyss-game/src
# If godot command is available:
godot --headless --create-project . 2>/dev/null || true
```

If `godot` binary is not in PATH, find it at `/tmp/godot_app/Godot.app/Contents/MacOS/Godot` and use that.

**IMPORTANT:** Create the project manually if `--headless --create-project` fails:
```bash
mkdir -p /Users/qnctx/projects/star-abyss-game/src
cat > /Users/qnctx/projects/star-abyss-game/src/project.godot << 'EOF'
; Engine configuration file.
; It's best edited using the editor UI and not directly,
; since the parameters that go here are not obvious.
;
; Format:
;   [section] ; section goes between []
;   param=value ; assign values to parameters

config_version=5

[application]
config/name="Star Abyss"
run/main_scene="res://scenes/main.tscn"
config/features=PackedStringArray("4.3")
config/icon="res://icon.svg"
EOF

mkdir -p /Users/qnctx/projects/star-abyss-game/src/scenes
mkdir -p /Users/qnctx/projects/star-abyss-game/src/scripts
mkdir -p /Users/qnctx/projects/star-abyss-game/src/assets
mkdir -p /Users/qnctx/projects/star-abyss-game/src/resources

# Create a simple SVG icon
cat > /Users/qnctx/projects/star-abyss-game/src/icon.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <circle cx="64" cy="64" r="60" fill="#1a1a2e"/>
  <circle cx="64" cy="64" r="40" fill="#9b59b6" opacity="0.6"/>
  <polygon points="64,8 76,56 124,56 83,86 96,136 64,108 32,136 45,86 4,56 52,56" fill="#00ff88" opacity="0.8"/>
</svg>
EOF
```

### Step 2: Main Scene (top-down 2.5D)

Create `scenes/main.tscn`:
- Root: Node3D named "Main"
- Child: DirectionalLight3D (rotated for top-down lighting, intensity 0.8)
- Child: WorldEnvironment with Environment resource:
  - Background: Color (#1a0a2e dark purple)
  - Fog: Enabled, Exponential, Density 0.02, color #2d1b4e
  - Glow: Enabled, intensity 0.3
- Child: Camera3D positioned at (0, 20, 0), rotated looking down (-90, 0, 0), projection = Orthogonal, size = 30
- Child: Node3D "Ground" with MeshInstance3D plane (20x20, dark grey color #333344)
- Child: Node3D "BasePosition" at (0, 0, 0) with a visible marker cube (2x2x2, green #44ff44)

### Step 3: Player Controller

Create `scripts/player.gd`:
```gdscript
extends CharacterBody3D

@export var speed: float = 8.0
@export var sprint_speed: float = 12.0
@export var oxygen_drain_rate: float = 1.0
@export var sprint_drain_rate: float = 1.5

var current_oxygen: float = 100.0
var max_oxygen: float = 100.0
var is_dead: bool = false

signal oxygen_changed(current: float, maximum: float)
signal player_died()

func _ready():
    oxygen_changed.emit(current_oxygen, max_oxygen)

func _physics_process(delta):
    if is_dead:
        return
    
    # Movement
    var input_dir = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
    var is_sprinting = Input.is_action_pressed("sprint")
    
    var current_speed = sprint_speed if is_sprinting else speed
    var direction = Vector3(input_dir.x, 0, input_dir.y).normalized()
    
    velocity.x = direction.x * current_speed
    velocity.z = direction.z * current_speed
    move_and_slide()
    
    # Oxygen drain
    var drain = sprint_drain_rate if is_sprinting else oxygen_drain_rate
    current_oxygen -= drain * delta
    current_oxygen = max(current_oxygen, 0.0)
    oxygen_changed.emit(current_oxygen, max_oxygen)
    
    if current_oxygen <= 0:
        die()

func die():
    is_dead = true
    player_died.emit()
    # Respawn after 2 seconds
    await get_tree().create_timer(2.0).timeout
    respawn()

func respawn():
    is_dead = false
    current_oxygen = max_oxygen
    position = Vector3(0, 1, 0)  # Respawn at base
    oxygen_changed.emit(current_oxygen, max_oxygen)

func refill_oxygen():
    current_oxygen = max_oxygen
    oxygen_changed.emit(current_oxygen, max_oxygen)
```

Add to the main scene as CharacterBody3D with:
- CollisionShape3D (CylinderShape3D, radius 0.5, height 1)
- MeshInstance3D (CylinderMesh, representing the player - blue #4488ff)
- Attach player.gd script

### Step 4: Input Map

Create `project.godot` input map entries (add to the project.godot file):

```ini
[input]
move_forward={
    "deadzone": 0.2,
    "events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":87,"key_label":0,"unicode":119,"echo":false,"script":null)
, Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":4194320,"key_label":0,"unicode":0,"echo":false,"script":null)
]
move_back={
    "deadzone": 0.2,
    "events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":83,"key_label":0,"unicode":115,"echo":false,"script":null)
, Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":4194322,"key_label":0,"unicode":0,"echo":false,"script":null)
]
move_left={
    "deadzone": 0.2,
    "events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":65,"key_label":0,"unicode":97,"echo":false,"script":null)
, Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":4194319,"key_label":0,"unicode":0,"echo":false,"script":null)
]
move_right={
    "deadzone": 0.2,
    "events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":68,"key_label":0,"unicode":100,"echo":false,"script":null)
, Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":4194321,"key_label":0,"unicode":0,"echo":false,"script":null)
]
sprint={
    "deadzone": 0.2,
    "events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":4194325,"key_label":0,"unicode":0,"echo":false,"script":null)
]
```

### Step 5: O₂ UI

Create `scripts/oxygen_ui.gd`:
```gdscript
extends Control

@onready var progress_bar: ProgressBar = $ProgressBar
@onready var label: Label = $Label

func _ready():
    var player = get_tree().get_first_node_in_group("player")
    if player:
        player.oxygen_changed.connect(_on_oxygen_changed)
        player.player_died.connect(_on_player_died)

func _on_oxygen_changed(current: float, maximum: float):
    progress_bar.value = current / maximum * 100
    label.text = "O₂: %.0f%%" % (current / maximum * 100)
    
    # Visual warning when low
    if current / maximum < 0.25:
        progress_bar.modulate = Color.RED
    else:
        progress_bar.modulate = Color.WHITE

func _on_player_died():
    label.text = "O₂: DEAD"
    progress_bar.modulate = Color.DARK_RED
```

Create UI scene `scenes/ui/oxygen_ui.tscn`:
- Root: Control, full rect
- Child: ProgressBar (anchor top-center, 300x30)
- Child: Label (below progress bar)

Add the player to "player" group in the main scene.

### Step 6: Test It

After creating all files, verify:
1. `project.godot` exists and has `config_version=5`
2. All `.gd` scripts have no syntax errors
3. Main scene loads all nodes correctly

## OUTPUT

After completing, list all created files and confirm the project can be opened.
