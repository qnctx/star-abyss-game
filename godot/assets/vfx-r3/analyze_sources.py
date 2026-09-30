"""Check actual captured release/socket positions; no simulation or motion seeks."""
import json
import re
import math
from pathlib import Path
from collections import defaultdict
OUT=Path(__file__).resolve().parent/'evidence/full-world'
def vec(value):return [float(n) for n in re.findall(r'-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?',value)]
report=[]
folders=['capture-20260927-214156','capture-20260927-214517']
latest=OUT/'baseline/latest-run.txt'
if latest.is_file():folders.append('baseline/'+latest.read_text(encoding='utf-8').strip())
for folder in folders:
    data=json.loads((OUT/folder/'normal-time.json').read_text(encoding='utf-8'))
    cases=defaultdict(lambda:{'released':False,'impacted':False,'versions':set(),'release_source_error_m':None})
    for row in data['records']:
        state=cases[(row['realm'],row['view'])]
        for a in row['snapshot'].get('actions',[]):
            state['released']|=a['released'];state['impacted']|=a['impacted']
            state['versions'].add(a['resource_version'])
            if a['release_frame']==row['frame']:
                state['release_source_error_m']=math.dist(vec(a['release_source']),vec(row['socket']))
    for (tier,view),state in cases.items():
        state['versions']=sorted(state['versions'])
        report.append({'run':folder,'tier':tier,'view':view,**state,'impact_snapshot_note':'Observer retained visual through its real auto-free.' if folder.startswith('baseline/') else 'Historical observer used Ascension handle, which is cleared at impact; false does not imply missing impact. Main events retain authoritative impact.'})
(OUT/'release-source-summary.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
final=[r for r in report if r['run'].startswith('baseline/')]
print(json.dumps({'final_cases':len(final),'released':sum(r['released'] for r in final),'impacted':sum(r['impacted'] for r in final),'release_error_max_m':max((r['release_source_error_m'] or 0) for r in final)},indent=2))
