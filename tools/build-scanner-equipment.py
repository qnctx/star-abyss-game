"""Local Blender asset from scanner-equip-stow.png; no remote 3D credits."""
import bpy, math, os, random
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'playable','assets','equipment');os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,color,metal=0,rough=.6,emission=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 if emission:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
 return m
ivory=mat('weathered ivory mineral shell',(.70,.65,.52),.3,.48);gold=mat('brushed gold seams',(.39,.27,.10),.78,.32);black=mat('graphite rubber',(.025,.023,.019),.1,.82);glass=mat('recessed smoked glass',(.008,.019,.021),.5,.22);cloth=mat('brown woven suit',(.10,.076,.054),.02,.95);glove=mat('anatomical charcoal glove',(.031,.027,.022),.03,.87);cyan=mat('cyan radar',(.05,.72,.77),.25,.3,2);amber=mat('amber status',(.95,.44,.035),.15,.35,2)
def tex(m,name,size,kind):
 image=bpy.data.images.new(name,width=size,height=size);pix=[];rng=random.Random(22)
 for y in range(size):
  for x in range(size):
   if kind=='stone':
    vein=abs(math.sin(x*.032+math.sin(y*.037)*2.2+math.sin((x+y)*.079)*.22));v=.81+rng.random()*.11-(.22 if vein<.035 else 0);c=(v*.94,v*.90,v*.80)
   else:
    v=.16+(.02 if (x%7<3) != (y%7<3) else -.02)+rng.random()*.017;c=(v,v*.79,v*.57)
   pix.extend((*c,1))
 image.pixels.foreach_set(pix);image.pack();n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=image;m.node_tree.links.new(n.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
tex(ivory,'mineral grain',256,'stone');tex(cloth,'woven fibres',128,'cloth')
def group(name,parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;return o
root=group('ExplorerEquipment');device=group('Scanner',root);right=group('RightHand',root);left=group('LeftHand',root)
def finish(o,name,m,parent):
 o.name=name;o.data.materials.append(m);o.parent=parent
 for p in o.data.polygons:p.use_smooth=True
 return o
def ball(name,p,s,m,parent):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,location=p);o=bpy.context.object;o.scale=s;return finish(o,name,m,parent)
def link(name,a,b,r,m,parent,r2=None):
 a,b=Vector(a),Vector(b);d=b-a;bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=r,radius2=r if r2 is None else r2,depth=d.length,location=(a+b)/2);o=bpy.context.object;o.rotation_mode='QUATERNION';o.rotation_quaternion=d.to_track_quat('Z','Y');return finish(o,name,m,parent)
def shell(name,outline,front,back,m,parent,bevel=.006):
 n=len(outline);verts=[(x,y,z) for y in [front,back] for x,z in outline];faces=[tuple(reversed(range(n))),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);finish(o,name,m,parent)
 mod=o.modifiers.new('rounded manufactured edges','BEVEL');mod.width=bevel;mod.segments=3
 # UVs survive glTF export and use embedded generated material images.
 bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.02);bpy.ops.object.mode_set(mode='OBJECT');o.select_set(False);return o
def ring(name,p,r,thick,m,parent):
 bpy.ops.mesh.primitive_torus_add(major_segments=64,minor_segments=8,location=p,major_radius=r,minor_radius=thick,rotation=(math.pi/2,0,0));return finish(bpy.context.object,name,m,parent)
outline=[(-.044,-.16),(.036,-.16),(.05,-.07),(.065,.015),(.091,.055),(.090,.12),(.056,.164),(-.052,.164),(-.09,.121),(-.091,.06),(-.063,.018),(-.05,-.08)]
shell('rubber backplate',outline,-.024,.032,black,device,.008)
shell('gold shell perimeter',[(x*.98,z*.98) for x,z in outline],-.038,-.022,gold,device,.006)
shell('ivory front shell',[(x*.955,z*.972) for x,z in outline],-.043,-.032,ivory,device,.007)
ball('ergonomic grip back',(0,.029,-.09),(.043,.025,.066),black,device)
link('display recess',(0,-.043,.083),(0,-.052,.083),.069,black,device)
link('dark glass display',(0,-.052,.083),(0,-.055,.083),.063,glass,device)
ring('display gold lip',(0,-.053,.083),.067,.0018,gold,device)
for i,r in enumerate([.021,.042,.058]):ring('radar circle '+str(i),(0,-.057,.083),r,.00055,cyan,device)
for a in range(0,360,45):
 t=math.radians(a);link('radar tick',(math.cos(t)*.054,-.057,.083+math.sin(t)*.054),(math.cos(t)*.058,-.057,.083+math.sin(t)*.058),.00065,cyan,device)
ball('radar target',(.018,-.058,.101),(.0022,.001,.0022),cyan,device)
link('radar sweep',(0,-.058,.083),(.033,-.058,.121),.00065,cyan,device)
for side in [-1,1]:
 x=side*.074
 ball('status bezel',(x,-.043,.025),(.011,.007,.017),gold,device);ball('amber lamp',(x,-.049,.025),(.006,.003,.011),amber,device)
 for z in [.14,.033,-.13]:ball('flush fastener',(side*(.059 if z>0 else .033),-.044,z),(.0026,.001,.0026),black,device)
 pivot=group('FinL' if side<0 else 'FinR',device);pivot.location=(side*.072,0,.157)
 shell('folding sensor blade',[(-.015,0),(.015,0),(.020,.048),(.009,.068),(-.012,.064)],-.017,.005,black,pivot,.003)
 shell('sensor mineral rim',[(-.018,.01),(-.014,.01),(-.011,.063),(-.015,.061)],-.019,-.017,gold,pivot,.001)
 link('fin hinge',(side*.072,-.027,.157),(side*.072,.013,.157),.011,gold,device)
def glove_segment(name,a,b,r,parent):
 link(name,a,b,r,glove,parent,r*.91);ball(name+' knuckle',a,(r*1.08,r*1.08,r*1.08),glove,parent);ball(name+' pad',b,(r*.94,r*.94,r*.94),glove,parent)
def sleeve_arm(parent,wrist,end):
 link('tailored forearm',wrist,end,.037,cloth,parent,.061)
 d=Vector(end)-Vector(wrist)
 for t in [.15,.25,.40,.58,.72,.87]:
  p=Vector(wrist)+d*t;ball('fabric fold',p,(.038+t*.018,.034+t*.013,.009),cloth,parent)
 ball('wrist gasket',wrist,(.041,.029,.025),black,parent)
 mid=Vector(wrist)+d*.43;plate=ball('mineral vambrace',mid,(.04,.018,.09),ivory,parent);plate.rotation_euler.x=-.38
 link('vambrace gold seam',mid+Vector((-.024,-.014,-.05)),mid+Vector((.024,-.018,.06)),.0015,gold,parent)
ball('right gloved palm',(.079,.012,-.092),(.040,.027,.059),glove,right);sleeve_arm(right,(.105,.004,-.15),(.205,-.13,-.37))
for finger,z in enumerate([-.032,-.057,-.082,-.107]):
 pts=[(.093,.006,z),(.071,-.022,z+.003),(.036,-.048,z+.002),(.012,-.043,z-.005)]
 for j in range(3):glove_segment('right finger '+str(finger)+' joint '+str(j),pts[j],pts[j+1],.0088-finger*.00045,right)
for i,(a,b) in enumerate(zip([(.112,-.002,-.105),(.119,-.022,-.066),(.088,-.05,-.037)],[ (.119,-.022,-.066),(.088,-.05,-.037),(.061,-.052,-.033)])):glove_segment('right thumb '+str(i),a,b,.011,right)
ball('left gloved palm',(-.138,-.058,-.089),(.036,.024,.051),glove,left);sleeve_arm(left,(-.17,-.068,-.138),(-.265,-.18,-.34))
index=[(-.119,-.068,-.041),(-.077,-.067,.003),(-.047,-.066,.041),(-.021,-.063,.066)]
for i in range(3):glove_segment('left index '+str(i),index[i],index[i+1],.008,left)
for f in range(3):
 pts=[(-.142-f*.013,-.06,-.046),(-.12-f*.014,-.092,-.017),(-.107-f*.014,-.107,-.034),(-.119-f*.013,-.10,-.065)]
 for i in range(3):glove_segment('left curled finger '+str(f)+' '+str(i),pts[i],pts[i+1],.008,left)
for i,(a,b) in enumerate(zip([(-.113,-.055,-.11),(-.096,-.092,-.089)],[(-.096,-.092,-.089),(-.103,-.107,-.059)])):glove_segment('left thumb '+str(i),a,b,.01,left)
# Merge only within independently animated groups. Material primitives retain
# their detail while avoiding a draw call for every finger joint and fastener.
for parent in [device,right,left]+[o for o in bpy.data.objects if o.name in ['FinL','FinR']]:
 objects=[o for o in parent.children if o.type=='MESH']
 if not objects:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:
  o.select_set(True);bpy.context.view_layer.objects.active=o
  for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name=parent.name+'Geometry'
# Source keyframes are retained in the .blend for editing; runtime drives the same groups.
for frame,z,rot in [(1,-.6,-.8),(18,0,0),(58,0,0),(76,-.6,-.8)]:
 root.location.z=z;root.rotation_euler.x=rot;root.keyframe_insert('location',frame=frame);root.keyframe_insert('rotation_euler',frame=frame)
bpy.context.scene.frame_set(18)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'explorer-scanner-v1.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'explorer-scanner-v1.glb'),export_format='GLB',export_animations=False,export_current_frame=True,export_apply=True)
print('SCANNER_ASSET_DONE',os.path.join(OUT,'explorer-scanner-v1.glb'))
