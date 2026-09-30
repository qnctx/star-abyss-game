from pathlib import Path
p=Path(__file__).resolve().parent
s=(p/'run_baseline.py').read_text(encoding='utf-8').replace('planet-native-r1-independent/baseline.gd','planet-native-r1-independent/segment_probe.gd').replace("else 'old-square-baseline'","else 'segments01'").replace('>90:', '>240:')
(p/'run_segments.py').write_text(s,encoding='utf-8')
