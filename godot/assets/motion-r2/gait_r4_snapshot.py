"""Preserve the reviewed previous release without touching product files."""
from pathlib import Path
import shutil,json,hashlib
p=Path('godot/assets/motion-r2');out=p/'source/gait-r4-before';out.mkdir(parents=True,exist_ok=True)
files=[p/'c2-motion-r2.glb',p/'source/c2-motion-r2.blend',p/'build.py',p/'combat.py',p/'hands_r3.py',p/'clips.json',Path('godot/scripts/native_motion_r2.gd')]
report={}
for f in files:
    dst=out/f.name
    if not dst.exists():shutil.copy2(f,dst)
    report[f.as_posix()]=hashlib.sha256(dst.read_bytes()).hexdigest()
(out/'snapshot.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
