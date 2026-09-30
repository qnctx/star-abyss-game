"""Assemble actual rendered evidence, preserving real sampled simulation timing."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib
p=Path('godot/assets/motion-r2')
clips=['walk','jog','sprint','jab','cast_fist','cast_palm','cast_sweep','cast_cleave','cast_skyfall','air_cast_skyfall']
for clip in clips:
    files=sorted((p/'evidence/r3-keys').glob(clip+'-*-front.png'))
    if not files:continue
    sheet=Image.new('RGB',(480*len(files),298),(20,24,31));d=ImageDraw.Draw(sheet)
    for i,f in enumerate(files):
        im=Image.open(f).convert('RGB');im.thumbnail((480,270));sheet.paste(im,(i*480,28));d.text((i*480+12,8),f.stem,fill='white')
    sheet.save(p/'evidence/r3-keys'/(clip+'-sheet.jpg'),quality=92)
files=sorted((p/'evidence/r3-live').glob('*.png'))
if files:
    for label in ['walk','jog','sprint','cast_palm-ground','cast_sweep-ground','cast_cleave-ground','cast_skyfall-air']:
        selected=[f for f in files if f.name.endswith('-'+label+'.png')]
        if not selected:continue
        selected=[selected[round(i*(len(selected)-1)/7)] for i in range(8)]
        sheet=Image.new('RGB',(1280,424),(20,24,31));draw=ImageDraw.Draw(sheet)
        for i,f in enumerate(selected):
            im=Image.open(f).convert('RGB');im.thumbnail((320,180));x=i%4*320;y=i//4*212
            sheet.paste(im,(x,y+26));draw.text((x+5,y+5),f.stem,fill='white')
        sheet.save(p/'evidence/r3-live'/(label+'-sheet.jpg'),quality=93)
    records=json.loads((p/'evidence/r3-live/report.json').read_text())['records']
    lookup={i+1:r['simulation_seconds'] for i,r in enumerate(records)}
    frames=[];durations=[];previous=None
    for f in files:
        tick=int(f.name.split('-')[0]);now=lookup.get(tick,tick/60)
        im=Image.open(f).convert('RGB');im.thumbnail((640,360))
        canvas=Image.new('RGB',(640,388),(20,24,31));canvas.paste(im,(0,28));d=ImageDraw.Draw(canvas)
        d.text((10,8),f.name+' | actual physics sample',fill='white')
        frames.append(canvas.convert('P',palette=Image.Palette.ADAPTIVE,colors=128))
        if previous is not None:durations.append(max(20,round((now-previous)*1000)))
        previous=now
    durations.append(durations[-1] if durations else 100)
    # GIF uses 10ms ticks: distribute rounding error cumulatively, rather than
    # shortening each 116.7ms interval to 110ms and speeding up the evidence.
    exact=0;encoded=0;quantized=[]
    for duration in durations:
        exact+=duration;end=round(exact/10)*10;quantized.append(max(10,end-encoded));encoded=end
    durations=quantized
    frames[0].save(p/'evidence/r3-live/normal-speed.gif',save_all=True,append_images=frames[1:],duration=durations,loop=0,optimize=False)
    with Image.open(p/'evidence/r3-live/normal-speed.gif') as gif:
        total=0
        for index in range(gif.n_frames):gif.seek(index);total+=gif.info.get('duration',0)
        (p/'evidence/r3-live/gif-timing.json').write_text(json.dumps({'frames':gif.n_frames,'encoded_ms':total,'expected_ms':sum(durations),'physics_sample_start':lookup.get(int(files[0].name.split('-')[0])),'physics_sample_end':lookup.get(int(files[-1].name.split('-')[0])),'method':'actual physics timestamp differences; cumulative GIF 10ms quantization'},indent=2))
hashes={n:hashlib.sha256((p/n).read_bytes()).hexdigest() for n in ['c2-motion-r2.glb','build.py','combat.py','hands_r3.py']}
(p/'evidence/r3-final-hashes.json').write_text(json.dumps(hashes,indent=2))
print(json.dumps(hashes))
