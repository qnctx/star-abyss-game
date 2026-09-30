from pathlib import Path
import json,sys,math
from PIL import Image,ImageDraw
p=Path('godot/assets/motion-r2/evidence/gait-r4')
tags=sys.argv[1:] or ['before','after']
for tag in tags:
    root=p/tag
    for trace in root.glob('*-trace.json'):
        data=json.loads(trace.read_text());view=data['view'];rows=data['records'];frames=data['images'];metrics={}
        for gait in ['walk','jog','sprint']:
            items=[r for r in rows if r['stage']==gait][12:]
            metrics[gait]={}
            for mode in ['raw','runtime']:
                hip_angles=[];knee_y=[];ankles=[];pelvis=[];knee_flex=[]
                for r in items:
                    d=r[mode];h=d['hipL'];k=d['kneeL'];a=d['ankleL']
                    u=[k[i]-h[i] for i in range(3)];v=[a[i]-k[i] for i in range(3)]
                    hip_angles.append(math.degrees(math.atan2(-u[2],-u[1])))
                    knee_flex.append(math.degrees(math.acos(max(-1,min(1,sum(u[i]*v[i] for i in range(3))/(math.dist(k,h)*math.dist(a,k)))))))
                    knee_y.append(k[1]);ankles.append(a);pelvis.append(d['pelvis'][1])
                peak=max(range(len(ankles)),key=lambda i:ankles[i][1])
                metrics[gait][mode]={'hip_flex_deg_minmax':[min(hip_angles),max(hip_angles)],'knee_flex_deg_max':max(knee_flex),'knee_height_max_m':max(knee_y),'ankle_height_max_m':ankles[peak][1],'ankle_z_at_highest_m':ankles[peak][2],'ankle_z_minmax_m':[min(a[2] for a in ankles),max(a[2] for a in ankles)],'pelvis_bob_m':max(pelvis)-min(pelvis)}
            metrics[gait]['max_IK_pelvis_drop_m']=max(r['raw']['pelvis'][1]-r['runtime']['pelvis'][1] for r in items)
            if frames:
                available=[f for f in frames if rows[min(f['tick']-1,len(rows)-1)]['stage']==gait]
                if available:
                    chosen=[]
                    for phase in [i/8 for i in range(8)]:chosen.append(min(available,key=lambda f:abs(rows[min(f['tick']-1,len(rows)-1)]['phase']-phase)))
                    sheet=Image.new('RGB',(1600,478),(15,19,24));draw=ImageDraw.Draw(sheet)
                    for i,f in enumerate(chosen):
                        im=Image.open(root/view/f['file']).convert('RGB');im.thumbnail((400,225));x=i%4*400;y=i//4*239;sheet.paste(im,(x,y+14));draw.text((x+4,y+1),f'{tag} {gait} {view} phase {i/8:.3f}',fill='white')
                    sheet.save(root/(gait+'-'+view+'-sheet.jpg'),quality=94)
        if frames:
            for label in ['all','walk','jog','sprint']:
                selected=frames if label=='all' else [f for f in frames if rows[min(f['tick']-1,len(rows)-1)]['stage']==label]
                if not selected:continue
                images=[];duration=[];last=0;cum=0
                for i,f in enumerate(selected):
                    im=Image.open(root/view/f['file']).convert('RGB');im.thumbnail((640,360))
                    canvas=Image.new('RGB',(640,388),(15,19,24));canvas.paste(im,(0,28));d=ImageDraw.Draw(canvas)
                    d.text((8,8),f'{tag} | {view} | {label} | 1x physics time',fill='white');images.append(canvas.convert('P',palette=Image.Palette.ADAPTIVE,colors=128))
                    delta=selected[i+1]['seconds']-f['seconds'] if i<len(selected)-1 else selected[-1]['seconds']-selected[-2]['seconds']
                    cum+=delta*1000;end=round(cum/10)*10;duration.append(max(10,end-last));last=end
                images[0].save(root/(label+'-'+view+'.gif'),save_all=True,append_images=images[1:],duration=duration,loop=0,optimize=False)
        (root/(view+'-summary.json')).write_text(json.dumps({'metrics':metrics,'frames':len(rows),'physics_seconds':rows[-1]['seconds'],'wall_seconds':rows[-1]['wall'],'time_scale':data['time_scale']},indent=2))
        print(tag,view,json.dumps(metrics,indent=2))
