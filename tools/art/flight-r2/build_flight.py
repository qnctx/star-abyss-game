"""Reference-led flight animation authored on an editable Blender armature."""
import bpy,json,re,math
from pathlib import Path
from mathutils import Vector,Euler
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'playable/assets/flight-r2';OUT.mkdir(parents=True,exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
source=(ROOT/'playable/src/humanoid-rig.mjs').read_text('utf-8')
rig=[(m[0],int(m[1]),[float(v) for v in m[2].split(',')]) for m in re.findall(r"\['(\w+)',(-?\d+),\[([^\]]+)\]",source)]
assert len(rig)==19
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'playable/assets/characters/c2-explorer.glb'))
old=list(bpy.context.scene.objects);meshes=[o for o in old if o.type=='MESH']
armdata=bpy.data.armatures.new('HUMANOID_RIG_Flight_R2');arm=bpy.data.objects.new('HUMANOID_RIG_Flight_R2',armdata);bpy.context.collection.objects.link(arm)
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
heads=[]
for name,parent,pos in rig:
 p=Vector((pos[0],-pos[2],pos[1]))
 if parent>=0:p+=heads[parent]
 heads.append(p);bone=armdata.edit_bones.new(name);bone.head=p;bone.tail=p+Vector((0,0,.12));bone.roll=0
 if parent>=0:bone.parent=armdata.edit_bones[rig[parent][0]]
bpy.ops.object.mode_set(mode='OBJECT')
for ob in meshes:
 mw=ob.matrix_world.copy();ob.parent=arm;ob.matrix_world=mw
 for mod in list(ob.modifiers):
  if mod.type=='ARMATURE':mod.object=arm
 # Imported names normally match native bones; normalize optional exporter prefix.
 for vg in ob.vertex_groups:
  for name,_,_ in rig:
   if vg.name.endswith(name):vg.name=name;break
for ob in old:
 if ob not in meshes:bpy.data.objects.remove(ob,do_unlink=True)
arm.show_in_front=True
def posture(kind,phase):
 breath=math.sin(phase*2*math.pi)*.012;rot=[[0.,0.,0.] for _ in rig];pos=[0,.018+breath*.4,0]
 speed=0 if kind in ['hover','land'] else 1;bank=.28 if kind=='bank-left' else -.28 if kind=='bank-right' else 0
 rot[0]=[-.53*speed,0,bank];rot[1]=[.045*speed,0,-bank*.22];rot[4]=[.2*speed,0,-bank*.15]
 for shoulder,elbow,wrist,hip,knee,ankle,side in [(6,7,8,13,14,15,-1),(10,11,12,16,17,18,1)]:
  # Hands relax below hips; no forward 90-degree shoulder raise.
  rot[shoulder]=[-.10-.16*speed+breath,0,side*(.16+.08*speed)+bank*.3]
  rot[elbow]=[.20+.06*speed,0,0];rot[wrist]=[.035,side*.06,side*.025]
  rot[hip]=[-.035-.04*speed,0,side*.035];rot[knee]=[.11+.07*speed+breath,0,0];rot[ankle]=[-.07-.05*speed,0,0]
  if kind=='land':rot[hip]=[-.27,0,side*.045];rot[knee]=[.43,0,0];rot[ankle]=[-.18,0,0];rot[shoulder]=[.08,0,side*.2]
 return pos,rot
clips={};fps=30
for kind in ['hover','cruise','bank-left','bank-right','land']:
 arm.animation_data_create();action=bpy.data.actions.new('Flight R2 | '+kind);arm.animation_data.action=action;action.use_fake_user=True
 duration=2 if kind!='land' else 1;keys=[]
 for phase in [0,.25,.5,.75,1]:
  frame=1+round(phase*duration*fps);pos,rot=posture(kind,phase);quats=[]
  for i,(name,_,_) in enumerate(rig):
   pb=arm.pose.bones[name];pb.rotation_mode='QUATERNION';q=Euler(rot[i],'XYZ').to_quaternion();pb.rotation_quaternion=q;pb.keyframe_insert('rotation_quaternion',frame=frame,group=name);quats.append([q.x,q.y,q.z,q.w])
   pb.location=(0,0,0)
  pb=arm.pose.bones['pelvis'];pb.location=pos;pb.keyframe_insert('location',frame=frame,group='pelvis')
  keys.append({'time':round(phase*duration,4),'position':pos,'rotations':quats})
 clips[kind]={'duration':duration,'loop':True,'keys':keys}
 # Preserve each authored action in NLA, muted so previews select a single action.
 track=arm.animation_data.nla_tracks.new();track.name=kind;strip=track.strips.new(kind,1,action);track.mute=True
arm.animation_data.action=bpy.data.actions.get('Flight R2 | cruise');bpy.context.scene.frame_end=61;bpy.context.scene.frame_set(16)
bpy.context.scene.render.fps=fps
asset={'version':'flight-blender-r2','source':'flight-r2.blend','reference':'docs/art/flight-r2/flight-reference.png','boneNames':[r[0] for r in rig],'coordinates':'HUMANOID_RIG local Y-up, quaternion XYZW','clips':clips}
(OUT/'flight-clips.json').write_text(json.dumps(asset,indent=2),encoding='utf-8')
(OUT/'flight-clips.mjs').write_text('// Exported from Blender flight-r2.blend; rebuild with tools/art/flight-r2/build_flight.py.\nexport default '+json.dumps(asset,separators=(',',':'))+';\n',encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'flight-r2.blend'))
print('FLIGHT_R2_SOURCE_AND_CLIPS_SAVED',len(rig),len(clips))
