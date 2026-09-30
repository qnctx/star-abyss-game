"""Reproducible C2 animation authoring; preserves source skin and rest axes."""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
OUT=Path('godot/assets/motion-r2').resolve()
sys.path.insert(0,str(OUT))
from combat import combat_pose
from hands_r3 import Hands
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(OUT.parent/'c2-explorer.glb'))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==arm]
for o in list(bpy.context.scene.objects):
 if o!=arm and o not in meshes:bpy.data.objects.remove(o,do_unlink=True)
config=json.loads((OUT.parent/'c2-motion.json').read_text())
names=config['boneNames']; parents=config['boneParents']; P=[Vector(v) for v in config['nativePositions']]
C=Matrix(((1,0,0),(0,0,-1),(0,1,0)))
hands=Hands(arm,meshes,C,OUT)
meshes+=hands.meshes
rest={b.name:b.matrix_local.to_quaternion() for b in arm.data.bones}
def q(x=0,y=0,z=0):
 return Quaternion((0,0,1),math.radians(z))@Quaternion((0,1,0),math.radians(y))@Quaternion((1,0,0),math.radians(x))
def envelope(t,peak=.38):
 if t<peak:return math.sin(t/peak*math.pi/2)**2
 return math.cos((t-peak)/(1-peak)*math.pi/2)**2
def pose(name,t):
 r={n:Quaternion() for n in names}; offset=Vector((0,0,0)); ph=2*math.pi*t
 if name in ['idle','cruise']:
  r['chest']=q(1.5*math.sin(ph));r['elbowL']=q(12);r['elbowR']=q(12)
  if name=='cruise':
   offset.y=.10+.014*math.sin(ph);r['shoulderL']=q(-7,0,-7);r['shoulderR']=q(-7,0,7)
   r['hipL']=q(-4);r['hipR']=q(-4);r['kneeL']=q(10);r['kneeR']=q(10)
 elif name=='boost':
  offset.y=.18;r['pelvis']=q(-67);r['chest']=q(-5);r['head']=q(48)
  r['shoulderL']=q(-18,0,-8);r['shoulderR']=q(-18,0,8);r['elbowL']=q(8);r['elbowR']=q(8)
  r['kneeL']=q(-8);r['kneeR']=q(-11)
 elif name=='walk':
  offset.y=-.055-.016*math.sin(ph*2);offset.x=.024*math.sin(ph)
  r['pelvis']=q(-2,-3*math.cos(ph),2*math.sin(ph));r['chest']=q(0,5*math.cos(ph));r['shoulderL']=q(-21*math.cos(ph));r['shoulderR']=q(21*math.cos(ph))
  r['elbowL']=q(15+5*math.sin(ph));r['elbowR']=q(15-5*math.sin(ph))
 elif name in ['jog','sprint']:
  fast=name=='sprint';stance=.21 if fast else .25;half=t%.5
  height=.815 if fast else .84
  if half<stance:height-=.028*math.sin(math.pi*half/stance)
  else:height+=(.075 if fast else .055)*math.sin(math.pi*(half-stance)/(.5-stance))
  offset.y=height-.93;offset.x=.012*math.cos(ph)
  r['pelvis']=q(-6 if fast else -3,-4*math.cos(ph));r['chest']=q(-9 if fast else -5,8*math.cos(ph));r['head']=q(10 if fast else 6)
  swing=38 if fast else 29
  r['shoulderL']=q(-swing*math.cos(ph),0,-4);r['shoulderR']=q(swing*math.cos(ph),0,4)
  r['elbowL']=q(85-12*math.cos(ph));r['elbowR']=q(85+12*math.cos(ph))
 positions={};rotations={}
 for i,n in enumerate(names):
  if parents[i]<0:positions[n]=P[i]+offset;rotations[n]=r[n]
  else:
   pn=names[parents[i]];positions[n]=positions[pn]+rotations[pn]@(P[i]-P[parents[i]]);rotations[n]=rotations[pn]@r[n]
 if name in ['walk','jog','sprint']:
  for side,shift in [('L',0),('R',.5)]:
   phase=(t+shift)%1;hip=positions['hip'+side];a=P[names.index('hip'+side)];b=P[names.index('knee'+side)];c=P[names.index('ankle'+side)]
   if name=='walk':
    stance=.52;span=1.2*stance
    z=-span/2+1.2*phase if phase<stance else span/2-span*((phase-stance)/(1-stance))
    lift=0 if phase<stance else .075*math.sin((phase-stance)/(1-stance)*math.pi)
    roll=12*(1-phase/.10) if phase<.10 else -18*((phase-.40)/.12) if .40<phase<stance else -18+30*(phase-stance)/(1-stance) if phase>=stance else 0
   else:
    stride=4.0 if name=='sprint' else 3.0;stance=.21 if name=='sprint' else .25;span=stride*stance
    if phase<stance:z=-span/2+stride*phase;lift=0;roll=6-24*phase/stance
    else:
     swing=(phase-stance)/(1-stance);ease=swing*swing*(3-2*swing)
     z=span/2-span*ease
     lift=(.28 if name=='sprint' else .22)*math.sin(math.pi*swing)**1.5
     roll=-18*(1-swing)-20*math.sin(math.pi*swing)+6*swing
   ankle=Vector((c.x,.14+lift,z));delta=ankle-hip;u=delta.normalized();l1=(b-a).length;l2=(c-b).length
   length=min(delta.length,l1+l2-.003);ankle=hip+u*length
   along=(l1*l1-l2*l2+length*length)/(2*length);bend=Vector((0,0,-1));bend=(bend-u*bend.dot(u)).normalized()
   knee=hip+u*along+bend*math.sqrt(max(0,l1*l1-along*along))
   positions['knee'+side]=knee;positions['ankle'+side]=ankle
   rotations['hip'+side]=(b-a).rotation_difference(knee-hip);rotations['knee'+side]=(c-b).rotation_difference(ankle-knee);rotations['ankle'+side]=q(roll)
 if name in ['jab','cross','kick','guard','hit','cast','combat_ready'] or name.startswith('air_') or name.startswith('cast_'):
  positions,rotations=combat_pose(name,t,names,parents,P,q)
 hands.pose(name,t,positions,rotations)
 globals={}
 for n in positions:
  m=(C@rotations[n].to_matrix()@C.inverted()).to_quaternion()@rest[n]
  globals[n]=Matrix.LocRotScale(C@positions[n],m,Vector((1,1,1)))
 for n,target in globals.items():
  bone=arm.data.bones[n]
  # Convert the authored global transforms analytically, avoiding 51 depsgraph
  # evaluations per frame while preserving the original skin/rest transforms.
  arm.pose.bones[n].matrix_basis=bone.matrix_local.inverted()@(bone.parent.matrix_local@globals[bone.parent.name].inverted() if bone.parent else Matrix.Identity(4))@target
 bpy.context.view_layer.update()
 if name in ['walk','jog','sprint']:
  # Preserve actual sole contact after skinning (ankle pivot alone is insufficient).
  deps=bpy.context.evaluated_depsgraph_get();floor=1e9
  for obj in meshes:
   ev=obj.evaluated_get(deps);me=ev.to_mesh();floor=min(floor,min(v.co.z for v in me.vertices));ev.to_mesh_clear()
  support=name=='walk' or t%.5<(.21 if name=='sprint' else .25)
  pelvis=arm.pose.bones['pelvis'];m=pelvis.matrix.copy();m.translation.z-=floor if support else min(0,floor);pelvis.matrix=m;bpy.context.view_layer.update()
clips={'idle':2,'walk':.75,'jog':3/6.8,'sprint':.4,'cruise':2,'boost':2,'jab':.6,'cross':.7,'kick':.9,'guard':1,'hit':.5,'cast':.8}
clips.update({'cast_fist':.86,'cast_palm':.82,'cast_sweep':1.13,'cast_cleave':2.42,'cast_skyfall':2.92})
clips['combat_ready']=1
clips.update({'air_'+n:clips[n] for n in ['jab','cross','kick','guard','hit','cast','cast_fist','cast_palm','cast_sweep','cast_cleave','cast_skyfall']})
scene=bpy.context.scene;scene.render.fps=60
for name,duration in clips.items():
 print('R3_BAKE',name,flush=True)
 arm.animation_data_clear();action=bpy.data.actions.new(name);arm.animation_data_create();arm.animation_data.action=action
 frames=round(duration*60)
 for f in range(frames+1):
  scene.frame_set(f);pose(name,f/frames)
  for b in arm.pose.bones:
   b.rotation_mode='QUATERNION';b.keyframe_insert('location',frame=f);b.keyframe_insert('rotation_quaternion',frame=f);b.keyframe_insert('scale',frame=f)
 action.use_fake_user=True
arm.animation_data.action=None
for action in list(bpy.data.actions):
 tr=arm.animation_data.nla_tracks.new();tr.name=action.name;st=tr.strips.new(action.name,1,action);tr.mute=True
scene.frame_start=0;scene.frame_end=120
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'source/c2-motion-r2.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'c2-motion-r2.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_skins=True)
(OUT/'clips.json').write_text(json.dumps({'fps':60,'clips':clips,'contact_normalized':{'jab':.38,'cross':.38,'kick':.38,'cast':.38,**{n:.50 for n in clips if 'cast_' in n}},'stride_m':{'walk':1.2,'jog':3.0,'sprint':4.0},'reference_speed_mps':{'walk':1.6,'jog':6.8,'sprint':10.0},'stance_fraction':{'walk':.52,'jog':.25,'sprint':.21},'forward':'-Z','rest_and_skin':'original 19 body rests preserved; 32 glove joints authored in Blender; no runtime rest rewrite','reference':'reference.png (existing approved image), no new paid generation'},indent=2))
print('R2_EXPORT_COMPLETE')
