from pathlib import Path
import json
p=Path(__file__).resolve().parent/'segments01'
d=json.loads((p/'results.json').read_text(encoding='utf-8'))
out={'utc':d['utc'],'hashes':d['hashes'],'changed':d['changed'],'rows':[]}
for r in d['rows']:
    out['rows'].append({'name':r['fixture']['name'],'field':r['field'],'ray':r['ray'],'first':r['fall'][0],'last':r['fall'][-1],'wall':r['wall'],'up_dot':r['final_up_dot']})
(p/'summary.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print(json.dumps(out,indent=2))
