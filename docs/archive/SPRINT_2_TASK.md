# Sprint 2: Evolution + Environment + Teleport

## CONTEXT
Godot 4.6 project. Player can walk, shoot 5 weapons, collect resources, upgrade at forge. Day/night waves. O₂ is a flat timer that drains at constant rate — BORING.

## GOAL
Replace flat O₂ timer with zone-based environmental adaptation. Player evolves serum to survive harsh zones longer. Teleport beacons prevent dying on the way back.

## RULES
- GDScript only. Use signals. Chinese UI labels.
- New files in src/scripts/ and src/scenes/
- DO NOT break existing systems

---

## SYSTEM 1: Environmental Adaptation (replaces flat O₂ drain)

### 1a. Zone Manager
Create `scripts/zone_manager.gd` as Autoload:
```gdscript
extends Node

signal zone_changed(zone_name: String)

enum ZoneType { CRASH, COLD, HEAT, GRAVITY }
var current_zone: int = ZoneType.CRASH

# Zone multipliers (how harsh without adaptation)
const ZONE_PRESSURE = {
    ZoneType.CRASH: 1.0,
    ZoneType.COLD: 3.0,
    ZoneType.HEAT: 3.5,
    ZoneType.GRAVITY: 4.0
}

# Player adaptation levels (0-4 for each zone)
var adaptations = {
    ZoneType.CRASH: 0,
    ZoneType.COLD: 0,
    ZoneType.HEAT: 0,
    ZoneType.GRAVITY: 0
}

# Adaptation effects per level
const ADAPTATION_EFFECTS = [0.0, 0.20, 0.40, 0.70, 1.00]  # adaptation percentage
const ADAPTATION_BONUSES = {
    ZoneType.COLD: {4: {"speed_bonus": 0.15, "immunity": "freeze"}},
    ZoneType.HEAT: {4: {"speed_bonus": 0.10, "immunity": "burn"}},
    ZoneType.GRAVITY: {4: {"speed_bonus": 0.20, "immunity": "crush"}},
    ZoneType.CRASH: {4: {"oxygen_efficiency": 0.7}}
}

func get_oxygen_multiplier() -> float:
    var pressure = ZONE_PRESSURE[current_zone]
    var adaptation = ADAPTATION_EFFECTS[adaptations[current_zone]]
    var mult = pressure * (1.0 - adaptation * 0.9)
    # Apply zone 4 bonus if maxed
    if adaptations[current_zone] == 4 and current_zone == ZoneType.CRASH:
        mult *= 0.7
    return max(mult, 0.3)
```

Register in project.godot:
```ini
ZoneManager="*res://scripts/zone_manager.gd"
```

### 1b. Zone Trigger Areas
Create `scripts/zone_trigger.gd`:
```gdscript
extends Area3D

@export var zone_type: int = 0  # 0=CRASH, 1=COLD, 2=HEAT, 3=GRAVITY

func _ready():
    body_entered.connect(_on_body_entered)

func _on_body_entered(body):
    if body.is_in_group("player"):
        ZoneManager.current_zone = zone_type
        ZoneManager.zone_changed.emit(get_zone_name())

func get_zone_name() -> String:
    match zone_type:
        0: return "Crash Zone"
        1: return "极寒区"
        2: return "熔岩区"
        3: return "重力异常区"
    return "Unknown"
```

### 1c. Update player.gd O₂ drain
Replace the flat drain in player.gd `_physics_process`:
```gdscript
# REPLACE the oxygen drain section with:
var mult = ZoneManager.get_oxygen_multiplier() if ZoneManager else 1.0
var drain = (sprint_drain_rate if is_sprinting else oxygen_drain_rate) * mult
```

### 1d. Zone Visuals
Update main.tscn: add 3 large colored Area3D zones at map edges:
- Cold zone (north): light blue fog tint area, ZoneTrigger with zone_type=1
- Heat zone (east): orange/red tint area, ZoneTrigger with zone_type=2  
- Gravity zone (south): dark purple with particle distortion, ZoneTrigger with zone_type=3
- Crash Zone: center (default)

Each zone entrance: a glowing portal or cave mouth model (CSG archway + emissive material)

---

## SYSTEM 2: Serum Brewing Station

### 2a. Recipe Data
Create `scripts/serum_recipes.gd` (autoload):
```gdscript
extends Node

var recipes = {
    "cold_1": {"zone": 1, "level": 1, "cost": {"iron": 15, "biomass": 10}, "unlocked": false},
    "cold_2": {"zone": 1, "level": 2, "cost": {"void_crystal": 10, "biomass": 20}, "unlocked": false},
    "cold_3": {"zone": 1, "level": 3, "cost": {"void_crystal": 25, "energy_core": 1, "blueprint": 1}, "unlocked": false},
    "cold_4": {"zone": 1, "level": 4, "cost": {"void_crystal": 40, "energy_core": 3, "blueprint": 3}, "unlocked": false},
    "heat_1": {"zone": 2, "level": 1, "cost": {"iron": 20, "biomass": 15}, "unlocked": false},
    "heat_2": {"zone": 2, "level": 2, "cost": {"void_crystal": 12, "biomass": 25}, "unlocked": false},
    "heat_3": {"zone": 2, "level": 3, "cost": {"void_crystal": 30, "energy_core": 1, "blueprint": 1}, "unlocked": false},
    "heat_4": {"zone": 2, "level": 4, "cost": {"void_crystal": 45, "energy_core": 3, "blueprint": 3}, "unlocked": false},
    "grav_1": {"zone": 3, "level": 1, "cost": {"iron": 25, "void_crystal": 10}, "unlocked": false},
    "grav_2": {"zone": 3, "level": 2, "cost": {"void_crystal": 20, "biomass": 15}, "unlocked": false},
    "grav_3": {"zone": 3, "level": 3, "cost": {"void_crystal": 35, "energy_core": 2, "blueprint": 1}, "unlocked": false},
    "grav_4": {"zone": 3, "level": 4, "cost": {"void_crystal": 50, "energy_core": 3, "blueprint": 3}, "unlocked": false},
    "crash_1": {"zone": 0, "level": 1, "cost": {"iron": 10, "biomass": 5}, "unlocked": true},
    "crash_2": {"zone": 0, "level": 2, "cost": {"iron": 25, "biomass": 20}, "unlocked": false},
    "crash_3": {"zone": 0, "level": 3, "cost": {"void_crystal": 20, "energy_core": 1, "blueprint": 1}, "unlocked": false},
    "crash_4": {"zone": 0, "level": 4, "cost": {"void_crystal": 35, "energy_core": 2, "blueprint": 2}, "unlocked": false},
}

const ZONE_NAMES = ["Crash Zone", "极寒区", "熔岩区", "重力异常区"]
const ZONE_ICONS = ["🌿", "❄️", "🔥", "🌑"]
const LEVEL_NAMES = ["Lv1 初阶", "Lv2 中阶", "Lv3 高阶", "Lv4 终极"]

func unlock_recipe(recipe_id: String):
    if recipe_id in recipes:
        recipes[recipe_id].unlocked = true

func get_unlocked_recipes_for_zone(zone: int) -> Array:
    var result = []
    for id in recipes:
        if recipes[id].zone == zone and recipes[id].unlocked:
            result.append(id)
    return result
```

Register as autoload:
```ini
SerumRecipes="*res://scripts/serum_recipes.gd"
```

### 2b. Serum Station UI
Create `scenes/ui/serum_ui.tscn` + `scripts/serum_ui.gd`:

The UI has 3 panels:
- **Left**: Zone tabs (❄️极寒 🔥熔岩 🌑重力 🌿Crash), click to filter recipes
- **Center**: Recipe cards for selected zone. Each card shows: serum name, current player level, cost materials, [Brew] button
- **Right**: Material inventory summary

```gdscript
func _brew_serum(recipe_id: String):
    var recipe = SerumRecipes.recipes[recipe_id]
    if not recipe.unlocked:
        return
    if not InventoryManager.has_resources(recipe.cost):
        return
    
    var current_level = ZoneManager.adaptations[recipe.zone]
    if current_level >= recipe.level:
        return  # already at or above this level
    
    InventoryManager.consume_resources(recipe.cost)
    ZoneManager.adaptations[recipe.zone] = recipe.level
    
    # Visual feedback
    # Play injection animation/sound
    _show_upgrade_effect()
```

Open with key F (or add to base interaction area)

### 2c. Zone Status HUD
Update the HUD to show current zone + adaptation level:
```
❄️ 极寒区 | 适应: ████░░ Lv3 (70%)
O₂: 85% | 🪨12 💎5 🧬8
```

---

## SYSTEM 3: Teleport Beacons

### 3a. Beacon Item
Create `scripts/teleport_beacon.gd`:
```gdscript
extends Node3D

@export var zone_name: String = "crash"
var is_placed: bool = false

func place():
    is_placed = true
    add_to_group("beacons")
    # Visual: small antenna/pylon with glowing light

func teleport_to_base(player):
    # Teleport player to base (0, 1, 0)
    player.position = Vector3(0, 1, 0)
    # Play teleport VFX
```

### 3b. Teleport Manager
Add to game_manager.gd or create `scripts/teleport_manager.gd`:
- Track placed beacons per zone
- Player presses T in a zone with beacon → teleport to base
- At base, show list of placed beacons → select → teleport there

### 3c. Beacon Crafting
Add to forge_ui.gd or serum_ui.gd as a craftable item:
```
❄️ 极寒信标: 虚空晶×20 + 能量核心×2
🔥 熔岩信标: 虚空晶×20 + 能量核心×2
🌑 重力信标: 虚空晶×25 + 能量核心×3
```

### 3d. Beacon Recipes as Discoveries
Create blueprint items that unlock beacon recipes. Place them at 'deep points' in each zone (for now, just spawn a glowing pickup at a far corner of each zone area).

---

## SYSTEM 4: Zone Areas in Crash Zone

Expand main.tscn with 3 zone entrances at map edges:

```
                    ❄️ 极寒入口 (North, z=8)
         ┌─────────────────────────────────┐
         │     ░░░░░ 淡蓝色区域 ░░░░░░░     │
         │  (zone_trigger: COLD)            │
         │                                  │
🔥 熔岩   │         🏠 基地                  │    (empty)
入口     │         (0,0)                    │
(West)   │                                  │
 x=-8    │                                  │
         │     ░░░░░ 暗紫色区域 ░░░░░░░     │
         │  (zone_trigger: GRAVITY)         │
         └─────────────────────────────────┘
                    🌑 重力入口 (South, z=-8)
```

Each entrance:
- CSG archway (2 wide, 3 tall) with colored emissive material
- Particle effect (blue sparkles for cold, orange embers for heat, purple distortion for gravity)
- ZoneTrigger Area3D that covers the colored zone area
- A small "sample area" (~6x6) of the zone with unique ground color and atmosphere
- A glowing pickup at the far end (blueprint or rare resource)

The 3 large zones will be expanded in a future sprint. For now they're teaser areas.

---

## VERIFICATION
1. Walk into cold zone → O₂ drain spikes → zone HUD changes
2. Brew crash_1 serum → O₂ drain improves slightly
3. Walk to zone edge → see archway + particles
4. Press T near placed beacon → teleport to base
