from pathlib import Path
import hashlib, json, shutil

root = Path(__file__).resolve().parents[3]
out = root / 'artifacts/terrain-r3-material-baseline'
paths = [
    'godot/scripts/native_planet.gd', 'godot/scripts/native_world.gd',
    'godot/scripts/native_planet_bake.gd',
    'godot/assets/terrain/basalt-albedo.png.import',
    'godot/assets/terrain/basin_near_surface.gdshader',
    'godot/assets/terrain/far_basin.gdshader',
    'godot/assets/terrain/planet_surface.gdshader',
    'godot/assets/terrain/planet_water.gdshader',
]
paths += [str(p.relative_to(root)).replace('\\', '/') for p in (root/'godot/assets/terrain').glob('planet-far-*.res')]
manifest = {}
for name in paths:
    source, target = root / name, out / name
    if not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    manifest[name] = hashlib.sha256(target.read_bytes()).hexdigest()
(out/'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(f'Saved {len(manifest)} material/renderer baseline files under {out}')
