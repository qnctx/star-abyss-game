import datetime,hashlib,json,pathlib,shutil
here=pathlib.Path(__file__).resolve().parent
root=here.parents[2]
target=here/'baseline/source'
target.mkdir(parents=True,exist_ok=True)
files=['godot/assets/motion-r2/c2-motion-r2.glb','godot/scripts/native_motion_r2.gd','godot/scripts/native_player.gd','godot/scenes/main.tscn']
hashes={}
for name in files:
    p=root/name
    data=p.read_bytes()
    hashes[name]=hashlib.sha256(data).hexdigest()
    (target/p.name).write_bytes(data)
(here/'baseline/manifest.json').write_text(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':hashes},indent=2),encoding='utf-8')
print(json.dumps(hashes))
