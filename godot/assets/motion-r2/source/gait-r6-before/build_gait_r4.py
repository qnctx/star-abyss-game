"""Replace only three gait actions in the frozen R3 Blender source."""
import bpy,sys,json,hashlib,math
from pathlib import Path
from mathutils import Vector,Matrix
out=Path('godot/assets/motion-r2').resolve();sys.path.insert(0,str(out))
from gait_r4 import gait_pose,PARAMS
base=out/'source/gait-r4-before/c2-motion-r2.blend'
bpy.ops.wm.open_mainfile(filepath=str(base))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
config=json.loads((out.parent/'c2-motion.json').read_text());names=config['boneNames'];parents=config['boneParents'];P=[Vector(v) for v in config['nativePositions']]
C=Matrix(((1,0,0),(0,0,-1),(0,1,0)));inv=C.inverted();scene=bpy.context.scene
rest={b.name:b.matrix_local.copy() for b in arm.data.bones}
def curves(action):
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                yield from bag.fcurves
def digest(action):
    rows=[]
    for fc in curves(action):
        rows.append((fc.data_path,fc.array_index,[(tuple(k.co),tuple(k.handle_left),tuple(k.handle_right),k.interpolation) for k in fc.keyframe_points]))
    return hashlib.sha256(repr(sorted(rows)).encode()).hexdigest()
protected={a.name:digest(a) for a in bpy.data.actions if a.name not in PARAMS}
meshhash={o.name:hashlib.sha256(repr([(tuple(v.co),[(g.group,g.weight) for g in v.groups]) for v in o.data.vertices]).encode()).hexdigest() for o in scene.objects if o.type=='MESH'}
feet={}
for side in ['L','R']:
    pool=[];ankle=P[names.index('ankle'+side)]
    for o in scene.objects:
        if o.type!='MESH' or o.parent!=arm:continue
        vg=o.vertex_groups.get('ankle'+side)
        if vg is None:continue
        for v in o.data.vertices:
            if any(g.group==vg.index and g.weight>.70 for g in v.groups):
                p=inv@(o.matrix_local@v.co)
                if p.y<.05:pool.append(p-ankle)
    min_y=min(v.y for v in pool);sole=[v for v in pool if v.y<min_y+.018]
    heel=Vector((0,min_y,max(v.z for v in sole)));toe=Vector((0,min_y,min(v.z for v in sole)))
    feet[side]={'heel':list(heel),'toe':list(toe),'sole':[list(v) for v in sole]}
(out/'gait-foot-r4.json').write_text(json.dumps(feet,indent=2))
print('FOOT_PIVOTS',json.dumps({s:{k:v for k,v in feet[s].items() if k!='sole'} for s in feet}),flush=True)
seeds={}
for name in PARAMS:
    old=bpy.data.actions[name];arm.animation_data.action=old
    if old.slots:arm.animation_data.action_slot=old.slots[0]
    scene.frame_set(0);bpy.context.view_layer.update()
    seeds[name]={b.name:b.matrix_basis.copy() for b in arm.pose.bones if b.name not in names}
arm.animation_data.action=None
for track in list(arm.animation_data.nla_tracks):
    if any(st.action and st.action.name in PARAMS for st in track.strips):arm.animation_data.nla_tracks.remove(track)
for name in PARAMS:bpy.data.actions.remove(bpy.data.actions[name])
scene.render.fps=60
for name,g in PARAMS.items():
    action=bpy.data.actions.new(name);arm.animation_data.action=action
    frames=round(g['duration']*60)
    for f in range(frames+1):
        scene.frame_set(f)
        positions,rotations=gait_pose(name,f/frames,names,parents,P,feet)
        globals={n:Matrix.LocRotScale(C@positions[n],(C@rotations[n].to_matrix()@inv).to_quaternion()@rest[n].to_quaternion(),Vector((1,1,1))) for n in names}
        for n,target in globals.items():
            bone=arm.data.bones[n]
            arm.pose.bones[n].matrix_basis=rest[n].inverted()@(rest[bone.parent.name]@globals[bone.parent.name].inverted() if bone.parent else Matrix.Identity(4))@target
        for n,matrix in seeds[name].items():arm.pose.bones[n].matrix_basis=matrix
        bpy.context.view_layer.update()
        for b in arm.pose.bones:
            b.keyframe_insert('location',frame=f);b.keyframe_insert('rotation_quaternion',frame=f);b.keyframe_insert('scale',frame=f)
    action.use_fake_user=True
    track=arm.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,1,action);track.mute=True
    print('REPLACED_GAIT',name,frames,flush=True)
arm.animation_data.action=None
assert protected=={n:digest(bpy.data.actions[n]) for n in protected},'Non-gait animation changed'
assert meshhash=={o.name:hashlib.sha256(repr([(tuple(v.co),[(g.group,g.weight) for g in v.groups]) for v in o.data.vertices]).encode()).hexdigest() for o in scene.objects if o.type=='MESH'},'Mesh or weights changed'
assert all(arm.data.bones[n].matrix_local==m for n,m in rest.items()),'Rest changed'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'source/c2-motion-r2.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'c2-motion-r2.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_skins=True)
meta=json.loads((out/'source/gait-r4-before/clips.json').read_text())
for name,g in PARAMS.items():
    meta['clips'][name]=g['duration'];meta['stride_m'][name]=g['stride'];meta['stance_fraction'][name]=g['stance']
meta['gait_revision']='R4 heel recovery; all other actions/meshes/rests retained from R3 source'
(out/'clips.json').write_text(json.dumps(meta,indent=2))
(out/'gait-r4-preservation.json').write_text(json.dumps({'unchanged_non_gait_actions':protected,'unchanged_mesh_weights':meshhash,'bone_rest_count':len(rest),'parameters':PARAMS,'glb_sha256':hashlib.sha256((out/'c2-motion-r2.glb').read_bytes()).hexdigest()},indent=2))
print('GAIT_R4_EXPORT_COMPLETE',flush=True)
