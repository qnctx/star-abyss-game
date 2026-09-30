"""Record current sources and encoded GIF playback; capture provenance is separate."""
from pathlib import Path
from PIL import Image
import hashlib,json
root=Path('godot/assets/motion-r2')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
report={'current_asset_sha256':sha(root/'c2-motion-r2.glb'),'current_driver_sha256':sha(root.parent.parent/'scripts/native_motion_r2.gd'),'note':'Current-source hashes are not capture-time assertions for earlier clips. See hit-regression/provenance.json for capture-start hashes.','gifs':{}}
for folder in ['combat-sequence','main-combat','hit-regression']:
    for file in (root/'evidence'/folder).glob('*normal-speed.gif'):
        gif=Image.open(file);duration=0
        for i in range(gif.n_frames):gif.seek(i);duration+=gif.info.get('duration',0)
        report['gifs'][str(file.relative_to(root))]={'sha256':sha(file),'encoded_frames':gif.n_frames,'playback_ms':duration,'capture_fps':30,'status':'superseded_before_contact_fix' if file.name=='main-hit-side-normal-speed.gif' else 'see_documented_scope'}
(root/'evidence-manifest.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
