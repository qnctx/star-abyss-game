from pathlib import Path
import json
p=Path(__file__).resolve().parent/'ground-edge05'
d=json.loads((p/'results.json').read_text(encoding='utf-8'))
def vec(s):return [float(x) for x in s.strip('()').split(',')]
rows=[r for r in d['rows'] if r['stage']=='ground-edge200']
pairs=[(a,b) for a,b in zip(rows,rows[1:]) if vec(a['position'])[2]>=200 and vec(b['position'])[2]<200]
result={'crossing_count':len(pairs),'crossings':[{'before':a,'after':b} for a,b in pairs],'reversed_steps':sum(vec(b['position'])[2]>vec(a['position'])[2]+.001 for a,b in zip(rows,rows[1:]))}
(p/'crossing.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
