from pathlib import Path
import json
import statistics

ROOT = Path(__file__).resolve().parents[1] / 'reports/terrain-r3-independent'
def timing(values):
    a = sorted(values)
    return {'samples': len(a), 'fps_mean': round(1000/statistics.mean(a), 2),
            'median_ms': round(statistics.median(a), 3), 'p95_ms': round(a[int((len(a)-1)*.95)], 3),
            'p99_ms': round(a[int((len(a)-1)*.99)], 3), 'max_ms': round(max(a), 3),
            'over50ms': sum(x>50 for x in a)} if a else {}
summary = []
for run in sorted(ROOT.iterdir()):
    if not run.is_dir() or not (run/'run.json').exists(): continue
    meta = json.loads((run/'run.json').read_text(encoding='utf-8'))
    if '--frozen' not in meta.get('argv', []): continue
    record = {'run': run.name, 'argv': meta['argv']}
    if (run/'integrity.json').exists(): record['integrity'] = json.loads((run/'integrity.json').read_text())
    if (run/'observations.json').exists():
        obs = json.loads((run/'observations.json').read_text(encoding='utf-8'))
        record['checks'] = len(obs['checks'])
        record['failures'] = [c for c in obs['checks'] if not c['pass']]
        record['views'] = [{'label': x['label'], 'timing':timing(x.get('render_intervals_ms', [])),
                'camera_near':x.get('camera_near'), 'triangles':x.get('triangles'), 'draw_calls':x.get('draw_calls')}
                for x in obs['observations'] if 'label' in x]
    if (run/'product-flight.json').exists():
        data=json.loads((run/'product-flight.json').read_text())
        record['flight']={k:data[k] for k in ('total','passed','failures','timing','milestones')}
        record['render_timing']=timing(data.get('render_intervals_ms',[]))
    log=(run/'godot.log').read_text(encoding='utf-8') if (run/'godot.log').exists() else ''
    record['errors']=[line for line in log.splitlines() if any(s in line for s in ('ERROR:', 'SCRIPT ERROR', 'Parse Error','SHADER ERROR'))]
    summary.append(record)
(ROOT/'FROZEN-SUMMARY.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
for row in summary:
    print(row['run'], 'errors', len(row['errors']))
    for view in row.get('views',[]): print(view['label'],view['timing'])
    if 'flight' in row: print('flight',row['flight']['passed'],row['flight']['total'],row['render_timing'])
