import bpy
from pathlib import Path
p=Path('godot/assets/motion-r2').resolve()
bpy.ops.wm.open_mainfile(filepath=str(p/'source/gait-r6-candidate/candidate.blend'))
bpy.ops.export_scene.gltf(filepath=str(p/'gait-r6/candidate.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_skins=True)
print('CANDIDATE_EXPORTED_UNREVIEWED',flush=True)
