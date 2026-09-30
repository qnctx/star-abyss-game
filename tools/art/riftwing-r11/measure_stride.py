import bpy,json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[3]
bpy.ops.wm.open_mainfile(filepath=str(root/'playable/assets/creatures/riftwing-r11/riftwing-r11.blend'))
arm=bpy.data.objects['RiftwingRig'];body=bpy.data.objects['RiftwingBody']
arm.animation_data.action=bpy.data.actions['ground-walk']
ids={}
for leg in ['LF','RF','LH','RH']:
 group=body.vertex_groups[leg+'_Foot'].index
 ids[leg]=[v.index for v in body.data.vertices if v.co.z<.1 and any(g.group==group and g.weight>.35 for g in v.groups)]
tracks={leg:[] for leg in ids}
for frame in range(34):
 bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
 obj=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=obj.to_mesh()
 for leg,indices in ids.items():
  points=[mesh.vertices[i].co for i in indices];center=sum(points,Vector())/len(points)
  tracks[leg].append({'time':frame/30,'forward':center.y,'soleHeight':min(p.z for p in points)})
 obj.to_mesh_clear()
summary={leg:{'foreAftTravel':max(p['forward'] for p in points)-min(p['forward'] for p in points),'estimatedSpeedAtHalfCycleSupport':2*(max(p['forward'] for p in points)-min(p['forward'] for p in points))/1.1} for leg,points in tracks.items()}
print('STRIDE_MEASUREMENT',json.dumps(summary))
