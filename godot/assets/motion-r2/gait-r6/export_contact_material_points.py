"""Export fixed, real mesh heel/toe points including every original skin weight."""
import bpy,json
from pathlib import Path
from mathutils import Matrix,Vector
p=Path('godot/assets/motion-r2').resolve()
bpy.ops.wm.open_mainfile(filepath=str(p/'source/c2-motion-r2.blend'))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');inv=Matrix(((1,0,0),(0,0,1),(0,-1,0)))
result={'coordinates':'C2 canonical Y-up / -Z forward; transform with existing skin inverse binds','points':{}}
for side in ['L','R']:
 pool=[]
 for obj in bpy.context.scene.objects:
  if obj.type!='MESH' or obj.parent!=arm:continue
  for v in obj.data.vertices:
   point=inv@(obj.matrix_world@v.co)
   if point.y<.06 and (point.x<0)==(side=='L'):pool.append((point,obj,v))
 ymin=min(row[0].y for row in pool);sole=[row for row in pool if row[0].y<ymin+.018]
 centerx=sum(row[0].x for row in sole)/len(sole)
 result['points'][side]={}
 for kind in ['heel','toe']:
  z=(max if kind=='heel' else min)(row[0].z for row in sole);target=Vector((centerx,ymin,z))
  point,obj,v=min(sole,key=lambda row:(row[0]-target).length_squared)
  weights=[{'bone':obj.vertex_groups[g.group].name,'weight':g.weight} for g in v.groups if g.weight>0]
  result['points'][side][kind]={'mesh':obj.name,'blender_vertex_index':v.index,'rest_canonical':list(point),'weights':weights,'weight_sum':sum(w['weight'] for w in weights)}
(p/'gait-r6/contact-material-points.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
