"""Export a validated runtime reduction from the editable, fully bound source."""
import bpy, bmesh, json, sys
from pathlib import Path
out=Path(sys.argv[sys.argv.index('--')+1])
bpy.ops.wm.open_mainfile(filepath=str((out/'c2-editable.blend').resolve()))
body=bpy.data.objects['C2_OriginalProportions']
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
bm=bmesh.new();bm.from_mesh(body.data)
bmesh.ops.dissolve_degenerate(bm,dist=.00002,edges=list(bm.edges))
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(body.data);bm.free()
body.data.validate(clean_customdata=False);body.data.update();body.data.calc_loop_triangles()
extra=0
for obj in bpy.context.scene.objects:
    if obj.type=='MESH' and obj!=body:obj.data.calc_loop_triangles();extra+=len(obj.data.loop_triangles)
dec=body.modifiers.new('RuntimeReduction','DECIMATE');dec.ratio=(68000-extra)/len(body.data.loop_triangles)
bpy.ops.object.modifier_move_up(modifier=dec.name);bpy.ops.object.modifier_apply(modifier=dec.name)
total=0
for obj in bpy.context.scene.objects:
    if obj.type!='MESH':continue
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.object.vertex_group_limit_total(limit=4);bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    obj.data.validate(clean_customdata=False);obj.data.update();obj.data.calc_loop_triangles();total+=len(obj.data.loop_triangles)
    for v in obj.data.vertices:
        if abs(sum(g.weight for g in v.groups)-1)>.002:raise RuntimeError('Invalid skin normalization')
if total>70000:raise RuntimeError(f'Runtime over budget: {total}')
bpy.ops.export_scene.gltf(filepath=str((out/'c2-native.glb').resolve()),export_format='GLB',export_animations=False,export_extras=True)
record=json.loads((out/'binding-record.json').read_text());record.update(runtimeTriangles=total,weightsValidated=True,degenerateEdgesDissolved=True)
(out/'binding-record.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
print(json.dumps({'runtimeTriangles':total,'weightsValidated':True}))
