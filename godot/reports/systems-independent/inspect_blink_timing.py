import hashlib, json
from pathlib import Path
p=Path(__file__).resolve().parents[2]/'reports/surface-blink-runtime/1535947/runtime-verification.json'
d=json.loads(p.read_text(encoding='utf-8'))
case=next(c for c in d['cases'] if c['label']=='r9-125km-arrival')
print('sha256',hashlib.sha256(p.read_bytes()).hexdigest())
for key in ['before','after','outcomes','resolution']:
 value=case[key]
 if key in ['before','after']: value={'agl':value['agl']}
 print(key,json.dumps(value,ensure_ascii=True))
