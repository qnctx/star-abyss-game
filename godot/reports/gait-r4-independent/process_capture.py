import json, sys, statistics
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent
label = sys.argv[1]
folder = root / label
data = json.loads((folder / 'capture.json').read_text(encoding='utf-8'))
frames, rows = data['frames'], data['rows']
intervals = [b['wall_time']-a['wall_time'] for a,b in zip(frames,frames[1:])]
summary = {k:data[k] for k in ['utc','time_scale','source_sha256','changed_during_run','camera']}
summary.update(physics_rows=len(rows), captured_triplets=len(frames), wall_seconds=rows[-1]['elapsed_wall'], physics_seconds=sum(r['delta'] for r in rows), median_capture_interval=statistics.median(intervals), max_capture_interval=max(intervals), all_physics=all(r['physics'] for r in rows), input_mismatches=sum(r['requested_keys']!=r['observed_keys'] for r in rows))
for view in ['front','side','back']:
    if not (folder/'frames'/f'{view}-0001.png').exists():continue
    imgs=[]
    durations=[]
    for i,f in enumerate(frames):
        im=Image.open(folder/'frames'/f"{view}-{f['index']:04d}.png").convert('RGB')
        ImageDraw.Draw(im).text((8,8),f"{label} | {view} | {f['phase']} | {f['wall_time']:.2f}s",fill='white',stroke_width=1,stroke_fill='black')
        imgs.append(im)
        dt=intervals[i] if i<len(intervals) else statistics.median(intervals)
        durations.append(max(10,round(dt*100)*10))
    imgs[0].save(folder/f'{view}-wall-time.gif',save_all=True,append_images=imgs[1:],duration=durations,loop=0)
    for gait in ['walk','jog','sprint','walk_start','walk_stop','jog_start','jog_stop','sprint_start','sprint_stop']:
        selected=[f for f in frames if f['phase']==gait][:12]
        sheet=Image.new('RGB',(4*320,3*348),'#151b27')
        draw=ImageDraw.Draw(sheet)
        for j,f in enumerate(selected):
            im=Image.open(folder/'frames'/f"{view}-{f['index']:04d}.png").convert('RGB').resize((320,320))
            x,y=j%4*320,j//4*348
            sheet.paste(im,(x,y))
            draw.text((x+4,y+323),f"{label} {gait} {view} {f['wall_time']:.2f}s",fill='white')
        sheet.save(folder/f'{view}-{gait}-sequence.jpg',quality=92)
(folder/'summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
print(json.dumps(summary,indent=2))
print('sample_row',json.dumps(rows[100]))
