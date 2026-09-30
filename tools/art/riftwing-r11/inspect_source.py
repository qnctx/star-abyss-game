import bpy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];DOC=ROOT/'docs/art/creatures/riftwing-r11'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'playable/assets/creatures/rift-prowler-v1/rift-prowler.glb'))
report=[]
for o in bpy.context.scene.objects:
 d={'name':o.name,'type':o.type,'matrix':[list(r) for r in o.matrix_world]}
 if o.type=='MESH':d.update(vertices=len(o.data.vertices),faces=len(o.data.polygons),materials=[m.name for m in o.data.materials],bounds=[list(v) for v in o.bound_box])
 if o.type=='ARMATURE':d['bones']=[{'name':b.name,'parent':b.parent.name if b.parent else None,'head':list(b.head_local),'tail':list(b.tail_local),'matrix':[list(r) for r in b.matrix_local]} for b in o.data.bones]
 report.append(d)
(DOC/'source-inspection.json').write_text(json.dumps(report,indent=2));print(json.dumps(report)[:16000])
