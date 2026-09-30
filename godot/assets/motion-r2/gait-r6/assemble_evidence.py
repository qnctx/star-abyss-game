"""Render contact sheets and 1x-physics-time GIFs from real Godot frame captures."""
import json, math, statistics, sys
from pathlib import Path
from PIL import Image, ImageDraw

folder = Path('godot/assets/motion-r2/evidence/gait-r6') / (sys.argv[1] if len(sys.argv)>1 else 'candidate1')
summaries = {}
for trace in folder.glob('*-trace.json'):
    data = json.loads(trace.read_text(encoding='utf-8'))
    view = trace.stem.removesuffix('-trace')
    rows, frames = data['records'], data['images']
    if not frames:
        continue
    def row_for(frame):
        return rows[min(frame.get('tick',frame.get('record',0)+1)-1,len(rows)-1)]
    metrics = {}
    for gait in ('walk','jog','sprint'):
        selected = [r for r in rows if r['stage']==gait and r.get('stage_age',r.get('age',1))>.20]
        if not selected or 'runtime' not in selected[0]:
            continue
        metrics[gait] = {}
        for mode in ('raw','runtime'):
            hips, knees, heels, pelvis = [], [], [], []
            for r in selected:
                d = r[mode]
                h,k,a = d['hipL'],d['kneeL'],d['ankleL']
                u = [k[i]-h[i] for i in range(3)]
                v = [a[i]-k[i] for i in range(3)]
                hips.append(math.degrees(math.atan2(-u[2],-u[1])))
                knees.append(math.degrees(math.acos(max(-1,min(1,sum(u[i]*v[i] for i in range(3))/(math.dist(k,h)*math.dist(a,k)))))))
                heels.append(a)
                pelvis.append(d['pelvis'][1])
            peak = max(range(len(heels)),key=lambda i:heels[i][1])
            metrics[gait][mode] = {'thigh_minmax_deg':[min(hips),max(hips)],'knee_minmax_deg':[min(knees),max(knees)],'heel_highest_position':heels[peak],'pelvis_bob_m':max(pelvis)-min(pelvis)}
    for gait in ('walk','jog','sprint'):
        available = [f for f in frames if row_for(f)['stage']==gait and row_for(f).get('stage_age',row_for(f).get('age',1))>.2]
        if not available:
            continue
        chosen = [min(available,key=lambda f:abs(row_for(f)['phase']-phase)) for phase in (i/8 for i in range(8))]
        sheet = Image.new('RGB',(1600,652),'#131922')
        draw = ImageDraw.Draw(sheet)
        for i,f in enumerate(chosen):
            im = Image.open(folder/view/f['file']).convert('RGB')
            im.thumbnail((400,300))
            x,y = i%4*400,i//4*326
            sheet.paste(im,(x+(400-im.width)//2,y+22))
            draw.text((x+8,y+5),f'{gait} / {view} / phase {row_for(f)["phase"]:.3f}',fill='white')
        sheet.save(folder/f'{gait}-{view}-sheet.jpg',quality=94)
    for gait in ('all','walk','jog','sprint'):
        selected = frames if gait=='all' else [f for f in frames if row_for(f)['stage']==gait]
        if len(selected)<2:
            continue
        animation,durations = [],[]
        accumulated = last = 0
        for i,f in enumerate(selected):
            im = Image.open(folder/view/f['file']).convert('RGB')
            im.thumbnail((720,540))
            canvas = Image.new('RGB',(720,568),'#131922')
            canvas.paste(im,((720-im.width)//2,28))
            ImageDraw.Draw(canvas).text((12,8),f'C2 R6 | {view} | {row_for(f)["stage"]} | 1x physics time',fill='white')
            animation.append(canvas.convert('P',palette=Image.Palette.ADAPTIVE,colors=192))
            dt = selected[i+1]['seconds']-f['seconds'] if i+1<len(selected) else selected[-1]['seconds']-selected[-2]['seconds']
            accumulated += dt*1000
            end = round(accumulated/10)*10
            durations.append(max(10,end-last))
            last = end
        destination=folder/f'{gait}-{view}.gif'
        animation[0].save(destination,save_all=True,append_images=animation[1:],duration=durations,loop=0,optimize=False)
        with Image.open(destination) as check:
            actual_duration=0
            for frame in range(check.n_frames):
                check.seek(frame)
                actual_duration+=check.info.get('duration',0)
            if abs(actual_duration-sum(durations))>10:
                raise ValueError('GIF timing mismatch: '+str(destination))
    summary={'frames':len(rows),'images':len(frames),'physics_seconds':rows[-1]['seconds'],'wall_seconds':rows[-1].get('wall',rows[-1].get('wall_seconds')),'time_scale':data['time_scale'],'glb_sha256':data.get('glb_sha256'),'driver_sha256':data.get('driver_sha256'),'metrics':metrics}
    summaries[view]=summary
    print(view, json.dumps(summary,ensure_ascii=False))
(folder/'summary.json').write_text(json.dumps(summaries,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
