import json,math,sys
from pathlib import Path
p=Path(__file__).resolve().parent/sys.argv[1]
d=json.loads((p/'capture.json').read_text(encoding='utf-8'))
def vec(s):return [float(x) for x in s.strip('()').split(',')]
out={}
for phase in ['walk','jog','sprint']:
    rows=[r for r in d['rows'] if r['phase']==phase]
    values={k:[] for k in ['thigh_forward_deg','ankle_height','knee_height','pelvis_height','speed']}
    for r in rows:
        root=vec(r['position']); b={k:vec(v) for k,v in r['bones'].items()}
        values['pelvis_height'].append(b['pelvis'][1]-root[1])
        v=vec(r['velocity']);values['speed'].append(math.hypot(v[0],v[2]))
        for side in ['L','R']:
            h,k,a=[b[x+side] for x in ['hip','knee','ankle']]
            values['thigh_forward_deg'].append(math.degrees(math.atan2(h[2]-k[2],h[1]-k[1])))
            values['ankle_height'].append(a[1]-root[1]);values['knee_height'].append(k[1]-root[1])
    out[phase]={k:{'min':min(v),'max':max(v),'range':max(v)-min(v)} for k,v in values.items()}
out['input_mismatch_rows']=[{'frame':r['frame'],'phase':r['phase'],'requested':r['requested_keys'],'observed':r['observed_keys']} for r in d['rows'] if r['requested_keys']!=r['observed_keys']]
(p/'trajectory-summary.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print(json.dumps(out,indent=2))
