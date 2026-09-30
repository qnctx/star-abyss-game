"""Inspect a character GLB in Blender without changing the source asset."""
import bpy
import json
import sys
from pathlib import Path
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
source, target = map(Path, args[:2])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source.resolve()))
meshes = []
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH':
        continue
    obj.data.calc_loop_triangles()
    coords = [obj.matrix_world @ Vector(v) for v in obj.bound_box]
    meshes.append({'name': obj.name, 'vertices': len(obj.data.vertices),
                   'triangles': len(obj.data.loop_triangles),
                   'bounds_min': [min(v[i] for v in coords) for i in range(3)],
                   'bounds_max': [max(v[i] for v in coords) for i in range(3)],
                   'uv_layers': len(obj.data.uv_layers),
                   'vertex_groups': len(obj.vertex_groups),
                   'materials': [m.name if m else None for m in obj.data.materials]})
armatures = [{'name': o.name, 'bones': [{'name': b.name,
              'parent': b.parent.name if b.parent else None,
              'head': list(b.head_local), 'tail': list(b.tail_local)} for b in o.data.bones]}
             for o in bpy.context.scene.objects if o.type == 'ARMATURE']
result = {'source': source.name, 'blender': bpy.app.version_string,
          'meshes': meshes, 'total_triangles': sum(m['triangles'] for m in meshes),
          'armatures': armatures,
          'images': [{'name': i.name, 'size': list(i.size), 'packed': bool(i.packed_file)}
                     for i in bpy.data.images],
          'actions': [a.name for a in bpy.data.actions]}
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps({'audit': str(target), 'triangles': result['total_triangles'],
                  'armatures': len(armatures), 'images': len(result['images'])}))
