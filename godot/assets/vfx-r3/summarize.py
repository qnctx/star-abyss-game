"""Summarize captured actual physics/render observations without editing images."""
import json
import sys
from pathlib import Path
from collections import defaultdict
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'evidence'
if '--main' in sys.argv:OUT=OUT/'full-world'
if '--no-png' in sys.argv:OUT=OUT/'baseline'
if (OUT/'latest-run.txt').is_file():OUT=OUT/(OUT/'latest-run.txt').read_text(encoding='utf-8').strip()
data=json.loads((OUT/'normal-time.json').read_text(encoding='utf-8'))
groups=defaultdict(list)
for row in data['records']:groups[(row.get('tier',row.get('realm')),row['view'])].append(row)
report=[]
for key,rows in groups.items():
    deltas=[r['delta'] for r in rows]
    report.append({'tier':key[0],'view':key[1],'samples':len(rows),'delta_min':min(deltas),'delta_max':max(deltas),'physics_elapsed':sum(deltas),'wall_elapsed':(rows[-1].get('wall_usec',0)-rows[0].get('wall_usec',0))/1e6,'resource_versions':sorted(set(a['resource_version'] for r in rows for a in r['snapshot'].get('actions',[]))),'draw_calls_scene_max':max(r.get('draw_calls_scene',0) for r in rows),'primitives_scene_max':max(r.get('primitives_scene',0) for r in rows)})
    if 'render_frame' in rows[0]:report[-1]['render_fps_observed']=(rows[-1]['render_frame']-rows[0]['render_frame'])/max(.001,report[-1]['wall_elapsed'])
(OUT/'summary.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
if (OUT/'capture-inputs.json').is_file():
    inputs=json.loads((OUT/'capture-inputs.json').read_text(encoding='utf-8'))
    print('INPUT_CHANGES='+json.dumps([p for p in inputs['before'] if inputs['before'][p]!=inputs['after'].get(p)],ensure_ascii=False))
