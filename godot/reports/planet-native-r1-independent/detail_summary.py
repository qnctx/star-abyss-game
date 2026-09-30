from pathlib import Path
import json,statistics
p=Path(__file__).resolve().parent
for label in ['basin1600-final01','basin1600-detail02']:
 d=json.loads((p/label/'results.json').read_text(encoding='utf-8'))
 print(label,'wall',d['rows'][-1]['wall'],'sim',d['physics_frames']/60)
 for stage in dict.fromkeys(r['stage'] for r in d['rows']):
  rs=[r for r in d['rows'] if r['stage']==stage];fs=[f for f in d['frames'] if f['stage']==stage];ds=[f for f in d['draws'] if f['stage']==stage];dt=sorted(b['wall']-a['wall'] for a,b in zip(ds,ds[1:]))
  print(stage,'agl',min(r['support']['agl'] for r in rs),max(r['support']['agl'] for r in rs),'p95/max_ms',round(dt[int((len(dt)-1)*.95)]*1000,2),round(max(dt)*1000,2),'image',fs[len(fs)//2]['file'] if fs else '')
