"""Bind original references, projected bones and rendered PNGs by actual tick.
This assembler refuses CPU-only traces. It does not generate or edit reference art.
Usage: python assemble_comparison.py CAPTURE_DIR [--events EVENTS_JSON]
"""
import argparse, hashlib, html, json, os
from pathlib import Path

P=argparse.ArgumentParser()
P.add_argument('capture_dir',type=Path)
P.add_argument('--events',type=Path,default=Path(__file__).parent/'independent'/'next-events.json')
args=P.parse_args()
source=Path(__file__).resolve().parent
root=args.capture_dir.resolve()
events=json.loads(args.events.read_text(encoding='utf-8'))['candidate']
refs=source.parent/'gait-review-r6'
links=[('pelvis','waist'),('waist','lumbar'),('lumbar','chest'),('chest','head')]
for side in ['L','R']:
    links += [('pelvis','hip'+side),('hip'+side,'knee'+side),('knee'+side,'ankle'+side),('chest','clavicle'+side),('clavicle'+side,'shoulder'+side),('shoulder'+side,'elbow'+side),('elbow'+side,'wrist'+side)]

def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def rel(p):return os.path.relpath(p,root).replace('\\','/')
def skeleton(record,w,h):
    joints=record['projected_joints']
    items=[]
    for a,b in links:
        if a not in joints or b not in joints:continue
        x,y=joints[a];u,v=joints[b]
        col='#5bb5ff' if b.endswith('L') else '#ffae54' if b.endswith('R') else '#e2e8f0'
        items.append(f'<line x1="{x:.3f}" y1="{y:.3f}" x2="{u:.3f}" y2="{v:.3f}" stroke="{col}" stroke-width="3"/>')
    for name in ['hipL','kneeL','ankleL','hipR','kneeR','ankleR','pelvis','head']:
        if name not in joints:continue
        x,y=joints[name]
        items.append(f'<circle cx="{x:.3f}" cy="{y:.3f}" r="4" fill="#fff"/><text x="{x+7:.3f}" y="{y-5:.3f}" font-size="12" fill="#fff">{name}</text>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}"><rect width="100%" height="100%" fill="#273343"/>'+''.join(items)+'</svg>'

manifest={'status':'comparison assembled; visual acceptance still requires watching actual 1x playback','reference_camera':'Unknown original image camera; approximate intent reference only. Skeleton/PNG use identical engine camera and tick.','views':{}}
sections=[]
first_hash=None
for trace_path in sorted(root.glob('*-trace.json')):
    data=json.loads(trace_path.read_text(encoding='utf-8'))
    if not data.get('captured_pixels') or not data.get('images'):
        raise SystemExit('Refusing CPU-only/empty capture: '+str(trace_path))
    if first_hash is None:first_hash=data['glb_sha256']
    if data['glb_sha256']!=first_hash:raise SystemExit('Mixed candidate assets')
    view=data['view']; records={r['tick']:r for r in data['records']}
    w,h=data['camera']['viewport']
    directory=root/view
    movie=[]
    for image in data['images']:
        r=records[image['tick']]
        if not r.get('projected_joints'):raise SystemExit('Missing same-tick camera projection')
        png=directory/image['file']
        if not png.exists():raise SystemExit('Missing actual PNG '+str(png))
        skel=directory/(png.stem+'-bones.svg')
        skel.write_text(skeleton(r,w,h),encoding='utf-8')
        movie.append({'png':rel(png),'bones':rel(skel),'tick':r['tick'],'seconds':r['seconds'],'wall':image.get('wall',image.get('wall_seconds',r.get('wall',r.get('wall_seconds')))),'phase':r['phase'],'clip':r['clip'],'stage_age':r['stage_age'],'speed':r['speed']})
    selections=[]
    for clip in ['walk','jog','sprint']:
        stable=[m for m in movie if m['clip']==clip and m['stage_age']>.30]
        for name in ['loading_knee_peak','rear_thigh_peak','rear_recovery_ankle_peak','swing_knee_peak','ankle_pass_nearest_hip_plane','forward_thigh_peak']:
            event=events['gaits'][clip]['L']['events'].get(name)
            if not event or not stable:continue
            phase=event['global_phase']
            nearest=min(stable,key=lambda m:abs((m['phase']-phase+.5)%1-.5))
            error=abs((nearest['phase']-phase+.5)%1-.5)
            selected=dict(nearest,event=name,target_phase=phase,phase_error=error)
            selections.append(selected)
    wall_start=movie[0]['wall']; physics_start=movie[0]['seconds']
    if any(m['wall'] is None for m in movie):raise SystemExit('Missing wall clock')
    if any(b['wall']<=a['wall'] for a,b in zip(movie,movie[1:])):raise SystemExit('Non-monotonic wall clock')
    manifest['views'][view]={'trace_sha256':digest(trace_path),'glb_sha256':data['glb_sha256'],'adapter':data.get('model_adapter_path'),'adapter_sha256':data.get('model_adapter_sha256'),'driver_sha256':data['driver_sha256'],'frames':len(movie),'physics_span':movie[-1]['seconds']-physics_start,'wall_span':movie[-1]['wall']-wall_start,'selected_events':selections,'movie':movie}
    cards=''
    for e in selections:
        cards += f'<article><h3>{e["clip"]} / {e["event"]}</h3><p>tick {e["tick"]} · phase {e["phase"]:.4f} · Δphase {e["phase_error"]:.4f}</p><div class="pair"><img src="{e["bones"]}"><img src="{e["png"]}"></div></article>'
    sections.append(f'<section data-view="{view}"><h2>{view}</h2><button class="play">实际墙钟 1× 播放</button> <input class="seek" type="range" min="0" max="{len(movie)-1}" value="0"><p class="clock"></p><div class="pair"><img class="bones"><img class="mesh"></div><div class="cards">{cards}</div></section>')
if not manifest['views']:raise SystemExit('No rendered trace found')
reference=''.join(f'<figure><img src="{rel(refs/name)}"><figcaption>{html.escape(label)}</figcaption></figure>' for name,label in [('01-walk.png','已批准慢走意图'),('02-alignment.png','已批准骨架／模型对齐方向'),('03-jog.png','已批准跑步后侧收腿方向'),('04-acceleration.png','已批准加速轮廓')])
style='body{background:#111827;color:#e5e7eb;font:16px system-ui,"Microsoft YaHei";margin:24px;line-height:1.5}h1{font-size:25px}.refs,.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:20px}img{width:100%;height:auto;display:block}.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}section{margin:36px 0}figure{margin:0}button{padding:10px;font:inherit}input{width:60%;max-width:700px}article{background:#1f2937;padding:14px}article p{font-size:14px}.clock{min-height:24px}'
script='const D='+json.dumps(manifest,ensure_ascii=False)+''';document.querySelectorAll('section').forEach(s=>{const M=D.views[s.dataset.view].movie,q=s.querySelector('.seek'),b=s.querySelector('.play');let timer=0;function show(i){const m=M[i];q.value=i;s.querySelector('.bones').src=m.bones;s.querySelector('.mesh').src=m.png;s.querySelector('.clock').textContent='tick '+m.tick+' / physics '+m.seconds.toFixed(3)+' s / wall '+m.wall.toFixed(3)+' s / '+m.clip+' '+m.speed.toFixed(2)+' m/s / phase '+m.phase.toFixed(4);}q.oninput=()=>{clearTimeout(timer);b.textContent='实际墙钟 1× 播放';show(+q.value)};b.onclick=()=>{clearTimeout(timer);let i=+q.value;function next(){show(i);if(i+1<M.length){const delay=Math.max(1,(M[i+1].wall-M[i].wall)*1000);i++;timer=setTimeout(next,delay)}else{b.textContent='重新播放';q.value=0}}b.textContent='播放中';next()};show(0)});'''
page='<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>R7 真实帧对照</title><style>'+style+'</style><h1>R7 图片意图 → 同帧骨架 → 实际 Godot 模型</h1><p>原图相机未知，且部分相位／左右标注有误，原图仅作已审核的动作意图参考。骨架与模型严格对应同一物理 tick、相机及 PNG。蓝色为左侧、橙色为右侧。选帧按独立测得事件取最近捕获帧，显示相位误差。此页面不自动判定自然度。</p><div class="refs">'+reference+'</div>'+''.join(sections)+'<script>'+script+'</script>'
(root/'comparison.html').write_text(page,encoding='utf-8')
(root/'comparison-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'output':str(root/'comparison.html'),'views':list(manifest['views']),'status':manifest['status']},ensure_ascii=False))
