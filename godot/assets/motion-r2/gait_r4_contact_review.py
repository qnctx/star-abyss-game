import json,math,sys
from pathlib import Path
p=Path('godot/assets/motion-r2');d=json.loads((p/('evidence/gait-r4/'+(sys.argv[1] if len(sys.argv)>1 else 'after')+'/side-trace.json')).read_text())
for gait in ['walk','jog','sprint']:
    rows=[r for r in d['records'] if r['stage']==gait][12:]
    print(gait)
    for mode in ['raw','runtime']:
        soles=[r[mode].get('sole_min_L',0) for r in rows if r['phase']<{'walk':.55,'jog':.20,'sprint':.18}[gait]]
        print(mode,'stance sole min/max',min(soles),max(soles))
    for phase in [0,.05,.1,.15,.2,.3,.4,.5,.6,.7,.8,.9]:
        r=min(rows,key=lambda r:abs(r['phase']-phase));x=r['runtime'];h=x['hipL'];k=x['kneeL'];a=x['ankleL'];u=[k[i]-h[i] for i in range(3)];v=[a[i]-k[i] for i in range(3)]
        flex=math.degrees(math.acos(max(-1,min(1,sum(u[i]*v[i] for i in range(3))/(math.dist(h,k)*math.dist(k,a))))))
        print('phase %.3f knee flex %.1f ankle y %.3f z %.3f pelvis %.3f'%(r['phase'],flex,a[1],a[2],x['pelvis'][1]))
