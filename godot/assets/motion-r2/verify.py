import bpy,json,sys,numpy as np
from pathlib import Path
P=Path('godot/assets/motion-r2').resolve()
bpy.ops.wm.open_mainfile(filepath=str(P/'source/c2-motion-r2.blend'))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==arm]
result={};fail=[]
for action in bpy.data.actions:
 if '--gait-r4' in sys.argv and action.name not in ['walk','jog','sprint']:continue
 arm.animation_data.action=action
 if action.slots:arm.animation_data.action_slot=action.slots[0]
 mn=np.array([1e9]*3);mx=-mn;edge_max=0.;samples=0
 for f in range(int(action.frame_range[0]),int(action.frame_range[1])+1):
  bpy.context.scene.frame_set(f);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
  for o in meshes:
   obj=o.evaluated_get(deps);mesh=obj.to_mesh();co=np.empty(len(mesh.vertices)*3,dtype=np.float32);mesh.vertices.foreach_get('co',co);co=co.reshape(-1,3)
   if not np.isfinite(co).all():fail.append(action.name+' nonfinite')
   mn=np.minimum(mn,co.min(axis=0));mx=np.maximum(mx,co.max(axis=0))
   edges=np.empty(len(mesh.edges)*2,dtype=np.int32);mesh.edges.foreach_get('vertices',edges);edges=edges.reshape(-1,2)
   edge_max=max(edge_max,float(np.linalg.norm(co[edges[:,0]]-co[edges[:,1]],axis=1).max()))
   obj.to_mesh_clear()
  samples+=1
 if np.max(mx-mn)>3 or edge_max>.65:fail.append(action.name+' oversized deformation')
 result[action.name]={'frames':samples,'bounds_min':mn.tolist(),'bounds_max':mx.tolist(),'largest_edge_m':edge_max}
report={'clips':result,'failures':fail,'method':'Every authored frame; evaluated original skinned geometry, finite coordinates, extent <=3m, edge <=0.65m. This is deformation evidence, not subjective input acceptance.'}
(P/('gait-r4-deformation.json' if '--gait-r4' in sys.argv else 'deformation-report.json')).write_text(json.dumps(report,indent=2))
print(json.dumps(report))
if fail:raise RuntimeError(str(fail))
