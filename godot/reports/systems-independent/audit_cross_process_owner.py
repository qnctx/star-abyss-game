import json, hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[2]
r=root/'reports/martial-r4'
out={}
for name in ['environment-runtime.json','cross-process-reload-verification.json','cross-process-fixture.json']:
 p=r/name; d=json.loads(p.read_text(encoding='utf-8-sig'))
 out[name]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'keys':list(d),
 'data':{k:v for k,v in d.items() if k not in ['frame_states','environment_events','expected_state','state','expected_rock_state']}}
manifests=[]
for phase in ['producer','consumer']:
 p=r/f'persistence-{phase}-r42-dependency-hashes.json'; d=json.loads(p.read_text(encoding='utf-8-sig'))
 manifests.append(d)
 out[phase+'_dependencies']={'keys':list(d),'count_before':len(d.get('before',{})),'count_after':len(d.get('after',{})), 'equal':d.get('before')==d.get('after'), 'reported_changed':d.get('changed'),
 'current_mismatches':[k for k,h in d.get('after',{}).items() if not (root/k).exists() or hashlib.sha256((root/k).read_bytes()).hexdigest()!=h]}
out['producer_consumer_dependencies_equal']=manifests[0].get('after')==manifests[1].get('before')
Path(__file__).with_name('CROSS-PROCESS-OWNER-CPU-AUDIT.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
for k,v in out.items():
 if isinstance(v,dict) and 'data' in v:
  d=v['data']; print(k, json.dumps({a:b for a,b in d.items() if a not in ['checks','deformations','cooldown','landing_events']},ensure_ascii=True));print('checks',len(d.get('checks',[])))
 else: print(k,json.dumps(v))
