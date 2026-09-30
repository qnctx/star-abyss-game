"""Run only in a controller-approved rendering slot."""
import bpy,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'docs/art/flight-r2';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'playable/assets/flight-r2/flight-r2.blend'))
arm=bpy.data.objects['HUMANOID_RIG_Flight_R2'];meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
print('MESH_BINDINGS',[(o.name,[(m.type,str(m.object) if m.type=='ARMATURE' else '') for m in o.modifiers],[g.name for g in o.vertex_groups]) for o in meshes])
assert any(any(m.type=='ARMATURE' and m.object==arm for m in o.modifiers) for o in meshes)
bpy.ops.object.light_add(type='AREA',location=(1,-3,5));bpy.context.object.data.energy=500;bpy.context.object.data.size=4
bpy.ops.object.light_add(type='AREA',location=(-2,2,3));bpy.context.object.data.energy=300;bpy.context.object.data.size=3
bpy.ops.object.camera_add(location=(3,-6,2.3));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1.05))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.65
s=bpy.context.scene;s.camera=cam;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=16;s.render.resolution_x=700;s.render.resolution_y=850;s.render.resolution_percentage=100;s.world.color=(.18,.18,.18)
for name in ['hover','cruise','bank-right','land']:
 arm.animation_data.action=bpy.data.actions['Flight R2 | '+name];s.frame_set(16);s.render.filepath=str(OUT/f'flight-blender-{name}.png');bpy.ops.render.render(write_still=True)
arm.animation_data.action=bpy.data.actions['Flight R2 | hover'];s.frame_set(16)
cam.location=(0,.36,1.68);cam.rotation_euler=(Vector((0,4,1.5))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='PERSP';cam.data.lens=24
s.render.resolution_x=1100;s.render.resolution_y=650;s.render.filepath=str(OUT/'flight-blender-forward-clearance.png');bpy.ops.render.render(write_still=True)
print('FLIGHT_RENDER_DONE',len(meshes),'skinned original meshes')
