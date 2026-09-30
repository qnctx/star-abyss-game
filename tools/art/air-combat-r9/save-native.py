import bpy,json
from pathlib import Path
from mathutils import Quaternion
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'playable/assets/air-combat-r9'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'air-combat-r9.blend'));bpy.context.preferences.filepaths.save_version=0
data=json.loads((OUT/'native-clips.json').read_text());rig=json.loads((OUT/'air-combat-clips.json').read_text())['boneNames'];arm=bpy.data.objects['C2_Native_AirCombat_Skin']
for id,clip in data['clips'].items():
 action=bpy.data.actions.new('C2 native | '+id);action.use_fake_user=True;arm.animation_data_create();arm.animation_data.action=action
 for key in clip['keys']:
  frame=1+round(key['progress']*100)
  for i,name in enumerate(rig):
   x,y,z,w=key['rotations'][i];pb=arm.pose.bones[name];pb.rotation_mode='QUATERNION';pb.rotation_quaternion=Quaternion((w,x,y,z));pb.keyframe_insert('rotation_quaternion',frame=frame,group=name)
  pb=arm.pose.bones['pelvis'];pb.location=key['position'];pb.keyframe_insert('location',frame=frame,group='pelvis')
 track=arm.animation_data.nla_tracks.new();track.name=id;track.strips.new(id,1,action);track.mute=True
arm.animation_data.action=bpy.data.actions['C2 native | boost'];bpy.context.scene.frame_set(51)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'air-combat-r9.blend'));print('NATIVE_SKIN_ACTIONS_SAVED')
