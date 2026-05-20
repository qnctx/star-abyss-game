# Sprint 3a: WorldGenerator Core

Create `src/scripts/world_generator.gd` — an autoload singleton that generates procedural terrain at game start.

## Requirements

1. Create the file at `src/scripts/world_generator.gd`
2. Extends Node. Add `WorldGenerator` as autoload entry in `src/project.godot`
3. On _ready(), generate the world:

**Terrain (100x100 world):**
- Use OpenSimplexNoise (create NoiseTexture2D resource at `src/assets/world_noise.tres` with seed, octaves=4, period=60, persistence=0.5)
- Create a ground plane using ArrayMesh — generate a grid of vertices (e.g. 101x101 with 1.0 spacing) with Y from noise * 3.0
- The center area (crash zone, radius 15) should be a shallow depression: multiply height by (dist/15) where dist < 15
- Apply `res://assets/ground_material.tres` to the mesh
- Add it as a child of the world node with a StaticBody3D + CollisionShape3D (from the same trimesh)

**Biome Map:**
- Create a 2D dictionary mapping positions to biomes using a simple distance-from-center check:
  - dist < 15 → BIOME_CRASH (0) — toxic wasteland center
  - z > 20 → BIOME_COLD (1) — north frozen
  - x > 20 → BIOME_HEAT (2) — east volcanic
  - z < -20 → BIOME_GRAVITY (3) — south anomaly
  - x < -20 → BIOME_CRASH_ZONE (4) — west locked
  - else → BIOME_CRASH (0)
- Expose `get_biome_at(pos: Vector2) -> int` and `get_spawn_position(min_dist: float, max_dist: float) -> Vector3` (returns a random valid surface point at the given distance range)

**Resource Placement:**
- After terrain is generated, spawn resource nodes using `res://scenes/resource_node.tscn`:
  - iron: 35 nodes, scattered across all biomes
  - void_crystal: 18 nodes, weighted toward gravity biome
  - biomass: 18 nodes, weighted toward cold biome
  - energy_core: 6 nodes, near heat biome
- Use raycasting to find the terrain surface height at each random position
- Set resource_node.resource_type and amount (1-3) on each

**Base Pod:**
- Instance `res://scenes/base_pod.tscn` at Vector3(0, get_height_at(Vector2.ZERO) + 0.1, 0)
- Expose `base_position: Vector3` so other systems can use it

**Spores:**
- Place 12 spore VFX instances (`res://scenes/vfx_toxic_spores.tscn`) in crash zone radius 12 from center

## Key API methods to expose:
- `get_biome_at(world_pos: Vector2) -> int`
- `get_height_at(world_pos: Vector2) -> float`
- `get_spawn_position(min_dist: float, max_dist: float) -> Vector3`
- `base_position: Vector3` (set during generation)

## Files to create:
- `src/scripts/world_generator.gd`
- `src/assets/world_noise.tres`

## Files to modify:
- `src/project.godot` — add `WorldGenerator="*res://scripts/world_generator.gd"` to [autoload]

Use `git add` and process for git operations. Write readable, well-commented GDScript. Test that the script has no syntax errors.
