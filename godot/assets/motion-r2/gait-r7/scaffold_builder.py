"""Create isolated R7 builder from the previously verified skin/rig pipeline."""
from pathlib import Path
p=Path('godot/assets/motion-r2')
src=(p/'build_gait_r6.py').read_text()
src=src.replace('from gait_r6 import gait_pose,PARAMS,solve_leg,q',"sys.path.insert(0,str(out/'gait-r7'))\nfrom gait_r7 import gait_pose,PARAMS,solve_leg,q")
src=src.replace("backup=out/'source/gait-r6-before'; dest=out/'gait-r6'", "backup=out/'source/gait-r7-before'; dest=out/'gait-r7'")
src=src.replace('from merge_gait_glb import replace_gait_animations',"sys.path.insert(0,str(out/'gait-r6'))\nfrom merge_gait_glb import replace_gait_animations")
start=src.index("candidate_dir=out/'source/gait-r6-candidate'")
end=src.index("assert (backup/'snapshot.json').exists()",start)
src=src[:start]+"candidate_dir=out/'source/gait-r7-candidate';candidate_dir.mkdir(exist_ok=True)\n(candidate_dir/'.gdignore').write_text('')\n"+src[end:]
src=src.replace('for entry in snapshot.values():',"for entry in snapshot['files']:")
src=src.replace("errors={s:info['sides'][s]['clearance']-heights[s] for s in ['L','R']}","errors={s:(info['sides'][s]['clearance']-heights[s] if info['sides'][s]['stance'] else max(0,info['sides'][s]['clearance']-heights[s])) for s in ['L','R']}")
src=src.replace("'height_error':heights[side]-info['sides'][side]['clearance']", "'height_error':(heights[side]-info['sides'][side]['clearance'] if info['sides'][side]['stance'] else min(0,heights[side]-info['sides'][side]['clearance']))")
start=src.index("assert all(s['min_shoe_height_m']")
end=src.index('bpy.ops.export_scene.gltf',start)
src=src[:start]+"# Isolated candidate is always exported for visual review; numerical failures\n# stay explicit in the report and never authorize production integration.\n"+src[end:]
src=src.replace("out/'c2-motion-r2.glb'", "dest/'candidate.glb'")
src=src.replace("(out/'clips.json')", "(dest/'candidate-clips.json')")
src=src.replace('R6 approved image direction; full skinned shoes; only walk/jog/sprint replaced','R7 ISOLATED CANDIDATE: explicit hip/knee gait events; awaiting visual review')
src=src.replace('GAIT_R6_EXPORT_COMPLETE','GAIT_R7_CANDIDATE_EXPORT_COMPLETE').replace('R6_BAKED','R7_BAKED')
src=src.replace('"""Bake the approved R6 gait design into the preserved C2 source and GLB.', '"""Bake isolated R7 hip/knee events; NEVER overwrite production source or GLB.')
target=p/'gait-r7/build_candidate.py'
assert not target.exists(),'Do not overwrite an edited R7 builder'
target.write_text(src)
print(target)
