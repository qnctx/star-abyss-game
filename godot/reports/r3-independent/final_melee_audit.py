import json,math,pathlib,re
here=pathlib.Path(__file__).resolve().parent
def v(s):return [float(x) for x in re.findall(r'-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?',s)]
results=[]
for distance in ['2.0','2.3','2.6']:
    d=json.loads((here/f'melee-final-{distance}.json').read_text())
    start=next(e for e in d['events'] if e['test_phase']=='melee_2m' and e['action']=='left-jab' and e['phase']=='start')
    impact=next(e for e in d['events'] if e['test_phase']=='melee_2m' and e['action']=='left-jab' and e['phase']=='impact')
    wall=d['wall']
    result={'distance':float(distance),'utc':d['utc'],'player_sha256':d['source_sha256']['native_player.gd'],'motion_script_sha256':d['source_sha256']['native_motion_r2.gd'],'motion_glb_sha256':d['asset_sha256']['res://assets/motion-r2/c2-motion-r2.glb'],'source_changed':d['changed_during_run'],'hit':impact['hit'],'gap':impact['beast_contact_gap'],'root_move':math.dist(v(start['player_position']),v(impact['player_position'])),'beast_move':math.dist(v(start['beast_position']),v(impact['beast_position'])),'hurt':impact['player_hurt_time'],'contact_elapsed':impact['time']-start['time'],'delta_min_max':[min(r['delta'] for r in d['rows']),max(r['delta'] for r in d['rows'])],'wall_safe_fixture':wall['safe_setup'],'wall_move':math.dist(v(wall['start']),v(wall['end'])),'wall_x_clearance':v(wall['hit'])[0]-v(wall['end'])[0]}
    result['pass']=not result['source_changed'] and result['hit']==(float(distance)<2.6) and result['beast_move']<.001 and result['hurt']==0 and result['wall_safe_fixture'] and result['wall_move']<.01 and result['wall_x_clearance']>.42
    results.append(result)
same=all(len(set(r[key] for r in results))==1 for key in ['player_sha256','motion_script_sha256','motion_glb_sha256'])
output={'same_player_motion_batch':same,'all_pass':same and all(r['pass'] for r in results),'cases':results}
(here/'melee-final-audit.json').write_text(json.dumps(output,indent=2),encoding='utf-8')
print(json.dumps(output,indent=2))
