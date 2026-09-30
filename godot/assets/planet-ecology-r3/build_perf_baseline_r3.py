"""Reconstruct the saved pre-optimization asset/runtime for isolated A/B runs.
Writes only inside baseline-perf-r3; never swaps the live ecology implementation.
"""
from pathlib import Path
P=Path(__file__).parent
root=P.parents[2]
out=P/'baseline-perf-r3/assets'
out.mkdir(parents=True,exist_ok=True)
source=(P/'baseline-perf-r3/build_assets_r3.py.txt').read_text()
source=source.replace('P=pathlib.Path(__file__).parent','P=pathlib.Path('+repr(str(out))+')')
source=source.replace('ROOT=P.parents[2]','ROOT=pathlib.Path('+repr(str(root))+')')
exec(compile(source,'saved_before_generator','exec'),{'__name__':'saved_before_generator','__file__':str(P/'build_perf_baseline_r3.py')})
runtime=(P/'baseline-perf-r3/native_planet_ecology.gd.txt').read_text()
runtime=runtime.replace('class_name NativePlanetEcology','')
runtime=runtime.replace('res://assets/planet-ecology-r3/','res://assets/planet-ecology-r3/baseline-perf-r3/assets/')
runtime=runtime.replace('res://assets/planet-ecology-r3/baseline-perf-r3/assets/ecology_surface_r3.gdshader','res://assets/planet-ecology-r3/ecology_surface_r3.gdshader')
(P/'baseline-perf-r3/native_planet_ecology_before_r3.gd').write_text(runtime,encoding='utf-8')
