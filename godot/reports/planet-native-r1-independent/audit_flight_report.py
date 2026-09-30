from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[3]
p=root/'godot/reports/planet-native-player/product-flight-final.json'
d=json.loads(p.read_text(encoding='utf-8'))
a=d['source_sha256_start'];b=d['source_sha256_end']
out={'report_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'reported_passes':sum(c['pass'] for c in d['checks']),'source_count':len(a),'in_run_changes':[k for k in a if a[k]!=b.get(k)],'current_different':[k for k,v in b.items() if not (root/'godot'/k.removeprefix('res://')).exists() or hashlib.sha256((root/'godot'/k.removeprefix('res://')).read_bytes()).hexdigest()!=v],'wall_sim_ratio':d['timing']['wall_s']/d['timing']['elapsed_delta']}
print(json.dumps(out,indent=2))
(Path(__file__).resolve().parent/'PRODUCT-FLIGHT-AUDIT.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
