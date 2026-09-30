"""Run only during controller-approved exclusive GPU slot."""
import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for name,loc in [('command',(-8,0,0)),('medical',(0,3,0)),('workshop',(8,0,0))]:
 bpy.ops.import_scene.gltf(filepath=str(ROOT/'playable/assets/camp-v2'/f'{name}.glb'))
 for ob in bpy.context.selected_objects:ob.location+=Vector(loc)
bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;ground.name='Preview ground only';ground.location.z=-.06
m=bpy.data.materials.new('Preview lunar ground');m.diffuse_color=(.095,.102,.12,1);ground.data.materials.append(m)
bpy.ops.object.light_add(type='AREA',location=(1,-9,17));bpy.context.object.data.energy=4500;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=13
bpy.ops.object.light_add(type='SUN',location=(0,0,12));sun=bpy.context.object;sun.rotation_euler=(.45,-.3,-.5);sun.data.energy=2
bpy.ops.object.camera_add(location=(21,-31,19));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,2))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=33
s=bpy.context.scene;s.camera=camera;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=16;s.render.resolution_x=1800;s.render.resolution_y=1000;s.render.resolution_percentage=100;s.world.color=(.18,.18,.18);s.render.image_settings.file_format='PNG';s.render.filepath=str(ROOT/'docs/art/camp-v2/camp-blender-preview.png');bpy.ops.render.render(write_still=True)
