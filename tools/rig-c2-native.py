"""Bind the original-proportion C2 mesh without any nonuniform geometry warp."""
import bpy, bmesh, json, sys, math
from pathlib import Path
from mathutils import Vector

args=sys.argv[sys.argv.index('--')+1:]
out=Path(args[0]);config=json.loads((out/'rig-config.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str((out/'c2-source_glb.glb').resolve()))
parts=[o for o in bpy.context.scene.objects if o.type=='MESH']
if len(parts)!=1:raise RuntimeError('Inspect multipart source before binding')
body=parts[0];bpy.context.view_layer.objects.active=body
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
zmin=min(v.co.z for v in body.data.vertices);zmax=max(v.co.z for v in body.data.vertices)
factor=1.85/(zmax-zmin)
center=Vector(config.get('sourceCenterXY',[0,0])+[0])
angle=math.radians(config.get('sourceYawDegrees',180))
from mathutils import Matrix
rotation=Matrix.Rotation(angle,3,'Z')
for v in body.data.vertices:
    p=v.co-center;p.z-=zmin;v.co=rotation@(p*factor)
body.name='C2_OriginalProportions'
bm=bmesh.new();bm.from_mesh(body.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
bm.to_mesh(body.data);bm.free();body.data.update()
bpy.context.view_layer.update()
exec(Path('tools/c2-back-detail.py').read_text(),globals())
details=add_back_detail(body,out)
names=['pelvis','waist','lumbar','chest','head','clavicleL','shoulderL','elbowL','wristL','clavicleR','shoulderR','elbowR','wristR','hipL','kneeL','ankleL','hipR','kneeR','ankleR']
parents=[-1,0,1,2,3,3,5,6,7,3,9,10,11,0,13,14,0,16,17]
# Authored positions are in game Y-up coordinates; Blender uses Z-up.
positions=config['positions']
heads=[Vector((p[0],-p[2],p[1])) for p in positions]
arm_data=bpy.data.armatures.new('C2_NativeRig');arm=bpy.data.objects.new('C2_NativeRig',arm_data);bpy.context.collection.objects.link(arm)
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
for i,name in enumerate(names):
    bone=arm_data.edit_bones.new(name);bone.head=heads[i]
    child=next((j for j,p in enumerate(parents) if p==i),None)
    if name=='chest':bone.tail=heads[i]+Vector((0,0,.15))
    elif name=='head':bone.tail=heads[i]+Vector((0,0,.18))
    elif name.startswith('wrist'):bone.tail=heads[i]+Vector((0,0,-.10))
    elif name.startswith('ankle'):bone.tail=heads[i]+Vector((0,.13,-.08))
    elif child is not None:bone.tail=heads[child]
    else:bone.tail=heads[i]+Vector((0,0,.1))
    if parents[i]>=0:bone.parent=arm_data.edit_bones[names[parents[i]]]
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
unweighted=sum(not any(g.weight>1e-6 for g in v.groups) for v in body.data.vertices)
weight_method='direct bone heat'
if unweighted:
    # The generated mesh has disconnected thin surfaces. Build a watertight
    # weighting proxy, then transfer weights without remeshing the visible skin.
    body.vertex_groups.clear()
    proxy=body.copy();proxy.data=body.data.copy();proxy.name='C2_WeightingProxy';bpy.context.collection.objects.link(proxy)
    proxy.parent=None;proxy.modifiers.clear();proxy.vertex_groups.clear()
    bpy.ops.object.select_all(action='DESELECT');proxy.select_set(True);bpy.context.view_layer.objects.active=proxy
    proxy.data.remesh_voxel_size=.015;bpy.ops.object.voxel_remesh()
    arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    missing=sum(not any(g.weight>1e-6 for g in v.groups) for v in proxy.data.vertices)
    if missing:raise RuntimeError(f'Weighting proxy has {missing} unweighted vertices')
    for group in proxy.vertex_groups:body.vertex_groups.new(name=group.name)
    bpy.context.view_layer.objects.active=body
    transfer=body.modifiers.new('ProxyWeightTransfer','DATA_TRANSFER');transfer.object=proxy
    transfer.use_vert_data=True;transfer.data_types_verts={'VGROUP_WEIGHTS'};transfer.vert_mapping='POLYINTERP_NEAREST'
    transfer.layers_vgroup_select_src='ALL';transfer.layers_vgroup_select_dst='NAME'
    bpy.ops.object.modifier_apply(modifier=transfer.name)
    bpy.data.objects.remove(proxy,do_unlink=True)
    unweighted=sum(not any(g.weight>1e-6 for g in v.groups) for v in body.data.vertices)
    if unweighted:raise RuntimeError(f'Weight transfer left {unweighted} vertices unweighted')
    weight_method='watertight voxel proxy bone heat; nearest-surface transfer to unchanged visible mesh'
for obj in details:
    groups={name:obj.vertex_groups.new(name=name) for name in ['lumbar','chest','head']}
    for v in obj.data.vertices:
        z=v.co.z
        if z>1.60:weights={'head':1}
        elif z>1.30:weights={'chest':1}
        elif z>1.1:
            t=(z-1.1)/.2;weights={'chest':t,'lumbar':1-t}
        else:weights={'lumbar':1}
        for name,w in weights.items():groups[name].add([v.index],w,'REPLACE')
    obj.parent=arm;mod=obj.modifiers.new('C2Skin','ARMATURE');mod.object=arm
body['c2NativeRig']=json.dumps({'version':'C2-ORIGINAL-20260912-R2','positions':positions})
body['sourceTaskId']=str(config['taskId'])
for p in body.data.polygons:p.use_smooth=True
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str((out/'c2-editable.blend').resolve()))
body.data.calc_loop_triangles()
report={'taskId':config['taskId'],'blender':bpy.app.version_string,'sourceTriangles':len(body.data.loop_triangles),'unweightedVertices':unweighted,'weightMethod':weight_method,'bones':len(names),'geometryProcessing':'uniform height scale, rigid yaw, seam welding; native rig; original rear reference projection and asymmetric shell/spine mesh; no proportion warp or pose bake','scale':factor,'nativePositions':positions}
(out/'binding-record.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
exec(Path('tools/export-c2-runtime.py').read_text(),globals())
