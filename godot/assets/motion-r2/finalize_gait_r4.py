from pathlib import Path
import hashlib,json,statistics
p=Path('godot/assets/motion-r2');e=p/'evidence/gait-r4'
r=json.loads((e/'regression/report.json').read_text());rows=r['records'];d=[v['delta'] for v in rows]
summary={'frames':r['frame_count'],'bone_count':r['bone_count'],'time_scale':r['time_scale'],'physics_seconds':rows[-1]['simulation_seconds'],'wall_seconds':rows[-1]['wall_seconds'],'delta_min':min(d),'delta_max':max(d),'delta_mean':statistics.mean(d),'cases':list(dict.fromkeys(v['case'] for v in rows)),'failures':r['failures'],'pending':r['pending_asset_requirements'],'scope':'adapter/rest/socket/gait-to-cast and ground/air release-timing fixture, not Main damage or human input'}
(e/'regression/summary.json').write_text(json.dumps(summary,indent=2))
paths=[p/'c2-motion-r2.glb',p.parent.parent/'scripts/native_motion_r2.gd',p.parent.parent/'scripts/native_player.gd',p/'clips.json',p/'gait_r4.py',p/'build_gait_r4.py',p/'gait-r4-preservation.json',p/'gait-r4-export-check.json',p/'gait-r4-deformation.json',p/'GAIT-R4.md']
hashes={str(f).replace('\\','/'):hashlib.sha256(f.read_bytes()).hexdigest() for f in paths}
manifest={'files':hashes,'regression':summary,'independent_report':'godot/reports/gait-r4-independent/FINAL-REPORT.md','independent_report_sha256':hashlib.sha256(Path('godot/reports/gait-r4-independent/FINAL-REPORT.md').read_bytes()).hexdigest()}
(e/'final-manifest.json').write_text(json.dumps(manifest,indent=2));print(json.dumps(summary,indent=2));print(json.dumps(hashes,indent=2))
