from pathlib import Path
p=Path(__file__).resolve().parent
s=(p/'run_segments.py').read_text(encoding='utf-8').replace('segment_probe.gd','basin_dynamic.gd').replace("else 'segments01'","else 'basin1600-final01'")
(p/'run_basin.py').write_text(s,encoding='utf-8')
