import hashlib,json,pathlib
here=pathlib.Path(__file__).resolve().parent
data=json.loads((here/'normal-time-samples.json').read_text())
print('probe UTC',data['utc'])
print('player probe SHA256',data['source_sha256']['native_player.gd'])
root=here.parents[2]
print('player current SHA256',hashlib.sha256((root/'godot/scripts/native_player.gd').read_bytes()).hexdigest())
print('total physics seconds',sum(r['delta'] for r in data['rows']))
print('total wall seconds',sum(r['wall_delta'] for r in data['rows']))
for filename in ['vfx-contract.json','save-preservation.json']:
    report=json.loads((here/filename).read_text())
    print(filename,report['utc'],sum(c['pass'] for c in report['checks']),len(report['checks']))
