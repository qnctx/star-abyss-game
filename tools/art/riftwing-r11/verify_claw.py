import bpy,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3];DOC=ROOT/'docs/art/creatures/riftwing-r11';OUT=ROOT/'playable/assets/creatures/riftwing-r11'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'riftwing-r11.blend'));arm=bpy.data.objects['RiftwingRig'];body=bpy.data.objects['RiftwingBody'];sole={}
for leg in ['LF','RF','LH','RH']:
 vg=body.vertex_groups[leg+'_Foot'].index;sole[leg]=[v.index for v in body.data.vertices if v.co.z<.10 and any(g.group==vg and g.weight>.35 for g in v.groups)];assert sole[leg],leg
arm.animation_data.action=bpy.data.actions['ground-claw'];report=[]
for phase in [0,.125,.25,.375,.5,.625,.75,.875,1]:
 bpy.context.scene.frame_set(round(phase*.8*30));bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();e=body.evaluated_get(deps);m=e.to_mesh();feet={}
 for leg,indices in sole.items():
  vs=[m.vertices[i].co for i in indices];p=sum(vs,Vector())/len(vs);feet[leg]={'minY':min(v.z for v in vs),'center':[p.x,p.z,-p.y],'vertices':len(vs)}
 e.to_mesh_clear();report.append({'progress':phase,'feet':feet})
start=Vector(report[0]['feet']['RF']['center']);peak=Vector(report[4]['feet']['RF']['center']);assert (peak-start).length>.4,(start,peak)
for frame in report:
 assert sum(abs(frame['feet'][leg]['minY'])<.035 for leg in ['LF','LH','RH'])>=2,frame
result={'clip':'ground-claw','duration':.8,'contactProgress':.5,'rightForeclawDisplacement':(peak-start).length,'rightForeclawForwardDelta':peak.z-start.z,'supportCriterion':'At least two of LF/LH/RH soles within 3.5cm of ground at every sampled phase','samples':report}
(DOC/'ground-claw-verification.json').write_text(json.dumps(result,indent=2));print(json.dumps({k:v for k,v in result.items() if k!='samples'}))
bpy.ops.mesh.primitive_plane_add(size=100,location=(0,0,-.003));o=bpy.context.object;m=bpy.data.materials.new('Preview ground');m.diffuse_color=(.42,.43,.45,1);o.data.materials.append(m)
bpy.ops.object.camera_add(location=(5.2,6,3.2));cam=bpy.context.object;cam.rotation_euler=(Vector((0,-.2,.85))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=4.7
bpy.ops.object.light_add(type='AREA',location=(1,4,6));o=bpy.context.object;o.data.energy=1100;o.data.size=4;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
s=bpy.context.scene;s.camera=cam;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=20;s.render.resolution_x=1100;s.render.resolution_y=850;s.render.resolution_percentage=100;s.world.color=(.18,.18,.18)
for phase in [.25,.5,1]:s.frame_set(round(phase*.8*30));s.render.filepath=str(DOC/f'ground-claw-{phase}.png');bpy.ops.render.render(write_still=True)
