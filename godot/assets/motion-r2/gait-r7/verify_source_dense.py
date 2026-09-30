"""Read saved R6 .blend at quarter frames; inspect true evaluated skin and rig."""
import bpy,sys,json,math,numpy as np
from pathlib import Path
from mathutils import Vector,Matrix
p=Path('godot/assets/motion-r2').resolve();sys.path.insert(0,str(p/'gait-r5'))
from full_skin_contact import FullSkinSoles
source=p/('source/gait-r7-candidate/next.blend' if '--next' in sys.argv else 'source/gait-r7-candidate/candidate.blend')
bpy.ops.wm.open_mainfile(filepath=str(source))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');scene=bpy.context.scene;soles=FullSkinSoles(arm)
inv=Matrix(((1,0,0),(0,0,1),(0,-1,0)));result={}
for name in ['walk','jog','sprint']:
 action=bpy.data.actions[name];arm.animation_data.action=action
 if action.slots:arm.animation_data.action_slot=action.slots[0]
 end=int(action.frame_range[1]);rows=[];first=None;last=None
 for step in range(end*4+1):
  f=step/4;scene.frame_set(math.floor(f),subframe=f%1);bpy.context.view_layer.update()
  heights,lowest=soles.sample();data={'frame':f,'heights':heights,'sides':{}}
  pose={b.name:b.matrix.copy() for b in arm.pose.bones}
  if step==0:first=pose
  last=pose
  for side in ['L','R']:
   h,k,a=[inv@arm.pose.bones[n+side].matrix.translation for n in ['hip','knee','ankle']]
   data['sides'][side]={'thigh_forward_deg':math.degrees(math.atan2(-(k-h).z,-(k-h).y)),
                       'knee_flexion_deg':180-math.degrees((h-k).angle(a-k)),
                       'knee_to_hip_height_m':k.y-h.y,
                       'thigh_length_m':(k-h).length,'shin_length_m':(a-k).length}
  rows.append(data)
 matrixdiff=max(max(abs(x-y) for ra,rb in zip(first[n],last[n]) for x,y in zip(ra,rb)) for n in first)
 sides=[d for r in rows for d in r['sides'].values()]
 result[name]={'samples':len(rows),'minimum_evaluated_shoe_height_m':min(v for r in rows for v in r['heights'].values()),
  'maximum_knee_relative_to_hip_m':max(d['knee_to_hip_height_m'] for d in sides),
  'thigh_forward_range_deg':[min(d['thigh_forward_deg'] for d in sides),max(d['thigh_forward_deg'] for d in sides)],
  'knee_flexion_range_deg':[min(d['knee_flexion_deg'] for d in sides),max(d['knee_flexion_deg'] for d in sides)],
  'thigh_length_range_m':[min(d['thigh_length_m'] for d in sides),max(d['thigh_length_m'] for d in sides)],
  'shin_length_range_m':[min(d['shin_length_m'] for d in sides),max(d['shin_length_m'] for d in sides)],
  'loop_all_51_bone_matrix_max_error':matrixdiff,'rows':rows}
 print(name,json.dumps({k:v for k,v in result[name].items() if k!='rows'}),flush=True)
(p/('gait-r7/next-dense-source-check.json' if '--next' in sys.argv else 'gait-r7/dense-source-check.json')).write_text(json.dumps(result,indent=2))
assert all(r['minimum_evaluated_shoe_height_m']>-.002 for r in result.values()),'Shoe penetrates floor between keys'
assert all(r['loop_all_51_bone_matrix_max_error']<1e-5 for r in result.values()),'Loop seam'
