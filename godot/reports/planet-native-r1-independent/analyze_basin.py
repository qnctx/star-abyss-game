from pathlib import Path
import json,statistics
from PIL import Image,ImageDraw
p=Path(__file__).resolve().parent/'basin1600-final01'
d=json.loads((p/'results.json').read_text(encoding='utf-8'))
out={'utc':d['utc'],'changed':d['changed'],'hashes':d['hashes'],'stages':{}}
for stage in dict.fromkeys(r['stage'] for r in d['rows']):
    rows=[r for r in d['rows'] if r['stage']==stage]
    dr=[r for r in d['draws'] if r['stage']==stage]
    dt=sorted(b['wall']-a['wall'] for a,b in zip(dr,dr[1:]))
    out['stages'][stage]={'first':rows[0],'last':rows[-1],'agl_min':min(r['support'].get('agl',0) for r in rows),'agl_max':max(r['support'].get('agl',0) for r in rows),'unready':sum(not r['support'].get('ready',False) for r in rows),'p50_ms':statistics.median(dt)*1000 if dt else 0,'p95_ms':dt[int(.95*(len(dt)-1))]*1000 if dt else 0,'max_ms':max(dt)*1000 if dt else 0}
    fs=[f for f in d['frames'] if f['stage']==stage]
    if not fs:continue
    ids=sorted(set(round(i*(len(fs)-1)/7) for i in range(8)))
    sheet=Image.new('RGB',(1280,800),'#10151c');draw=ImageDraw.Draw(sheet)
    for j,k in enumerate(ids):
        f=fs[k];im=Image.open(p/f['file']).resize((320,180));x=j%4*320;y=j//4*200;sheet.paste(im,(x,y));draw.text((x+4,y+183),f"{stage} t={f['wall']:.2f} frame={f['tick']}",fill='white')
    sheet.crop((0,0,1280,400)).save(p/(stage+'-sheet.jpg'),quality=93)
(p/'summary.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print(json.dumps(out,indent=2))
