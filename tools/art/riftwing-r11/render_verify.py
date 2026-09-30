import bpy,json,math,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'playable/assets/creatures/riftwing-r11';DOC=ROOT/'docs/art/creatures/riftwing-r11'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'riftwing-r11.blend'));arm=bpy.data.objects['RiftwingRig'];meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];manifest=json.loads((OUT/'manifest.json').read_text())
audits={}
for clip in manifest['clips']:
 arm.animation_data.action=bpy.data.actions[clip['name']];bounds=[]
 for i in range(17):
  bpy.context.scene.frame_set(round(i/16*clip['duration']*30));bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();points=[]
  for o in meshes:
   eo=o.evaluated_get(deps);me=eo.to_mesh();points.extend([o.matrix_world@v.co for v in me.vertices]);eo.to_mesh_clear()
  assert all(math.isfinite(c) for p in points for c in p)
  lo=[min(p[j] for p in points) for j in range(3)];hi=[max(p[j] for p in points) for j in range(3)];bounds.append((lo,hi))
 mn=[min(b[0][j] for b in bounds) for j in range(3)];mx=[max(b[1][j] for b in bounds) for j in range(3)]
 # Native Blender xyz -> game xyz=(x,z,-y).
 audits[clip['name']]={'samples':17,'bounds':{'min':[mn[0],mn[2],-mx[1]],'max':[mx[0],mx[2],-mn[1]]},'turnRadiusXZ':max(math.hypot(x,y) for x in [mn[0],mx[0]] for y in [mn[1],mx[1]])}
manifest['animatedBounds']=audits;manifest['glbBytes']=(OUT/'riftwing-r11.glb').stat().st_size
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2));(DOC/'animation-verification.json').write_text(json.dumps(audits,indent=2))
if '--bounds-only' in sys.argv:print('RIFTWING_BOUNDS_COMPLETE');raise SystemExit(0)
bpy.ops.object.camera_add(location=(6,7,4));cam=bpy.context.object;cam.rotation_euler=(Vector((0,-.25,.9))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=6.6
for loc,energy,size in [((1,4,7),850,5),((-4,-1,4),650,4)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=energy;o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
s=bpy.context.scene;s.camera=cam;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=20;s.render.resolution_x=1200;s.render.resolution_y=900;s.render.resolution_percentage=100;s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.085,.095,.12,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.45
for name,t in [('ground-idle',.2),('flight',0),('flight',.25),('flight',.75),('dive',.5),('death',1)]:
 clip=next(c for c in manifest['clips'] if c['name']==name);arm.animation_data.action=bpy.data.actions[name];s.frame_set(round(t*clip['duration']*30));s.render.filepath=str(DOC/(name+'-'+str(t)+'.png'));bpy.ops.render.render(write_still=True)
print('RIFTWING_CPU_BOUNDS_AND_RENDER_COMPLETE')
