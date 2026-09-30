import bpy,math,json
from pathlib import Path
OUT=Path('godot/assets/vfx-r2').resolve()
bpy.ops.wm.read_factory_settings(use_empty=True)
for layer in range(4):
 verts=[];faces=[];uv=[]
 for i in range(65):
  t=i/64;a=-1.45+2.9*t;width=(.11 if layer==0 else .023)*math.sin(math.pi*t)**1.2
  for side in [-1,1]:
   x=(.62+layer*.025)*math.sin(a);forward=(.42+layer*.018)*math.cos(a)-layer*.065+side*width
   z=.055*math.sin(a*2)+layer*.016+side*width*.85
   verts.append((x,forward,z));uv.append((t,(side+1)/2))
 for i in range(64):faces.append((i*2,i*2+1,i*2+3,i*2+2))
 mesh=bpy.data.meshes.new('TaperedQiRibbon');mesh.from_pydata(verts,[],faces);mesh.update()
 o=bpy.data.objects.new('QiBlade_Rim' if layer==0 else 'QiBlade_Filament_'+str(layer),mesh);bpy.context.collection.objects.link(o)
 uvl=mesh.uv_layers.new()
 for p in mesh.polygons:
  for li in p.loop_indices:uvl.data[li].uv=uv[mesh.loops[li].vertex_index]
 mat=bpy.data.materials.new('Qi_Translucent_'+str(layer));mat.diffuse_color=(.3,.8,1,.35);mat.use_nodes=True
 bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.3,.8,1,1);bs.inputs['Emission Color'].default_value=(.2,.7,1,1);bs.inputs['Emission Strength'].default_value=2;bs.inputs['Alpha'].default_value=.32
 mat.surface_render_method='DITHERED';o.data.materials.append(mat)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'source/qi-blade-r2.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'qi-blade-r2.glb'),export_format='GLB')
(OUT/'design.json').write_text(json.dumps({'span_m':1.27,'direction':'-Z','charge_s':.18,'release_s':.07,'flight_s':.55,'fade_s':.15,'geometry':'4 tapered curved ribbon meshes; open center; no opaque disk','shader':'native_vfx.gd applies UV feathering, additive unlit transparency, no depth writes'},indent=2))

def ribbon(name,points,width):
 verts=[];faces=[];uv=[]
 for i,p in enumerate(points):
  t=i/(len(points)-1);before=points[max(0,i-1)];after=points[min(len(points)-1,i+1)]
  dx=after[0]-before[0];dz=after[2]-before[2];length=max(.00001,math.hypot(dx,dz));w=width*math.sin(math.pi*t)**.7
  for side in [-1,1]:verts.append((p[0]-side*dz/length*w,p[1]+side*w*.25,p[2]+side*dx/length*w));uv.append((t,(side+1)/2))
 for i in range(len(points)-1):faces.append((2*i,2*i+1,2*i+3,2*i+2))
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob)
 layer=me.uv_layers.new()
 for poly in me.polygons:
  for li in poly.loop_indices:layer.data[li].uv=uv[me.loops[li].vertex_index]
 mat=bpy.data.materials.new(name+'-translucent');mat.diffuse_color=(.5,.8,1,.25);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Alpha'].default_value=.25;mat.surface_render_method='DITHERED';ob.data.materials.append(mat)

for tier,name in [(6,'qi-domain-r2'),(8,'qi-fracture-r2'),(9,'qi-dao-r2')]:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 if tier in [6,9]:
  count=4 if tier==6 else 7
  for j in range(count):
   angle=j*math.tau/count;radius=(.76 if tier==6 else 1.05)+.08*(j%2)
   pts=[]
   for i in range(49):
    a=angle+(i/48-.5)*math.tau/count*.78
    pts.append((radius*math.cos(a),.04*math.sin(a*3),radius*math.sin(a)))
   ribbon('OpenCrescent_'+str(j),pts,.045 if tier==6 else .04)
   pts=[(p[0]*1.11,p[1]-.025,p[2]*1.11) for p in pts];ribbon('FineEcho_'+str(j),pts,.012)
 else:
  for j in range(5):
   pts=[]
   for i in range(49):
    t=i/48;z=(t-.5)*2.1;x=.13*math.sin(t*math.pi*3)+.19*(j-2)*math.sin(t*math.pi)
    pts.append((x,.045*j*math.sin(t*math.pi),z))
   ribbon('FractureFilament_'+str(j),pts,.018 if j!=2 else .035)
 for j in range(8):
  angle=j*math.tau/8+.2;radius=.95 if tier==6 else 1.25
  pts=[((radius+.22*t)*math.cos(angle+.12*t),.04*math.sin(t*math.pi),(radius+.22*t)*math.sin(angle+.12*t)) for t in [i/24 for i in range(25)]]
  ribbon('ReleaseWisp_'+str(j),pts,.012)
 bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'source'/f'{name}.blend'))
 bpy.ops.export_scene.gltf(filepath=str(OUT/f'{name}.glb'),export_format='GLB')
