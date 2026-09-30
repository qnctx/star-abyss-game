import collections,json,pathlib
here=pathlib.Path(__file__).resolve().parent
data=json.loads((here/'combat-live.json').read_text(encoding='utf-8'))
print('UTC',data['utc'],'changed',data['changed_during_run'],'rows',len(data['rows']))
for event in data['events']:
    print(event['test_phase'],event['frame'],event['phase'],event['action'],'hit',event['hit'],'hp',event['player_hp'],event['beast_hp'],event['ordinary_hp'])
groups=collections.defaultdict(list)
for row in data['rows']:groups[row['phase']].append(row)
summary={'utc':data['utc'],'changed_during_run':data['changed_during_run'],'phases':{}}
for phase,rows in groups.items():
    result={'player_hp':[rows[0]['player_hp'],rows[-1]['player_hp']],'ordinary_hp':[rows[0]['ordinary']['hp'],rows[-1]['ordinary']['hp']],'beast_modes':sorted(set(r['beast']['mode'] for r in rows)),'guard_seen':any(r['guarding'] for r in rows),'fragments':rows[-1]['fragments']}
    summary['phases'][phase]=result
    print(phase,result)
print('save keys',list(data['save']) if data['save'] else [])
print('setup',data['setup'])
print('reload',data.get('reload_checks',{}))
for e in data['events']:
    if e['test_phase']=='melee_2m':
        print('melee evidence',e['phase'],'gap',e.get('beast_contact_gap'),'limb',e.get('limb_contact'),'hurt',e.get('player_hurt_time'),'player',e.get('player_position'),'beast',e.get('beast_position'))
(here/'combat-live-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
