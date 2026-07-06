# Star Abyss HTML5 Prototype

A browser-playable HTML5 prototype of **Star Abyss Voyage** (星渊迷航), a top-down survival tower defense game.

## Quick Start

1. Open `playable/star-abyss.html` in any modern browser (Chrome, Firefox, Safari, Edge)
2. Press **SPACE** to start
3. Defend your base pod through waves of night enemies!

## Controls

| Input | Action |
|-------|--------|
| WASD / Arrow Keys | Move player |
| Mouse | Aim direction |
| Left Click | Shoot |
| Shift (hold) | Sprint (drains O2 faster) |
| 1 / 2 / 3 | Select turret type |
| E + Left Click | Place selected turret |
| R | Restart (on Game Over screen) |

## Core Mechanics

### Oxygen System
- Player starts with 180 seconds of O2
- Normal drain: 1/sec, Sprint drain: +2.5/sec
- At 0 O2, player dies and respawns at base with a 60-second O2 penalty
- Displayed as a blue bar in the top-left HUD

### Day/Night Cycle
- **Day**: 45 seconds — enemies do not spawn, safe to gather resources
- **Night**: 25 seconds — enemies spawn and attack in waves
- Smooth visual transition with darkening sky and visible stars at night
- Fog patches drift across the map with purple/green hues

### Enemy Waves
- Night spawns enemies that pathfind toward the base pod
- Wave count increases each night cycle (Wave 1: 7 enemies, Wave 2: 9, etc.)
- Enemies are red hexagons with pulsing glow
- Size and speed scale slightly with wave number
- Enemies deal 10 damage on contact with the base (and die on impact)

### Turret Defense
Three turret types, selected with 1/2/3 and placed with E+Click:

| Type | Cost | Fire Rate | Damage | Range | Special |
|------|------|-----------|--------|-------|---------|
| Machine Gun | 10 iron | 0.1s | 3 | 250 | Fast, cheap |
| Laser | 25 iron | 0.6s | 30 | 350 | High single-target |
| Missile | 50 iron | 1.2s | 20 | 300 | AoE splash (60 radius) |

- Turrets auto-target the nearest enemy in range
- Barrel visually tracks the current target
- Must be placed within 350px of the base

### Resources
- Enemies drop **iron** (yellow) and **energy** (blue) on death
- Walk over to collect — iron is used for turrets
- Resources despawn after 30 seconds

### Base Pod
- Green glowing square at map center, 100 HP
- Enemies deal 10 damage per contact
- At 0 HP: Game Over

## Architecture

### Game Loop
- `requestAnimationFrame`-based at ~60fps
- Fixed timestep with `dt` capping at 50ms to prevent spiral-of-death on tab switch
- Separate `update(dt)` and `draw()` phases

### Entity System
Entities are plain JavaScript objects stored in arrays:

| Array | Contents |
|-------|----------|
| `game.enemies` | Enemy objects with position, hp, speed, size, pulse phase |
| `game.bullets` | Projectile objects with velocity, damage, range, owner |
| `game.turrets` | Turret objects with type, position, fire timer, target angle |
| `game.resources_drops` | Dropped resource items with position, type, bob animation |
| `particles` | Visual-only particle effects |
| `floatingTexts` | Damage/value numbers that float up and fade |

### Collision Detection
- Circle-vs-circle distance checks (`Math.hypot`)
- No spatial partitioning — acceptable for prototype scale (<100 entities)
- Collision radii: player (12px), enemies (variable), projectiles (2-4px), resources (20px pickup)

### Rendering
- Single Canvas 2D context
- All graphics procedurally drawn (no sprites/images)
- Layered rendering: background → fog → resources → base → turrets → enemies → player → bullets → particles → HUD
- Screen shake via `ctx.translate()` on damage events

### State Management
- Single `game` object holds all mutable state
- `game.state`: `'title'` | `'playing'` | `'over'`
- `resetGameState()` for clean restarts

## What's Implemented vs Simplified

### Fully Implemented
- Player movement with sprint
- Oxygen drain and death/respawn cycle
- Day/night cycle with visual transitions
- Enemy spawning, pathfinding, and base/player damage
- Three turret types with auto-targeting and projectiles
- Resource drops and collection
- Base HP and game over condition
- Start screen, game over screen, HUD
- Particle effects and screen shake
- Wave scaling

### Simplified from Full GDD
- **Map**: Single screen, no procedural generation or chunking
- **Player weapons**: Single weapon type (no unlocks/upgrades)
- **Turret placement**: E+Click (no drag-and-drop grid system)
- **Enemy AI**: Simple "move toward target" pathfinding (no obstacle avoidance)
- **No items/upgrades**: No collectible power-ups or skill tree
- **No multiplayer**: Single-player only
- **No save/load**: Session-only gameplay
- **Art**: All procedural — no hand-crafted sprites

## Mapping to Godot Version

| HTML5 Prototype | Godot Equivalent |
|-----------------|------------------|
| Canvas 2D + requestAnimationFrame | Node2D + `_process(delta)` |
| `game.enemies[]` array | Enemy scene instances in a group |
| `ctx.fillRect()` / `ctx.arc()` | `Polygon2D` / `Sprite2D` with shaders |
| Keyboard input via `keys{}` | `Input.is_action_pressed()` |
| Circle collision via `dist()` | `Area2D` with `CollisionShape2D` |
| `drawHUD()` overlay | `CanvasLayer` with `Control` nodes |
| Particle arrays | `GPUParticles2D` |
| Screen shake via translate | `Camera2D` offset |

The HTML5 prototype validates core mechanics and pacing before committing to Godot scene/resource architecture.

## Known Limitations

1. **No obstacle avoidance** — enemies walk in straight lines toward targets
2. **No save system** — progress lost on refresh
3. **Single screen map** — no camera scrolling or world generation
4. **Fixed difficulty curve** — wave scaling is linear, no boss waves
5. **No audio** — purely visual feedback
6. **No mobile support** — keyboard/mouse only
7. **Turret placement** is somewhat finicky — must hold E while clicking
8. **Performance** — no spatial partitioning; could lag with 100+ entities

## Future Improvements

- Add procedural terrain with obstacles
- Implement A* pathfinding for enemies
- Add player weapon upgrades and turret upgrades
- Camera system with map larger than screen
- Audio: ambient music, SFX for shooting, damage, wave start
- Mobile touch controls
- Save/load via localStorage
- Boss enemies at wave milestones
- Resource types with different crafting uses
