import collections,json,math,pathlib,re,statistics
here=pathlib.Path(__file__).resolve().parent
data=json.loads((here/'combat-live.json').read_text(encoding='utf-8'))
checks=[]
def check(name,passed,detail=None):checks.append({'name':name,'pass':bool(passed),'detail':detail})
def vector(s):return [float(x) for x in re.findall(r'-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?',s)]
def gap(a,b):return math.dist(vector(a),vector(b))
check('source and assets stable',not data['changed_during_run'],data['changed_during_run'])
check('all samples actual physics',all(r['physics'] and r['delta']>0 for r in data['rows']))
check('normal time scale',data['time_scale']==1)
for stage,windup in [('ground_r4',.5),('ordinary_r9',2.2)]:
    events=[e for e in data['events'] if e['test_phase']==stage and e.get('side')!='enemy' and e['action'].startswith('cast_')]
    for phase in ['start','release','impact']:
        check(stage+' exactly one '+phase,sum(e['phase']==phase for e in events)==1)
    released=[e for e in events if e['phase']=='release']
    started=[e for e in events if e['phase']=='start']
    if released and started:
        release=released[0]
        elapsed=release['time']-started[0]['time']
        check(stage+' windup respected',windup-1e-5<=elapsed<=windup+2/60+1e-5,elapsed)
        check(stage+' release uses current hand bone',gap(release['pending']['origin'],release['hand_r'])<.001)
        actions=release.get('vfx',{}).get('actions',[])
        check(stage+' vfx shares authority source',bool(actions) and gap(actions[0]['release_source'],release['pending']['origin'])<.001)
    check(stage+' hit observed',any(e['phase']=='impact' and e['hit'] for e in events))
interrupt=[e for e in data['events'] if e['test_phase']=='interrupt_cast' and e['action']=='cast_skyfall']
check('real enemy cancels cast',any(e['phase']=='start' for e in interrupt) and any(e['phase']=='cancel' for e in interrupt))
check('interrupted cast never releases or impacts',not any(e['phase'] in ['release','impact'] for e in interrupt))
check('actual drop collected',any(r['phase']=='pickup' and r['fragments']==1 for r in data['rows']))
for name,passed in data.get('reload_checks',{}).items():check(name,passed)
melee=[e for e in data['events'] if e['test_phase']=='melee_2m' and e['phase']=='impact' and e['action']=='left-jab']
# An autonomous enemy can sidestep after a 2m setup; initial range is not a hit guarantee.
# The separate same-batch stationary-until-contact cases retain the explicit distance tests.
check('dynamic jab agrees with actual bone contact',len(melee)==1 and melee[0]['hit']==(melee[0]['beast_contact_gap']<=.240001),[(e['hit'],e['beast_contact_gap']) for e in melee])
check('beast takes off and flies',{'takeoff','air'}<=set(r['beast']['mode'] for r in data['rows']))
check('beast lands again',any(r['phase']=='landing' and r['beast']['mode']=='ground' for r in data['rows']))
check('five metre approach eventually damages',any(e['test_phase']=='ground_5m' and e['phase']=='enemy_impact' and e['hit'] for e in data['events']))
render=collections.defaultdict(list)
for row in data.get('render_rows',[]):render[row['phase']].append(row['delta']*1000)
perf={}
for phase,values in render.items():
    values.sort()
    perf[phase]={'samples':len(values),'median_ms':statistics.median(values),'p95_ms':values[min(len(values)-1,int(len(values)*.95))],'max_ms':max(values)}
output={'utc':data['utc'],'checks':checks,'passed':sum(c['pass'] for c in checks),'total':len(checks),'render_frame_intervals_ms':perf,'performance_scope':'hidden Intel UHD OpenGL 1280x720; scene setups and PNG captures included; no claim about foreground human feel'}
(here/'combat-assertions.json').write_text(json.dumps(output,indent=2),encoding='utf-8')
print(output['passed'],'/',output['total'])
for c in checks:
    if not c['pass']:print('FAIL',c['name'],c['detail'])
print('render',json.dumps(perf))
print('landing modes',sorted(set(r['beast']['mode'] for r in data['rows'] if r['phase']=='landing')))
print('VFX versions',sorted(set(a['resource_version'] for e in data['events'] for a in e.get('vfx',{}).get('actions',[]))))
for e in data['events']:
    if e['test_phase']=='ground_5m' or (e['test_phase']=='melee_2m' and e['phase']=='impact'):
        print('review',e['frame'],e['test_phase'],e['phase'],e['action'],e['hit'],'gap',e.get('beast_contact_gap'),'hurt',e.get('player_hurt_time'))
