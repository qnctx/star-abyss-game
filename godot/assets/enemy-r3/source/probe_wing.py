import bpy, json
from pathlib import Path
from mathutils import Quaternion
p=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(p/'riftwing-r3.blend'))
arm=bpy.data.objects['RiftwingRig']
arm.animation_data.action=bpy.data.actions['sweep']
bpy.context.scene.frame_set(20)
def position(name):
    return [round(v,4) for v in arm.matrix_world @ arm.pose.bones[name].matrix.translation]
print('ORIGINAL',position('Wing_R_Root'),position('Wing_R_Tip'))
arm.animation_data.action=None
for axis in [(1,0,0),(0,1,0),(0,0,1)]:
    for angle in [-.7,0,.7]:
        arm.pose.bones['Wing_R_Root'].rotation_quaternion=Quaternion(axis,angle)
        bpy.context.view_layer.update()
        print('AXIS',axis,angle,position('Wing_R_Tip'))
