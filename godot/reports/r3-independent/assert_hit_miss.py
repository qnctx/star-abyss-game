import json,pathlib
here=pathlib.Path(__file__).resolve().parent
d=json.loads((here/'hit-miss-final.json').read_text(encoding='utf-8'))
checks=[]
def check(name,passed):checks.append({'name':name,'pass':bool(passed)})
check('source stable',not d['changed_during_run'])
check('actual physics delta',all(r['physics'] and r['delta']>0 for r in d['rows']))
for phase,hit in [('empty_cast',False),('real_hit',True)]:
    events=[e for e in d['visual_events'] if e['test_phase']==phase]
    main=[e for e in d['events'] if e['test_phase']==phase and e['phase']=='impact']
    check(phase+' Main result',len(main)==1 and main[0]['hit']==hit)
    check(phase+' visual phase',sum(e['phase']==('impact' if hit else 'miss') for e in events)==1)
    check(phase+' no opposite feedback',not any(e['phase']==('miss' if hit else 'impact') for e in events))
    rows=[r for r in d['rows'] if r['phase']==phase]
    check(phase+' authoritative hp',abs((rows[0]['ordinary_hp']-rows[-1]['ordinary_hp'])-(28000 if hit else 0))<.001)
output={'utc':d['utc'],'checks':checks,'passed':sum(c['pass'] for c in checks),'total':len(checks)}
(here/'hit-miss-final-audit.json').write_text(json.dumps(output,indent=2),encoding='utf-8')
print(json.dumps(output))
