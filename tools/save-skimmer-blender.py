"""Editable source uses the EXACT geometry exported from the runtime vehicle."""
import bpy,os,math
from mathutils import Vector
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
folder=os.path.join(root,'playable','assets','vehicles')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=os.path.join(folder,'survey-skimmer-cockpit-v1.glb'))
for name,position,target in [('DriverEye',(0,-.14,1.72),(0,5,1.12)),('Exterior',(3,4,2.5),(0,0,.75))]:
 bpy.ops.object.camera_add(location=position);camera=bpy.context.object;camera.name=name;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=28
 if name=='DriverEye':bpy.context.scene.camera=camera
for position,power,size in [((0,1,5),650,5),((-3,-1,3),450,4)]:
 bpy.ops.object.light_add(type='AREA',location=position);light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
bpy.context.scene.world.color=(.18,.18,.18)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(folder,'survey-skimmer-cockpit-v1.blend'))
print('SKIMMER_SOURCE_SAVED')
