# Star Abyss Voyage — Domain Context (CONTEXT.md)

## Project Overview
**星渊迷航** — Top-down 2.5D survival roguelike with tower defense elements.
Set on a toxic planet. Player must manage oxygen, gather resources, build base defenses, and survive night waves.

---

## Core Domain Entities

### Player (玩家)
- **Type**: `CharacterBody3D`
- **Script**: `scripts/player.gd`
- **Concept**: The controllable survivor. Moves with WASD, sprints with Shift.
- **States**: alive / dead / respawning
- **Key properties**:
  - `current_oxygen` (float, starts at 180s)
  - `is_dead` (bool)
  - `_grace_timer` (float, 10s safe start, then 5s per respawn)
- **Signals**: `oxygen_changed`, `player_died`
- **Behaviors**:
  - Oxygen drains based on movement state (sprint vs normal) and zone pressure
  - Teleports between base and zone beacons
  - Respawns at base after 2s death timer

### Enemy (敌人)
- **Type**: `CharacterBody3D`
- **Script**: `scripts/enemy.gd`
- **Concept**: Hostile creature that pathfinds toward the player's base pod.
- **States**: alive / dead (fires `enemy_died`, then queue_free)
- **Key properties**: `speed`, `health`, `damage`, `attack_range`
- **Signals**: `enemy_died`, `base_reached(damage: float)`
- **Scaling**:
  - Boss waves (every 10th): 5x HP, 3x damage, 2x speed
  - Elite waves (every 5th, not 10th): 3x HP, 2x damage, 1.5x speed
- **Behaviors**: Move toward `target_position` (base), emit `base_reached` on contact, then die

### Turret (炮塔)
- **Type**: `StaticBody3D`
- **Script**: `scripts/turret.gd`
- **Concept**: Auto-targeting defense structure. Built by player, auto-fires at nearest enemy.
- **Key properties**: `range`, `fire_rate`, `damage`
- **Behaviors**:
  - Uses a dynamic `Area3D` with `SphereShape3D` (range) for detection
  - Finds nearest enemy in "enemies" group each frame
  - Fires projectile toward target, plays muzzle flash VFX
  - Fire rate controlled by cooldown timer

### Projectile (子弹/抛射物)
- **Type**: `CharacterBody3D`
- **Script**: `scripts/projectile.gd` (turret), `scripts/player_projectile.gd` (player weapons)
- **Concept**: Moving bullet that travels toward a target node and deals damage on arrival
- **Turret projectiles**: follow `target` node via `look_at`
- **Player projectiles**: use `direction` vector + `speed`, can have `slow_amount` (ice ray)

### Resource Node (资源节点)
- **Type**: `Area3D`
- **Script**: `scripts/resource_node.gd`
- **Concept**: Floating collectible resource scattered around the map. Bobbing animation.
- **Resource types**: iron, void_crystal, biomass, energy_core, blueprint
- **Behaviors**: Player enters collision → `InventoryManager.add_resource()` → VFX particles → `queue_free()`

### Zone (区域)
- **Type**: Managed by `ZoneManager` (Node, Autoload candidate)
- **Script**: `scripts/zone_manager.gd`
- **Concept**: Geographic regions with different atmospheric pressure and adaptation effects.
- **Zone types**: CRASH (default safe), COLD, HEAT, GRAVITY
- **Key mechanics**:
  - `ZONE_PRESSURE` dict multiplies oxygen drain rate
  - Player adaptation level (0-4) reduces penalty per zone
  - At adaptation level 4: immunity to zone-specific hazard + speed bonus
- **Signals**: `zone_changed(zone_name: String)`

### Zone Trigger (区域触发器)
- **Type**: `Area3D`
- **Script**: `scripts/zone_trigger.gd`
- **Concept**: Invisible volume that detects player entry and calls `ZoneManager.zone_changed`

### Oxygen System
- **Managed by**: `Player` script (direct property `current_oxygen`)
- **UI component**: `scripts/oxygen_ui.gd` + `scenes/ui/oxygen_ui.tscn`
- **Concept**: Countdown survival resource. Starts at 180s. Drains at different rates:
  - Normal movement: ~0.556/s (180s total)
  - Sprinting: ~0.778/s (~130s total)
  - Zone pressure multiplies drain further

### Day/Night Cycle
- **Managed by**: `GameManager` (Autoload Node)
- **Script**: `scripts/game_manager.gd`
- **Concept**: Timed cycle controlling resource spawns and enemy waves.
- **Day**: 960s (16 min) — resources spawn, player gathers
- **Night**: 480s (8 min) — enemy waves spawn, game is dangerous
- **Wave system**:
  - Base enemy count: `ENEMIES_PER_WAVE_BASE + wave * 0.5`
  - Spawns staggered with 1-3s delays
  - Next wave starts 5s after all enemies dead
- **Signals**: `night_started`, `day_started`, `wave_spawned(wave_number)`

### Base Pod (基地舱)
- **Type**: `StaticBody3D`
- **Script**: `scripts/base_pod.gd`
- **Concept**: Central structure. Enemy pathfind to this. Player teleports to/from this.
- **Position** tracked by `WorldGenerator.base_position`

### Weapon System
- **Controller**: `scripts/weapon_controller.gd` (Node3D, attached to player)
- **Concept**: Player fires one of 5 weapon types, selected by number keys 1-5.
- **Weapons**: pistol (infinite ammo), shotgun, rifle, flamethrower, ice_ray
- **Quality tiers**: normal → fine → rare → epic → legendary (damage multipliers 1.0 → 1.9)
- **Signals**: `weapon_fired`, `weapon_changed`, `ammo_changed`

### Inventory / Resources
- **Manager**: `scripts/inventory_manager.gd` (Autoload Node)
- **Concept**: Tracks count of 5 resource types across the whole game
- **Resource types**: iron, void_crystal, biomass, energy_core, blueprint
- **Signals**: `resource_changed(resource_type, amount)`
- **Methods**: `add_resource()`, `has_resources(requirements)`, `consume_resources(requirements)`

### World Generator
- **Script**: `scripts/world_generator.gd`
- **Concept**: Procedural terrain generation (likely crash zone terrain).
- **Provides**: `base_position` (Vector3), `get_spawn_position(min_dist, max_dist)`

---

## Core Domain Boundaries

### What's IN the domain
- Player oxygen survival mechanics
- Zone-based environmental pressure / adaptation
- Enemy wave spawning during night
- Base defense via turrets
- Resource gathering and crafting/forge system
- Day/night timed gameplay loop
- Weapon switching and quality upgrade system
- Teleportation between base and zone beacons

### What's OUT of the domain (not yet implemented)
- Multiplayer
- Persistent save/load system
- Full crafting tree beyond forge UI
- Enemy AI beyond "walk to base"
- Terrain destruction

---

## Architecture Observations (for refactoring)

### Current Signal Usage
- `GameManager`: `night_started`, `day_started`, `wave_spawned` — well structured
- `Player`: `oxygen_changed`, `player_died` — fire-and-forget
- `Enemy`: `enemy_died`, `base_reached` — connected in `GameManager.spawn_enemy()`
- `Turret`: no signals emitted — uses direct group lookup
- `WeaponController`: `weapon_fired`, `weapon_changed`, `ammo_changed`
- `InventoryManager`: `resource_changed`

### Potential "Signal Hell" Risks
1. `GameManager.spawn_enemy()` manually wires `enemy_died` and `base_reached` — if enemy scales are applied after wiring, order matters
2. `ZoneManager` is a singleton (Autoload) but signals on `zone_changed` — receivers must know to connect
3. Cross-scene signal chains: Player death → respawn → `_grace_timer` logic depends on frame delta timing

### Component Design Assessment
**Current**: Heavy use of Godot nodes as "components" — `Area3D` for detection, `CharacterBody3D` for physics. Good.
**Issue**: `WeaponController` on Player node mixes concerns (input handling, weapon data, projectile spawning). Could extract `WeaponData` as a Resource/class.

**Recommendation**:
- Prefer **composition**: attach child nodes as "behavior components" (WeaponController, OxygenUI attachment, etc.)
- `ResourceNode` already uses `class_name ResourceNode` — good pattern for reusable components
- Use `@export` on parent nodes to expose child behavior parameters

---

## Key File Locations
```
src/
├── scripts/
│   ├── game_manager.gd      # Day/night, wave spawning
│   ├── player.gd            # Movement, oxygen, death
│   ├── enemy.gd              # Pathfind to base, damage
│   ├── turret.gd             # Auto-target, fire
│   ├── weapon_controller.gd  # Weapon system
│   ├── inventory_manager.gd  # Resource tracking
│   ├── zone_manager.gd       # Zone adaptation
│   ├── zone_trigger.gd       # Zone entry detection
│   ├── resource_node.gd      # Collectible resources
│   ├── world_generator.gd    # Terrain + spawn positions
│   └── base_pod.gd           # Base structure
├── scenes/
│   ├── main.tscn
│   ├── player.tscn / player_model.tscn
│   ├── enemy.tscn / enemy_bug.tscn
│   ├── turret.tscn / turret_model.tscn
│   ├── projectile.tscn / projectile_bolt.tscn / player_projectile.tscn
│   ├── resource_node.tscn
│   ├── base_pod.tscn
│   └── ui/ (oxygen_ui, forge_ui, weapon_hud, etc.)
└── project.godot
```

---

## grill-with-docs Self-Analysis

**What is the game's core domain?**
Survival tower-defense roguelike. Player manages oxygen (time-limited resource) while building base defenses against night enemy waves. The "core loop" is: Day → gather resources → build/upgrade turrets → Night → survive waves → repeat.

**What are the hard boundaries?**
- No networking / multiplayer
- No persistent progression (roguelike = run-based, restart on death)
- No terrain editing during gameplay (static or procedurally generated once)

**Where is complexity concentrated?**
- `GameManager`: day/night timing, wave scaling, enemy instantiation
- `Player`: oxygen drain interaction with zones
- `WeaponController`: 5 weapons × 5 quality tiers = 25 damage combinations

**Most important refactor opportunity?**
Separate `WeaponData` into a Resource class so weapon stats can be data-driven (`.tres` files) rather than hardcoded dicts. This enables future weapon expansion without code changes.