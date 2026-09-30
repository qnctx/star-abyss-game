"""Image-first eight-action canonical rig authoring; CPU, no external generation."""
import bpy,json,re,math,shutil,struct
from pathlib import Path
from mathutils import Vector,Euler
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'playable/assets/air-combat-r9';DOC=ROOT/'docs/art/air-combat-r9'
OUT.mkdir(parents=True,exist_ok=True);DOC.mkdir(parents=True,exist_ok=True)
ref=Path('C:/Users/HUAWEI/.codex/generated_images/01a0d79e-2cdf-7481-97d5-cac1cb7e07f1/exec-4480e9af-fa82-471d-b16b-582f4ec7e255.png')
for target in [OUT/'reference.png',DOC/'reference.png']:shutil.copy2(ref,target)
bpy.context.preferences.filepaths.save_version=0
rig=[(m[0],int(m[1]),[float(v) for v in m[2].split(',')]) for m in re.findall(r"\['(\w+)',(-?\d+),\[([^\]]+)\]",(ROOT/'playable/src/humanoid-rig.mjs').read_text('utf-8'))]
glb=(ROOT/'playable/assets/characters/c2-explorer.glb').read_bytes();length=struct.unpack_from('<I',glb,12)[0];gltf=json.loads(glb[20:20+length]);native=next(json.loads(n['extras']['c2NativeRig']) for n in gltf['nodes'] if 'c2NativeRig' in n.get('extras',{}))
(OUT/'native-rig.json').write_text(json.dumps(native,indent=2),encoding='utf-8')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'playable/assets/characters/c2-explorer.glb'))
old=list(bpy.context.scene.objects);meshes=[o for o in old if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]
def armature(name,positions):
 data=bpy.data.armatures.new(name);arm=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(arm)
 bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
 for i,(name,parent,_) in enumerate(rig):
  p=positions[i];bone=data.edit_bones.new(name);bone.head=(p[0],-p[2],p[1]);bone.tail=bone.head+Vector((0,0,.1));bone.roll=0
  if parent>=0:bone.parent=data.edit_bones[rig[parent][0]]
 bpy.ops.object.mode_set(mode='OBJECT');arm.show_in_front=True;return arm
absolute=[]
for _,parent,pos in rig:absolute.append(list(Vector(pos)+(Vector(absolute[parent]) if parent>=0 else Vector((0,0,0)))))
driver=armature('Canonical_AirCombat_Driver',absolute);skin=armature('C2_Native_AirCombat_Skin',native['positions'])
driver.hide_render=True
for o in meshes:
 world=o.matrix_world.copy();o.parent=None;o.data.transform(world);o.matrix_world.identity();o.parent=skin
 for m in o.modifiers:
  if m.type=='ARMATURE':m.object=skin
for o in old:
 if o not in meshes:bpy.data.objects.remove(o,do_unlink=True)
def neutral():
 rot=[[0.,0.,0.] for _ in rig]
 for shoulder,elbow,hip,knee,ankle,side in [(6,7,13,14,15,-1),(10,11,16,17,18,1)]:
  rot[shoulder]=[.04,0,side*.10];rot[elbow]=[.12,0,0];rot[hip]=[.02,0,side*.025];rot[knee]=[-.06,0,0];rot[ankle]=[.025,0,0]
 return [0,.02,0],rot
def keypose(kind):
 pos,r=neutral()
 if kind=='boost':
  r[0]=[-1.40,0,0];r[1]=[.015,0,0];r[2]=[.015,0,0];r[3]=[.015,0,0];r[4]=[1.25,0,0]
  for s,e,w,h,k,a,side in [(6,7,8,13,14,15,-1),(10,11,12,16,17,18,1)]:r[s]=[-.21,0,side*.07];r[e]=[.06,0,0];r[w]=[.06,0,0];r[h]=[-.015,0,side*.018];r[k]=[-.035,0,0];r[a]=[-.08,0,0]
 elif kind in ['left-jab','right-cross']:
  left=kind=='left-jab';strike=6 if left else 10;guard=10 if left else 6;side=-1 if left else 1
  r[0]=[-.10,side*.17,0];r[2]=[.05,side*.20,side*.055];r[3]=[.02,side*.22,0];r[4]=[0,-side*.42,0]
  r[strike]=[1.50,-side*.05,side*.055];r[strike+1]=[.07,0,0];r[strike+2]=[0,0,side*.03]
  r[guard]=[.92,-side*.28,-side*.16];r[guard+1]=[1.35,0,0];r[guard+2]=[-.12,0,0]
  r[13]=[.30,0,-.14];r[14]=[-.45,0,0];r[16]=[.85,0,.15];r[17]=[-1.2,0,0]
 elif kind=='rising-kick':
  r[0]=[.16,-.12,-.09];r[2]=[-.09,.13,0];r[4]=[-.12,0,0]
  r[16]=[2.05,0,.06];r[17]=[-.10,0,0];r[18]=[-.15,0,0]
  r[13]=[1.30,0,-.11];r[14]=[-2.05,0,0];r[15]=[.2,0,0]
  r[6]=[-.30,0,-.70];r[7]=[.30,0,0];r[10]=[.8,0,.13];r[11]=[1.15,0,0]
 elif kind=='air-guard':
  r[0]=[-.04,0,0];r[2]=[.14,0,0];r[4]=[.14,0,0]
  for s,e,h,k,side in [(6,7,13,14,-1),(10,11,16,17,1)]:r[s]=[1.03,side*.10,-side*.22];r[e]=[1.28,-side*.12,-side*.50];r[h]=[1.36,0,side*.09];r[k]=[-2.08,0,0]
 elif kind=='impact':
  r[0]=[.60,0,-.12];r[2]=[-.06,0,0];r[3]=[-.04,0,0];r[4]=[.05,0,0]
  r[6]=[-.32,0,-.73];r[10]=[-.22,0,.86];r[7]=[.28,0,0];r[11]=[.22,0,0];r[13]=[.18,0,-.16];r[14]=[-.35,0,0];r[16]=[.38,0,.13];r[17]=[-.6,0,0]
 elif kind=='launch':
  r[0]=[.72,0,.18];r[2]=[-.06,0,0];r[4]=[-.12,0,0];r[6]=[-.22,0,-.49];r[10]=[-.17,0,.4];r[7]=[.15,0,0];r[11]=[.13,0,0];r[13]=[-.09,0,-.06];r[16]=[-.13,0,.07];r[14]=[-.12,0,0];r[17]=[-.18,0,0]
 return pos,r
clips={}
for kind in ['hover','boost','left-jab','right-cross','rising-kick','air-guard','impact','launch']:
 action=bpy.data.actions.new('Canonical | '+kind);action.use_fake_user=True;driver.animation_data_create();driver.animation_data.action=action
 basepos,base=neutral();peakpos,peak=keypose(kind);keys=[]
 peakq=[Euler(e,'XYZ').to_quaternion() for e in peak]
 if kind in ['left-jab','right-cross']:
  shoulder=6 if kind=='left-jab' else 10;parent=rig[shoulder][1];chain=[]
  while parent>=0:chain.append(parent);parent=rig[parent][1]
  world=Euler((0,0,0)).to_quaternion()
  for p in reversed(chain):world=world@peakq[p]
  # Counter torso winding so the striking fist extends toward canonical -Z.
  peakq[shoulder]=world.inverted()@Euler((1.52,0,0),'XYZ').to_quaternion()
 if kind=='air-guard':
  for shoulder,side in [(6,-1),(10,1)]:
   parent=rig[shoulder][1];chain=[]
   while parent>=0:chain.append(parent);parent=rig[parent][1]
   world=Euler((0,0,0)).to_quaternion()
   for p in reversed(chain):world=world@peakq[p]
   upper=Vector((0,-1,0)).rotation_difference(Vector((side*.02,-.10,-.28)).normalized())
   lower=Vector((0,-1,0)).rotation_difference(Vector((-side*.255,.115,-.04)).normalized())
   peakq[shoulder]=world.inverted()@upper;peakq[shoulder+1]=upper.inverted()@lower
 phases=[0,.18,.45,.54,.75,1] if kind in ['left-jab','right-cross','rising-kick'] else [0,.25,.5,.75,1]
 for t in phases:
  strength=([0,.38,1,.86,.3,0][phases.index(t)] if kind in ['left-jab','right-cross','rising-kick'] else (math.sin(math.pi*t)**.6 if kind in ['impact','launch'] else 1))
  rotations=[];pos=[basepos[i]+(peakpos[i]-basepos[i])*strength for i in range(3)]
  if kind in ['hover','boost']:pos[1]+=.005*math.sin(t*math.tau)
  for i,(name,_,_) in enumerate(rig):
   qa=Euler(base[i],'XYZ').to_quaternion();qb=peakq[i];q=qa.slerp(qb,strength);pb=driver.pose.bones[name];pb.rotation_mode='QUATERNION';pb.rotation_quaternion=q;pb.keyframe_insert('rotation_quaternion',frame=1+round(t*100),group=name);rotations.append([q.x,q.y,q.z,q.w])
  pb=driver.pose.bones['pelvis'];pb.location=pos;pb.keyframe_insert('location',frame=1+round(t*100),group='pelvis')
  keys.append({'progress':t,'position':pos,'rotations':rotations})
 track=driver.animation_data.nla_tracks.new();track.name=kind;track.strips.new(kind,1,action);track.mute=True
 clips[kind]={'loop':kind in ['hover','boost','air-guard'],'peak':.45 if kind in ['left-jab','right-cross','rising-kick'] else .5,'keys':keys}
data={'version':'air-combat-r9','coordinates':'canonical HUMANOID_RIG local Y-up, forward -Z, quaternion XYZW; position is visual root offset only','reference':'reference.png','boneNames':[r[0] for r in rig],'clips':clips}
(OUT/'air-combat-clips.json').write_text(json.dumps(data,indent=2),encoding='utf-8');(OUT/'air-combat-clips.mjs').write_text('export default '+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
bpy.context.scene.frame_end=101;bpy.context.scene.render.fps=30;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'air-combat-r9.blend'))
print('CANONICAL_ACTIONS_READY',len(clips),'nativePositions',len(native['positions']))
