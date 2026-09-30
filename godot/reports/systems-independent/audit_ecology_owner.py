import hashlib, json
from pathlib import Path
root=Path(__file__).resolve().parents[3]
reports=root/'godot/reports/ecology-damage-r4'
manifest=json.loads((root/'godot/assets/planet-ecology-r4/manifest.json').read_text(encoding='utf-8-sig'))
frozen=json.loads((reports/'r42-frozen-core-hashes.json').read_text(encoding='utf-8-sig'))
out={'frozen_count':len(frozen['files']), 'current_mismatches':[p for p,h in frozen['files'].items() if hashlib.sha256((root/p).read_bytes()).hexdigest()!=h],
 'reference_mismatches':[p for p,h in manifest['references'].items() if hashlib.sha256((root/'docs/art/ecology-damage-r4'/p).read_bytes()).hexdigest()!=h], 'evidence':{}}
for name in ['visual-test-results.json','independent-services-r42-contact-final.json','r42-frozen-core-hashes.json']:
 p=reports/name
 out['evidence'][name]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'data':json.loads(p.read_text(encoding='utf-8-sig'))}
Path(__file__).with_name('ECOLOGY-OWNER-CPU-AUDIT.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in out.items() if k!='evidence'},indent=2))
