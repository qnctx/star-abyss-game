import bpy,json
from pathlib import Path
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path('godot/assets/c2-explorer.glb').resolve()))
report=[]
for o in bpy.context.scene.objects:
 d={'name':o.name,'type':o.type,'matrix':[list(r) for r in o.matrix_world]}
 if o.type=='ARMATURE':
  d['bones']=[{'name':b.name,'head':list(b.head_local),'tail':list(b.tail_local),'rotation':list(b.matrix_local.to_quaternion())} for b in o.data.bones]
 if o.type=='MESH':
  d['vertices']=len(o.data.vertices);d['bounds']=[list(v) for v in o.bound_box]
  d['bad_weights']=sum(abs(sum(g.weight for g in v.groups)-1)>0.002 for v in o.data.vertices)
 report.append(d)
Path('godot/assets/motion-r2/source-audit.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
