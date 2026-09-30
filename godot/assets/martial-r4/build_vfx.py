"""Blender-authored tapered qi surfaces mapped to reference.png A/B/C.
No runtime primitives, no collision, no screen-aligned beams.
"""
import bpy, math, json
from pathlib import Path
OUT=Path(__file__).resolve().parent
assert (OUT/'reference.png').is_file()
stats={}
def mesh_asset(name,curves):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    vs=[];faces=[];uvs=[]
    for points,width in curves:
        base=len(vs)
        for i,p in enumerate(points):
            u=i/(len(points)-1); taper=max(.002,math.sin(math.pi*u))**.65
            # Ribbon lies on a curved pressure surface; consistent radial thickness.
            x,y,z=p; length=max(.01,math.hypot(x,y));dx=x/length;dy=y/length
            for s in [-1,1]:
                vs.append((x+dx*width*taper*s,-z,y+dy*width*taper*s));uvs.append((u,(s+1)/2))
        for i in range(len(points)-1): faces.append((base+i*2,base+i*2+1,base+i*2+3,base+i*2+2))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    uv=mesh.uv_layers.new(name='qi_uv')
    for p in mesh.polygons:
        for i in p.loop_indices:uv.data[i].uv=uvs[mesh.loops[i].vertex_index]
    mat=bpy.data.materials.new('qi_silver_cyan');mat.diffuse_color=(.2,.72,1,.7);mat.use_nodes=True
    bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.2,.72,1,1);bs.inputs['Emission Color'].default_value=(.2,.55,1,1);bs.inputs['Emission Strength'].default_value=1.7
    mesh.materials.append(mat)
    bpy.context.view_layer.objects.active=obj;obj.select_set(True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'source'/f'{name}.blend'))
    bpy.ops.export_scene.gltf(filepath=str(OUT/f'{name}.glb'),export_format='GLB')
    stats[name]={'vertices':len(vs),'triangles':len(faces)*2,'reference':'A' if name=='fist' else 'B' if name=='slash' else 'C'}
def arc(radius,z,start,end,n=35,ell=1):
    return [(math.cos(start+(end-start)*i/(n-1))*radius,math.sin(start+(end-start)*i/(n-1))*radius*ell,z+.025*math.sin(i*.6)) for i in range(n)]
mesh_asset('fist',[(arc(.13+k*.035,-.04*k,.1+k,.1+k+4.9,25),.012) for k in range(3)])
mesh_asset('slash',[([(math.sin(-1.4+2.8*i/48)*(.245-k*.035),math.cos(-1.4+2.8*i/48)*.06-.025,-.035*k-.04*math.cos(-1.4+2.8*i/48)) for i in range(49)],.018-k*.004) for k in range(3)])
gather=[(arc(.12+k*.025,-.015*k,k*1.1,k*1.1+4.6,30,.65),.015) for k in range(5)]
# Reference C: loose strands draw inward outside the elbows, while the pressure
# knot itself remains between the real palms. This reads from the play camera.
for sign in [-1,1]:
    gather.append(([(sign*(.62-.47*i/35),.09*math.sin(i/35*math.pi*1.5),-.08+.05*math.sin(i/35*math.pi)) for i in range(36)],.020))
mesh_asset('charge',gather)
mesh_asset('pressure',[(arc(.10+k*.065,.035*k,k*.8,k*.8+5.3,36,.85),.014+k*.003) for k in range(5)])
mesh_asset('impact',[(arc(.22+k*.15,0,k*.78,k*.78+1.7,16),.042) for k in range(7)])
# impact-reference row B: an irregular thin aperture, never a solid portal disk.
mesh_asset('aperture',[(arc(.52+k*.022,.016*k,k*.8,k*.8+5.55,68,1.9),.012) for k in range(4)])
(OUT/'vfx-manifest.json').write_text(json.dumps(stats,indent=2))
