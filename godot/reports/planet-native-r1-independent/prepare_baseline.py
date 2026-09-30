from pathlib import Path
import hashlib,json,datetime
here=Path(__file__).resolve().parent
root=here.parents[2]
out=here/'old-square-baseline'
(out/'source').mkdir(parents=True,exist_ok=True)
manifest={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sources':{}}
for rel in ['godot/scripts/native_world.gd','godot/scripts/native_player.gd','godot/scripts/native_main.gd','godot/scenes/main.tscn']:
    src=root/rel
    raw=src.read_bytes()
    dest=out/'source'/src.name
    if dest.exists():raise RuntimeError('Baseline already exists; do not overwrite')
    dest.write_bytes(raw)
    manifest['sources'][rel]=hashlib.sha256(raw).hexdigest()
(out/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
runner=(root/'godot/reports/gait-r4-independent/run_capture.py').read_text(encoding='utf-8')
runner=runner.replace('gait-r4-independent/live_capture.gd','planet-native-r1-independent/baseline.gd').replace("else 'baseline'","else 'old-square-baseline'")
(here/'run_baseline.py').write_text(runner,encoding='utf-8')
print(json.dumps(manifest,indent=2))
