"""Image-first martial library. Runs in local Blender; never writes motion-r2.

reference.png A: hip-led fist; B: diagonal palm crescent; C: compressed double
palm drive. Bake all C2 body and existing glove joints, preserving rests/skin.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion

OUT=Path(__file__).resolve().parent
assert (OUT/'reference.png').is_file(), 'image-first reference required'
assert (OUT/'impact-reference.png').is_file(), 'high-tier image-first reference required'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(OUT.parent/'motion-r2/c2-motion-r2.glb'))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
for o in list(bpy.context.scene.objects):
    if o!=arm: bpy.data.objects.remove(o,do_unlink=True)
arm.animation_data_clear()
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
C=Matrix(((1,0,0),(0,0,-1),(0,1,0)))
config=json.loads((OUT.parent/'c2-motion.json').read_text())
names=config['boneNames'];parents=config['boneParents'];P=[Vector(v) for v in config['nativePositions']]
rests={b.name:b.matrix_local.copy() for b in arm.data.bones}
restq={n:m.to_quaternion() for n,m in rests.items()}
def q(x=0,y=0,z=0):
    return Quaternion((0,0,1),math.radians(z))@Quaternion((0,1,0),math.radians(y))@Quaternion((1,0,0),math.radians(x))
def curve(t, keys):
    for (a,x),(b,y) in zip(keys,keys[1:]):
        if t<=b:
            u=max(0,min(1,(t-a)/(b-a))); u=u*u*(3-2*u)
            return x+(y-x)*u
    return keys[-1][1]
def vec(t,keys):
    return Vector(tuple(curve(t,[(k,v[j]) for k,v in keys]) for j in range(3)))

def pose(kind,t,air):
    # Separate hip initiation, shoulder release, recoil and foot settlement.
    load=curve(t,[(0,0),(.18,1),(.35,1),(.48,0),(1,0)])
    strike=curve(t,[(0,0),(.34,0),(.50,1),(.56,.96),(.78,0),(1,0)])
    hip=curve(t,[(0,0),(.18,-.32),(.30,-.32),(.44,1),(.57,1),(.84,0),(1,0)])
    if kind=='cancel': load=1-t;strike=0;hip=-.32*load
    high=kind in ['descent','landing','blink','arrival']
    offset=Vector((-.025*hip,-.075-.06*load,-.045*hip))
    yaw=-14+(32 if kind=='slash' else 20)*hip
    lean=-3-(9 if kind=='break' else 4)*strike
    if kind=='break': offset.y-=.12*load;offset.z-=.04*strike;yaw=-12+26*hip
    if air: offset=Vector((.015*hip,.12-.035*strike,.04*strike));lean+=8*strike
    if kind=='descent':
        dive=curve(t,[(0,0),(.26,.55),(.50,1),(1,1)])
        offset=Vector((0,.11,-.06*dive));lean=-48*dive;yaw=10*dive
    elif kind in ['landing','arrival']:
        absorb=curve(t,[(0,.35),(.18,1),(.38,.8),(.72,.2),(1,0)])
        offset.y=-.075-(.30 if kind=='landing' else .14)*absorb;lean=-22*absorb;yaw=-8
    elif kind=='blink':
        offset.y-=.04*load;lean=-4*load;yaw=-18*strike
    r={n:Quaternion() for n in names}
    r['pelvis']=q(0,yaw);r['lumbar']=q(lean*.45,7*strike)
    r['chest']=q(lean*.55,12*strike);r['head']=q(-lean*.6,-(yaw+19*strike)*.65)
    pos={};rot={}
    for i,n in enumerate(names):
        if parents[i]<0: pos[n]=P[i]+offset;rot[n]=r[n]
        else:
            pn=names[parents[i]];pos[n]=pos[pn]+rot[pn]@(P[i]-P[parents[i]]);rot[n]=rot[pn]@r[n]
    def limb(a,b,c,target,pole,endq):
        h=pos[a]; A=P[names.index(a)]; B=P[names.index(b)]; D=P[names.index(c)]
        l1=(B-A).length;l2=(D-B).length;delta=target-h
        length=max(abs(l1-l2)+.002,min(delta.length,l1+l2-.005));u=delta.normalized()
        end=h+u*length;along=(l1*l1-l2*l2+length*length)/(2*length)
        pole=Vector(pole);pole=(pole-u*pole.dot(u)).normalized()
        middle=h+u*along+pole*math.sqrt(max(0,l1*l1-along*along))
        pos[b]=middle;pos[c]=end;rot[a]=(B-A).rotation_difference(middle-h)
        rot[b]=(D-B).rotation_difference(end-middle);rot[c]=rot[b] if endq is None else endq
    for side,sign in [('L',-1),('R',1)]:
        left=side=='L'
        foot=Vector((sign*(.26 if kind=='break' else .20),.145,-.19 if left else .20))
        # Front sole remains planted. Rear pivots on its toe during hip drive.
        heel_lift=.025*max(0,hip) if not left else 0
        foot.y+=heel_lift;footroll=8*max(0,hip) if not left else 0
        if air:
            foot=Vector((sign*.22,.28 if left else .44,.18 if left else .28))
            foot.z+=.09*strike;footroll=12
        if kind=='descent':
            foot=Vector((sign*.20,.27 if left else .40,.22 if left else .39));footroll=16
        elif kind in ['landing','arrival']:
            foot=Vector((sign*.26,.145,-.20 if left else .18));footroll=0
        limb('hip'+side,'knee'+side,'ankle'+side,foot,(0,0,-1),q(footroll,8 if left else -20+22*hip))
        ready=Vector((sign*.19,1.40,-.25))
        endq=None # Closed fist follows its forearm; no sideways wrist break.
        hand=ready.copy()
        if kind=='fist' and not left:
            chamber=Vector((.29,1.27,.015)); contact=pos['shoulderR']+Vector((-.10,-.015,-.475))
            hand=ready.lerp(chamber,load).lerp(contact,strike)
        elif kind=='slash' and not left:
            hand=vec(t,[(0,ready),(.18,(.42,1.28,.06)),(.34,(.43,1.64,-.06)),(.50,(-.24,1.28,-.43)),(.58,(-.29,1.18,-.34)),(.78,(.25,1.29,-.12)),(1,ready)])
            endq=q(0,-sign*90,180)
        elif kind in ['break','cancel']:
            chamber=Vector((sign*.17,1.13,-.18))
            contact=pos['shoulder'+side]+Vector((-sign*.075,-.10,-.46))
            hand=ready.lerp(chamber,load).lerp(contact,strike)
            endq=q(0,-sign*90,180)
            if air: hand.y-=.13*strike;endq=q(-20,-sign*90,180)
        elif kind=='slash' and left:
            hand+=Vector((-.1*load,.05*load,.06*strike))
        if kind=='descent':
            hand=ready.lerp(Vector((.15,1.37,-.38)) if not left else Vector((-.32,1.10,.20)),dive)
        elif kind in ['landing','arrival']:
            target=Vector((.30,.40,-.34)) if not left and kind=='landing' else Vector((sign*.36,1.08,-.31))
            hand=ready.lerp(target,absorb);endq=None if not left and kind=='landing' else q(0,-sign*90,180)
        elif kind=='blink':
            target=Vector((-.03,1.40,-.28)) if left else Vector((.44,1.42,-.20))
            hand=ready.lerp(target,load*.4+strike*.7);endq=q(0,-sign*90,180)
        limb('shoulder'+side,'elbow'+side,'wrist'+side,hand,(sign*(1.55 if kind in ['break','cancel'] else .8),-1,.05),endq)
    # Existing glove anatomy: animate each phalanx without changing any bind.
    for b in arm.data.bones:
        n=b.name
        if n in pos: continue
        parent=b.parent.name
        side=n[-1];sign=-1 if side=='L' else 1
        h=C.inverted()@b.head_local; ph=C.inverted()@b.parent.head_local
        pos[n]=pos[parent]+rot[parent]@(h-ph)
        curl=.94 if kind in ['fist','descent'] or (kind=='landing' and side=='R') else .12+.20*load
        local=Quaternion()
        if n.startswith('thumb'):
            j=int(n[-2]);local=q(0,sign*(36 if j==1 else 24)*curl,-sign*(18 if j==1 else 30)*curl)
        elif not n.startswith('palm'):
            j=int(n[-2]);local=q(0,0,-sign*[76,92,68][j-1]*curl)
        rot[n]=rot[parent]@local
    glob={}
    for n in pos:
        glob[n]=Matrix.LocRotScale(C@pos[n],(C@rot[n].to_matrix()@C.inverted()).to_quaternion()@restq[n],Vector((1,1,1)))
    for n,target in glob.items():
        b=arm.data.bones[n]
        arm.pose.bones[n].matrix_basis=rests[n].inverted()@(rests[b.parent.name]@glob[b.parent.name].inverted() if b.parent else Matrix.Identity(4))@target

scene=bpy.context.scene;scene.render.fps=60
clips={}
for air in [False,True]:
    for kind,duration in [('fist',.65),('slash',.60),('break',1.90),('cancel',.30),('descent',1.4),('landing',.9),('blink',.8),('arrival',.65)]:
        name=('air_' if air else '')+'cast_martial_'+kind
        arm.animation_data_clear();action=bpy.data.actions.new(name);arm.animation_data_create();arm.animation_data.action=action
        frames=round(duration*60)
        for f in range(frames+1):
            scene.frame_set(f);pose(kind,f/frames,air)
            for b in arm.pose.bones:
                b.rotation_mode='QUATERNION';b.keyframe_insert('location',frame=f);b.keyframe_insert('rotation_quaternion',frame=f);b.keyframe_insert('scale',frame=f)
        action.use_fake_user=True;clips[name]=duration
        print('MARTIAL_BAKED',name,flush=True)
arm.animation_data.action=None
for a in bpy.data.actions:
    track=arm.animation_data.nla_tracks.new();track.name=a.name;strip=track.strips.new(a.name,1,a);track.mute=True
scene.frame_start=0;scene.frame_end=114
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'source/c2-martial-r4.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'c2-martial-r4.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_skins=True)
manifest={'reference':'reference.png','reference_sha256':hashlib.sha256((OUT/'reference.png').read_bytes()).hexdigest(),'high_reference':'impact-reference.png','high_reference_sha256':hashlib.sha256((OUT/'impact-reference.png').read_bytes()).hexdigest(),'clips':clips,'contact_normalized':.5,'bones':list(rests),'body_rest_preserved':True,'source_motion_sha256':hashlib.sha256((OUT.parent/'motion-r2/c2-motion-r2.glb').read_bytes()).hexdigest(),'mapping':{'fist':'reference row A','slash':'reference row B','break':'reference row C','cancel':'reference row C cancellation inset','descent':'impact-reference A1-3','landing':'impact-reference A4-6','blink':'impact-reference B1-4','arrival':'impact-reference B5-6'},'scope':'animation-only independent library; no shared mesh or locomotion writes'}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
print('MARTIAL_EXPORT_COMPLETE',flush=True)
