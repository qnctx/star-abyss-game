"""Preserve the currently imported ecology runtime before the topology upgrade."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'godot/assets/planet-ecology-r4'
OUT = ROOT / 'artifacts/ecology-damage-r4-compatibility/runtime-r4.1-before-subtrees.zip'
manifest = json.loads((ASSETS / 'manifest.json').read_text(encoding='utf8'))
files = {ASSETS / 'manifest.json', ASSETS / 'ecology_r4.gdshader'}
for asset in manifest['assets']:
    for key in [asset['id']] + [asset['id'] + '_' + part for part in asset['parts']]:
        for extension in ['.json', '.res']:
            files.add(ASSETS / (key + extension))
for name in ['native_environment_damage.gd', 'native_environment_damage_assets.gd', 'native_planet_ecology.gd']:
    files.add(ROOT / 'godot/scripts' / name)
if OUT.exists():
    raise RuntimeError('Compatibility archive already exists; refusing to replace it')
OUT.parent.mkdir(parents=True, exist_ok=True)
hashes = {}
with zipfile.ZipFile(OUT, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=1) as archive:
    for path in sorted(files):
        data = path.read_bytes()
        member = path.relative_to(ROOT).as_posix()
        hashes[member] = hashlib.sha256(data).hexdigest()
        archive.writestr(member, data)
    archive.writestr('runtime-sha256.json', json.dumps(hashes, indent=2))
with zipfile.ZipFile(OUT) as archive:
    assert archive.testzip() is None
print(json.dumps({'archive': str(OUT), 'files': len(files), 'bytes': OUT.stat().st_size}))
