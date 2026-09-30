import json, hashlib
from pathlib import Path
root = Path(__file__).resolve().parents[2]
out = {}
for name in ['descent-r1/runtime.json', 'flight-pose-r1/runtime.json', 'flight-pose-r1/product-flight-current.json']:
    p = root/'reports'/name
    d = json.loads(p.read_text(encoding='utf-8-sig'))
    start, end = d.get('source_sha256_start', {}), d.get('source_sha256_end', {})
    summary = {k:v for k,v in d.items() if k not in ['source_sha256_start','source_sha256_end','samples','snapshots']}
    out[name] = {'report_sha256':hashlib.sha256(p.read_bytes()).hexdigest(), 'keys':list(d),
        'hash_count':len(start), 'hashes_equal':start == end,
        'current_mismatches':[k for k,v in end.items() if not (root/k.removeprefix('res://')).exists() or hashlib.sha256((root/k.removeprefix('res://')).read_bytes()).hexdigest()!=v],
        'summary':summary}
Path(__file__).with_name('FLIGHT-OWNER-CPU-AUDIT.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print(json.dumps({k:{'hash_count':v['hash_count'],'hashes_equal':v['hashes_equal'],'current_mismatches':v['current_mismatches'],'checks':len(v['summary'].get('checks',[])), 'failed_checks':[c['name'] for c in v['summary'].get('checks',[]) if not c.get('pass')], 'sim_s':v['summary'].get('sim_s'),'wall_s':v['summary'].get('wall_s')} for k,v in out.items()},indent=2))
