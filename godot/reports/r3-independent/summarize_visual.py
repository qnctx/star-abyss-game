import collections,json,math,pathlib,re,statistics
here=pathlib.Path(__file__).resolve().parent
d=json.loads((here/'visual-final.json').read_text(encoding='utf-8'))
def v(s):return [float(x) for x in re.findall(r'-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?',s)]
groups=collections.defaultdict(list)
for row in d['rows']:groups[row['phase']].append(row)
summary={'utc':d['utc'],'changed_during_run':d['changed_during_run'],'gaits':{},'casts':{},'physics_seconds':sum(r['delta'] for r in d['rows']),'wall_seconds':sum(r['wall_delta'] for r in d['rows'])}
for phase in ['final-walk','final-jog','final-sprint']:
    rows=groups[phase][20:]
    slips=[]
    speeds=[]
    for a,b in zip(rows,rows[1:]):
        speeds.append(math.dist(v(a['position']),v(b['position']))/b['delta'])
        for side in ['L','R']:
            old,new=a['feet'][side],b['feet'][side]
            if old['supported'] and new['supported'] and old['anchor']==new['anchor']:
                ap,bp=v(old['point']),v(new['point'])
                slips.append(math.hypot(ap[0]-bp[0],ap[2]-bp[2])/b['delta'])
    summary['gaits'][phase]={'samples':len(rows),'speed_mean':statistics.mean(speeds),'unchanged_support_samples':len(slips),'support_ankle_speed_mean':statistics.mean(slips) if slips else None,'support_ankle_speed_max':max(slips) if slips else None,'ankle_terrain_gap_range':[min(r['feet'][s]['terrain_gap'] for r in rows for s in ['L','R']),max(r['feet'][s]['terrain_gap'] for r in rows for s in ['L','R'])]}
for phase in ['final-r4','final-r5','final-r6','final-r8','final-r9']:
    events=[e for e in d['events'] if e['test_phase']==phase]
    summary['casts'][phase]={'events':[(e['phase'],e['action'],e['frame']) for e in events],'versions':sorted(set(a['resource_version'] for e in events for a in e.get('vfx',{}).get('actions',[])))}
(here/'visual-final-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
print(json.dumps(summary,indent=2))
