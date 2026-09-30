"""Reference-led lunar camp. CPU modelling/export; no rendering or paid API."""
import bpy, bmesh, math, json, shutil
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'playable/assets/camp-v2'; DOC=ROOT/'docs/art/camp-v2'
OUT.mkdir(parents=True,exist_ok=True); DOC.mkdir(parents=True,exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
ref=Path('E:/myProject/star-abyss-game/docs/art/camp-v2/camp-architecture-reference.png')
if ref.exists(): shutil.copy2(ref,DOC/ref.name)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
M={}
def mat(name,color,metal=0,rough=.65,emit=0):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,1); bs.inputs['Metallic'].default_value=metal; bs.inputs['Roughness'].default_value=rough
 if emit: bs.inputs['Emission Color'].default_value=(*color,1); bs.inputs['Emission Strength'].default_value=emit
 M[name]=m
for args in [('ceramic',(.58,.61,.6),.28),('edge',(.19,.23,.25),.7),('dark',(.045,.062,.071),.4),('orange',(.65,.26,.075),.45),('red',(.55,.09,.065),.3),('brass',(.62,.45,.2),.65),('glass',(.07,.19,.22),.55,.22),('canvas',(.39,.25,.17),0,.9),('warm', (1,.62,.22),0,.4,2.5),('cyan',(.16,.8,1),0,.3,3)]: mat(*args)
active=[]
def finish(o,name,material):
 o.name=name; o.data.materials.append(M[material]); active.append(o); return o
def box(name,loc,dim,material='ceramic',bevel=.035):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=dim; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mo=o.modifiers.new('Manufactured edge chamfer','BEVEL'); mo.width=bevel; mo.segments=1
  bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mo.name)
 return finish(o,name,material)
def mesh(name,verts,faces,material):
 me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update(); ob=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(ob); return finish(ob,name,material)
def beam(name,a,b,r=.035,material='edge',vertices=8):
 a,b=Vector(a),Vector(b); d=b-a
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=d.length,location=(a+b)/2); o=bpy.context.object; o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); return finish(o,name,material)
def text(name,body,loc,size=.24,material='ceramic'):
 cu=bpy.data.curves.new(name,'FONT'); cu.body=body; cu.size=size; cu.align_x='CENTER'; cu.extrude=.002
 ob=bpy.data.objects.new(name,cu); bpy.context.collection.objects.link(ob); ob.location=loc; ob.rotation_euler=(math.pi/2,0,0); ob.data.materials.append(M[material]); bpy.context.view_layer.objects.active=ob; ob.select_set(True); bpy.ops.object.convert(target='MESH'); ob.select_set(False); active.append(ob)
def crate(x,y,z,w=.72):
 box('Sealed cargo case',(x,y,z+w*.4),(w,w*.65,w*.8),'edge',.07)
 for dx in [-w*.32,w*.32]: box('Case retaining band',(x+dx,y,z+w*.4),(.045,w*.68,w*.84),'brass',.01)
 box('Case latch',(x,y-w*.34,z+w*.44),(.18,.045,.12),'dark',.01)
def window(x,y,z,w=1.3):
 box('Window pressure gasket',(x,y,z),(w+.16,.12,.99),'dark',.07)
 box('Window reflective glazing',(x,y-.068,z),(w,.025,.81),'glass',.035)
 for dx in [-w/2,w/2]: box('Window mullion',(x+dx,y-.09,z),(.05,.06,.89),'edge',.01)
 box('Window interior light',(x,y-.092,z+.39),(w*.8,.04,.025),'warm',.003)
def dish(x,y,z):
 beam('Dish pedestal',(x,y,z),(x,y,z+.42),.1)
 rings=5; seg=24; verts=[(x,y,z+.42)]
 for j in range(1,rings+1):
  r=.8*j/rings
  for i in range(seg):
   a=2*math.pi*i/seg; verts.append((x+r*math.cos(a),y+r*math.sin(a),z+.42+.35*(r/.8)**2))
 faces=[]
 for i in range(seg): faces.append((0,1+i,1+(i+1)%seg))
 for j in range(rings-1):
  for i in range(seg):
   a=1+j*seg+i;b=1+j*seg+(i+1)%seg; faces.append((a,b,b+seg,a+seg))
 mesh('Parabolic communications reflector',verts,faces,'ceramic')
 for a in [0,2.094,4.189]: beam('Dish feed support',(x+.7*math.cos(a),y+.7*math.sin(a),z+.73),(x,y,z+1.2),.017)
 box('Dish receiver',(x,y,z+1.2),(.15,.15,.15),'dark')
def build(kind,width,depth,accent):
 global active; active=[]; w=width/2; d=depth/2; floor=.7; top=4.1; shoulder=3.3
 box('Underfloor pressure hull',(0,0,.52),(width,depth,.36),'dark',.1)
 box('Interior deck',(0,0,.73),(width-.16,depth-.16,.12),'edge',.02)
 # Faceted side walls and sloping shoulders define the reference silhouette.
 for s in [-1,1]:
  mesh('Chamfered side pressure shell',[(s*w,-d,.7),(s*w,d,.7),(s*w,d,shoulder),(s*(w-.65),d,top),(s*(w-.65),-d,top),(s*w,-d,shoulder)],[(0,1,2,3,4,5)],'ceramic')
  for yy in [-d+.22,0,d-.22]:
   beam('Vertical structural rib',(s*(w+.025),yy,.75),(s*(w+.025),yy,shoulder),.065)
   beam('Shoulder structural rib',(s*(w+.025),yy,shoulder),(s*(w-.65),yy,top+.02),.065)
  for yy in [-1.1,.7]:
   box('Side access service panel',(s*(w+.035),yy,1.8),(.07,1.25,1.25),'edge',.04)
   for zz in [1.45,1.62,1.79,1.96,2.13]:box('Radiator cooling louver',(s*(w+.085),yy,zz),(.075,1.08,.055),'dark',.006)
 box('Back pressure bulkhead',(0,d,2),(width,.18,2.6),'ceramic',.05)
 for yy in [-d,d]:
  mesh('Faceted gable closure',[(-w,yy,shoulder),(w,yy,shoulder),(w-.65,yy,top),(-w+.65,yy,top)],[(0,1,2,3)],'ceramic')
 box('Roof panel',(0,0,top),(width-1.3,depth,.13),'ceramic',.05)
 # Front remains open through its central airlock; workshop has wide serving bay.
 opening=2.05 if kind!='workshop' else 5.2
 side=(width-opening)/2
 for s in [-1,1]:
  box('Front wall beside open airlock',(s*(opening/2+side/2),-d,2.0),(side,.2,2.6),'ceramic',.035)
  if kind!='workshop': window(s*(opening/2+side/2),-d-.14,2.05,min(1.4,side-.27))
 box('Faceted front header',(0,-d,3.53),(width-1.0,.23,1.04),'ceramic',.08)
 box('Front service color band',(0,-d-.132,3.56),(width-1.4,.035,.43),accent,.015)
 text('Station signage',{'command':'01  COMMAND','medical':'02  MEDICAL','workshop':'03  WORKSHOP'}[kind],(0,-d-.16,3.49),.24)
 # Airlock reveal, header, split slid-open door leaves, threshold, and actual interior.
 for s in [-1,1]:
  box('Airlock reveal jamb',(s*(opening/2+.07),-d-.1,1.99),(.16,.4,2.58),'edge',.03)
  if kind!='workshop':
   box('Retracted pressure door',(s*(opening/2+.21),-d+.1,1.91),(.36,.11,2.29),accent,.055)
   box('Airlock vertical guide',(s*(opening/2-.08),-d-.25,1.93),(.035,.05,2.35),'brass',.005)
 box('Airlock lintel',(0,-d-.14,3.28),(opening+.3,.42,.2),'edge',.03)
 box('Entry light',(0,-d-.37,3.15),(.8,.06,.065),'warm',.01)
 box('Entry threshold',(0,-d-.19,.81),(opening+.06,.55,.12),'brass',.025)
 box('Interior back panel',(0,d-.13,2),(width-.4,.04,2.25),'dark',.01)
 for xx in [-width*.26,width*.26]:
  box('Interior equipment console',(xx,d-.55,1.3),(1.3,.65,1.05),'edge',.07)
  box('Interior illuminated readout',(xx,d-.895,1.52),(.95,.025,.39),'cyan',.015)
 box('Interior overhead light',(0,0,3.75),(2,.35,.045),'warm',.01)
 # Raised deck, supports, four broad stair treads, railings leave center opening clear.
 py=-d-.72
 box('Front access platform',(0,py,.65),(width+.55,1.5,.18),'edge',.025)
 for xx in [-w,w]:
  for yy in [-d-.1,-d-1.35]:beam('Platform footing',(xx,yy,.08),(xx,yy,.59),.11)
 for i in range(4):
  yy=-d-1.5-(3-i)*.32; z=.14+i*.16
  box('Stair tread %d'%i,(0,yy,z),(2.15,.37,.13),'edge',.018)
  box('Stair safety nosing',(0,yy-.17,z+.068),(2.04,.035,.02),'brass',.003)
 for s in [-1,1]:
  for xx in [s*1.25,s*w]:beam('Deck handrail post',(xx,-d-1.37,.73),(xx,-d-1.37,1.7),.035,'brass')
  for zz in [1.22,1.68]:beam('Deck horizontal handrail',(s*1.25,-d-1.37,zz),(s*w,-d-1.37,zz),.032,'brass')
  beam('Stair sloped handrail',(s*1.22,-d-2.48,1.08),(s*1.22,-d-1.4,1.7),.034,'brass')
  beam('Stair foot post',(s*1.22,-d-2.48,.05),(s*1.22,-d-2.48,1.08),.034,'brass')
 # Roof hardware and panel seams.
 for xx in [-w+1,w-1]:beam('Roof edge protective rail',(xx,-d+.15,top+.14),(xx,d-.15,top+.14),.04)
 for yy in [-d+.5,0,d-.5]:box('Roof seam',(0,yy,top+.078),(width-1.45,.025,.025),'edge',.003)
 for xx in [-.8,.6]:
  box('Rooftop HVAC',(xx,.8,top+.29),(1.08,1.1,.46),'edge',.065)
  for j in range(5):box('HVAC radiator vane',(xx-.4+j*.2,.8,top+.54),(.055,.88,.05),'dark',.005)
 ax=w-.7; ay=d-.45
 beam('Communications mast',(ax,ay,top),(ax,ay,top+2),.055)
 beam('Antenna whip',(ax,ay,top+2),(ax,ay,top+3.15),.016)
 box('Mast status bar',(ax,ay-.08,top+1.6),(.055,.055,.59),'cyan',.01)
 for s in [-1,1]: beam('Mast brace',(ax+s*.4,ay,top+.08),(ax,ay,top+1),.025)
 if kind=='command':
  dish(-1.25,-.25,top+.09)
  for xx in [-w+.32,w-.32]:box('Command orange shoulder identity',(xx,-d-.125,3),(.4,.05,.82),'orange',.02)
 if kind=='medical':
  for dims in [(.72,.04,.22),(.22,.04,.72)]:box('Medical red cross',(-w+.75,-d-.14,2.88),dims,'red',.01)
  box('Medical treatment couch',(1.1,.3,1.2),(.95,1.85,.3),'ceramic',.12)
 if kind=='workshop':
  box('Service counter',(0,-d-.13,1.22),(4.6,.8,.86),'orange',.065)
  box('Counter work surface',(0,-d-.13,1.68),(4.85,.96,.12),'edge',.035)
  for xx in [-1.65,-.55,.55,1.65]:box('Counter cabinet door',(xx,-d-.551,1.22),(.98,.035,.65),'dark',.02)
  for zz in [1.28,2.07,2.85]:box('Workshop parts shelf',(0,d-.5,zz),(4.3,.65,.07),'brass',.015)
  for xx in [-1.8,-.9,0,.9,1.8]:
   crate(xx,d-.5,2.12,.38)
   beam('Workshop bottle',(xx,-d-.15,1.75),(xx,-d-.15,2.0),.09,'brass')
  # Awning fabric with visible drape strips, triangular side cheeks and support rods.
  span=w+.2; y0=-d-.15; y1=-d-2.05
  verts=[]
  for j in range(9):
   x=-span+2*span*j/8
   for k in range(6):
    t=k/5; verts.append((x,y0+(y1-y0)*t,3.42-.6*t-.16*math.sin(math.pi*t)+.025*math.cos(j*math.pi)))
  faces=[]
  for j in range(8):
   for k in range(5):a=j*6+k;faces.append((a,a+6,a+7,a+1))
  mesh('Draped canvas shop awning',verts,faces,'canvas')
  for xx in [-span,span]:
   beam('Awning support post',(xx,y1,.12),(xx,y1,2.86),.045,'brass'); beam('Awning tension rod',(xx,y1,2.86),(xx,y0,3.45),.027)
  beam('Awning front crossbar',(-span,y1,2.84),(span,y1,2.84),.035)
 # Exterior machinery, individually shaped cargo, pressure tanks and lamps.
 for s in [-1,1]:
  crate(s*(w+.55),-.5,0,.86); crate(s*(w+.5),.35,0,.65)
  beam('Exterior oxygen cylinder',(s*(w+.4),1.1,.25),(s*(w+.4),1.1,1.7),.22,'brass',12)
  for z in [.38,1.45]:beam('Tank collar',(s*(w+.4),1.1,z),(s*(w+.4),1.1,z+.09),.245,'edge',12)
  box('Hull corner safety lamp',(s*(w-.16),-d-.16,.97),(.22,.07,.055),'cyan',.01)
 # Fastener rows communicate assembled panels without textures.
 for x in [-w+.18,-w+.6,w-.6,w-.18]:
  for z in [1.05,2.7,3.24]:beam('Hull bolt',(x,-d-.13,z),(x,-d-.16,z),.024,'dark',6)
 return list(active)
records=[]
for kind,w,d,col in [('command',6.8,4.8,'orange'),('medical',6.4,4.6,'red'),('workshop',7.6,4.8,'orange')]:
 objs=build(kind,w,d,col)
 for o in objs:o['station']=kind
 # Save native editable authored objects. Separate GLB batches keep draw calls bounded.
 bpy.ops.object.select_all(action='DESELECT')
 for o in objs:o.select_set(True)
 bpy.context.view_layer.objects.active=objs[0]
 bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'{kind}.blend'))
 export=[]; tris=0
 for material in M:
  subset=[o for o in objs if o.data.materials and o.data.materials[0].name==M[material].name]
  if not subset:continue
  verts=[]; faces=[]
  for o in subset:
   base=len(verts); verts.extend([tuple(o.matrix_world@v.co) for v in o.data.vertices]); faces.extend([tuple(base+i for i in p.vertices) for p in o.data.polygons]);tris+=sum(len(p.vertices)-2 for p in o.data.polygons)
  ob=mesh(f'{kind}_{material}',verts,faces,material)
  bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_area()<1e-9],context='FACES');bm.to_mesh(ob.data);bm.free();export.append(ob)
 tris=sum(len(o.data.polygons) for o in export)
 bpy.ops.object.select_all(action='DESELECT')
 for o in export:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/f'{kind}.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
 records.append({'id':kind,'asset':f'assets/camp-v2/{kind}.glb','source':f'{kind}.blend','triangles':tris,'meshBatches':len(export),'bodySize':[w,4.1,d],'frontDirection':[0,0,1],'entrance':[0,.81,d/2+.2],'approach':[0,0,d/2+2.9],'platform':{'center':[0,.65,d/2+.72],'size':[w+.55,.18,1.5]},'stairs':{'center':[0,.35,d/2+1.98],'width':2.15,'rise':.16,'run':.32,'count':4},'bodyCollision':{'center':[0,2,d/2*-0.02],'halfExtents':[w/2,2,d/2]},'note':'Front airlock physically open; split body collision around doorway for interior traversal. Workshop service counter intentionally occupies front opening; interact from exterior platform.'})
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
(OUT/'manifest.json').write_text(json.dumps({'version':2,'reference':'docs/art/camp-v2/camp-architecture-reference.png','units':'meters','runtimeAxes':'Y up; entrance toward +Z','materials':'10 embedded PBR vertex-independent materials, no external textures','suggestedLayout':[{'id':'command','position':[-10,0,-5],'rotationY':.3},{'id':'medical','position':[0,0,-11],'rotationY':0},{'id':'workshop','position':[10,0,-4],'rotationY':-.4}],'buildings':records},indent=2),encoding='utf-8')
print('CAMP_BUILD_COMPLETE',json.dumps(records))
