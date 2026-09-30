"""Render actual native-retargeted C2 skin; Cycles CPU only."""
import bpy,math,json
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'docs/art/air-combat-r9';ASSET=ROOT/'playable/assets/air-combat-r9'
bpy.ops.wm.open_mainfile(filepath=str(ASSET/'air-combat-r9.blend'))
arm=bpy.data.objects['C2_Native_AirCombat_Skin'];meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];data=json.loads((ASSET/'air-combat-clips.json').read_text());groups=[]
for j,(id,clip) in enumerate(data['clips'].items()):
 arm.animation_data.action=bpy.data.actions['C2 native | '+id];bpy.context.scene.frame_set(1+round(clip['peak']*100));bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();copies=[]
 yaw=-math.pi/2 if id=='boost' else math.pi-.65
 rotation=Matrix.Rotation(yaw,4,'Z')
 for original in meshes:
  evaluated=original.evaluated_get(deps);me=bpy.data.meshes.new_from_object(evaluated,depsgraph=deps);me.transform(rotation@original.matrix_world);ob=bpy.data.objects.new(id+'__'+original.name,me);bpy.context.collection.objects.link(ob);copies.append(ob)
 verts=[v.co for ob in copies for v in ob.data.vertices];lo=Vector([min(v[i] for v in verts) for i in range(3)]);hi=Vector([max(v[i] for v in verts) for i in range(3)]);center=(lo+hi)/2
 offset=Vector(((j%4-1.5)*3.4,0,(1-j//4)*3.4))
 for ob in copies:ob.location=offset-center
 groups.append(copies)
 cu=bpy.data.curves.new('caption','FONT');cu.body=id.upper();cu.align_x='CENTER';cu.size=.16
 ob=bpy.data.objects.new('caption',cu);bpy.context.collection.objects.link(ob);ob.location=offset+Vector((0,-.6,-1.36));ob.rotation_euler=(math.pi/2,0,0)
for ob in meshes:ob.hide_render=True
bpy.ops.object.camera_add(location=(0,-25,1.7));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,1.7))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=13.9
for loc,energy,size in [((-5,-5,8),1800,8),((6,-3,3),1200,6)]:
 bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=energy;light.data.size=size;light.rotation_euler=(Vector((0,0,1.7))-light.location).to_track_quat('-Z','Y').to_euler()
s=bpy.context.scene;s.camera=camera;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=16;s.render.resolution_x=2000;s.render.resolution_y=1100;s.render.resolution_percentage=100;s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.04,.05,.07,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.4
s.render.filepath=str(OUT/'air-combat-contact-sheet.png');bpy.ops.render.render(write_still=True)
for ob in bpy.context.scene.objects:
 if ob.type=='FONT':ob.hide_render=True
for j,id in enumerate(data['clips']):
 for k,group in enumerate(groups):
  for ob in group:ob.hide_render=k!=j
 offset=Vector(((j%4-1.5)*3.4,0,(1-j//4)*3.4));camera.location=offset+Vector((0,-15,0));camera.rotation_euler=(offset-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=2.85
 s.render.resolution_x=800;s.render.resolution_y=800;s.render.filepath=str(OUT/(id+'.png'));bpy.ops.render.render(write_still=True)
print('AIR_COMBAT_REFERENCE_RENDER_DONE')
