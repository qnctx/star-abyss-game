"""Read-only original C2 topology render before rigging decisions."""
import bpy, json
from pathlib import Path
from mathutils import Vector
out=Path('godot/assets/motion-r2/evidence/r3-diagnostic').resolve()
out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path('godot/assets/c2-explorer.glb').resolve()))
scene=bpy.context.scene
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO'
scene.display.shading.color_type='MATERIAL'
scene.display.shading.show_shadows=True
scene.display.shading.show_cavity=True
scene.display.shading.background_type='WORLD'
scene.world=bpy.data.worlds.new('DiagnosticWorld')
scene.world.color=(.04,.04,.04)
scene.render.resolution_x=768
scene.render.resolution_y=768
scene.render.resolution_percentage=100
camdata=bpy.data.cameras.new('DiagnosticCamera')
cam=bpy.data.objects.new('DiagnosticCamera',camdata)
scene.collection.objects.link(cam);scene.camera=cam
camdata.type='ORTHO';camdata.ortho_scale=.30;camdata.clip_start=.001
target=Vector((.365,0,.86))
for name,offset in [('front',(0,-1,0)),('outside',(1,0,0)),('inside',(-1,0,0)),('back',(0,1,0))]:
    cam.location=target+Vector(offset)
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(name+'.png'))
    bpy.ops.render.render(write_still=True)
print('R3_HAND_DIAG_COMPLETE')
