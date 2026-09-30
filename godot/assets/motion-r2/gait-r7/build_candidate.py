"""Bake isolated R7 hip/knee events; NEVER overwrite production source or GLB.

Run from repository root with Blender. The immutable pre-R7 snapshot is the
only input, so revisions never accumulate damage to original mesh or actions.
"""
import bpy,sys,json,hashlib,math,shutil
from pathlib import Path
import numpy as np
from mathutils import Vector,Matrix

out=Path('godot/assets/motion-r2').resolve();sys.path.insert(0,str(out));sys.path.insert(0,str(out/'gait-r5'))
sys.path.insert(0,str(out/'gait-r7'))
from gait_r7 import gait_pose,PARAMS,solve_leg,q
from full_skin_contact import FullSkinSoles
backup=out/'source/gait-r7-before'; dest=out/'gait-r7';dest.mkdir(exist_ok=True)
variant='next' if '--next' in sys.argv else 'candidate'
report_prefix='next-' if variant=='next' else ''
sys.path.insert(0,str(dest))
sys.path.insert(0,str(out/'gait-r6'))
from merge_gait_glb import replace_gait_animations
candidate_dir=out/'source/gait-r7-candidate';candidate_dir.mkdir(exist_ok=True)
(candidate_dir/'.gdignore').write_text('')
assert (backup/'snapshot.json').exists(),'Create immutable snapshot before authoring'
snapshot=json.loads((backup/'snapshot.json').read_text())
for entry in snapshot['files']:
    assert hashlib.sha256((backup/entry['backup']).read_bytes()).hexdigest()==entry['sha256'],'Backup changed'
bpy.ops.wm.open_mainfile(filepath=str(backup/'c2-motion-r2.blend'))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');scene=bpy.context.scene
config=json.loads((out.parent/'c2-motion.json').read_text());names=config['boneNames'];parents=config['boneParents'];P=[Vector(v) for v in config['nativePositions']]
C=Matrix(((1,0,0),(0,0,-1),(0,1,0)));inv=C.inverted()
rest={b.name:b.matrix_local.copy() for b in arm.data.bones}

def curves(action):
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:yield from bag.fcurves

def digest(action):
    rows=[(fc.data_path,fc.array_index,[(tuple(k.co),tuple(k.handle_left),tuple(k.handle_right),k.interpolation) for k in fc.keyframe_points]) for fc in curves(action)]
    return hashlib.sha256(repr(sorted(rows)).encode()).hexdigest()

def mesh_hash():
    return {o.name:hashlib.sha256(repr(([(tuple(v.co),[(g.group,g.weight) for g in v.groups]) for v in o.data.vertices],
                       [tuple(p.vertices) for p in o.data.polygons],[m.name for m in o.data.materials])).encode()).hexdigest()
            for o in scene.objects if o.type=='MESH'}

protected={a.name:digest(a) for a in bpy.data.actions if a.name not in PARAMS}
meshhash=mesh_hash()

class ShoeSamples(FullSkinSoles):
    def __init__(self,arm):
        super().__init__(arm);self.groups=[];self.foot_data={}
        for side in ['L','R']:
            allpoints=[]; groups=[]
            for obj,masks in self.entries:
                coords=np.array([list(inv@(obj.matrix_world@v.co)) for v in obj.data.vertices])
                ids=masks[side];ids=ids[coords[ids,1]<.06]
                if not len(ids):continue
                a=coords[ids];lo,hi=np.quantile(a[:,2],[.15,.85])
                groups.append((obj,ids[a[:,2]<lo],ids[a[:,2]>hi]))
                allpoints.extend(a.tolist())
            a=np.array(allpoints);lo,hi=np.quantile(a[:,2],[.15,.85]);toe=a[a[:,2]<lo].mean(axis=0);heel=a[a[:,2]>hi].mean(axis=0)
            yaw=math.degrees(math.atan2(-(toe-heel)[0],-(toe-heel)[2]))
            ankle=P[names.index('ankle'+side)]
            # Full footprint extrema are retained; no ankle-weight cutoff and no
            # artificial zero-X heel/toe. Sole height uses actual authored mesh.
            ymin=float(a[:,1].min());sole=a[a[:,1]<ymin+.018]
            heel[1]=ymin;heel[2]=float(sole[:,2].max());toe[1]=ymin;toe[2]=float(sole[:,2].min())
            self.foot_data[side]={'heel':list(Vector(heel)-ankle),'toe':list(Vector(toe)-ankle),
                    'sole':[list(Vector(v)-ankle) for v in sole], 'yaw_correction_deg':-yaw,
                    'rest_heel_to_toe_yaw_deg':yaw}
            self.groups.append((side,groups))

    def detail(self):
        bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();world={};result={}
        for obj,_ in self.entries:
            ev=obj.evaluated_get(deps);mesh=ev.to_mesh();data=np.empty(len(mesh.vertices)*3,dtype=np.float32);mesh.vertices.foreach_get('co',data)
            data=data.reshape(-1,3);mat=np.array(obj.matrix_world);world[obj.name]=data@mat[:3,:3].T+mat[:3,3];ev.to_mesh_clear()
        for side,groups in self.groups:
            toe=np.concatenate([world[o.name][ids] for o,ids,_ in groups]).mean(axis=0)
            heel=np.concatenate([world[o.name][ids] for o,_,ids in groups]).mean(axis=0)
            d=toe-heel
            result[side]={'yaw_deg':math.degrees(math.atan2(-d[0],d[1])),
                          'track_x':float((toe[0]+heel[0])/2),
                          'toe_mean_height':float(toe[2]),'heel_mean_height':float(heel[2]),
                          'toe':toe.tolist(),'heel':heel.tolist()}
        return result

soles=ShoeSamples(arm);feet=soles.foot_data
(dest/'foot-definition.json').write_text(json.dumps(feet,indent=2))
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
report={'parameters':PARAMS,'samples':{},'summary':{}}

for name,g in PARAMS.items():
    action=bpy.data.actions.new(name);arm.animation_data.action=action
    frames=round(g['duration']*60);rows=[]
    for step in range(frames*2+1):
        f=step/2
        scene.frame_set(int(f),subframe=f%1);positions,rotations,info=gait_pose(name,f/frames,names,parents,P,feet)
        ankles={side:Vector(info['sides'][side]['requested_ankle']) for side in ['L','R']}
        yaw={side:feet[side]['yaw_correction_deg'] for side in ['L','R']}
        total_y={side:0. for side in ['L','R']};max_clamp=max(d['initial_clamp_m'] for d in info['sides'].values())
        root_adjustment=0.
        def apply_pose():
            globals={n:Matrix.LocRotScale(C@positions[n],(C@rotations[n].to_matrix()@inv).to_quaternion()@rest[n].to_quaternion(),Vector((1,1,1))) for n in names}
            for n,target in globals.items():
                bone=arm.data.bones[n]
                arm.pose.bones[n].matrix_basis=rest[n].inverted()@(rest[bone.parent.name]@globals[bone.parent.name].inverted() if bone.parent else Matrix.Identity(4))@target
            for n,matrix in seeds[name].items():arm.pose.bones[n].matrix_basis=matrix
            bpy.context.view_layer.update()
        # Calibrate BOTH complete deformed shoes to the intended floor/clearance,
        # heading and track. This includes knee/ankle blended sole vertices.
        for iteration in range(26):
            apply_pose();heights,lowest=soles.sample();details=soles.detail()
            errors={s:(info['sides'][s]['clearance']-heights[s] if info['sides'][s]['stance'] else max(0,info['sides'][s]['clearance']-heights[s])) for s in ['L','R']}
            if (max(abs(e) for e in errors.values())<.00035 and
                max(abs(details[s]['yaw_deg']) for s in ['L','R'])<.15 and
                max(abs(details[s]['track_x']-(-.15 if s=='L' else .15)) for s in ['L','R'])<.0005):break
            for side in ['L','R']:
                dy=max(-.035,min(.035,errors[side]));ankles[side].y+=dy;total_y[side]+=dy
                ankles[side].x+=max(-.015,min(.015,(-.15 if side=='L' else .15)-details[side]['track_x']))
                yaw[side]-=max(-4,min(4,details[side]['yaw_deg']*.45))
                rotations['ankle'+side]=q(info['sides'][side]['roll'])@q(0,yaw[side])
            # Resolve contact at the pelvis rather than silently shortening an
            # unreachable leg. This keeps a softly extended support knee and
            # preserves the explicitly authored FK free-leg silhouette.
            drop=0.
            min_bend=10 if name=='walk' else 12
            for side in ['L','R']:
                A=P[names.index('hip'+side)];B=P[names.index('knee'+side)];D=P[names.index('ankle'+side)]
                l1=(B-A).length;l2=(D-B).length
                reach2=l1*l1+l2*l2+2*l1*l2*math.cos(math.radians(min_bend))
                h=positions['hip'+side];a=ankles[side]
                vertical=math.sqrt(max(.001,reach2-(a.x-h.x)**2-(a.z-h.z)**2))
                if info['sides'][side]['stance']:
                    drop=max(drop,h.y-a.y-vertical)
                elif h.y-a.y>vertical:
                    ankles[side].y=h.y-vertical
            drop=min(.025,max(0,drop))
            if drop:
                root_adjustment-=drop
                for n in positions:positions[n].y-=drop
                for side in ['L','R']:
                    if not info['sides'][side]['stance']:ankles[side].y-=drop
            for side in ['L','R']:
                clamp=solve_leg(side,ankles[side],positions,rotations,names,P);max_clamp=max(max_clamp,clamp)
        apply_pose();heights,lowest=soles.sample();details=soles.detail()
        final_clamp=max((ankles[s]-positions['ankle'+s]).length for s in ['L','R'])
        sample={'frame':f,'phase':f/frames,'iterations':iteration,'max_ik_clamp_m':final_clamp,'maximum_predictor_clamp_m':max_clamp,'root_contact_adjustment_y_m':root_adjustment,'sides':{}}
        for side in ['L','R']:
            h=positions['hip'+side];k=positions['knee'+side];a=positions['ankle'+side]
            thigh=math.degrees(math.atan2(-(k-h).z,-(k-h).y))
            bend=180-math.degrees((h-k).angle(a-k))
            sample['sides'][side]={**info['sides'][side],'height':heights[side],'height_error':(heights[side]-info['sides'][side]['clearance'] if info['sides'][side]['stance'] else min(0,heights[side]-info['sides'][side]['clearance'])),
                  'correction_y_m':total_y[side],'ankle_yaw_deg':yaw[side],**details[side],
                  'thigh_forward_deg':thigh,'knee_flexion_deg':bend,'hip':list(h),'knee':list(k),'ankle':list(a),'lowest':lowest[side]}
        rows.append(sample)
        for b in arm.pose.bones:
            b.keyframe_insert('location',frame=f);b.keyframe_insert('rotation_quaternion',frame=f);b.keyframe_insert('scale',frame=f)
    # Linear samples prevent unsampled Bezier overshoot through the ground.
    for fc in curves(action):
        for k in fc.keyframe_points:k.interpolation='LINEAR'
    action.use_fake_user=True
    track=arm.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,1,action);track.mute=True
    allside=[d for row in rows for d in row['sides'].values()]
    summary={'frames':frames,'baked_samples':frames*2+1,'authoring_hz':120,'min_shoe_height_m':min(d['height'] for d in allside),'max_contact_error_m':max(abs(d['height_error']) for d in allside),
             'max_ik_clamp_m':max(row['max_ik_clamp_m'] for row in rows),'clamped_frames':sum(row['max_ik_clamp_m']>.0001 for row in rows),
             'max_predictor_clamp_before_skin_calibration_m':max(row['maximum_predictor_clamp_m'] for row in rows),
             'max_real_shoe_heading_error_deg':max(abs(d['yaw_deg']) for d in allside),
             'thigh_min_max_deg':[min(d['thigh_forward_deg'] for d in allside),max(d['thigh_forward_deg'] for d in allside)],
             'knee_flexion_min_max_deg':[min(d['knee_flexion_deg'] for d in allside),max(d['knee_flexion_deg'] for d in allside)]}
    report['samples'][name]=rows;report['summary'][name]=summary
    print('R7_BAKED',name,json.dumps(summary),flush=True)
(dest/(report_prefix+'authoring-report.json')).write_text(json.dumps(report,indent=2))
arm.animation_data.action=None
assert protected=={n:digest(bpy.data.actions[n]) for n in protected},'Non-gait animation changed'
assert meshhash==mesh_hash(),'Mesh, topology, materials or weights changed'
assert all(arm.data.bones[n].matrix_local==m for n,m in rest.items()),'Rest changed'
preservation={'unchanged_non_gait_actions':protected,'unchanged_mesh_topology_material_weights':meshhash,'bone_rest_count':len(rest),'action_count':len(bpy.data.actions)}
(dest/(report_prefix+'preservation.json')).write_text(json.dumps(preservation,indent=2))
# The candidate stays reviewable if calibration fails; never overwrite release.
bpy.ops.wm.save_as_mainfile(filepath=str(candidate_dir/(variant+'.blend')))
# Isolated candidate is always exported for visual review; numerical failures
# stay explicit in the report and never authorize production integration.
bpy.ops.export_scene.gltf(filepath=str(candidate_dir/'dense-animation-export.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=False,export_skins=True)
replace_gait_animations(backup/'c2-motion-r2.glb',candidate_dir/'dense-animation-export.glb',dest/(variant+'.glb'))
meta=json.loads((backup/'clips.json').read_text())
for name,g in PARAMS.items():
    meta['clips'][name]=g['duration'];meta['stride_m'][name]=g['stride'];meta['stance_fraction'][name]=g['stance'];meta['reference_speed_mps'][name]=g['speed']
meta['gait_revision']='R7 ISOLATED CANDIDATE: explicit hip/knee gait events; awaiting visual review'
meta['gait_reference']='gait-review-r6/04-acceleration.png (reviewed main push-off/recovery); rejected phase/arm/high-knee errors corrected'
meta['gait_support_plane_m']=.002
meta['gait_authoring_hz']=120
(dest/(variant+'-clips.json')).write_text(json.dumps(meta,indent=2))
preservation['glb_sha256']=hashlib.sha256((dest/(variant+'.glb')).read_bytes()).hexdigest()
(dest/(report_prefix+'preservation.json')).write_text(json.dumps(preservation,indent=2))
print('GAIT_R7_CANDIDATE_EXPORT_COMPLETE',flush=True)
