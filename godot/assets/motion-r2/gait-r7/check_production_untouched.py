from pathlib import Path
import json,hashlib
p=Path('godot/assets/motion-r2');snapshot=json.loads((p/'source/gait-r7-before/snapshot.json').read_text())
result=[]
for record in snapshot['files']:
 if record['backup'] not in ['c2-motion-r2.blend','c2-motion-r2.glb','clips.json']:continue
 actual=hashlib.sha256(Path(record['file']).read_bytes()).hexdigest()
 result.append({'file':record['file'],'baseline_sha256':record['sha256'],'current_sha256':actual,'unchanged':actual==record['sha256']})
(p/'gait-r7/production-untouched.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
assert all(r['unchanged'] for r in result),'Shared production changed externally; do not overwrite it'
