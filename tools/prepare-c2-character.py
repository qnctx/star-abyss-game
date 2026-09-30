"""Fit the first Lux3D mesh to the game's 19-bone rig and preserve editable sources."""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

OUT=Path('artifacts/c2-lux3d-20260911')
CANDIDATE='--candidate' in sys.argv
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(OUT/'c2-source_glb.glb'))
body=next(o for o in bpy.context.scene.objects if o.type=='MESH')
bpy.context.view_layer.objects.active=body
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
zlo=min(v.co.z for v in body.data.vertices); zhi=max(v.co.z for v in body.data.vertices)
scale=1.85/(zhi-zlo)
source_z=[0,.10,.43,.84,1.35,1.58,1.85]
target_z=[0,.12,.565,1.01,1.508,1.64,1.85]
def fit_z(z):
    for i in range(len(source_z)-1):
        if z<=source_z[i+1]:
            t=(z-source_z[i])/(source_z[i+1]-source_z[i])
            return target_z[i]+t*(target_z[i+1]-target_z[i])
    return target_z[-1]
for v in body.data.vertices:
    p=v.co*scale; z=p.z-zlo*scale
    # Fit leg centres to the gait rig without thinning the cloth/boot cross-section.
    # Hands overlap the thighs in height, so height alone must not classify them as legs.
    torso_x=-p.x*.85
    leg_x=-math.copysign(min(abs(p.x),.15)*.58+max(0,abs(p.x)-.15)*.85,p.x)
    leg_blend=max(0,min(1,(.94-z)/.22)) if abs(p.x)<.28 else 0
    x=torso_x*(1-leg_blend)+leg_x*leg_blend
    v.co=Vector((x,-p.y*.78,fit_z(z)))
body.name='C2_FabricAndArmor'
import bmesh
bm=bmesh.new();bm.from_mesh(body.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
bm.to_mesh(body.data);bm.free();body.data.update()
bpy.context.view_layer.update()

def material(name,color,roughness,metal=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bsdf=m.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(*color,1)
    bsdf.inputs['Roughness'].default_value=roughness;bsdf.inputs['Metallic'].default_value=metal
    return m
ivory=material('C2_IvoryBackShell',(.59,.52,.40),.78,.04)
edge_mat=material('C2_ShellEdge',(.28,.23,.15),.68,.25)
amber=material('C2_AmberSpine',(.60,.30,.045),.48,.3)
bsdf=amber.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Emission Color'].default_value=(.55,.20,.015,1);bsdf.inputs['Emission Strength'].default_value=.3
def back_y(x,z,offset=.010):
    hit,point,normal,index=body.ray_cast(Vector((x,-1,z)),Vector((0,1,0)))
    return point.y-offset if hit else -.13-offset
outline=[(.12,1.46),(.18,1.39),(.16,1.32),(.11,1.26),(.025,1.20),
         (-.075,1.135),(-.094,1.08),(-.066,1.025),(.015,.995),(.10,.95),
         (.105,.91),(.025,.934),(-.06,.957),(-.14,1.003),(-.16,1.072),
         (-.142,1.14),(-.077,1.205),(.012,1.269),(.077,1.34)]
centers=[Vector((.135,1.435)),Vector((.12,1.335)),Vector((.025,1.235)),Vector((-.10,1.125)),Vector((-.09,1.055)),Vector((.025,.995)),Vector((.08,.953))]
samples=[]
for i in range(len(centers)-1):
    p0=centers[max(0,i-1)];p1=centers[i];p2=centers[i+1];p3=centers[min(len(centers)-1,i+2)]
    for j in range(10):
        t=j/10;samples.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t))
samples.append(centers[-1]);verts=[];faces=[];columns=7
for i,p in enumerate(samples):
    tangent=(samples[min(i+1,len(samples)-1)]-samples[max(i-1,0)]).normalized();normal=Vector((-tangent.y,tangent.x))
    taper=max(.2,min(1,i/8,(len(samples)-1-i)/8));width=.039*taper
    for j in range(columns):
        x,z=p+normal*((j/(columns-1)*2-1)*width)
        verts.append((x,back_y(x,z,.035),z))
    if i:
        for j in range(columns-1):a=(i-1)*columns+j;faces.append((a,a+1,a+columns+1,a+columns))
mesh=bpy.data.meshes.new('C2_BackShellSurface');mesh.from_pydata(verts,[],faces);mesh.update()
shell=bpy.data.objects.new('C2_AsymmetricBackShell',mesh);bpy.context.collection.objects.link(shell);shell.data.materials.append(ivory)
bpy.context.view_layer.objects.active=shell
solid=shell.modifiers.new('ShellThickness','SOLIDIFY');solid.thickness=.009
bpy.ops.object.modifier_apply(modifier=solid.name)
bevel=shell.modifiers.new('WornShellEdges','BEVEL');bevel.width=.003;bevel.segments=2
bpy.ops.object.modifier_apply(modifier=bevel.name)
for p in shell.data.polygons:p.use_smooth=True

def tube(name,coords,radius,mat):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=6
    curve.bevel_depth=radius;curve.bevel_resolution=2
    sp=curve.splines.new('BEZIER');sp.bezier_points.add(len(coords)-1)
    for p,co in zip(sp.bezier_points,coords):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj);obj.data.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.object.convert(target='MESH');return bpy.context.object
spine=[(-.015,1.65),(-.025,1.55),(-.035,1.45),(-.025,1.35),(.005,1.26),(.022,1.20)]
spine_obj=tube('C2_AmberSpineInset',[(x,back_y(x,z,.017),z) for x,z in spine],.0022,amber)
parts=[body,shell,spine_obj]

# Bone origins follow HUMANOID_RIG; Blender is Z-up, game coordinates are Y-up.
rig=[('pelvis',-1,(0,1.01,0)),('waist',0,(0,.04,0)),('lumbar',1,(0,.16,0)),('chest',2,(0,.20,0)),
     ('head',3,(0,.351,-.006)),('clavicleL',3,(-.170,.118,0)),('shoulderL',5,(-.045,-.020,0)),
     ('elbowL',6,(0,-.30,0)),('wristL',7,(0,-.277,0)),('clavicleR',3,(.170,.118,0)),
     ('shoulderR',9,(.045,-.020,0)),('elbowR',10,(0,-.30,0)),('wristR',11,(0,-.277,0)),
     ('hipL',0,(-.087,0,0)),('kneeL',13,(0,-.445,0)),('ankleL',14,(0,-.445,0)),
     ('hipR',0,(.087,0,0)),('kneeR',16,(0,-.445,0)),('ankleR',17,(0,-.445,0))]
heads=[]
for name,parent,p in rig:
    v=Vector((p[0],-p[2],p[1]));heads.append(v+(heads[parent] if parent>=0 else Vector()))
tails=[]
for i,(name,parent,p) in enumerate(rig):
    child=next((j for j,(_,pa,_) in enumerate(rig) if pa==i),None)
    if name=='chest': tail=heads[i]+Vector((0,0,.2))
    elif name=='head': tail=heads[i]+Vector((0,0,.10))
    elif name.startswith('wrist'):tail=heads[i]+Vector((0,0,-.10))
    elif name.startswith('ankle'):tail=heads[i]+Vector((0,.12,-.07))
    else:tail=heads[child] if child is not None else heads[i]+Vector((0,0,.1))
    tails.append(tail.copy())
rest_heads=[v.copy() for v in heads];rest_tails=[v.copy() for v in tails]
from mathutils import Matrix
for side,indices in [(-1,[6,7,8]),(1,[10,11,12])]:
    rot=Matrix.Rotation(-side*math.radians(25),3,'Y');pivot=heads[indices[0]].copy()
    for i in indices:heads[i]=pivot+rot@(heads[i]-pivot);tails[i]=pivot+rot@(tails[i]-pivot)
arm_data=bpy.data.armatures.new('C2_GameRig');arm=bpy.data.objects.new('C2_GameRig',arm_data);bpy.context.collection.objects.link(arm)
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
for i,(name,parent,_) in enumerate(rig):
    b=arm_data.edit_bones.new(name);b.head=rest_heads[i];b.tail=rest_tails[i]
    if parent>=0:b.parent=arm_data.edit_bones[rig[parent][0]]
target_matrices=[arm_data.edit_bones[name].matrix.copy() for name,_,_ in rig]
for i,(name,_,_) in enumerate(rig):
    b=arm_data.edit_bones[name];b.head=heads[i];b.tail=tails[i]
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
unweighted=sum(not any(g.weight>1e-6 for g in v.groups) for v in body.data.vertices)
if unweighted:raise RuntimeError(f'Automatic weights left {unweighted} vertices unweighted; do not export')
# Small independent back pieces follow the torso, avoiding limb weight bleed.
for obj in parts[1:]:
    groups={name:obj.vertex_groups.new(name=name) for name in ['waist','lumbar','chest','head']}
    for v in obj.data.vertices:
        z=v.co.z
        if z>1.59 and obj==spine_obj:weights={'chest':1}
        elif z>1.30:weights={'chest':1}
        elif z>1.12:
            t=(z-1.12)/.18;weights={'chest':t,'lumbar':1-t}
        else:weights={'lumbar':1}
        for name,w in weights.items():groups[name].add([v.index],w,'REPLACE')
    mod=obj.modifiers.new('C2Skin','ARMATURE');mod.object=arm;obj.parent=arm
# Bake the relaxed A pose down to the engine's neutral bind pose, then reset rest bones.
for i,(name,_,_) in enumerate(rig):arm.pose.bones[name].matrix=target_matrices[i];bpy.context.view_layer.update()
for obj in parts:
    bpy.context.view_layer.objects.active=obj
    for mod in list(obj.modifiers):
        if mod.type=='ARMATURE':bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='POSE');bpy.ops.pose.transforms_clear();bpy.ops.object.mode_set(mode='EDIT')
for i,(name,_,_) in enumerate(rig):
    b=arm_data.edit_bones[name];b.head=rest_heads[i];b.tail=rest_tails[i];b.roll=0
bpy.ops.object.mode_set(mode='OBJECT')
for obj in parts:
    mod=obj.modifiers.new('C2Skin','ARMATURE');mod.object=arm
    for p in obj.data.polygons:p.use_smooth=True
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str((OUT/('c2-candidate.blend' if CANDIDATE else 'c2-editable.blend')).resolve()))
# Retain the high-detail editable source and create a separate runtime reduction.
for obj in parts:
    bpy.context.view_layer.objects.active=obj
    if obj==body:
        extra=0
        for other in parts[1:]:other.data.calc_loop_triangles();extra+=len(other.data.loop_triangles)
        obj.data.calc_loop_triangles()
        dec=obj.modifiers.new('GameTriangleBudget','DECIMATE');dec.ratio=(44000-extra)/len(obj.data.loop_triangles)
        bpy.ops.object.modifier_move_up(modifier=dec.name)
        bpy.ops.object.modifier_apply(modifier=dec.name)
    bpy.ops.object.vertex_group_limit_total(limit=4)
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    obj.data.validate(clean_customdata=False);obj.data.update()
game=Path('playable/assets/characters');game.mkdir(parents=True,exist_ok=True)
if not CANDIDATE:bpy.ops.export_scene.gltf(filepath=str((game/'c2-explorer.glb').resolve()),export_format='GLB',export_animations=False,export_yup=True)
bpy.ops.export_scene.gltf(filepath=str((OUT/('c2-candidate.glb' if CANDIDATE else 'c2-fitted.glb')).resolve()),export_format='GLB',export_animations=False,export_yup=True)
print(json.dumps({'status':'exported','unweighted_vertices':unweighted,'bones':len(rig)}))
