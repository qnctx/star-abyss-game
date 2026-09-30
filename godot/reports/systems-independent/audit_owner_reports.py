import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
out = {}
for name in ('loaded-library-verification.json', 'save-recovery-verification.json', 'import-cache-verification.json', 'basic-verification.json', 'surface-contract-verification.json'):
    p = root / 'reports/martial-r4' / name
    data = json.loads(p.read_text(encoding='utf-8-sig'))
    checks = data.get('checks', [])
    out[name] = {'sha256': hashlib.sha256(p.read_bytes()).hexdigest(),
                 'keys': list(data), 'check_count': len(checks) if isinstance(checks, list) else checks,
                 'not_true': [v for v in checks if isinstance(v, dict) and v.get('ok') is not True] if isinstance(checks, list) else None,
                 'metadata': {k: v for k, v in data.items() if k != 'checks'}}
p = root / 'reports/martial-r4/save-recovery-dependency-hashes.json'
d = json.loads(p.read_text(encoding='utf-8'))
out['dependencies'] = {'count': len(d['before']), 'before_after_equal': d['before'] == d['after'],
    'current_mismatches': [name for name, sha in d['after'].items() if hashlib.sha256((root/'scripts'/name).read_bytes()).hexdigest() != sha]}
target = Path(__file__).with_name('OWNER-CPU-AUDIT-CORRECTED.json')
library = out['loaded-library-verification.json']['metadata']
out['library_cpu_checks'] = {'clips': len(library['clips']), 'imports': len(library['imports']),
    'source_sha_mismatches': [v['path'] for v in library['imports'] if hashlib.sha256((root / v['path'].removeprefix('res://')).read_bytes()).hexdigest() != v['source_sha256']]}
target.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding='utf-8')
print(json.dumps({k: v for k, v in out.items() if k in ('dependencies', 'library_cpu_checks')}, indent=2))
