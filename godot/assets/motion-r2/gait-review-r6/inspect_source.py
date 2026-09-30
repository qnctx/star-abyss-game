import bpy,json,hashlib
from pathlib import Path
p=Path('godot/assets/motion-r2').resolve()
bpy.ops.wm.open_mainfile(filepath=str(p/'source/c2-motion-r2.blend'))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
result={'blender':bpy.app.version_string,'bones':len(arm.data.bones),'actions':{a.name:list(a.frame_range) for a in bpy.data.actions},'meshes':[{'name':o.name,'vertices':len(o.data.vertices),'materials':[m.name for m in o.data.materials],'parent':o.parent.name if o.parent else None,'world':list(map(list,o.matrix_world))} for o in bpy.context.scene.objects if o.type=='MESH'],'rig_matrix':list(map(list,arm.matrix_world))}
(p/'gait-review-r6/source-inspection.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2))
