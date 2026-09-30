"""An actual fragment of the reference-backed original shoulder carapace.
Retains source sculpt/material; the projectile is not a primitive replacement.
"""
import bpy
import bmesh
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
assert (ROOT / 'docs/art/creatures/rift-prowler-v1/concept.png').exists()
bpy.ops.wm.open_mainfile(filepath=str(OUT / 'source/riftwing-r3.blend'))
body = bpy.data.objects['RiftwingBody']
mesh = body.data.copy()
bm = bmesh.new()
bm.from_mesh(mesh)
# The same fitted mineral armour, cut from its upper right shoulder.
target = Vector((.28, .22, 1.18))
anchor = min(bm.verts, key=lambda v: (v.co - target).length_squared).co.copy()
keep = [f for f in bm.faces if (f.calc_center_median() - anchor).length < .25]
keep_set = set(keep)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f not in keep_set], context='FACES')
if not bm.faces:
    raise RuntimeError('No source armour fragment found')
centre = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
for v in bm.verts:
    v.co = (v.co - centre) * 1.35
bm.to_mesh(mesh)
bm.free()
obj = bpy.data.objects.new('RiftCarapaceShard', mesh)
bpy.context.collection.objects.link(obj)
obj.location = (0, 0, 0)
solid = obj.modifiers.new('Actual broken armour thickness', 'SOLIDIFY')
solid.thickness = .025
solid.offset = 0
# Thin fracture faces carry the same restrained violet seen in the reference.
edge = bpy.data.materials.new('Amethyst fracture edge')
edge.use_nodes = True
bsdf = edge.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value = (.20, .025, .38, 1)
bsdf.inputs['Emission Color'].default_value = (.30, .035, .60, 1)
bsdf.inputs['Emission Strength'].default_value = 1.6
bsdf.inputs['Metallic'].default_value = .25
bsdf.inputs['Roughness'].default_value = .48
obj.data.materials.append(edge)
solid.material_offset_rim = len(obj.data.materials) - 1
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.modifier_apply(modifier=solid.name)
triangles = sum(max(0, len(f.vertices) - 2) for f in obj.data.polygons)
bpy.ops.export_scene.gltf(filepath=str(OUT / 'rift-shard-r3.glb'), export_format='GLB', use_selection=True, export_yup=True, export_animations=False)
for other in list(bpy.context.scene.objects):
    if other != obj:
        bpy.data.objects.remove(other, do_unlink=True)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'source/rift-shard-r3.blend'))
report = {'reference': 'docs/art/creatures/rift-prowler-v1/concept.png', 'source': 'existing original RiftwingBody shoulder armour mesh',
          'source_anchor': list(anchor), 'source_centroid': list(centre), 'triangles': triangles,
          'changes': 'detached sculpted patch; closed 0.025 m fractured rim; restrained violet fracture material', 'new_paid_generation': False}
(OUT / 'shard-manifest.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print('RIFT_SHARD_READY', json.dumps(report))
