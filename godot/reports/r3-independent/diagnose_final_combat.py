import json,pathlib
d=json.loads((pathlib.Path(__file__).resolve().parent/'combat-live.json').read_text(encoding='utf-8'))
for e in d['events']:
    if e['test_phase']=='melee_2m':print(e['phase'],e['action'],e['hit'],'p',e['player_position'],'b',e['beast_position'],'limb',e['limb_contact'],'gap',e['beast_contact_gap'],'hurt',e['player_hurt_time'])
rows=[r for r in d['rows'] if r['phase']=='landing']
for r in rows[::30]:print('landing',r['frame'],r['position'],'flight',r['flight'],'C',r.get('c_down'),'mouse',r.get('mouse_mode'),'terrain',r.get('terrain'),'support',r.get('support'),'vel',r.get('velocity'),'vspeed',r.get('vertical_speed'),'floor',r.get('on_floor'),'slides',r.get('slide_count'),'enemy',r['beast']['mode'])
