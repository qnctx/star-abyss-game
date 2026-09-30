"""CPU-only six asset contact sheet, individual views and GLB roundtrip audit."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'playable/assets/ascension-r8';DOC=ROOT/'docs/art/ascension-r8'
manifest=json.loads((OUT/'manifest.json').read_text('utf-8'));groups=[];audit=[]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for i,record in enumerate(manifest['assets']):
 bpy.ops.import_scene.gltf(filepath=str(OUT/(record['id']+'.glb')));objs=[o for o in bpy.context.selected_objects if o.type=='MESH'];groups.append(objs)
 count=0
 for o in objs:
  o.data.calc_loop_triangles();count+=len(o.data.loop_triangles)
  assert all(math.isfinite(c) for v in o.data.vertices for c in v.co)
  assert all(p.area>1e-10 for p in o.data.polygons)
 assert count==record['triangles'];assert len(objs)==record['drawCalls']<=4
 offset=Vector(((i%3-1)*5.9,0,(1-i//3)*5.3))
 for o in objs:o.location+=offset
 audit.append({'id':record['id'],'triangles':count,'drawCalls':len(objs),'finiteVertices':True,'nondegenerateFaces':True})
 # Captions are preview-only, never included in delivered assets.
 cu=bpy.data.curves.new('caption','FONT');cu.body=record['id'].upper();cu.align_x='CENTER';cu.size=.23
 ob=bpy.data.objects.new('caption',cu);bpy.context.collection.objects.link(ob);ob.location=offset+Vector((0,0,-2.5));ob.rotation_euler=(math.pi/2,0,0)
 mat=bpy.data.materials.new('Caption');mat.diffuse_color=(.65,.74,.85,1);cu.materials.append(mat)
bpy.ops.object.camera_add(location=(0,-24,2.65));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,2.65))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=18
bpy.ops.object.light_add(type='AREA',location=(-5,-7,10));bpy.context.object.data.energy=2200;bpy.context.object.data.size=10
bpy.ops.object.light_add(type='AREA',location=(8,-5,3));bpy.context.object.data.energy=1700;bpy.context.object.data.size=8
for light in [o for o in bpy.context.scene.objects if o.type=='LIGHT']:
 light.rotation_euler=(Vector((0,0,2.65))-light.location).to_track_quat('-Z','Y').to_euler()
s=bpy.context.scene;s.camera=cam;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=24;s.render.resolution_x=1800;s.render.resolution_y=1180;s.render.resolution_percentage=100
s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.007,.01,.024,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.3
s.render.filepath=str(DOC/'ascension-assets-sheet.png');bpy.ops.render.render(write_still=True)
for ob in bpy.context.scene.objects:
 if ob.type=='FONT':ob.hide_render=True
for i,record in enumerate(manifest['assets']):
 for j,objs in enumerate(groups):
  for o in objs:o.hide_render=i!=j
 offset=Vector(((i%3-1)*5.9,0,(1-i//3)*5.3));cam.location=offset+Vector((.55,-12,.25));cam.rotation_euler=(offset-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=5.8
 s.render.resolution_x=900;s.render.resolution_y=900;s.render.filepath=str(DOC/(record['id']+'.png'));bpy.ops.render.render(write_still=True)
(DOC/'verification.json').write_text(json.dumps({'renderer':'Cycles CPU','assets':audit,'totalTriangles':sum(a['triangles'] for a in audit)},indent=2),encoding='utf-8')
print('ASCENSION_CPU_VERIFY_AND_RENDER_COMPLETE')
