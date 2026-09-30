"""CPU ground-support evidence with actor/world root fixed at origin."""
import bpy,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3];DOC=ROOT/'docs/art/creatures/riftwing-r11'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'playable/assets/creatures/riftwing-r11/riftwing-r11.blend'));arm=bpy.data.objects['RiftwingRig'];meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];body=bpy.data.objects['RiftwingBody'];report={}
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.003));ground=bpy.context.object;ground.name='Preview ground only';m=bpy.data.materials.new('Preview light gray ground');m.diffuse_color=(.45,.46,.48,1);ground.data.materials.append(m)
bpy.ops.object.camera_add(location=(5.3,6,3.25));cam=bpy.context.object;cam.rotation_euler=(Vector((0,-.3,.75))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=4.8
for pos,energy,size in [((2,3,6),1050,4),((-3,-2,4),500,3)]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=energy;o.data.size=size;o.rotation_euler=(Vector((0,0,.8))-o.location).to_track_quat('-Z','Y').to_euler()
s=bpy.context.scene;s.camera=cam;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=24;s.render.resolution_x=1200;s.render.resolution_y=900;s.render.resolution_percentage=100;s.world.color=(.15,.15,.15)
for name,time in [('ground-walk',.25),('ground-walk',.75),('land',1),('death',1)]:
 duration={'ground-walk':1.1,'land':1.3,'death':1.5}[name];arm.animation_data.action=bpy.data.actions[name];s.frame_set(round(time*duration*30));bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();mins={}
 for o in meshes:
  evaluated=o.evaluated_get(deps);me=evaluated.to_mesh();mins[o.name]=min((o.matrix_world@v.co).z for v in me.vertices);evaluated.to_mesh_clear()
 key=name+'-'+str(time);report[key]={'actorRootLocation':list(arm.location),'visualRootLocation':list(arm.pose.bones['Root'].location),'minYByMesh':mins,'minY':min(mins.values())}
 if name in ['death','land']:assert -.005<min(mins.values())<.01,(name,mins)
 s.render.filepath=str(DOC/(key+'-ground-contact.png'));bpy.ops.render.render(write_still=True)
(DOC/'ground-contact-verification.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
