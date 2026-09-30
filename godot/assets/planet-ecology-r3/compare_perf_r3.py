"""Compare the same-camera paired Godot runs and retain input provenance."""
from pathlib import Path
import json,hashlib,datetime
P=Path(__file__).parent; root=P.parents[2]
before=json.loads((P/'integrated-verification-baseline-repeat-r3.json').read_text())
after=json.loads((P/'integrated-verification-r3.json').read_text())
paths=[root/'godot/scripts'/name for name in ['native_planet.gd','native_planet_field.gd','native_planet_field_r3.gd','native_planet_ecology.gd']]
paths += [root/'godot/tests/native_ecology_r3_integrated.gd',P/'ecology_surface_r3.gdshader']
paths += list(P.glob('*.res'))+list(P.glob('*-collision.tres'))
terrain=root/'godot/assets/terrain'
paths += list(terrain.glob('planet*.gdshader'))+list(terrain.glob('*.res'))
start=datetime.datetime.fromisoformat(after['utc_start']).replace(tzinfo=datetime.timezone.utc).timestamp()
trace={}
for path in sorted(set(paths)):
 trace[path.relative_to(root).as_posix()]={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'mtime_utc':datetime.datetime.fromtimestamp(path.stat().st_mtime,datetime.timezone.utc).isoformat(),'unchanged_since_run_start':path.stat().st_mtime<=start}
result={'before':before,'after':after,'triangle_reduction_percent':100*(1-after['snapshot']['triangles']/before['snapshot']['triangles']),'same_field_values':before['field']==after['field'],'all_traced_inputs_predate_after_run':all(v['unchanged_since_run_start'] for v in trace.values()),'inputs':trace,'measurement_context':'Paired sequential tests after material_capture completed and independent GPU acceptance paused. Existing game process PID34324 (started 20:48:54 local) remained unchanged in both runs; it was not terminated. No claim of exclusive machine/GPU ownership. Same camera, 1440x900, OpenGL Intel UHD, default vsync; this is the real-planet ecology test, not the complete main scene.'}
(P/'performance-comparison-r3.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({'before_utc':[before['utc_start'],before['utc_end']],'after_utc':[after['utc_start'],after['utc_end']],'before_fps':before['performance']['engine_fps'],'after_fps':after['performance']['engine_fps'],'triangle_reduction_percent':result['triangle_reduction_percent'],'same_field_values':result['same_field_values'],'input_files':len(trace),'inputs_predate_run':result['all_traced_inputs_predate_after_run']}))
