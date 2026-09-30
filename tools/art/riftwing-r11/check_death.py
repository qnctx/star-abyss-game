import bpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'playable/assets/creatures/riftwing-r11/riftwing-r11.blend'))
a=bpy.data.objects['RiftwingRig'];a.animation_data.action=bpy.data.actions['death'];bpy.context.scene.frame_set(45);bpy.context.view_layer.update();d=bpy.context.evaluated_depsgraph_get()
for o in bpy.context.scene.objects:
 if o.type=='MESH':
  e=o.evaluated_get(d);m=e.to_mesh();print('DEATH_MIN',o.name,min(v.co.z for v in m.vertices));e.to_mesh_clear()
