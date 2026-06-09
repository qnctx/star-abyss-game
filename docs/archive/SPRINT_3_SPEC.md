# Sprint 3: Procedural World Generation

## Goal
Replace the static 20×20 flat sandbox scene with a procedurally generated 100×100 world featuring terrain height variation, biome transitions, natural zone entrances, and intelligent resource placement.

## Current State (what's broken)
- `main.tscn` is a hand-placed test scene: one flat CSGBox3D ground, 8 decorative rocks, 3 zone "archways" (CSGBox doorframes)
- World is 20×20 units — base to any zone entrance is 3-second walk
- No height variation, no biome visuals, no Crash Zone entrance
- `GameManager.spawn_resources()` spawns in a hardcoded ring (distance 3-12 from origin)
- `GameManager.spawn_enemy()` spawns in a hardcoded ring (distance 8-12 from origin)
- `Player.respawn()` hardcoded to Vector3(0,1,0)
- `Player._try_teleport()` hardcoded distance check to Vector3(0,1,0)

## Requirements

### 1. WorldGenerator Autoload (`scripts/world_generator.gd`)
Add to project.godot autoload list. Singleton that generates the world on `_ready()`.

**Terrain Generation:**
- World size: 100×100 units (configurable via @export)
- Use OpenSimplexNoise for height map (reuse the existing `ground_noise.tres` if suitable, or create a new one)
- Generate a ground mesh (ArrayMesh or large CSGMesh3D grid) with vertex heights from noise
- Height range: 0.0 to 4.0 units
- Apply `ground_material.tres` (or create biome-specific materials)
- Center area (crash zone) should be a shallow crater: height dips toward center
- Add collision (StaticBody3D + CollisionShape3D using generated trimesh)

**Biome Assignment:**
- World divided into 4 biome quadrants radiating from center, plus the center crash zone
- Center (0,0): "crash" — toxic wasteland, crater depression, base pod spawn point
- North (z > 25): "cold" — frozen tundra, white/blue ground tint, frost particles
- East (x > 25): "heat" — volcanic crust, red/orange ground tint, ember particles
- South (z < -25): "gravity" — gravitational anomaly, purple/gray ground tint, floating rocks
- West (x < -25) or reserved: "crash_deep" — the Crash Zone (locked, final boss area)
- Biome transitions should be gradual: blend between adjacent biome materials using vertex colors or overlapping ground patches
- Biome detection: each world position maps to a biome enum. Store a 2D array or compute via function `get_biome_at(pos: Vector2) -> int`

**Zone Entrance Generation:**
Replace the current hand-placed archways with natural features:
- Cold Zone entrance (edge of crash zone, north): Ice cave — a CSG subtracted tunnel into a small ice wall, with blue point light and frost VFX
- Heat Zone entrance (edge of crash zone, east): Lava fissure — ground crack with orange emissive glow, heat distortion particles
- Gravity Zone entrance (edge of crash zone, south): Gravity well — floating rock ring + purple particle vortex
- Crash Zone entrance (far west, locked): Massive sealed door/collapsed structure, emits "Requires 3 Boss Keys" text when approached
- Each entrance has a ZoneTrigger (Area3D) child that calls `ZoneManager.current_zone = ...` and `ZoneManager.zone_changed.emit(...)` on player body_entered
- This means the existing `ZoneTrigger` script on the old archways should be reused on the new entrance scenes

**Resource Placement:**
- Replace `GameManager.spawn_resources()` logic entirely
- Resources spawn at WorldGenerator time (or delegated to WorldGenerator, called by GameManager on day_start)
- Placement rules:
  - `iron` → common everywhere, 30-40 nodes
  - `void_crystal` → more common in gravity zone, sparse elsewhere, 15-20 nodes
  - `biomass` → common in cold zone, sparse elsewhere, 15-20 nodes
  - `energy_core` → rare, near heat zone, 5-8 nodes
  - `blueprint` → very rare, 1-2 nodes, in hidden/hard-to-reach spots
- Resources should not spawn inside geometry or below terrain surface
- Use `resource_node.tscn` scene (already exists) for each spawn

**Base Pod Placement:**
- Spawn one `base_pod.tscn` at world position (0, 0.5, 0) — the crash zone center
- This is where the player starts and respawns

### 2. Refactor main.tscn
Strip it down to a minimal bootstrap scene:
- Keep: DirectionalLight3D, WorldEnvironment, Camera3D, Player, all UI nodes (OxygenUI, ForgeUI, ResourceHUD, WeaponHUD, SerumUI)
- Keep: PointLight_Base (at base pod position — but base pod is now spawned by WorldGenerator, so move the light there OR have WorldGenerator spawn it)
- Remove: Ground (all CSG rocks, crystals, ground plane), ColdZone, HeatZone, GravityZone (all hand-placed), Spores1-8 (old VFX), Turret (hand-placed)
- Remove: PointLight_Turret, PointLight_Crystal
- The scene should just be the player + camera + lights + UI + WorldGenerator node
- WorldGenerator node (type Node) added to main.tscn, script = `world_generator.gd`

### 3. Refactor GameManager
- `spawn_resources()`: delegate to WorldGenerator (call `WorldGenerator.place_resources()`)
- `spawn_enemy()`: use world-space spawn positions around the base pod (which is at 0,0,0), but pick spawn points on valid terrain surfaces, not inside walls/geometry. Use `WorldGenerator.get_spawn_position()` that returns a random valid surface point at given distance from base
- Enemy spawn distance: keep 8-12 range from base

### 4. Refactor Player Teleport / Respawn
- `respawn()` base position: read from `GameManager.base_position` or `WorldGenerator.base_position` instead of hardcoded Vector3(0,1,0)
- `_try_teleport()` base distance check: same — read base position dynamically

### 5. Visual Polish
- Add biome-specific fog tint that blends as player moves between biomes (can be a simple WorldEnvironment update in ZoneManager or a per-frame check)
- Spore VFX: keep the spore scene, but place new instances at random world positions in the crash zone center area (radius 15 from origin), 10-15 instances
- Add a subtle grid of point lights or emissive crystals in the crash zone for atmosphere

### 6. Camera
- Ensure the orthographic camera still covers the playable area properly
- Camera should follow player with smooth interpolation (already exists in player script? check — if not, add simple camera follow script)

## Files to Create
- `src/scripts/world_generator.gd` — main world generation logic
- `src/scenes/world/ice_cave_entrance.tscn` — cold zone entrance scene
- `src/scenes/world/lava_fissure_entrance.tscn` — heat zone entrance scene  
- `src/scenes/world/gravity_well_entrance.tscn` — gravity zone entrance scene
- `src/scenes/world/crash_zone_entrance.tscn` — locked crash zone entrance scene
- `src/scenes/world/biome_ground_cold.tscn` or create in code — cold area ground patch
- `src/scenes/world/biome_ground_heat.tscn` or create in code
- `src/scenes/world/biome_ground_gravity.tscn` or create in code

## Files to Modify
- `src/scenes/main.tscn` — strip to bootstrap
- `src/project.godot` — add WorldGenerator autoload
- `src/scripts/game_manager.gd` — delegate spawn to WorldGenerator; use dynamic base position
- `src/scripts/player.gd` — use dynamic base position for respawn/teleport

## Integration Constraints
- ZoneManager autoload must still work — zone triggers must set current_zone
- InventoryManager must still work — resources must call add_resource on pickup
- All existing UI nodes must remain functional
- Enemy spawning must still work through GameManager signals
- Store generated terrain height data so get_spawn_position() is fast (no raycasting)

## Deliverables
- Complete working code pushed to GitHub
- `git log --oneline` shows clean commits
- Claude Code handles all code writing; Hermes reviews and validates
