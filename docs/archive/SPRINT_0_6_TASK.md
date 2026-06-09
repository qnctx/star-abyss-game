# Sprint 0.6: Visual Overhaul — Low-Poly Sci-Fi Art

## CONTEXT
Godot 4.6 project at `/Users/qnctx/projects/star-abyss-game/src/`. Current visuals are all grey/colored primitives. Replace everything with low-poly sci-fi art using Godot's built-in CSG nodes and materials. NO external models needed.

## RULES
- Use CSG nodes (CSGBox3D, CSGCylinder3D, CSGSphere3D, CSGCombiner3D) for ALL models
- Use StandardMaterial3D with albedo_color, roughness, metallic for materials
- NO Blender, NO external .glb files
- Keep poly count low (<500 tris per object)
- All new files in src/scenes/ and src/assets/

---

## STEP 1: Ground — Alien Rock Surface

Replace the flat grey plane with a textured alien surface:

Create `src/assets/ground_material.tres`:
- StandardMaterial3D
- albedo_color: dark charcoal (#1a1a1a)
- roughness: 0.9
- Add noise texture for variation (use Godot's built-in NoiseTexture2D)
- Create `src/assets/ground_noise.tres`:
  - NoiseTexture2D with FastNoiseLite
  - noise type: Simplex, frequency 0.05
  - Color ramp: dark grey → dark purple
- Apply noise as albedo_texture
- Add normal map variation

Update main.tscn ground:
- Replace MeshInstance3D plane with CSGBox3D (20, 0.3, 20) at y=-0.15
- Apply ground_material.tres
- Add scattered small CSGSphere3D rocks around (5-10 small dark rocks)
- Add a few glowing crystal clusters (small CSGBox3D with emissive purple material)

---

## STEP 2: Player — Astronaut

Replace blue cylinder with a proper astronaut model:

Create `src/scenes/player_model.tscn` as a CSGCombiner3D:
- **Helmet**: CSGSphere3D (radius 0.35) + visor CSGBox3D (0.3, 0.15, 0.05), visor=cyan emissive
- **Body**: CSGCylinder3D (r=0.25, h=0.8), white-grey (#cccccc)
- **Backpack**: CSGBox3D (0.3, 0.5, 0.2) behind body, dark grey with orange accent stripe
- **Arms**: CSGCylinder3D (r=0.08, h=0.5) ×2, white
- **Legs**: CSGCylinder3D (r=0.1, h=0.4) ×2, dark grey
- **Boots**: CSGBox3D (0.15, 0.12, 0.2) ×2, dark grey

Update main.tscn Player node to instance `player_model.tscn` as child.

Add a subtle O₂ tank glow on the backpack (emissive blue material).

---

## STEP 3: Enemy — Alien Bug

Create `src/scenes/enemy_bug.tscn`:
- **Body**: CSGSphere3D (r=0.4) stretched on Z, dark red-brown (#4a1a1a), metallic 0.3
- **Legs**: 6x CSGCylinder3D (r=0.05, h=0.4), angled outward, dark brown (#2a1010)
- **Eyes**: 2x CSGSphere3D (r=0.1), emissive red (#ff0000, energy 0.5)
- **Mandibles**: 2x CSGCylinder3D (r=0.03, h=0.25) pointing forward, bone color
- **Spikes**: 3x CSGCylinder3D (r=0.04, h=0.15) on back

Update enemy.tscn to instance enemy_bug.tscn as child instead of the red box.

---

## STEP 4: Turret — Sci-Fi Defense Cannon

Create `src/scenes/turret_model.tscn`:
- **Base**: CSGCylinder3D (r=0.4, h=0.3), dark metal (#333340), metallic 0.8
- **Pedestal**: CSGCylinder3D (r=0.2, h=0.5), same material
- **Barrel**: CSGCylinder3D (r=0.08, h=1.2) rotated horizontal, gunmetal (#555566)
- **Barrel tip**: CSGCylinder3D (r=0.1, h=0.15), emissive orange glow (#ff6600)
- **Side panels**: 2x CSGBox3D (0.1, 0.3, 0.5), dark grey
- Add a small rotating radar dish on top: CSGCylinder3D (r=0.15, h=0.05) + CSGBox3D (0.02, 0.25, 0.02), metallic

Update turret.tscn to instance turret_model.tscn as child.

---

## STEP 5: Projectile — Energy Bolt

Create `src/scenes/projectile_bolt.tscn`:
- **Core**: CSGSphere3D (r=0.12), emissive yellow (#ffdd00, energy 1.5)
- **Trail**: CSGCylinder3D (r=0.06, h=0.5), emissive orange (#ff8800, energy 0.8), positioned behind core
- Make the whole thing spin (rotate on Z axis)

Also create `src/assets/bolt_material.tres` with emissive yellow, no roughness.

Add GPUParticles3D to projectile:
- Emit small glowing dots in trail
- Lifetime 0.3s, 20 particles/sec
- Color: yellow → orange → transparent

Update projectile.tscn to instance projectile_bolt.tscn as child.

---

## STEP 6: VFX — Particle Effects

Create `src/scenes/vfx_muzzle_flash.tscn`:
- GPUParticles3D, one-shot (explosiveness=1, amount=8)
- Small yellow/orange spheres, lifetime 0.15s
- Spread in cone, speed 5-10

Create `src/scenes/vfx_explosion.tscn`:
- GPUParticles3D, one-shot (amount=15)
- Orange/red spheres, lifetime 0.4s
- Spread 360°, speed 3-8
- Scale over lifetime: grow then shrink

Create `src/scenes/vfx_toxic_spores.tscn` (ambient, always on):
- GPUParticles3D, continuous emission
- Small purple/green spheres, lifetime 2-4s
- Slow floating upward motion
- Add to main scene at 10 different positions
- Spawn radius: 15

Add muzzle flash to turret.gd fire function:
```gdscript
var flash = load("res://scenes/vfx_muzzle_flash.tscn").instantiate()
flash.global_position = global_position + Vector3(0, 0.5, 0) + (-global_transform.basis.z * 1.0)
get_tree().current_scene.add_child(flash)
```

Add explosion to enemy.gd die function:
```gdscript
var explosion = load("res://scenes/vfx_explosion.tscn").instantiate()
explosion.global_position = global_position
get_tree().current_scene.add_child(explosion)
```

---

## STEP 7: Lighting & Atmosphere

Update main.tscn:
- Add 2-3 point lights around the base with subtle colored glow (one warm white at base, one blue at turret area)
- Add WorldEnvironment glow intensity: 0.5 (increase from 0.3)
- Add bloom to emissive materials
- Fog color: slightly more purple (#3d1b5e)
- Background sky: add a few star-like particle dots (or change background to very dark)

---

## STEP 8: Base Marker — Escape Pod

Replace green cube with a crashed escape pod:

Create `src/scenes/base_pod.tscn`:
- **Main body**: CSGCylinder3D (r=0.8, h=1.5) tilted slightly, white/light grey
- **Nose cone**: CSGSphere3D (r=0.8) cut to half, dark grey
- **Door/hatch**: CSGBox3D (0.3, 0.6, 0.05) slightly open, with orange border emissive
- **Damage marks**: small CSG cylinders scattered, dark scorch marks
- **Flickering light**: PointLight3D child, orange, slight random intensity

Update main.tscn BasePosition to instance base_pod.tscn instead of green cube.

---

## VERIFICATION
After creating all files:
1. Check main.tscn for broken resource paths
2. Verify all CSG nodes have collision enabled where needed
3. Confirm particle systems have reasonable emission rates
4. Make sure materials have proper metallic/roughness for PBR lighting

## OUTPUT
List all created files and confirm the scene is visually ready.
