"""Compare exported semantic data, independent of JSON indices/layout."""
from pathlib import Path
import json,struct,hashlib
p=Path('godot/assets/motion-r2')
def load(path):
    data=path.read_bytes();n=struct.unpack_from('<I',data,12)[0]
    doc=json.loads(data[20:20+n]);binary=data[28+n:]
    def accessor(i):
        a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']]
        size={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[a['componentType']]*{'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
        start=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',size)
        raw=b''.join(binary[start+k*stride:start+k*stride+size] for k in range(a['count']))
        return (a['componentType'],a['type'],a['count'],hashlib.sha256(raw).hexdigest())
    animations={}
    for a in doc['animations']:
        rows=[]
        for ch in a['channels']:
            s=a['samplers'][ch['sampler']];target=ch['target']
            rows.append((doc['nodes'][target['node']]['name'],target['path'],s.get('interpolation','LINEAR'),accessor(s['input']),accessor(s['output'])))
        animations[a['name']]=sorted(rows)
    meshes={}
    for m in doc['meshes']:
        meshes[m['name']]=[{'attributes':{k:accessor(v) for k,v in prim['attributes'].items()},'indices':accessor(prim['indices'])} for prim in m['primitives']]
    binds=[accessor(s['inverseBindMatrices']) for s in doc['skins']]
    return animations,meshes,binds
a,ma,ba=load(p/'source/gait-r4-before/c2-motion-r2.glb');b,mb,bb=load(p/'c2-motion-r2.glb')
changed=[n for n in a if a[n]!=b[n]]
result={'animation_count':len(b),'changed_animation_names':changed,'protected_26_exported_clips_identical':all(a[n]==b[n] for n in a if n not in ['walk','jog','sprint']),'mesh_attributes_indices_identical':ma==mb,'inverse_bind_accessors_identical':ba==bb,'glb_sha256':hashlib.sha256((p/'c2-motion-r2.glb').read_bytes()).hexdigest(),'driver_sha256':hashlib.sha256((p.parent.parent/'scripts/native_motion_r2.gd').read_bytes()).hexdigest()}
(p/'gait-r4-export-check.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
assert set(changed)=={'walk','jog','sprint'} and ma==mb and ba==bb
