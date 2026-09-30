from pathlib import Path
import json
data=json.loads(Path('godot/assets/motion-r2/gait-r6/authoring-report.json').read_text())
for name,rows in data['samples'].items():
 for r in rows:
  if r['max_ik_clamp_m']>.0001:print(name,r['phase'],r['max_ik_clamp_m'],{s:{k:d[k] for k in ['phase','initial_clamp_m','hip','ankle','clearance']} for s,d in r['sides'].items()})
