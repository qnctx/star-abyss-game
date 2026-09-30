"""Read-only Blender diagnosis of the old gait's actual lowest deformed vertex."""
import bpy,json,numpy as np
from pathlib import Path
p=Path('godot/assets/motion-r2');bpy.ops.wm.open_mainfile(filepath=str((p/'source/gait-r5-before/c2-motion-r2.blend').resolve()))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==arm];result={}
for name in ['walk','jog','sprint']:
    action=bpy.data.actions[name];arm.animation_data.action=action
    if action.slots:arm.animation_data.action_slot=action.slots[0]
    lowest={'height':1e9}
    for frame in range(int(action.frame_range[0]),int(action.frame_range[1])+1):
        bpy.context.scene.frame_set(frame);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
        for o in meshes:
            obj=o.evaluated_get(deps);mesh=obj.to_mesh();coords=np.empty(len(mesh.vertices)*3,dtype=np.float32);mesh.vertices.foreach_get('co',coords);coords=coords.reshape(-1,3);i=int(coords[:,2].argmin())
            if float(coords[i,2])<lowest['height']:
                v=o.data.vertices[i]
                lowest={'height':float(coords[i,2]),'frame':frame,'mesh':o.name,'vertex':i,'rest_position_blender':list(v.co),'deformed_position_blender':coords[i].tolist(),'weights':{o.vertex_groups[g.group].name:g.weight for g in v.groups}}
            obj.to_mesh_clear()
    result[name]=lowest
(p/'gait-r5/evidence/lowest-skin-source.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
