"""Read-only topology and weight audit for the pending hand reference batch."""
import bpy,json
from pathlib import Path
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path('godot/assets/c2-explorer.glb').resolve()))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
report={'bone_names':[b.name for b in arm.data.bones],'hands':{},'mesh_changed':False}
for side in ['L','R']:
    sets=[]
    for obj in [o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==arm]:
        group=obj.vertex_groups.get('wrist'+side)
        if group is None:continue
        vertices=[v for v in obj.data.vertices if any(g.group==group.index and g.weight>.5 for g in v.groups)]
        if vertices:
            sets.append({'mesh':obj.name,'wrist_dominant_vertices':len(vertices),'local_bounds_min':[min(v.co[i] for v in vertices) for i in range(3)],'local_bounds_max':[max(v.co[i] for v in vertices) for i in range(3)]})
    report['hands'][side]=sets
Path('godot/assets/motion-r2/hand-audit.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
