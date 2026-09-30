import json, hashlib
from pathlib import Path
r=Path(__file__).resolve().parents[2]/'reports'
out={}
for f in ['environment-generation-guard/20260929T172358Z_2c5ddd325999/result.json','surface-blink-runtime/1535947/runtime-verification.json']:
 d=json.loads((r/f).read_text(encoding='utf-8-sig'))
 if 'probe' in d:
  s={'seed_pid':d['seed']['pid'],'probe_pid':d['probe']['pid'],'seed_checks':len(d['seed']['checks']),'probe_checks':len(d['probe']['checks']), 'failed':d['failed'],'passed':d['passed'],'returncodes':[d['seed_process']['returncode'],d['probe_process']['returncode']], 'before':d['before_probe_hashes'],'post_exit':d['post_exit_hashes'],'close_path':d['probe'].get('close_path')}
 else:
  s={k:v for k,v in d.items() if not isinstance(v,(list,dict))}
  s.update(checks=len(d['checks']),failed=[c for c in d['checks'] if not c['passed']],hashes_equal=d['source_sha256_start']==d['source_sha256_end'],hash_count=len(d['source_sha256_start']),cases=[{'keys':list(c),'label':c.get('label',c.get('case')), 'accepted':c.get('accepted'),'before_agl':c.get('before',{}).get('agl'),'after_agl':c.get('after',{}).get('agl')} for c in d['cases']])
 s['report_sha256']=hashlib.sha256((r/f).read_bytes()).hexdigest();out[f]=s
print(json.dumps(out,indent=2))
Path(__file__).with_name('GENERATION-BLINK-CPU-AUDIT.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
