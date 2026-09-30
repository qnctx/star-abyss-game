from pathlib import Path
import shutil,json,hashlib
p=Path('godot/assets/motion-r2');backup=p/'source/gait-r5-before';backup.mkdir(exist_ok=True)
files=[p/'c2-motion-r2.glb',p/'source/c2-motion-r2.blend',p/'clips.json',p/'gait_r4.py',p/'build_gait_r4.py',p.parent.parent/'scripts/native_motion_r2.gd']
hashes={}
for src in files:
    dst=backup/src.name
    if not dst.exists():shutil.copy2(src,dst)
    hashes[src.name]=hashlib.sha256(dst.read_bytes()).hexdigest()
(backup/'snapshot.json').write_text(json.dumps(hashes,indent=2))
r=json.loads((p/'gait-r5/evidence/baseline-skin.json').read_text());samples=r['samples'];summary={'source':hashes,'method':r['method'],'frames':r['physics_frames'],'time_scale':r['time_scale'],'physics_seconds':r['records'][-1]['seconds'],'wall_seconds':r['records'][-1]['wall'],'sample_count':len(samples),'skinned_vertices_per_sample':sorted(set(v['skinned_vertex_count'] for v in samples)),'stage_min_y':r['stage_min_y']}
(p/'gait-r5/evidence/baseline-skin-summary.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary,indent=2))
