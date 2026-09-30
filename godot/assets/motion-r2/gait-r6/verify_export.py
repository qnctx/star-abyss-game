"""Exact semantic preservation check of the pre-R6 and current exported GLB."""
from pathlib import Path
import json,struct,hashlib,sys
p=Path('godot/assets/motion-r2')
target=p/('gait-r6/candidate.glb' if '--candidate' in sys.argv else 'c2-motion-r2.glb')

def load(path):
    data=path.read_bytes();n=struct.unpack_from('<I',data,12)[0]
    doc=json.loads(data[20:20+n]);binary=data[28+n:]
    def view(i):
        v=doc['bufferViews'][i];s=v.get('byteOffset',0)
        return hashlib.sha256(binary[s:s+v['byteLength']]).hexdigest()
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
    meshes={m['name']:[{'attributes':{k:accessor(v) for k,v in prim['attributes'].items()},'indices':accessor(prim['indices']),'material':doc['materials'][prim['material']]['name']} for prim in m['primitives']] for m in doc['meshes']}
    binds=[accessor(s['inverseBindMatrices']) for s in doc['skins']]
    materials=doc['materials'];images=[(img.get('name'),img.get('mimeType'),view(img['bufferView'])) for img in doc.get('images',[])]
    return animations,meshes,binds,materials,images,doc

a,ma,ba,mata,ia,da=load(p/'source/gait-r6-before/c2-motion-r2.glb')
b,mb,bb,matb,ib,db=load(target)
same_images=[r[1:] for r in ia]==[r[1:] for r in ib]
changed=[n for n in a if a[n]!=b[n]]
result={'animation_count':len(b),'changed_animation_names':changed,
 'protected_26_exported_clips_identical':all(a[n]==b[n] for n in a if n not in ['walk','jog','sprint']),
 'mesh_attributes_indices_material_assignment_identical':ma==mb,'inverse_bind_accessors_identical':ba==bb,
 'material_json_identical':mata==matb,'embedded_texture_bytes_identical':same_images,
 'joint_count':len(db['skins'][0]['joints']),'glb_sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
result['gait_max_input_key_counts']={a['name']:max(db['accessors'][s['input']]['count'] for s in a['samplers']) for a in db['animations'] if a['name'] in ['walk','jog','sprint']}
if ia!=ib: result['image_comparison']={'before':ia,'after':ib}
(p/('gait-r6/candidate-export-check.json' if '--candidate' in sys.argv else 'gait-r6/export-check.json')).write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
assert set(changed)=={'walk','jog','sprint'} and ma==mb and ba==bb and mata==matb and same_images
