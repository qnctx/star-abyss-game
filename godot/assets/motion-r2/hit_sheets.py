from pathlib import Path
from PIL import Image,ImageDraw
import json
root=Path('godot/assets/motion-r2/evidence/hit-regression')
frames=[Image.open(f).convert('RGB') for f in sorted(root.glob('f*.png'))]
durations=[(round((i+1)*100/30)-round(i*100/30))*10 for i in range(len(frames))]
frames[0].save(root/'guard-impact-launch-normal-speed.gif',save_all=True,append_images=frames[1:],duration=durations,loop=0)
sheet=Image.new('RGB',(1280,200*((len(frames)//3+3)//4)),(20,25,30));draw=ImageDraw.Draw(sheet)
for i,frame in enumerate(range(0,len(frames),3)):
    im=frames[frame].copy();im.thumbnail((320,180));x=i%4*320;y=i//4*200;sheet.paste(im,(x,y));draw.text((x+8,y+181),f'{frame/30:.2f}s frame {frame}',fill='white')
sheet.save(root/'guard-impact-launch-sheet.jpg')
trace=json.loads((root/'trace.json').read_text())
assert all(t.get('engine_in_physics',False) and abs(t.get('engine_physics_dt',0)-1/30)<1e-6 for t in trace), 'Capture did not advance inside real 30Hz physics frames'
summary={}
for name,start,end in [('guard',10,24),('impact',30,48),('launch',60,108)]:
    part=trace[start:end]
    summary[name]={'max_agl_m':max(t['agl'] for t in part),'max_speed_mps':max(t['speed'] for t in part),'clips':sorted(set(t['clip'] for t in part)),'max_ankle_above_support_m':max(v['ankle_above_support'] for t in part for v in t['feet'])}
    summary[name]['physics_step_s']=1/30
    if 'root_y' in part[0]:
        summary[name]['max_root_rise_from_pre_hit_m']=max(t['root_y'] for t in part)-trace[start-1]['root_y']
        summary[name]['support_height_range_m']=[min(t['support_y'] for t in part),max(t['support_y'] for t in part)]
(root/'summary.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary))
