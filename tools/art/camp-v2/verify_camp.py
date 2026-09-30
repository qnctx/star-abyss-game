import bpy,json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]; OUT=ROOT/'playable/assets/camp-v2'
manifest=json.loads((OUT/'manifest.json').read_text('utf-8')); results=[]
for item in manifest['buildings']:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 bpy.ops.import_scene.gltf(filepath=str(OUT/(item['id']+'.glb')))
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']; tris=0; bounds=[]
 for o in meshes:
  o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles)
  assert all(math.isfinite(v) for p in o.data.vertices for v in p.co)
  bounds.extend([o.matrix_world@v.co for v in o.data.vertices])
 assert tris==item['triangles'],(tris,item['triangles'])
 assert len(meshes)==item['meshBatches']
 assert all(p.area>1e-10 for o in meshes for p in o.data.polygons)
 # Exported glTF imports back to Blender Z-up. Entry negative Y is unobstructed above deck.
 w,h,d=item['bodySize']; opening=2.05 if item['id']!='workshop' else 5.2
 side=(w-opening)/2
 item['collisionBoxes']=[{'name':'leftWall','center':[-w/2,2,0],'size':[.22,2.6,d]},{'name':'rightWall','center':[w/2,2,0],'size':[.22,2.6,d]},{'name':'backWall','center':[0,2,-d/2],'size':[w,2.6,.22]}]
 for s in [-1,1]:item['collisionBoxes'].append({'name':'frontJamb','center':[s*(opening/2+side/2),2,d/2],'size':[side,2.6,.25]})
 if item['id']=='workshop':item['collisionBoxes'].append({'name':'serviceCounter','center':[0,1.22,d/2+.13],'size':[4.85,.98,.96]})
 item['walkableFloor']={'center':[0,.73,0],'size':[w-.16,.12,d-.16]}
 item['doorClearance']={'width':opening if item['id']=='workshop' else 1.89,'height':2.33,'floorHeight':.81}
 item['fileBytes']=(OUT/(item['id']+'.glb')).stat().st_size
 results.append({'id':item['id'],'triangles':tris,'meshes':len(meshes),'bytes':item['fileBytes'],'finiteVertices':True,'nondegenerateFaces':True,'nativeBounds':{'min':[min(p[i] for p in bounds) for i in range(3)],'max':[max(p[i] for p in bounds) for i in range(3)]}})
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
(ROOT/'docs/art/camp-v2/verification.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps(results,indent=2))
