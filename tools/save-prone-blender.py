import bpy,os
from mathutils import Vector
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)));folder=os.path.join(root,'playable','assets','animations','prone-v2')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=os.path.join(folder,'c2-prone-v2.glb'))
for name,p,target in [('Side',(3,0,1.25),(0,0,.25)),('Front',(0,3,1),(0,0,.25)),('Top',(0,0,4),(0,0,0))]:
 bpy.ops.object.camera_add(location=p);c=bpy.context.object;c.name=name;c.rotation_euler=(Vector(target)-c.location).to_track_quat('-Z','Y').to_euler();c.data.type='ORTHO';c.data.ortho_scale=2.6
 if name=='Side':bpy.context.scene.camera=c
bpy.ops.object.light_add(type='AREA',location=(0,-1,4));l=bpy.context.object;l.data.energy=700;l.data.size=4
bpy.context.scene.world.color=(.18,.18,.18);bpy.context.scene.frame_end=60
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(folder,'c2-prone-v2.blend'));print('PRONE_ANIMATION_SOURCE_SAVED')
