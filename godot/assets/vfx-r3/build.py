"""Author thin, tapered 3D qi surfaces from the existing approved R2 sheet.

Local Blender only: no generation service and no new image. Design coordinates
are Godot Y-up/-Z-forward, converted to Blender Z-up/+Y-forward for GLB export.
Every asset is one merged surface: discontinuous ribbons are authored contours,
not stock toruses, disks, boxes, spheres or billboard placeholders.
"""
import bpy
import math
import json
import hashlib
import shutil
import sys
from pathlib import Path
from mathutils import Vector

OUT = Path(__file__).resolve().parent
SOURCE = OUT / 'source'
SOURCE.mkdir(exist_ok=True)
(SOURCE/'.gdignore').touch()
REFERENCE = OUT.parent / 'vfx-r2/reference.png'
if not REFERENCE.is_file():
    raise RuntimeError('Existing generated reference is required before authoring')
shutil.copy2(REFERENCE, OUT/'reference-r2.png')
REFERENCE_HASH = hashlib.sha256(REFERENCE.read_bytes()).hexdigest()
manifest = {'reference':'reference-r2.png','reference_sha256':REFERENCE_HASH,
            'reference_origin':'Existing generated vfx-r2/reference.png; reused without another generation',
            'authoring':'Blender local authored tapered open ribbon surfaces; no billable service',
            'coordinates':'Godot meters, -Z forward, +Y up', 'assets':{}}
ONLY=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
if ONLY and (OUT/'manifest.json').is_file():
    manifest['assets']=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))['assets']

class Ribbons:
    def __init__(self):
        self.vertices=[]; self.faces=[]; self.uv=[]; self.parts=[]

    def add(self,name,points,width,normal=(0,1,0),power=.8):
        base=len(self.vertices)
        for i,p in enumerate(points):
            t=i/(len(points)-1)
            tangent=Vector(points[min(len(points)-1,i+1)])-Vector(points[max(0,i-1)])
            n=Vector(normal(t) if callable(normal) else normal)
            side=n.cross(tangent).normalized()
            taper=max(.001,math.sin(math.pi*t))**power
            w=(width(t) if callable(width) else width)*taper
            for s in (-1,1):
                v=Vector(p)+side*w*s
                self.vertices.append((v.x,-v.z,v.y))
                self.uv.append((t,(s+1)/2))
        for i in range(len(points)-1):
            self.faces.append((base+2*i,base+2*i+1,base+2*i+3,base+2*i+2))
        self.parts.append(name)

    def finish(self,name,description):
        if ONLY and name not in ONLY:return
        bpy.ops.wm.read_factory_settings(use_empty=True)
        mesh=bpy.data.meshes.new(name+'-authored-surface')
        mesh.from_pydata(self.vertices,[],self.faces);mesh.update()
        obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
        layer=mesh.uv_layers.new(name='RibbonFeatherUV')
        for polygon in mesh.polygons:
            polygon.use_smooth=True
            for loop in polygon.loop_indices:
                layer.data[loop].uv=self.uv[mesh.loops[loop].vertex_index]
        mat=bpy.data.materials.new('Qi_Feathered_Translucent')
        mat.use_nodes=True
        nodes=mat.node_tree.nodes;nodes.clear()
        output=nodes.new('ShaderNodeOutputMaterial')
        bs=nodes.new('ShaderNodeBsdfPrincipled')
        bs.inputs['Base Color'].default_value=(.18,.75,1,1)
        bs.inputs['Emission Color'].default_value=(.15,.7,1,1)
        bs.inputs['Emission Strength'].default_value=1.4
        bs.inputs['Alpha'].default_value=.3
        bs.inputs['Roughness'].default_value=.5
        mat.node_tree.links.new(bs.outputs['BSDF'],output.inputs['Surface'])
        mat.surface_render_method='DITHERED'
        mat.diffuse_color=(.2,.75,1,.3)
        mesh.materials.append(mat)
        obj['reference_image']='reference-r2.png'
        obj['reference_sha256']=REFERENCE_HASH
        obj['design_derivation']=description
        obj['parts']=json.dumps(self.parts)
        # Pack reference in editable source; hide it from GLB and renders.
        image=bpy.data.images.load(str(REFERENCE),check_existing=True);image.pack()
        ref=bpy.data.objects.new('SOURCE_REFERENCE_NOT_GEOMETRY',None)
        bpy.context.collection.objects.link(ref)
        ref.empty_display_type='IMAGE';ref.data=image
        ref.hide_render=True;ref.hide_viewport=True
        ref['readme']='Existing R2 generated image; no new image generation in R3'
        bpy.context.view_layer.objects.active=obj;obj.select_set(True)
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(name+'.blend')))
        bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_extras=True,export_animations=False)
        mesh.calc_loop_triangles()
        bounds=[list(min(v[i] for v in self.vertices) for i in range(3)),list(max(v[i] for v in self.vertices) for i in range(3))]
        manifest['assets'][name]={'triangles':len(mesh.loop_triangles),'vertices':len(mesh.vertices),'mesh_surfaces':1,'ribbon_parts':self.parts,'derivation':description,'blender_bounds':bounds}

def samples(count=40):return [i/count for i in range(count+1)]

# Charge: first panel's sparse circular currents around the hand, three partial
# helices with large gaps; radius under 0.28 m leaves the actual hand readable.
r=Ribbons()
for j in range(3):
    def point(t):
        a=j*math.tau/3+t*math.pi*1.25
        radius=.18+.09*t
        return (radius*math.cos(a),radius*math.sin(a),.07-.19*t)
    r.add('hand_current_'+str(j),[point(t) for t in samples(32)],.044,normal=(0,0,1))
r.finish('qi-charge-r3','R2 first panel: disconnected hand-sized gathering currents; open center')

# Fist: compact forward pressure spiral derived from top-down contracted current.
r=Ribbons()
for j in range(3):
    def point(t):
        a=j*math.tau/3+t*3.1
        radius=.32*(1-t)**.65+.025
        return (radius*math.cos(a),radius*math.sin(a),.5-1.25*t)
    r.add('compressed_punch_'+str(j),[point(t) for t in samples(40)],.09,normal=lambda t:(math.cos(j*math.tau/3+t*3.1),math.sin(j*math.tau/3+t*3.1),0))
for side in [-1,1]:
    r.add('needle_wake_'+str(side),[(side*(.26-.11*t),.02+side*.07*math.sin(t*math.pi),.85-.95*t) for t in samples(24)],.012)
r.finish('qi-fist-r3','R2 contracted current in lower top view stretched along the fist direction; hollow spiral, no solid projectile')

# Palm: two bowed crescents around a negative-space central opening.
r=Ribbons()
for j in range(2):
    pts=[]
    for t in samples(48):
        a=-1.6+3.2*t
        pts.append(((.7+j*.11)*math.sin(a),(.12 if j==0 else -.13)*math.sin(math.pi*t),-(.38+j*.02)*math.cos(a)+j*.08))
    r.add('palm_bow_'+str(j),pts,.15 if j==0 else .047,normal=(0,1,.55 if j==0 else -.55))
for side in [-1,1]:
    r.add('palm_streamer_'+str(side),[(side*(.75-.22*t),.04*math.sin(t*math.pi),.35-.56*t) for t in samples(24)],.017)
r.finish('qi-palm-r3','R2 middle panel crescent widened into a shallow open palm pressure wave, fine offset echo')

# Sweep: long thin horizontal arc with dragged ends; cut silhouette is decisive.
r=Ribbons()
for j in range(3):
    pts=[]
    for t in samples(56):
        a=-1.42+2.84*t
        pts.append(((1.15+j*.035)*math.sin(a),.085*math.sin(a*1.7)+.22*math.cos(a)+j*.022,-(.48+j*.025)*math.cos(a)+j*.085))
    r.add('sweeping_crescent_'+str(j),pts,.18 if j==0 else .032,normal=(0,1,.28))
r.finish('qi-sweep-r3','R2 middle panel long crescent with two fine wakes, authored wide horizontal sweep')

# Cleave: derived crescent reauthored in a vertical plane, downward asymmetry.
r=Ribbons()
for j in range(3):
    pts=[]
    for t in samples(48):
        a=-1.35+2.7*t
        pts.append((.42*math.cos(a)-.14+.055*math.sin(a*2)+j*.035,1.08*math.sin(a),-.47*math.cos(a)+j*.08-.13*t))
    r.add('falling_crescent_'+str(j),pts,.18 if j==0 else .035,normal=(0,0,1))
r.finish('qi-cleave-r3','R2 open crescent adapted into a vertical downward cut; same filament language, no new storyboard claim')

# Skyfall: final panel's dispersed tapered branches, stronger vertical flow.
r=Ribbons()
for j in range(3):
    r.add('sky_rift_'+str(j),[(.09*math.sin(t*8+j)+(j-1)*.1*math.sin(math.pi*t),(t-.5)*2.4,-.12*math.sin(t*math.pi)+j*.02) for t in samples(48)],.085 if j==1 else .045,normal=(0,0,1))
for side in [-1,1]:
    for j in range(2):
        r.add('fork_%d_%d'%(side,j),[(side*(.08+.64*t),(.3 if j==0 else -.25)+(.42 if j==0 else -.35)*t+.12*math.sin(t*4),-.08+.15*t) for t in samples(24)],.045,normal=(0,0,1))
r.finish('qi-skyfall-r3','R2 final impact panel dispersed branching filaments stretched into a narrow vertical sky split; empty center')

# Impact: matching burst fingers, one surface with no opaque center or flash card.
r=Ribbons()
for j in range(8):
    angle=j*math.tau/8+.16*math.sin(j)
    pts=[]
    for t in samples(24):
        a=angle+.22*math.sin(t*math.pi)
        radius=.06+(.55+.18*(j%3)/2)*t
        pts.append((radius*math.cos(a),radius*math.sin(a),-.21*math.sin(t*math.pi)+.14*t))
    r.add('impact_finger_'+str(j),pts,.038 if j%2 else .065,normal=(0,0,1))
r.finish('qi-impact-r3','R2 third panel white-blue branching burst, open core and eight tapered decaying fingers')

(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('R3_LOCAL_VFX_BUILD',json.dumps({k:v['triangles'] for k,v in manifest['assets'].items()}))
