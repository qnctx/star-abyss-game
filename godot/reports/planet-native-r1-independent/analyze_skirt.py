from pathlib import Path
import json,statistics,sys
from PIL import Image,ImageDraw,ImageChops,ImageStat
p=Path(__file__).resolve().parent/(sys.argv[1] if len(sys.argv)>1 else 'basin-skirt03')
d=json.loads((p/'results.json').read_text(encoding='utf-8'))
out={'utc':d['utc'],'hashes':d['hashes'],'changed':d['changed'],'physics':d['physics_frames'],'wall':d['rows'][-1]['wall'],'roi_count':len(d['roi_frames']),'stages':{}}
for stage in dict.fromkeys(r['stage'] for r in d['rows']):
 rs=[r for r in d['rows'] if r['stage']==stage];fs=[f for f in d['frames'] if f['stage']==stage];roi=[f for f in d['roi_frames'] if f['stage']==stage];ds=[f for f in d['draws'] if f['stage']==stage];dt=sorted(b['wall']-a['wall'] for a,b in zip(ds,ds[1:]))
 info={'agl_min':min(r['support']['agl'] for r in rs),'agl_max':max(r['support']['agl'] for r in rs),'first_position':rs[0]['position'],'last_position':rs[-1]['position'],'unready':sum(not r['support']['ready'] for r in rs),'p95_ms':dt[int(.95*(len(dt)-1))]*1000,'max_ms':max(dt)*1000,'image':fs[len(fs)//2]['file'] if fs else '', 'roi_count':len(roi)}
 out['stages'][stage]=info
 if not roi:continue
 sheet=Image.new('RGB',(960,8*122),'#202020');draw=ImageDraw.Draw(sheet)
 for j in range(8):
  f=roi[round(j*(len(roi)-1)/7)];sheet.paste(Image.open(p/f['file']),(0,j*122));draw.text((8,j*122+101),f"{stage} tick{f['tick']} t{f['wall']:.3f}",fill='white')
 sheet.save(p/(stage+'-roi-sheet.png'))
 # Ground-only band, excluding avatar/UI: compares every rendered crop.
 means=[];dark=[];prev=None
 for f in roi:
  im=Image.open(p/f['file']).convert('RGB').crop((200,30,760,65))
  gray=im.convert('L');dark.append(sum(v<40 for v in gray.getdata()))
  if prev is not None:means.append(sum(ImageStat.Stat(ImageChops.difference(im,prev)).mean)/3)
  prev=im
 info['dark_pixels_min_max']=[min(dark),max(dark)]
 info['frame_diff_mean_max']=max(means) if means else 0
(p/'summary.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print(json.dumps(out,indent=2))
