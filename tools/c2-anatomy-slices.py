import bpy, json, sys
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'artifacts/c2-lux3d-20260911/c2-source_glb.glb')
obj=next(o for o in bpy.context.scene.objects if o.type=='MESH')
points=[obj.matrix_world@v.co for v in obj.data.vertices]
zmin=min(p.z for p in points); zmax=max(p.z for p in points); scale=1.85/(zmax-zmin)
points=[Vector((p.x*scale,p.y*scale,(p.z-zmin)*scale)) for p in points]
for height in [.1,.3,.5,.7,.9,1.,1.1,1.2,1.3,1.4,1.5,1.6,1.7]:
    subset=[p for p in points if abs(p.z-height)<.012]
    xs=sorted(p.x for p in subset); groups=[]
    for x in xs:
        if not groups or x-groups[-1][-1]>.025: groups.append([])
        groups[-1].append(x)
    print(json.dumps({'z':height,'x_intervals':[[round(min(g),3),round(max(g),3)] for g in groups],
                      'y_range':[round(min(p.y for p in subset),3),round(max(p.y for p in subset),3)]}))
