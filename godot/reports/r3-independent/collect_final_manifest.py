import datetime,hashlib,json,pathlib,subprocess
here=pathlib.Path(__file__).resolve().parent
root=here.parents[2]
files=list((root/'godot/scripts').glob('*.gd'))+[root/'godot/project.godot',root/'godot/scenes/main.tscn']
for folder in ['motion-r2','enemy-r3','vfx-r3']:
    files+=list((root/'godot/assets'/folder).glob('*.glb'))
    files+=list((root/'godot/assets'/folder).glob('*.gdshader'))
hashes={str(p.relative_to(root)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
evidence={}
for filename in ['combat-live.json','visual-final.json','cleave-final.json','melee-final-2.0.json','melee-final-2.3.json','melee-final-2.6.json','hit-miss-final.json','small-ui.json']:
    path=here/filename
    if not path.exists():continue
    report=json.loads(path.read_text(encoding='utf-8'))
    mismatches=[]
    for name,sha in report.get('source_sha256',{}).items():
        if hashes.get('godot/scripts/'+name)!=sha:mismatches.append('godot/scripts/'+name)
    for name,sha in report.get('asset_sha256',{}).items():
        rel=name.replace('res://','godot/')
        if hashes.get(rel)!=sha:mismatches.append(rel)
    if report.get('scene_sha256') and report['scene_sha256']!=hashes['godot/scenes/main.tscn']:mismatches.append('godot/scenes/main.tscn')
    evidence[filename]={'utc':report['utc'],'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'mismatches_to_current':mismatches}
report={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'files':hashes,'evidence':evidence}
(here/'FINAL-MANIFEST.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(evidence,indent=2))
