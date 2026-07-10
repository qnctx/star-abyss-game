# 星渊迷航 (Star Abyss Voyage) — Project Context

## Game Overview
3D survival game with first-person controls and tower-defense systems. Toxic planet, oxygen is life, build a base, defend at night, and escape.

## Engine
- **Godot 4.x** (MIT open source)
- **GDScript only** — Claude writes GDScript fast, it's Python-like
- No C#, No C++, No plugins unless absolutely necessary

## Project Structure
```
src/                           # Godot project root
├── project.godot
├── scenes/
│   ├── main.tscn              # Main game scene
│   └── ui/
├── scripts/
│   ├── player.gd              # Player movement and O₂ state
│   ├── game_manager.gd        # Day/night and combat state
│   ├── enemy.gd               # Enemy AI base
│   └── turret.gd              # Turret logic
├── assets/                    # Godot resources and generated assets
├── test_runner.gd             # Integrated headless tests
└── test_standalone.gd         # Standalone logic tests
```

## Architecture Rules
- Each system is a separate GDScript file with clear signals
- Use Godot's built-in 3D nodes (`CharacterBody3D`, `Area3D`, `Node3D`) — no custom engines
- Player O₂ state lives in `player.gd`; cross-system state uses focused autoloads
- Game state uses a GameManager Autoload
- UI uses Control nodes with signals

## Art Style
- Low-poly 3D world with first-person aiming
- Dark sci-fi with bioluminescent accents
- Toxic fog via WorldEnvironment volume fog
- Placeholder art: colored cubes/spheres until real models

## Key Systems (MVP)
1. **Player**: `CharacterBody3D`, WASD movement, mouse yaw/pitch, interaction and O₂ state
2. **Oxygen**: Countdown timer, UI bar, drain rate varies by activity, death at 0
3. **Base Building**: Grid placement, snap to ground, material cost check
4. **Turrets**: Auto-target nearest enemy, fire projectile, limited range
5. **Enemies**: Pathfind to base, attack on contact, die when HP=0
6. **Day/Night**: Timer-based cycle, enemy waves at night

## Commands
- Run game: `cd src && godot`
- Run editor: `cd src && godot --editor`
- Integrated tests: `cd src && godot --headless --script test_runner.gd`
- Logic tests: `cd src && godot --headless --script test_standalone.gd`
- Manual test: Run the game with F5 and follow `docs/TEST_PLAN.md`

## Style
- Snake_case for GDScript variables and functions
- PascalCase for class names
- Signals: `signal_name`
- Comment in English, UI text in Chinese
