"""Reference-led, CPU-only construction of six distinct ascension effects."""
import bpy,bmesh,math,json,random
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'playable/assets/ascension-r8';DOC=ROOT/'docs/art/ascension-r8'
OUT.mkdir(parents=True,exist_ok=True);DOC.mkdir(parents=True,exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
rng=random.Random(81);objs=[];mats={}
def material(name,color,metal=.0,emission=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=.32
 p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission;mats[name]=m
def mesh(name,v,f,mat):
 me=bpy.data.meshes.new(name);me.from_pydata([(x,-z,y) for x,y,z in v],[],f);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.data.materials.append(mats[mat]);objs.append(o);return o
def polar(r,a,z=0):return (r*math.cos(a),r*math.sin(a),z)
def slab(name,points,depth,mat):
 n=len(points);v=[(x,y,z+dz) for dz in [-depth/2,depth/2] for x,y,z in points];f=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)];return mesh(name,v,f,mat)
def arc(name,r,width,start,end,z,mat,steps=12,depth=.065,taper=False):
 v=[]
 for i in range(steps+1):
  t=i/steps;a=start+(end-start)*t;w=width*(math.sin(math.pi*t)**.6*.95+.05 if taper else 1)
  for dz in [-depth/2,depth/2]:
   for s in [-1,1]:v.append(polar(r+s*w/2,a,z+dz))
 f=[]
 for i in range(steps):
  a=i*4;b=a+4
  f.extend([(a,b,b+1,a+1),(a+2,a+3,b+3,b+2),(a,a+2,b+2,b),(a+1,b+1,b+3,a+3)])
 f.extend([(0,1,3,2),(steps*4,steps*4+2,steps*4+3,steps*4+1)])
 return mesh(name,v,f,mat)
def line(name,points,width,mat):
 v=[]
 for i,p in enumerate(points):
  p=Vector(p);d=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)]);n=Vector((-d.y,d.x,0)).normalized()*width/2
  v.extend([tuple(p+n),tuple(p-n)])
 return mesh(name,v,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(points)-1)],mat)
def crystal(name,x,y,z,length,width,angle,mat='obsidian'):
 # Asymmetric eight-facet shard with a pitched ridge and broken basal edge.
 pts=[(-width*.5,-length*.36,0),(width*.4,-length*.5,0),(width*.55,length*.13,0),(width*.08,length*.56,0),(-width*.45,length*.21,0),(0,-length*.12,width*.55),(0,length*.14,-width*.32)]
 ca,sa=math.cos(angle),math.sin(angle);v=[(x+px*ca-py*sa,y+px*sa+py*ca,z+pz) for px,py,pz in pts]
 mesh(name,v,[(0,1,5),(1,2,5),(2,3,5),(3,4,5),(4,0,5),(1,0,6),(2,1,6),(3,2,6),(4,3,6),(0,4,6)],mat)
 line(name+' luminous fracture',[v[0],v[5],v[3]],.009,'energy')
def sigil(r,a,z,size=.1):
 # Etched fork/rake strokes, deliberately not glyph textures or generic torus.
 for j in range(3):
  aa=a+(j-1)*size/r*.55;p=polar(r-size*.4,aa,z);q=polar(r+size*.4,aa+.025,z)
  line('Inlaid angular rune',[p,q,polar(r+size*.18,aa+.05,z)],.015,'gold')
def gate(r,layers=2,dao=False):
 for layer in range(layers):
  rr=r+layer*.27;z=(layer%2)*.23-layer*.06
  for j in range(10 if dao else 8):
   n=10 if dao else 8;a=j*2*math.pi/n+layer*.13;span=2*math.pi/n*.73
   if dao and j in [2,7]:continue
   arc('Segmented engraved armor',rr,.18 if layer else .24,a,a+span,z,'silver',10,.10,dao)
   arc('Raised gold edge',rr+.10,.026,a+.015,a+span-.015,z+.063,'gold',10,.025)
   arc('Inner light channel',rr-.08,.023,a+.03,a+span-.03,z+.07,'energy',10,.018)
   for k in range(3):sigil(rr,a+span*(k+1)/4,z+.065,.115)
 for j in range(12):
  a=j*math.tau/12;crystal('Floating inscribed key',*polar(r+.72,a,.12*math.sin(a*3)),.19,.085,a,'gold')
def reset(id):
 global objs,mats;objs=[];mats={};bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 material('silver',(.51,.59,.66),.8);material('obsidian',(.022,.014,.05),.7);material('gold',(.67,.43,.16),.78)
 material('energy',(.10,.68,1) if id in ['qi-boost','aerial-crescent'] else (.44,.16,1),.1,2.8)
def build(id):
 reset(id)
 if id=='qi-boost':
  for j in range(5):
   v=[]
   for i in range(57):
    t=i/56;a=t*math.tau*1.35+j*1.25;r=.48+.14*math.sin(t*math.pi);w=.045*math.sin(t*math.pi)+.004
    for side in [-1,1]:v.append(((r+side*w)*math.cos(a),t*2.8-1.4,(r+side*w)*math.sin(a)+t*.2))
   mesh('Tapered helical qi filament',v,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(56)],'energy')
  for j in range(8):
   x=(j%4-1.5)*.17;line('Trailing needle',[(x,-.8,.05),(x*.8,-1.6,.3),(x*.5,-2.0,.7)],.012,'energy')
 elif id=='aerial-crescent':
  for j in range(4):
   arc('Layered crescent cutting surface',1.35+j*.15,.16-j*.025,-1.23+j*.09,1.7-j*.08,j*.07,'energy',48,.018,True)
  for j in range(9):
   a=-1.1+j*.30;line('Detached trailing filament',[polar(1.6,a,0),polar(1.82,a+.10,.03),polar(2.0,a+.15,.06)],.008,'energy')
 elif id=='blink-aperture':
  for j in range(12):
   a=j*math.tau/12
   arc('Broken silver collar',1.13,.14,a,a+.33,.05*math.sin(j),'silver',6,.08)
   sigil(1.13,a+.16,.12,.10)
   crystal('Prismatic aperture tooth',*polar(1.36,a,.10*math.sin(j*2)),.45,.19,a-.6)
   arc('Violet aperture inner filament',.97,.024,a+.04,a+.44,-.025,'energy',8,.01)
  for j in range(7):
   a=j*math.tau/7;crystal('Orbital splinter',*polar(1.74,a,.15),.19,.09,a)
 elif id=='domain-gate':
  gate(1.15,2)
  line('Central discontinuous spatial seam',[(.04,-1.85,.02),(-.03,-.8,.04),(.06,-.2,0),(-.055,.45,.04),(.025,1.95,0)],.048,'energy')
  for side in [-1,1]:
   line('Fractured seam edge',[(side*.12,-1.65,0),(side*.08,-.6,.02),(side*.15,.1,.05),(side*.08,1.6,0)],.018,'silver')
 elif id=='void-fracture':
  for j in range(15):
   a=j*math.tau/15;rr=.8+rng.random()*.65
   crystal('Radial shattered void plate',*polar(rr,a,rng.uniform(-.2,.22)),.65+rng.random()*.7,.21+rng.random()*.17,a-math.pi/2)
   pts=[polar(.10,a,0),polar(.43,a+.12,.04),polar(.7,a-.08,.03),polar(1.2,a+.06,-.03),polar(1.9,a+.12,0)]
   line('Forked lightning fracture',pts,.026,'energy');line('Fine crack branch',[pts[2],polar(1.05,a-.22,.03),polar(1.47,a-.31,.01)],.012,'energy')
  for j in range(13):
   a=j*math.tau/13;crystal('Outer ballistic fragment',*polar(2.03,a,rng.uniform(-.3,.3)),.14,.08,a,'silver')
 elif id=='dao-gate':
  gate(1.35,3,True)
  for rr in [.24,.49,.72]:
   for a in [0,math.pi]:arc('Nested eye arcs',rr,.016,a+.14,a+math.pi-.14,-.18,'energy',24,.012)
  for j in range(4):
   a=j*math.pi/2;line('Astral cardinal spine',[polar(.2,a,-.1),polar(.9,a,0),polar(2.05,a,.15)],.015,'energy')
   crystal('Cardinal floating reliquary',*polar(2.37,a,.05),.25,.15,a,'gold')
  for j in range(3):
   pts=[]
   for i in range(101):
    a=i*math.tau/100;pts.append((2.5*math.cos(a),1.9*math.sin(a),.22*math.sin(a+j)))
   line('Thin offset celestial orbit',[(x,y+(j-1)*.12,z) for x,y,z in pts],.008,'gold')
records=[]
for id in ['qi-boost','aerial-crescent','blink-aperture','domain-gate','void-fracture','dao-gate']:
 build(id);source=list(objs)
 bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'{id}.blend'))
 batches=[]
 for mat in mats:
  vs=[];fs=[]
  for o in source:
   if o.data.materials[0]!=mats[mat]:continue
   base=len(vs);vs.extend([(v.co.x,v.co.z,-v.co.y) for v in o.data.vertices]);fs.extend([tuple(base+i for i in p.vertices) for p in o.data.polygons])
  if not vs:continue
  o=mesh(id+'_'+mat,vs,fs,mat);bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_area()<1e-10],context='FACES');bm.to_mesh(o.data);bm.free();batches.append(o)
 bpy.ops.object.select_all(action='DESELECT')
 for o in batches:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/f'{id}.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
 verts=[(v.co.x,v.co.z,-v.co.y) for o in batches for v in o.data.vertices];lo=[min(v[i] for v in verts) for i in range(3)];hi=[max(v[i] for v in verts) for i in range(3)]
 records.append({'id':id,'glb':f'assets/ascension-r8/{id}.glb','blend':f'{id}.blend','triangles':sum(len(o.data.polygons) for o in batches),'drawCalls':len(batches),'materials':[o.data.materials[0].name for o in batches],'bounds':{'min':lo,'max':hi},'size':[hi[i]-lo[i] for i in range(3)],'bytes':(OUT/f'{id}.glb').stat().st_size})
assert sum(r['triangles'] for r in records)<30000
manifest={'version':'ascension-r8','reference':'docs/art/ascension-r8/ascension-reference.png','coordinates':'meters, Y up, +Z portal/slash normal; origin at effect center; qi helix extends along Y','runtime':'Scale/rotate at runtime. No lights, collision, physics or gameplay semantics. Disable castShadow/receiveShadow; pool instances and limit concurrency.','totalTriangles':sum(r['triangles'] for r in records),'assets':records}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8');print('ASCENSION_ASSETS_COMPLETE',json.dumps(manifest))
