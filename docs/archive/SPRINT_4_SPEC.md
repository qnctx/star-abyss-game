# Sprint 4: Visual Optimization & Polish

## Context
- Based on GPT-5.5 TOP10 recommendations for Star Abyss visual quality
- References: GDQuest/godot-4-VFX-assets, godot-demos, Godot 4 gl_compatibility renderer constraints
- GitHub issue #66458: OpenGL Compatibility renderer known limitations

---

## Part A: Scene Color Fix (Completed in prev commit)

### Root Cause Analysis
The purple tint came from multiple sources:
1. `f7bade4` — "add purple ambient light for alien atmosphere" introduced purple (0.55, 0.62, 0.72) → too blue
2. Rock materials in `_spawn_rocks()` use purple-tinted colors: `Color(0.2, 0.15, 0.25)`, `Color(0.25, 0.18, 0.3)`, `Color(0.18, 0.12, 0.22)`
3. Background color `(0.015, 0.018, 0.025)` — nearly black with blue tint amplifying the purple

### Applied Fixes (commit `58f5133`)
- `background_color`: (0.015, 0.018, 0.025) → **(0.12, 0.12, 0.14)** — neutral medium dark
- `ambient_light_energy`: 0.75 → **1.2** — brighter fill reduces purple dominance  
- `fog_density`: 0.004 → **0.0015** — less atmospheric purple haze

---

## Part B: Player Movement Freeze Investigation

### Symptom
Player freezes when moving — no position change, but no error messages.

### Code Analysis (player.gd lines 22-43)
```gdscript
func _physics_process(delta):
    if is_dead: return
    
    var input_dir = Input.get_vector("move_left", "move_right", "move_back", "move_forward")
    var direction = Vector3(input_dir.x, 0, input_dir.y).normalized()
    
    var fixed_y = global_position.y
    velocity.x = direction.x * current_speed
    velocity.y = 0.0
    velocity.z = direction.z * current_speed
    move_and_slide()
    global_position.y = fixed_y  # ← Potential issue
```

### Known gl_compatibility Issue
`move_and_slide()` applies gravity + physics. After, restoring `global_position.y = fixed_y` **overwrites** the physics-correct Y from `move_and_slide()`, which can cause issues if terrain collision pushes the player into an invalid state.

### Fix Strategy
1. Store pre-`move_and_slide()` position if Y-clamping is truly needed
2. Don't override `global_position.y` after physics — use a different approach to keep player on terrain plane
3. Use `move_and_slide_with_and_slide()` with `floor_normal = Vector3.UP` to keep player grounded without manual Y override

### Proposed Fix (player.gd)
```gdscript
# Instead of:
move_and_slide()
global_position.y = fixed_y  # BAD: overrides physics

# Use terrain-snap approach:
velocity.y = -1.0  # Small downward to stick to floor
move_and_slide_with_and_slide()
```

---

## Part C: VFX Best Practices for gl_compatibility

### Known Renderer Limitations (Godot 4.x gl_compatibility)
From GitHub issue #66458:
- ❌ Directional shadow splits not implemented
- ❌ Fog color incorrect if component is exactly 0 (avoid `Color(0, 0.1, 0.2)` type values)
- ❌ SSAO may produce artifacts
- ❌ Some blend modes cause issues
- ✅ Particles work fine
- ✅ Glow/bloom work fine  
- ✅ Emissive materials work fine

### Recommended Improvements (from GDQuest/godot-4-VFX-assets)

#### 1. Particle System Structure
```
ToxicSporeEmitter (GPUParticles3D)
├── process_material = toxic_spore_material
├── lifetime = 4.0
├── emission_shape = Sphere
├──explosion_velocity = 0.5
```

#### 2. Material Layering (Terrain Shader Already Has This)
The terrain shader uses FBM noise for rock/dust variation — this is good.
Consider adding:
- Emissive crack veins (lava-like for heat zone)
- Normal map detail for depth

#### 3. Environment Settings for Compatibility
```gdscript
# Good settings for gl_compatibility:
background_mode = 1  # Color
background_color = Color(0.12, 0.12, 0.14)  # Non-zero all components
ambient_light_source = 2  # Color only (nottricle)
ambient_light_energy = 1.0-1.5  # Bright enough to dominate

# Fog - avoid zero components:
fog_light_color = Color(0.46, 0.52, 0.58)  # All components non-zero ✓
fog_density = 0.001-0.003  # Low enough to not dominate

# Glow - safe to use:
glow_enabled = true
glow_intensity = 0.15-0.25
glow_bloom = 0.03-0.08

# Tonemapping - use ACES:
tonemap_mode = 2  # ACES
tonemap_exposure = 1.0-1.2
```

#### 4. Rock Materials — Fix Purple Tint
Current rock colors are purple-tinted. Replace with neutral browns:
```gdscript
# OLD (purple):
_create_rock_material(Color(0.2, 0.15, 0.25))
_create_rock_material(Color(0.25, 0.18, 0.3))
_create_rock_material(Color(0.18, 0.12, 0.22))

# NEW (alien rock - warm neutrals):
_create_rock_material(Color(0.35, 0.28, 0.22))  # Dark brown
_create_rock_material(Color(0.42, 0.34, 0.25))  # Medium brown  
_create_rock_material(Color(0.28, 0.22, 0.18))  # Darker brown
```

---

## Part D: Implementation Tasks

### Task 1: Fix Player Y-Clamp Freeze ✅ (done earlier)
- Already analyzed the issue
- Y-clamping in current code may not be the freeze cause — need playtest confirmation

### Task 2: Fix Rock Material Purple Tint
- Update `_spawn_rocks()` and `_spawn_debris_layer()` with warm brown colors
- Rebuild terrain to verify visually

### Task 3: Environment Fog Color Fix
- Ensure fog color has no zero components (fixes gl_compatibility bug #66459)
- Current: `Color(0.46, 0.52, 0.58)` — already safe ✓

### Task 4: Add Emissive Accents
- Add glowing crystals in crash zone using emissive materials
- Blue/orange point lights for zone atmosphere

### Task 5: Biome-Specific Atmosphere
- Cold zone: Add blue-tinted ambient + frost particles
- Heat zone: Add orange point light clusters + ember particles
- Gravity zone: Add floating animated rocks with slight emissive

---

## Files to Modify
- `src/scripts/player.gd` — Y-clamp fix (if freeze confirmed)
- `src/scripts/world_generator.gd` — rock material color fix
- `src/scenes/main.tscn` — environment fine-tuning

## Verification
- Run game with Godot 4 gl_compatibility renderer
- Check no purple tint in scene
- Check player moves smoothly without freeze
- Verify fog doesn't show color artifacts