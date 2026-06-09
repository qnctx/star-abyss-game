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
  - Calls `DeathDropManager.record_player_death(self)` before emitting `player_died`
  - Respawns at base after 2s death timer

### Death Drop Manager (死亡资源掉落)
- **Type**: `Node` autoload
- **Script**: `scripts/death_drop_manager.gd`
- **Concept**: Recoverable penalty for O2/death risk. Death removes roughly half of each carried resource type and spawns one recoverable crate.
- **State**:
  - `active_payload`
  - `active_position`
- **Signals**: `death_drop_spawned()`, `death_drop_collected()`
- **Behavior**:
  - `record_player_death(player)` removes resources from `InventoryManager`, merges with any existing uncollected drop, and spawns a new `DeathDrop` at the latest death position.
  - `collect_active_drop()` returns the payload to `InventoryManager` and clears the active crate.
  - `get_drop_hint()` reports distance/direction and payload text for HUD/Objective guidance.
  - `capture_save_data()` / `apply_save_data()` persist active drop payload and position.
- **HUD/Objective**:
  - `CombatHUD` shows a `Drop:` hint only while a death drop is active.
  - `ObjectiveTracker` prioritizes recovery after urgent night/base/structure repair states.

### Death Drop (死亡掉落包)
- **Type**: `Area3D`
- **Script**: `scripts/death_drop.gd`
- **Groups**: `death_drops`
- **Behavior**:
  - Displays a small orange recoverable crate.
  - Player collision calls `DeathDropManager.collect_active_drop()`.

### Enemy (敌人)
- **Type**: `CharacterBody3D`
- **Script**: `scripts/enemy.gd`
- **Concept**: Hostile creature that moves toward the player's base pod and opportunistically attacks nearby built structures.
- **States**: alive / dead (fires `enemy_died`, then queue_free)
- **Key properties**: `speed`, `health`, `damage`, `attack_range`
- **Signals**: `enemy_died(should_reward: bool)`, `base_reached(damage: float, hit_position: Vector3)`
- **Scaling**:
  - Scout waves (every 3rd, unless elite/boss): 0.7x HP, 0.75x damage, 1.8x speed, smaller cyan visual
  - Tank waves (every 4th, unless scout/elite/boss): 2.8x HP, 1.7x damage, 0.7x speed, larger gold visual
  - Boss waves (every 10th): 5x HP, 3x damage, 2x speed
  - Elite waves (every 5th, not 10th): 3x HP, 2x damage, 1.5x speed
- **Metadata**: Spawned enemies store `wave_variant` and `wave_variant_label` for future reward/UI systems.
- **Rewards**:
  - Only combat kills grant rewards.
  - Base breaches call `die(false)` and do not grant kill rewards.
  - Variants add bonus rewards: Scout biomass, Tank iron, Elite crystal/blueprint, Boss energy_core/blueprint.
- **Behaviors**:
  - Move toward `target_position` (base), emit `base_reached` on contact, then die.
  - If a `built_structures` node is within `structure_target_range`, move to it and attack on `structure_attack_interval`.
  - Structure attacks use `structure_health` / `structure_max_health` metadata and queue-free structures at 0 HP.

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

### Shield Generator (护盾发生器)
- **Type**: `Node3D`
- **Script**: `scripts/shield_generator.gd`
- **Concept**: Buildable base defense module that protects Base HP from enemy contact damage.
- **Cost**: `25 iron + 8 void_crystal + 1 energy_core`
- **Behaviors**:
  - Registers `50` shield capacity with `GameManager` on build
  - Unregisters that capacity if removed from the scene
  - Uses lightweight procedural meshes and a blue shield field visual

### Slow Field (减速力场)
- **Type**: `Node3D`
- **Script**: `scripts/slow_field.gd`
- **Concept**: Buildable control defense that slows enemies inside its radius instead of dealing damage.
- **Cost**: `15 iron + 8 biomass + 4 energy`
- **Behaviors**:
  - Applies a named slow source to enemies in range
  - Enemies use `get_effective_speed()` so slow sources can be reused by future systems
  - Removes slow when enemies leave range or the field is removed

### Solar Panel (太阳能板)
- **Type**: `Node3D`
- **Script**: `scripts/solar_panel.gd`
- **Concept**: Tier 1 base power module that turns safe daytime into a useful preparation resource.
- **Cost**: `18 iron + 6 biomass`
- **Behaviors**:
  - Generates `1 energy` every `5` seconds during daytime
  - Pauses generation at night
  - Adds to `InventoryManager.resources["energy"]`

### Research Station (研究台)
- **Type**: `Node3D`
- **Script**: `scripts/research_station.gd`
- **Concept**: First technology-tree entry point; converts base power into blueprint progress.
- **Cost**: `20 iron + 5 void_crystal + 5 energy`
- **Behaviors**:
  - Consumes `5 energy` every `20` seconds
  - Produces `1 blueprint`
  - Pauses automatically while energy is below `5`

### Resource Scanner (资源扫描器)
- **Type**: `Node`
- **Script**: `scripts/resource_scanner.gd`
- **Concept**: Lightweight HUD scanner that reduces resource-hunting friction during the build loop.
- **Controls**: `G` cycles target resource type.
- **Scan types**: iron, biomass, void_crystal, energy_core
- **Behaviors**:
  - Finds nearest matching node in the `resource_nodes` group within `45m`
  - Reports distance and rough compass direction through `CombatHUD`
  - Updates automatically as resources are collected

### Signal Beacon (信号台)
- **Type**: `Node3D`
- **Script**: `scripts/signal_beacon.gd`
- **Concept**: Late-MVP rescue signal structure that converts stored energy into long-term story/progression signal.
- **Build input**: `B`, then `7`
- **Build cost**: `30 iron + 10 void_crystal + 10 energy + 2 blueprint`
- **Runtime loop**:
  - Every `6s`, consumes `1 energy` if available.
  - Adds `10/100` signal progress per powered cycle.
  - Pauses without energy.
  - Joins `signal_beacons` and `built_structures`.
- **Progress milestones**: Notifies `SignalLogManager` whenever progress advances.
- **HUD**: `CombatHUD` shows the strongest beacon status, e.g. `Signal: 40/100 | transmitting`, `needs energy`, or `locked 100/100`.

### Signal Log Manager (无线电日志 / 撤离坚守)
- **Type**: `Node` autoload
- **Script**: `scripts/signal_log_manager.gd`
- **Concept**: Small story/progression log unlocked by Signal Beacon progress milestones, plus the end-of-signal Extraction Holdout state.
- **Milestones**: `25`, `50`, `75`, `100` signal progress.
- **State**:
  - `unlocked_logs`
  - `collected_caches`
  - `latest_message`
  - `extraction_holdout_active`
  - `extraction_holdout_complete`
  - `extraction_time_remaining`
- **Signals**: `radio_log_unlocked(log_id, message)`, `signal_cache_spawned(cache_id)`, `signal_cache_collected(cache_id)`, `extraction_holdout_started(duration)`, `extraction_holdout_completed()`
- **Signal Cache loop**:
  - Each unlocked milestone spawns one deterministic Signal Cache unless it has been collected.
  - Cache rewards include resource bundles such as iron/energy, crystal/blueprint, biomass/energy, or energy_core/blueprint.
  - `get_cache_hint()` reports nearest active cache distance/direction.
- **Extraction Holdout loop**:
  - Unlocking `signal_100` in normal play starts a timed extraction holdout.
  - If the player completes Signal during daytime, `GameManager.force_start_night()` starts immediate defense pressure.
  - `get_extraction_status_text()` and `get_extraction_objective_text()` expose HUD/objective text.
  - Save/load restores holdout state without spawning a new wave while runtime structures are being restored.
- **HUD**: `CombatHUD` shows `latest_message`, nearest active Signal Cache hint, and Extraction countdown/victory state under the signal/save rows.
- **Save/load**: `SaveManager` persists unlocked radio logs, collected Signal Cache state, latest message, and Extraction Holdout state; old saves can also rebuild milestones from restored Signal Beacon progress.

### Signal Cache (信号补给点)
- **Type**: `Area3D`
- **Script**: `scripts/signal_cache.gd`
- **Concept**: A radio-led exploration reward spawned by Signal Log milestones.
- **Groups**: `signal_caches`
- **Behavior**:
  - Player collision collects the cache.
  - Grants its configured resource bundle through `InventoryManager`.
  - Calls `SignalLogManager.mark_cache_collected(cache_id)` so it will not respawn after save/load.

### Objective Tracker (目标提示)
- **Type**: `Node`
- **Script**: `scripts/objective_tracker.gd`
- **Concept**: Lightweight HUD guidance that turns the growing MVP systems into a readable next-step loop.
- **Behaviors**:
  - Reads inventory, base health, day/night state, enemies alive, and built structure groups.
  - Prioritizes extraction completion/holdout, defense at night, base repair when damaged, damaged structure repair, active Signal Cache recovery, then first turret, O2, solar, research, tech unlocks, shield, slow field, turret upgrades, Signal Beacon build, and signal powering.
  - Emits `objective_changed(text)` when the current objective changes.
  - `CombatHUD` displays the objective line below scanner status.

### Tech Manager (科技解锁)
- **Type**: `Node` autoload
- **Script**: `scripts/tech_manager.gd`
- **Concept**: Small MVP technology gate that turns blueprints into buildable defensive options.
- **Unlocked by default**: Turret, O2 Station, Solar Panel, Research Station, Signal Beacon.
- **Locked by default**:
  - Shield Generator costs `1 blueprint` to unlock.
  - Slow Field costs `2 blueprint` to unlock.
- **Behaviors**:
  - `BuildManager` blocks placement while selected building tech is locked.
  - Build mode uses `Y` / `unlock_tech` to unlock the selected building if blueprint cost is available.
  - `CombatHUD` shows locked state, unlock cost, and `Y READY` / `Y NEED BLUEPRINT`.
  - `ObjectiveTracker` guides the player from research into Shield Generator and Slow Field unlocks.

### Save Manager (存档/读档)
- **Type**: `Node` autoload
- **Script**: `scripts/save_manager.gd`
- **Input**: `F6` quick-save, `F7` quick-load; actions are registered at runtime.
- **Save path**: `user://star_abyss_save.json`
- **HUD feedback**: `SaveManager.save_status_changed(message)` is connected by `CombatHUD`; top-left HUD shows `Save: Saved`, `Save: Loaded`, or failure/no-file messages for a short duration.
- **Persisted MVP state**:
  - `InventoryManager.resources`
  - `TechManager.unlocked`
  - Base HP/shield, wave number, phase timer, current day/night flag, wave direction
  - Built structures with `build_id`, position, scale, build cost/label, HP, max HP, upgrade level, turret damage/fire rate, Signal Beacon progress/timer
  - Signal radio logs, collected Signal Cache state, and Extraction Holdout state from `SignalLogManager`
  - Active Death Drop payload and position from `DeathDropManager`
  - Active enemies with position, scale, health, speed, damage, attack settings, and wave variant metadata
- **Load behavior**:
  - Clears current enemies and built structures before restoring saved runtime nodes.
  - Restored enemies reconnect to `GameManager._on_enemy_died` and `_on_base_reached`.
  - Restored structures are created from the same structure scripts/scenes used by BuildManager.

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
- **UI component**: `scripts/oxygen_ui.gd` attached directly in `scenes/main.tscn`
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
  - Variants: Scout every 3rd wave, Tank every 4th, Elite every 5th, Boss every 10th; boss/elite take priority over scout/tank.
  - Spawns staggered with 1-3s delays
  - Next wave starts 5s after all enemies dead
  - Enemies that breach the base also damage nearby built structures after shield absorption.
- **Signals**: `night_started`, `day_started`, `wave_spawned(wave_number)`
- **Manual test control**: `BaseInteraction` maps `N` to `GameManager.force_start_night()` so wave/base-defense checks can start without waiting for the full day timer.
- **Warning UI**:
  - `phase_time_remaining` tracks current day/night countdown.
  - `last_wave_direction` stores rough compass direction of the first enemy spawned in the current wave.
  - `CombatHUD` displays countdown, direction, and current wave variant label.

### Base Pod (基地舱)
- **Type**: `StaticBody3D`
- **Script**: `scripts/base_pod.gd`
- **Concept**: Central structure. Enemy pathfind to this. Player teleports to/from this.
- **Position** tracked by `WorldGenerator.base_position`
- **Repair loop**:
  - `BaseInteraction` lets the player press `E` near the base pod to repair.
  - Repair costs `10 iron + 5 biomass`.
  - Repair restores `25` Base HP and cannot be used at full HP.
- **Shield loop**:
  - Buildable `ShieldGenerator` adds `50` max shield to the base.
  - Enemy base damage is absorbed by shield before Base HP is reduced.
  - Shield slowly recharges while shield capacity exists.

### Build / Recycle System
- **Manager**: `scripts/build_manager.gd`
- **Build controls**:
  - `B` toggles build mode.
  - `1-6` select buildable structures.
  - Left click places a valid structure.
- **Recycle controls**:
  - `X` toggles recycle mode while build mode is open.
  - Left click recycles the nearest built structure under the preview.
  - Refund rate is `50%`, with at least `1` returned for each original cost item.
  - `get_recycle_status_text()` reports the current target label and expected refund for HUD display.
- **Upgrade controls**:
  - `U` upgrades the nearest turret under the preview while build mode is open.
  - Turret upgrade costs `10 iron + 5 energy + 1 blueprint`.
  - Max upgrade level is `3`.
  - Each level increases turret damage and fire rate.
  - `get_upgrade_status_text()` reports target level and `READY`/`NEED RES`/`MAX` status for HUD display.
- **Repair controls**:
  - `R` repairs the nearest damaged built structure under the preview.
  - Structure repair costs `5 iron + 2 biomass`.
  - Repair restores `35` HP up to the structure max.
  - `get_repair_status_text()` reports target HP and resource readiness.
- **Damage visibility**:
  - `CombatHUD.get_structure_damage_hint()` summarizes damaged structures on the Base HUD row.
  - Single damaged structures show label plus HP, e.g. `Struct Turret 40/100 | B+R READY`.
  - Multiple damaged structures show count and worst HP.
- **Implementation notes**:
  - New structures store `build_id` metadata for save/load restoration.
  - New structures store `build_cost` metadata when placed.
  - New structures store `structure_health` and `structure_max_health` metadata when placed; enemies can also initialize this metadata when attacking older/test structures.
  - Upgraded structures store `upgrade_level` metadata.
  - Recycle ignores nodes that are not in `built_structures`.
  - `CombatHUD` renders build status as two rows during build mode to avoid overlong one-line hints.

### Weapon System
- **Controller**: `scripts/weapon_controller.gd` (Node3D, attached to player)
- **Concept**: Player fires one of 5 weapon types, selected by number keys 1-5.
- **Weapons**: pistol (infinite ammo), shotgun, rifle, flamethrower, ice_ray
- **Quality tiers**: normal → fine → rare → epic → legendary (damage multipliers 1.0 → 1.9)
- **Signals**: `weapon_fired`, `weapon_changed`, `ammo_changed`

### Inventory / Resources
- **Manager**: `scripts/inventory_manager.gd` (Autoload Node)
- **Concept**: Tracks count of 5 resource types across the whole game
- **Resource types**: iron, void_crystal, biomass, energy, energy_core, blueprint
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
- Full save/load beyond MVP runtime state; projectile/VFX persistence is not implemented yet
- Full crafting tree beyond forge UI
- Advanced enemy pathfinding/tactics beyond nearby structure attacks
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
│   ├── base_interaction.gd   # Base repair input and night test shortcut
│   ├── player.gd            # Movement, oxygen, death
│   ├── death_drop_manager.gd # Death penalty resource drop/recovery state
│   ├── death_drop.gd         # Recoverable death crate
│   ├── enemy.gd              # Pathfind to base, damage
│   ├── turret.gd             # Auto-target, fire
│   ├── shield_generator.gd    # Buildable base shield module
│   ├── slow_field.gd          # Buildable enemy slow/control field
│   ├── solar_panel.gd         # Buildable daytime energy generator
│   ├── research_station.gd    # Buildable energy-to-blueprint converter
│   ├── resource_scanner.gd    # HUD nearest-resource scanner
│   ├── objective_tracker.gd   # HUD next-step objective tracker
│   ├── weapon_controller.gd  # Weapon system
│   ├── inventory_manager.gd  # Resource tracking
│   ├── tech_manager.gd       # Blueprint-based building unlock gates
│   ├── save_manager.gd       # Runtime save/load MVP
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
│   └── ui/ (forge_ui scene; other HUDs are attached directly in main.tscn)
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
