# Sprint 1: Combat + Resources + Forge

## CONTEXT
Godot 4.6 project at `/Users/qnctx/projects/star-abyss-game/src/`. Current systems: player movement, O₂, day/night, enemy waves, auto-turret. Player has ZERO agency — no weapon, no resources, no crafting.

## YOUR JOB
Add 3 systems that give the player meaningful choices.

## RULES
- GDScript only, no C#
- Each system in its own file
- Use signals for communication
- Comment in English, UI labels in Chinese
- DO NOT break existing systems (player movement, O₂, game_manager)

---

## SYSTEM 1: Player Weapon

### 1a. Aiming System
Add to player.gd or create `scripts/weapon_controller.gd`:
- Mouse position → raycast from camera to ground plane → direction from player to hit point
- Show a targeting reticle (small crosshair on ground)
- Player sprite rotates to face aim direction

### 1b. Shooting
Create `scripts/weapon_controller.gd`:
```gdscript
extends Node3D

signal weapon_fired()

@export var current_weapon: String = "pistol"
var weapon_data = {
    "pistol": {"damage": 10, "fire_rate": 2.0, "spread": 0.05, "projectile_speed": 20.0, "ammo_per_shot": 0},
    "shotgun": {"damage": 8, "fire_rate": 0.8, "spread": 0.3, "projectile_speed": 15.0, "ammo_per_shot": 1, "pellets": 5},
    "rifle": {"damage": 25, "fire_rate": 3.0, "spread": 0.02, "projectile_speed": 30.0, "ammo_per_shot": 1},
    "flamethrower": {"damage": 5, "fire_rate": 10.0, "spread": 0.4, "projectile_speed": 8.0, "ammo_per_shot": 1},
    "ice_ray": {"damage": 15, "fire_rate": 1.5, "spread": 0.01, "projectile_speed": 25.0, "ammo_per_shot": 1, "slow_amount": 0.5}
}
var quality_multipliers = {"normal": 1.0, "fine": 1.3, "rare": 1.6, "epic": 2.0, "legendary": 2.5}
var weapon_quality = "normal"
var can_fire = true
var ammo = {"rifle": 30, "shotgun": 15, "flamethrower": 50, "ice_ray": 20}
var infinite_ammo_weapons = ["pistol"]

func _process(delta):
    if Input.is_action_pressed("shoot") and can_fire:
        fire()

func fire():
    var data = weapon_data[current_weapon]
    var pellets = data.get("pellets", 1)
    
    for i in range(pellets):
        var spread_angle = randf_range(-data.spread, data.spread)
        # Create projectile
        var proj = load("res://scenes/player_projectile.tscn").instantiate()
        proj.global_position = global_position + Vector3(0, 0.5, 0)
        proj.direction = (get_aim_direction() + spread_offset).normalized()
        proj.speed = data.projectile_speed
        proj.damage = data.damage * quality_multipliers[weapon_quality]
        proj.slow_amount = data.get("slow_amount", 0)
        get_tree().current_scene.add_child(proj)
    
    # Ammo
    if current_weapon not in infinite_ammo_weapons:
        ammo[current_weapon] -= data.ammo_per_shot
        if ammo[current_weapon] <= 0:
            switch_weapon("pistol")
    
    can_fire = false
    weapon_fired.emit()
    await get_tree().create_timer(1.0 / data.fire_rate).timeout
    can_fire = true

func get_aim_direction() -> Vector3:
    var mouse_pos = get_viewport().get_mouse_position()
    var camera = get_viewport().get_camera_3d()
    var from = camera.project_ray_origin(mouse_pos)
    var to = from + camera.project_ray_normal(mouse_pos) * 100
    # Ray intersect with Y=0 ground plane
    var dir = camera.project_ray_normal(mouse_pos)
    if dir.y > -0.01: return Vector3.FORWARD  # looking at sky
    var t = -from.y / dir.y
    var hit_point = from + dir * t
    hit_point.y = 0
    return (hit_point - global_position).normalized()

func switch_weapon(weapon_name: String):
    if weapon_name in weapon_data:
        current_weapon = weapon_name
```

Add input map to project.godot:
```ini
shoot={
"deadzone": 0.2,
"events": [Object(InputEventMouseButton,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"button_mask":1,"position":Vector2(0,0),"global_position":Vector2(0,0),"factor":1.0,"button_index":1,"canceled":false,"pressed":true,"double_click":false,"script":null)
]
}
weapon_switch_1={
"deadzone": 0.2,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":49,"key_label":0,"unicode":49,"echo":false,"script":null)
]
}
weapon_switch_2={
"deadzone": 0.2,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":50,"key_label":0,"unicode":50,"echo":false,"script":null)
]
}
```

### 1c. Player Projectile
Create `scripts/player_projectile.gd` + `scenes/player_projectile.tscn`:
- Area3D, bullet shape (small elongated box or capsule)
- Moves in direction at speed
- On hit enemy: deal damage (apply slow if slow_amount>0)
- On hit anything: destroy
- Lifetime: 3 seconds then destroy
- Different color based on weapon (pistol=yellow, shotgun=orange, rifle=blue, flamethrower=red, ice_ray=cyan)

### 1d. Attach to Player
- Add WeaponController node as child of Player in main.tscn
- Position at player's hand height (y=0.5, z=0.3 in front)

### 1e. Weapon Switching UI
Create HUD text showing current weapon + ammo:
- Bottom-left corner
- "🔫 手枪 | ∞" or "💥 霰弹枪 | 12"
- Press 1/2/3/4/5 to switch weapons (only if unlocked)

---

## SYSTEM 2: Resource Collection

### 2a. Inventory Manager
Create `scripts/inventory_manager.gd` as another Autoload:
```gdscript
extends Node

signal resource_changed(resource_type: String, amount: int)

var resources = {
    "iron": 0,
    "void_crystal": 0,
    "biomass": 0,
    "energy_core": 0,
    "blueprint": 0
}

func add_resource(type: String, amount: int):
    if type in resources:
        resources[type] += amount
        resource_changed.emit(type, resources[type])

func has_resources(requirements: Dictionary) -> bool:
    for type in requirements:
        if resources.get(type, 0) < requirements[type]:
            return false
    return true

func consume_resources(requirements: Dictionary):
    for type in requirements:
        resources[type] -= requirements[type]
        resource_changed.emit(type, resources[type])
```

Register as Autoload:
```ini
InventoryManager="*res://scripts/inventory_manager.gd"
```

### 2b. Resource Nodes
Create `scripts/resource_node.gd` + `scenes/resource_node.tscn`:
- Area3D with glowing crystal/rock mesh
- @export var resource_type: String ("iron", "void_crystal", "biomass")
- @export var amount: int = 1
- When player enters area: auto-collect, play pickup VFX, queue_free
- Visual: different color/material per type (iron=grey, void=purple, biomass=green, energy=blue, blueprint=gold)
- Slight bobbing animation (sin wave on Y)

### 2c. Resource Spawning
Add to game_manager.gd:
```gdscript
func spawn_resources():
    var spawn_positions = []
    var count = 15
    for i in range(count):
        var angle = randf_range(0, TAU)
        var distance = randf_range(3.0, 12.0)
        var pos = Vector3(cos(angle) * distance, 0.3, sin(angle) * distance)
        spawn_positions.append(pos)
    
    var types = ["iron", "iron", "iron", "iron", "void_crystal", "void_crystal", "biomass", "biomass", "biomass"]
    for i in range(min(count, spawn_positions.size())):
        var node = load("res://scenes/resource_node.tscn").instantiate()
        node.position = spawn_positions[i]
        node.resource_type = types[i % types.size()]
        node.amount = randi_range(1, 3)
        get_tree().current_scene.add_child(node)
```

Call spawn_resources() at the start of start_day().

### 2d. Resource HUD
Update oxygen_ui.gd or create `scripts/resource_hud.gd`:
- Top-right corner, small icons with counts
- Shows: 🪨铁×12  💎晶×3  🧬质×8
- Connect to InventoryManager.resource_changed signal
- Only show resources that have >0 count

---

## SYSTEM 3: Forge (锻造台)

### 3a. Forge UI Scene
Create `scenes/ui/forge_ui.tscn`:
- Control (full screen panel, dark transparent background)
- Title: "⚒️ 锻造台"
- Left side: weapon slots (list of unlocked weapons)
- Center: selected weapon info (name, icon, current quality, damage)
- Right side: upgrade button + material cost display
- Close button (X) or press E again to close
- Keyboard shortcut: press E near base to open/close

### 3b. Forge Script
Create `scripts/forge_ui.gd`:
```gdscript
extends Control

var forge_recipes = {
    "pistol": {
        "normal": {},
        "fine": {"iron": 10},
        "rare": {"iron": 20, "void_crystal": 5},
        "epic": {"iron": 30, "void_crystal": 15, "blueprint": 1},
        "legendary": {"iron": 50, "void_crystal": 30, "energy_core": 1, "blueprint": 2}
    },
    "shotgun": {
        "unlock": {"iron": 20, "blueprint": 1},
        "fine": {"iron": 15, "void_crystal": 3},
        "rare": {"iron": 30, "void_crystal": 10},
        "epic": {"iron": 50, "void_crystal": 20, "blueprint": 2},
        "legendary": {"iron": 80, "void_crystal": 50, "energy_core": 2, "blueprint": 3}
    }
}
var quality_names = ["normal", "fine", "rare", "epic", "legendary"]
var quality_colors = ["grey", "green", "blue", "purple", "orange"]

func upgrade_weapon(weapon_name: String):
    var current_quality = get_current_quality(weapon_name)
    var next_idx = quality_names.find(current_quality) + 1
    if next_idx >= quality_names.size():
        return  # max quality
    
    var next_quality = quality_names[next_idx]
    var cost = forge_recipes[weapon_name][next_quality]
    
    if InventoryManager.has_resources(cost):
        InventoryManager.consume_resources(cost)
        apply_upgrade(weapon_name, next_quality)
        # Play upgrade VFX
```

Connect to player's WeaponController to apply upgrades.

### 3c. Forge Trigger
Add to main.tscn: an Area3D around the base pod that, when player enters and presses E, opens forge UI.

---

## OUTPUT VERIFICATION
After creating all files:
1. Check all .gd scripts compile (no syntax errors)
2. Verify autoload entries in project.godot (GameManager AND InventoryManager)
3. Verify input maps (shoot, weapon_switch_1, weapon_switch_2, interact)
4. Confirm player can: aim with mouse → click to shoot → hit enemies
5. Confirm resources spawn on map → walk over to collect → HUD updates
6. Confirm press E near base → forge UI opens → upgrade consumes materials
