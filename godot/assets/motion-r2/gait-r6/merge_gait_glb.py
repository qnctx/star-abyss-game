"""Copy ONLY three newly baked animation payloads into an immutable GLB base.

This avoids re-encoding protected mesh/texture data or resampling unrelated
actions when new gait clips use denser (fractional-frame) authoring keys.
"""
import json,struct,copy

def read_glb(path):
    raw=path.read_bytes();size=struct.unpack_from('<I',raw,12)[0]
    return json.loads(raw[20:20+size]),bytearray(raw[28+size:])

def replace_gait_animations(base_path,gait_path,destination):
    base,data=read_glb(base_path);new,source=read_glb(gait_path)
    nodes={node['name']:i for i,node in enumerate(base['nodes'])}
    accessor_map={};view_map={}
    def copy_accessor(index):
        if index in accessor_map:return accessor_map[index]
        acc=copy.deepcopy(new['accessors'][index]);oldview=acc['bufferView']
        if oldview not in view_map:
            view=copy.deepcopy(new['bufferViews'][oldview]);start=view.get('byteOffset',0)
            while len(data)%4:data.append(0)
            payload=source[start:start+view['byteLength']]
            view['buffer']=0;view['byteOffset']=len(data);data.extend(payload)
            view_map[oldview]=len(base['bufferViews']);base['bufferViews'].append(view)
        acc['bufferView']=view_map[oldview]
        accessor_map[index]=len(base['accessors']);base['accessors'].append(acc)
        return accessor_map[index]
    changes={}
    for anim in new['animations']:
        if anim['name'] not in ['walk','jog','sprint']:continue
        updated=copy.deepcopy(anim)
        for channel in updated['channels']:
            name=new['nodes'][channel['target']['node']]['name']
            assert name in nodes,f'New unknown animated node {name}'
            channel['target']['node']=nodes[name]
        for sampler in updated['samplers']:
            sampler['input']=copy_accessor(sampler['input']);sampler['output']=copy_accessor(sampler['output'])
        changes[updated['name']]=updated
    assert set(changes)=={'walk','jog','sprint'}
    base['animations']=[changes.get(a['name'],a) for a in base['animations']]
    base['buffers'][0]['byteLength']=len(data)
    rawjson=json.dumps(base,separators=(',',':')).encode()
    rawjson+=b' '*((-len(rawjson))%4);data.extend(b'\x00'*((-len(data))%4))
    result=(struct.pack('<4sII',b'glTF',2,12+8+len(rawjson)+8+len(data))
             +struct.pack('<II',len(rawjson),0x4E4F534A)+rawjson
             +struct.pack('<II',len(data),0x004E4942)+data)
    destination.write_bytes(result)
