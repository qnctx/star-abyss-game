import json,math,pathlib,re
here=pathlib.Path(__file__).resolve().parent
d=json.loads((here/'melee-targeted.json').read_text())
def v(s):return [float(x) for x in re.findall(r'-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?',s)]
print('UTC',d['utc'],'changed',d['changed_during_run'])
print('player',d['source_sha256']['native_player.gd'])
print('motion model',d['asset_sha256'].get('res://assets/motion-r2/c2-motion-r2.glb'))
for e in d['events']:
    if e['test_phase']=='melee_2m' and e['action']=='left-jab':
        print('melee',e['phase'],e['frame'],'hit',e['hit'],'gap',e['beast_contact_gap'],'hurt',e['player_hurt_time'],'move',math.dist(v(e['player_position']),v(d['melee_start'])))
        print('coordinates player',e['player_position'],'beast',e['beast_position'],'hand',e['limb_contact'])
wall=d['wall']
print('wall',wall)
if 'start' in wall:
    print('wall displacement',math.dist(v(wall['start']),v(wall['end'])),'remaining x clearance',v(wall['hit'])[0]-v(wall['end'])[0])
