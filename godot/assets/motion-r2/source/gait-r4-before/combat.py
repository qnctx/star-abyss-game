"""Authored combat keys in C2 canonical Y-up coordinates. No mesh/rest edits."""
import math
from mathutils import Vector, Quaternion

def curve(t, keys):
    for (a,x),(b,y) in zip(keys,keys[1:]):
        if t<=b:
            u=max(0,min(1,(t-a)/(b-a)));u=u*u*(3-2*u)
            return x+(y-x)*u
    return keys[-1][1]

def combat_pose(name,t,names,parents,P,q):
    air=name.startswith('air_');name=name.removeprefix('air_')
    spell=name.startswith('cast_')
    # Hold readable chamber keys, then accelerate through the actual release.
    chamber=curve(t,[(0,0),(.18,1),(.35,1),(.50,0),(.65,0),(1,0)]) if spell else 0
    spell_strike=curve(t,[(0,0),(.34,0),(.50,1),(.55,1),(.78,.20),(1,0)]) if spell else 0
    spell_drive=curve(t,[(0,0),(.16,-.25),(.32,-.25),(.46,1),(.56,1),(.85,.1),(1,0)]) if spell else 0
    # Hip reaches its drive key before shoulder release; contact remains exactly .38.
    drive=curve(t,[(0,0),(.12,-.22),(.29,1),(.43,1),(.76,.12),(1,0)])
    release=curve(t,[(0,0),(.20,0),(.38,1),(.43,.98),(.64,.12),(.82,0),(1,0)])
    # A hit reacts immediately; unlike an attack it has no anticipatory windup.
    recoil=curve(t,[(0,.4),(.13,1),(.27,.90),(.60,.20),(1,0)])
    r={n:Quaternion() for n in names}
    offset=Vector((0,-.065,-.015))
    yaw=-12.;lean=-4.;chestyaw=4.
    if name in ('jab','cross','cast'):
        sign=-1 if name=='jab' else 1
        yaw+=sign*(12 if name=='jab' else 25)*drive
        chestyaw+=sign*(8 if name=='jab' else 12)*curve(t,[(0,0),(.16,-.15),(.34,1),(.45,1),(.76,0),(1,0)])
        offset.z-=.035*drive;offset.x+=(-.018 if name=='jab' else -.035)*drive
        lean-=3*drive
        if name=='jab':
            lean-=16*release
            offset.z-=.055*drive
    if name=='kick':
        shift=curve(t,[(0,0),(.17,1),(.60,1),(.90,0),(1,0)])
        offset.x-=.115*shift;offset.y+=.025*shift
        yaw+=12*drive;lean+=11*release;chestyaw-=8*drive
    if name=='hit':
        offset.z+=.045*recoil;offset.y-=.025*recoil
        lean+=14*recoil;chestyaw-=8*recoil
    if spell:
        sign=-1 if name=='cast_palm' else 1
        yaw+=sign*(34 if name=='cast_sweep' else 22)*spell_drive
        chestyaw+=sign*(22 if name=='cast_sweep' else 12)*spell_strike
        offset.z-=.045*spell_drive
        offset.x+=(-.035 if name!='cast_palm' else .025)*spell_strike
        lean-=5*spell_strike
        if name in ['cast_cleave','cast_skyfall']:
            lean=5*chamber-16*spell_strike
            offset.y+=.035*chamber-.060*spell_strike
    if air:
        offset.y+=.14;offset.x*=.4;offset.z*=.6
    r['pelvis']=q(0,yaw);r['lumbar']=q(lean*.45, chestyaw*.35)
    r['chest']=q(lean*.55,chestyaw*.65);r['head']=q(-lean*.65,-(yaw+chestyaw)*.65)
    positions={};rotations={}
    for i,n in enumerate(names):
        if parents[i]<0:positions[n]=P[i]+offset;rotations[n]=r[n]
        else:
            pn=names[parents[i]];positions[n]=positions[pn]+rotations[pn]@(P[i]-P[parents[i]]);rotations[n]=rotations[pn]@r[n]
    def limb(a,b,c,target,pole,endq=None):
        h=positions[a];A=P[names.index(a)];B=P[names.index(b)];D=P[names.index(c)]
        l1=(B-A).length;l2=(D-B).length;delta=target-h
        length=max(abs(l1-l2)+.002,min(delta.length,l1+l2-.004));u=delta.normalized()
        target=h+u*length;along=(l1*l1-l2*l2+length*length)/(2*length)
        pole=Vector(pole);pole=(pole-u*pole.dot(u)).normalized()
        joint=h+u*along+pole*math.sqrt(max(0,l1*l1-along*along))
        positions[b]=joint;positions[c]=target
        rotations[a]=(B-A).rotation_difference(joint-h)
        rotations[b]=(D-B).rotation_difference(target-joint)
        rotations[c]=rotations[b] if endq is None else endq
    for side in ('L','R'):
        left=side=='L';foot=Vector((-.185 if left else .185,.14,-.145 if left else .18))
        footyaw=8 if left else -22
        if name=='cross' and not left:footyaw+=28*drive
        if name=='jab' and not left:footyaw-=9*drive
        if name=='jab' and left and not air:
            foot.z-=.16*curve(t,[(0,0),(.08,0),(.32,1),(.65,1),(1,0)])
            foot.y+=.065*curve(t,[(0,0),(.06,0),(.19,1),(.33,0),(.70,0),(.83,.55),(1,0)])
        if name=='kick' and left:footyaw+=20*drive
        if spell and not left:footyaw+=22*spell_drive
        if air:
            foot=Vector((-.18 if left else .18,.23 if left else .32,.12 if left else .22))
        if name=='kick' and not left:
            chamber=curve(t,[(0,0),(.22,1),(.50,1),(.74,.9),(1,0)])
            # Knee rises before the lower leg opens; re-chamber before putting foot down.
            foot.y+=.33*chamber+.42*release;foot.z-=.23*chamber+.68*release
            limb('hipR','kneeR','ankleR',foot,(0,.6,-1),q(72*release,footyaw))
        else:
            limb('hip'+side,'knee'+side,'ankle'+side,foot,(0,0,-1),q(0,footyaw))
    for side in ('L','R'):
        left=side=='L';sign=-1 if left else 1
        # Compact cheek guard with elbows below fists, away from chest armour.
        hand=Vector((sign*.185,1.43 if left else 1.40,-.265 if left else -.225))
        if name=='guard':
            hand+=Vector((-sign*.025,.055,-.025))
        if name=='hit':
            hand+=Vector((sign*.04,-.08*recoil,.035*recoil))
        attacking=(left and name=='jab') or (not left and name in ('cross','cast'))
        if attacking:
            shoulder=positions['shoulder'+side]
            target=shoulder+Vector((-sign*.065,-.012,-.468))
            hand=hand.lerp(target,release)
            hand.y+=.023*math.sin(math.pi*release)
        else:
            hand.z+=.022*drive;hand.y+=.012*drive
        endq=None
        if spell:
            active=(left and name=='cast_palm') or (not left and name!='cast_palm')
            if active:
                shoulder=positions['shoulder'+side]
                pre=hand.copy();target=hand.copy()
                if name=='cast_fist':
                    pre=Vector((.28,1.31,.035));target=shoulder+Vector((-.06,-.025,-.465))
                elif name=='cast_palm':
                    pre=Vector((-.16,1.23,-.16));target=shoulder+Vector((.12,-.05,-.46))
                elif name=='cast_sweep':
                    pre=Vector((.48,1.29,-.04));target=Vector((-.30,1.33,-.42))
                elif name=='cast_cleave':
                    pre=Vector((.18,1.84,.025));target=Vector((.075,1.08,-.49))
                else:
                    pre=Vector((.24,1.83,-.035));target=Vector((.10,1.06,-.45))
                hand=hand.lerp(pre,chamber).lerp(target,spell_strike)
                # Palm faces forward, fingertips up. Side-specific proper rotations.
                if name in ['cast_palm','cast_sweep','cast_skyfall']:
                    palm_q=q(0,-90 if not left else 90,180)
                    endq=rotations['chest'].slerp(palm_q,curve(t,[(0,0),(.20,.8),(.42,1),(.66,1),(1,0)]))
                elif name=='cast_cleave':
                    endq=q(-110+95*spell_strike,0,-20)
            elif name=='cast_skyfall':
                hand=hand.lerp(Vector((-.24,1.83,-.035)),chamber).lerp(Vector((-.28,1.44,-.21)),spell_strike)
                endq=q(0,-90,160)
            else:
                hand.y+=.04*spell_strike;hand.z-=.025*spell_strike
        limb('shoulder'+side,'elbow'+side,'wrist'+side,hand,(sign*.42,-1,.10),endq)
    return positions,rotations
