"""Original textured prowler + reference-authored additional articulated membrane wings."""
import bpy,math,json,random
from pathlib import Path
from mathutils import Vector,Quaternion
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'playable/assets/creatures/riftwing-r11';DOC=ROOT/'docs/art/creatures/riftwing-r11';OUT.mkdir(parents=True,exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'playable/assets/creatures/rift-prowler-v1/rift-prowler.glb'))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');arm.name='RiftwingRig';body=bpy.data.objects['RiftProwler'];body.name='RiftwingBody'
for o in list(bpy.context.scene.objects):
 if o.type=='MESH' and o!=body:bpy.data.objects.remove(o,do_unlink=True)
# Preserve all original PBR channels and authored stone/vein/eye vertex colours.
def mat(name,color,metal=.1,rough=.7,emit=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1);p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emit;return m
stone=mat('Wing charcoal layered armor',(.11,.10,.12),.32,.64);membrane=mat('Wing fibrous violet membrane',(.075,.039,.095),.03,.82);vein=mat('Wing subdued amethyst veins',(.20,.06,.35),.08,.5,.26)
# Procedural microsurface remains editable; vertex colours carry the same appearance into GLB.
nodes=membrane.node_tree.nodes;links=membrane.node_tree.links;n=nodes.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=32;n.inputs['Detail'].default_value=3;bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.22;bump.inputs['Distance'].default_value=.028;links.new(n.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],nodes.get('Principled BSDF').inputs['Normal'])
added=[];rng=random.Random(11)
bpy.context.view_layer.objects.active=arm;arm.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for side,s in [('L',-1),('R',1)]:
 for name,p,parent in [(f'Wing_{side}_Root',(s*.29,.12,1.18),'Chest'),(f'Wing_{side}_Tip',(s*1.18,.03,1.62),f'Wing_{side}_Root')]:
  b=arm.data.edit_bones.new(name);b.head=p;b.tail=Vector(p)+Vector((0,.2,0));b.parent=arm.data.edit_bones[parent];b.roll=0
bpy.ops.object.mode_set(mode='OBJECT')
def weights(o,side):
 root=o.vertex_groups.new(name=f'Wing_{side}_Root');tip=o.vertex_groups.new(name=f'Wing_{side}_Tip')
 for v in o.data.vertices:
  t=max(0,min(1,(abs(v.co.x)-.92)/.5));root.add([v.index],1-t,'REPLACE');tip.add([v.index],t,'REPLACE')
 mod=o.modifiers.new('Articulated wing skin','ARMATURE');mod.object=arm;o.parent=arm;added.append(o)
def mesh(name,verts,faces,material,side,colors=False):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);me.materials.append(material)
 if colors:
  ca=me.color_attributes.new(name='WingColor',type='FLOAT_COLOR',domain='CORNER')
  for poly in me.polygons:
   for li in poly.loop_indices:
    v=me.vertices[me.loops[li].vertex_index].co;factor=.65+.35*math.sin(v.x*27+v.y*19)**2
    ca.data[li].color=(.12*factor,.064*factor,.15*factor,1)
  if not material.node_tree.nodes.get('Wing vertex pigment'):
   nd=material.node_tree.nodes.new('ShaderNodeVertexColor');nd.name='Wing vertex pigment';nd.layer_name='WingColor';material.node_tree.links.new(nd.outputs['Color'],material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
 weights(o,side);return o
def spar(points,r,material,side,name):
 vs=[];fs=[]
 for i,p in enumerate(points):
  d=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(i-1,0)]);q=d.to_track_quat('Z','Y');radius=r*(1-.70*i/max(1,len(points)-1))
  for j in range(7):vs.append(tuple(Vector(p)+q@Vector((radius*math.cos(j*math.tau/7),radius*math.sin(j*math.tau/7),0))))
 for i in range(len(points)-1):
  for j in range(7):a=i*7+j;b=i*7+(j+1)%7;fs.append((a,b,b+7,a+7))
 fs.extend([tuple(range(6,-1,-1)),tuple((len(points)-1)*7+j for j in range(7))]);mesh(name,vs,fs,material,side)
for side,s in [('L',-1),('R',1)]:
 root=Vector((s*.29,.12,1.18));knuckle=Vector((s*1.18,.03,1.62))
 fingers=[Vector((s*2.55,-.12,1.28)),Vector((s*2.2,-.92,.99)),Vector((s*1.55,-1.07,.91)),Vector((s*.79,-.70,.95)),root]
 # Five fan sectors with scalloped trailing edges and corrugated, vertex-pigmented membrane.
 for sector in range(len(fingers)-1):
  A=fingers[sector];B=fingers[sector+1];verts=[];faces=[];N=12;R=8
  for i in range(N+1):
   u=i/N;edge=A.lerp(B,u);edge=edge.lerp(knuckle,.18*math.sin(math.pi*u))
   for j in range(R+1):
    t=j/R;p=knuckle.lerp(edge,t);p.z-=.08*math.sin(math.pi*u)*math.sin(math.pi*t);p.z+=.012*math.sin(u*math.pi*8)*math.sin(t*math.pi);verts.append(tuple(p))
  for i in range(N):
   for j in range(R):a=i*(R+1)+j;faces.append((a,a+R+1,a+R+2,a+1))
  # Avoid coincident fan-root row by discarding zero area triangles in export later.
  mesh(f'{side} scalloped membrane panel {sector}',verts,faces,membrane,side,True)
  edgepoints=[tuple(knuckle.lerp(A.lerp(B,i/18).lerp(knuckle,.18*math.sin(math.pi*i/18)),1)) for i in range(19)]
  spar(edgepoints,.022,stone,side,f'{side} reinforced scallop hem')
  for k in range(3):
   u=(k+1)/4;target=A.lerp(B,u).lerp(knuckle,.18*math.sin(math.pi*u));points=[]
   for j in range(8):
    t=.18+j*.105;p=knuckle.lerp(target,t);p.z+=.012+.01*math.sin(j*1.7);points.append(tuple(p))
   spar(points,.0045,vein,side,f'{side} fine membrane vascular seam')
 spar([tuple(root),tuple((root+knuckle)/2+Vector((0,.06,.10))),tuple(knuckle),tuple(fingers[0])],.092,stone,side,f'{side} armored leading spar')
 for j,p in enumerate(fingers[1:4]):spar([tuple(knuckle),tuple(knuckle.lerp(p,.55)+Vector((0,.03,.07))),tuple(p)],.046,stone,side,f'{side} articulated finger strut {j}')
 # Overlapping pointed armor scales along the anterior arch, each with a raised ridge.
 for i in range(12):
  t=i/11;p=root.lerp(knuckle,t*2) if t<.5 else knuckle.lerp(fingers[0],(t-.5)*2);w=.13*(1-.38*t)*rng.uniform(.85,1.15);l=.25*rng.uniform(.85,1.18)
  v=[p+Vector((s*-l*.45,-w,0)),p+Vector((s*l*.52,-w*.7,0)),p+Vector((s*l*.8,0,.02)),p+Vector((s*l*.18,w,.025)),p+Vector((s*-l*.4,w*.7,0)),p+Vector((0,0,.09))]
  plate=mesh(f'{side} layered ridged wing plate {i}',[tuple(x) for x in v],[(0,1,5),(1,2,5),(2,3,5),(3,4,5),(4,0,5),(4,3,2,1,0)],stone,side)
  bpy.context.view_layer.objects.active=plate;bevel=plate.modifiers.new('Chipped chamfered scale edges','BEVEL');bevel.width=.012;bevel.segments=2;bpy.ops.object.modifier_apply(modifier=bevel.name)
  spar([tuple(p+Vector((s*-l*.25,-w*.45,.054))),tuple(p+Vector((0,0,.098))),tuple(p+Vector((s*l*.3,w*.3,.055)))],.0032,vein,side,f'{side} scale fracture inlay {i}')
# Consolidate the extra geometry to one mesh with three materials, retaining weighted detail.
bpy.ops.object.select_all(action='DESELECT')
for o in added:o.select_set(True)
bpy.context.view_layer.objects.active=added[0];bpy.ops.object.join();wings=bpy.context.object;wings.name='RiftwingMembraneWings'
import bmesh
bm=bmesh.new();bm.from_mesh(wings.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_area()<1e-10],context='FACES');bm.to_mesh(wings.data);bm.free()
# Actions animate the actual original quadruped skeleton plus the four added wing joints.
clips=[('ground-idle',2,True),('ground-walk',1.1,True),('ground-claw',.8,False),('takeoff',1.2,False),('flight',.9,True),('dive',1.0,False),('sweep',.9,False),('land',1.3,False),('hit',.6,False),('death',1.5,False)]
def pose(name,t):
 for b in arm.pose.bones:b.rotation_mode='QUATERNION';b.rotation_quaternion=(1,0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
 ground=name in ['ground-idle','ground-walk','ground-claw','death'];spread=0 if ground else 1
 if name=='takeoff':spread=min(1,t*2)
 if name=='land':spread=max(0,1-(t-.35)/.65)
 if name=='hit':spread=.8
 flap=math.sin(t*math.tau)*.45 if name=='flight' else 0
 for side,s in [('L',-1),('R',1)]:
  arm.pose.bones[f'Wing_{side}_Root'].rotation_quaternion=Quaternion((0,0,1),-s*1.13*(1-spread))@Quaternion((0,1,0),-s*(flap+.12*spread))
  arm.pose.bones[f'Wing_{side}_Tip'].rotation_quaternion=Quaternion((0,0,1),-s*.93*(1-spread))@Quaternion((0,1,0),-s*flap*.35)
  if name=='sweep':arm.pose.bones[f'Wing_{side}_Root'].rotation_quaternion=Quaternion((0,1,0),-s*.2)@Quaternion((0,0,1),s*math.sin(t*math.pi)*.65)
  if name=='death':
   arm.pose.bones[f'Wing_{side}_Root'].rotation_quaternion=Quaternion((0,1,0),-s*1.1*t)@Quaternion((0,0,1),-s*(1.13+.27*t))
   arm.pose.bones[f'Wing_{side}_Tip'].rotation_quaternion=Quaternion((0,0,1),-s*(.93-.58*t))
 for leg,offset in [('LF',0),('RH',0),('RF',math.pi),('LH',math.pi)]:
  swing=math.sin(t*math.tau+offset)*.34 if name=='ground-walk' else 0
  tuck=.26*spread
  arm.pose.bones[leg+'_Upper'].rotation_quaternion=Quaternion((1,0,0),swing+tuck)
  arm.pose.bones[leg+'_Lower'].rotation_quaternion=Quaternion((1,0,0),-.22*spread-max(0,-swing)*.48)
  arm.pose.bones[leg+'_Foot'].rotation_quaternion=Quaternion((1,0,0),-swing*.2)
 arm.pose.bones['Tail01'].rotation_quaternion=Quaternion((0,1,0),.07*math.sin(t*math.tau))
 arm.pose.bones['Tail02'].rotation_quaternion=Quaternion((0,1,0),.10*math.sin(t*math.tau+.4))
 arm.pose.bones['Neck'].rotation_quaternion=Quaternion((1,0,0),.025*math.sin(t*math.tau))
 if name=='ground-claw':
  # Wind-up then full forward/down claw reach at .5, three other legs remain braced.
  strength=math.sin(t*math.pi)**2
  wind=math.sin(min(1,t/.5)*math.pi) if t<.5 else 0
  arm.pose.bones['RF_Upper'].rotation_quaternion=Quaternion((1,0,0),.90*strength-.48*wind)
  arm.pose.bones['RF_Lower'].rotation_quaternion=Quaternion((1,0,0),.05*strength+.48*wind)
  arm.pose.bones['RF_Foot'].rotation_quaternion=Quaternion((1,0,0),-.32*strength)
  arm.pose.bones['Neck'].rotation_quaternion=Quaternion((1,0,0),-.07*strength)
  arm.pose.bones['Head'].rotation_quaternion=Quaternion((1,0,0),.045*strength)
 if name=='takeoff':arm.pose.bones['Root'].location.y=.09*math.sin(t*math.pi)
 if name=='dive':arm.pose.bones['Root'].rotation_quaternion=Quaternion((1,0,0),-.24*math.sin(t*math.pi))
 if name=='hit':arm.pose.bones['Chest'].rotation_quaternion=Quaternion((1,0,0),-.2*math.sin(t*math.pi));arm.pose.bones['Head'].rotation_quaternion=Quaternion((0,1,0),.2*math.sin(t*math.pi))
 if name=='death':
  arm.pose.bones['Root'].rotation_quaternion=Quaternion((0,0,1),1.60*t);arm.pose.bones['Root'].location.y=-.32*t
  for leg in ['LF','RF','LH','RH']:
   arm.pose.bones[leg+'_Upper'].rotation_quaternion=Quaternion((1,0,0),.75*t)
   arm.pose.bones[leg+'_Lower'].rotation_quaternion=Quaternion((1,0,0),-1.10*t)
   arm.pose.bones[leg+'_Foot'].rotation_quaternion=Quaternion((1,0,0),.3*t)
for name,duration,loop in clips:
 action=bpy.data.actions.new(name);action.use_fake_user=True;arm.animation_data_create();arm.animation_data.action=action
 for i in range(17):
  t=i/16;pose(name,t);frame=round(t*duration*30)
  if name in ['ground-walk','ground-claw','death']:
   bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();evaluated=body.evaluated_get(deps);evaluatedMesh=evaluated.to_mesh();low=min(v.co.z for v in evaluatedMesh.vertices);evaluated.to_mesh_clear();arm.pose.bones['Root'].location.y-=low
  for b in arm.pose.bones:
   b.keyframe_insert('rotation_quaternion',frame=frame,group=b.name);b.keyframe_insert('location',frame=frame,group=b.name)
 track=arm.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action);track.mute=True
arm.animation_data.action=bpy.data.actions['ground-idle'];bpy.context.scene.frame_start=0;bpy.context.scene.frame_set(0);bpy.context.scene.render.fps=30;bpy.context.scene.frame_end=60
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'riftwing-r11.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in [arm,body,wings]:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'riftwing-r11.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True)
report={'species':'riftwing-r11','source':'../rift-prowler-v1/rift-prowler.glb','axis':'meters, Y up, -Z forward, +X right','root':'RiftwingRig','bones':[b.name for b in arm.data.bones],'wingBones':['Wing_L_Root','Wing_L_Tip','Wing_R_Root','Wing_R_Tip'],'clips':[{'name':n,'duration':d,'loop':l} for n,d,l in clips],'triangles':sum(len(o.data.polygons) for o in [body,wings]),'wingTriangles':len(wings.data.polygons),'materials':[m.name for o in [body,wings] for m in o.data.materials],'note':'In-place creature movement; runtime owns root travel/collision. Blend clips on the same rig; original quadruped is not replaced.'}
(OUT/'manifest.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print('RIFTWING_BUILD_READY',json.dumps(report))
