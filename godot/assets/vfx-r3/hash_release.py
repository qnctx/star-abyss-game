"""Freeze delivered source/resource identities for independent visual checks."""
import hashlib
import json
from pathlib import Path
OUT=Path(__file__).resolve().parent
GODOT=OUT.parents[1]
paths=[GODOT/'scripts/native_vfx_r3.gd',OUT/'qi_ribbon.gdshader',OUT/'build.py',OUT/'reference-r2.png']
paths+=sorted(OUT.glob('qi-*-r3.glb'))
paths+=sorted((OUT/'source').glob('*.blend'))
entries={str(p.relative_to(GODOT)).replace('\\','/'):{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in paths}
bundle=hashlib.sha256(json.dumps(entries,sort_keys=True,separators=(',',':')).encode()).hexdigest()
report={'bundle_sha256':bundle,'resource_version':'r3-existing-reference','files':entries}
(OUT/'release-sha256.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('bundle_sha256='+bundle)
print('native_vfx_r3.gd='+entries['scripts/native_vfx_r3.gd']['sha256'])
print('qi_ribbon.gdshader='+entries['assets/vfx-r3/qi_ribbon.gdshader']['sha256'])
