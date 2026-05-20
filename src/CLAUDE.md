# 星渊迷航 (Star Abyss Voyage) — Project Context

## Game Overview
Top-down 2.5D survival roguelike with tower defense. Toxic planet, oxygen is life, build base, defend at night, escape.

## Engine
- **Godot 4.x** (MIT open source)
- **GDScript only** — Claude writes GDScript fast, it's Python-like
- No C#, No C++, No plugins unless absolutely necessary

## Project Structure (to be created)
```
src/                           # Godot project root
├── project.godot
├── scenes/
│   ├── main.tscn              # Main game scene
│   └── ui/
├── scripts/
│   ├── player.gd              # Player controller
│   ├── oxygen.gd              # O₂ system
│   ├── enemy.gd               # Enemy AI base
│   └── turret.gd              # Turret logic
├── assets/
│   ├── models/                # .blend → .glb
│   ├── textures/
│   └── sounds/
└── resources/                 # Godot .tres files
```

## Architecture Rules
- Each system is a separate GDScript file with clear signals
- Use Godot's built-in nodes (CharacterBody2D, Area2D, TileMap) — no custom engines
- O₂ is managed by a global Autoload singleton
- Game state uses a GameManager Autoload
- UI uses Control nodes with signals

## Art Style
- Low-poly 2.5D (3D world, top-down camera)
- Dark sci-fi with bioluminescent accents
- Toxic fog via WorldEnvironment volume fog
- Placeholder art: colored cubes/spheres until real models

## Key Systems (MVP)
1. **Player**: CharacterBody2D, WASD move, mouse aim, can interact
2. **Oxygen**: Countdown timer, UI bar, drain rate varies by activity, death at 0
3. **Base Building**: Grid placement, snap to ground, material cost check
4. **Turrets**: Auto-target nearest enemy, fire projectile, limited range
5. **Enemies**: Pathfind to base, attack on contact, die when HP=0
6. **Day/Night**: Timer-based cycle, enemy waves at night

## Commands
- Run game: `cd src && godot`
- Run editor: `cd src && godot --editor`
- Test: Run the game and press F5 (Godot's built-in play)

## Style
- Snake_case for GDScript variables and functions
- PascalCase for class names
- Signals: `signal_name`
- Comment in English, UI text in Chinese
