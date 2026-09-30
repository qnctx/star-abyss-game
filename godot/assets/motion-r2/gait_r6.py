"""R6 editable gait design in C2 canonical Y-up / -Z forward coordinates.

Image mapping: R6 04 main 03/07 drives hip extension; 01/05,04/08 drive
rear heel recovery. The reviewed wrong labels, planted heels, duplicated arms
and high knees are deliberately corrected. IK is an offline authoring aid;
the exported clips contain actual joint keyframes, never runtime pose patches.
"""
import math
from mathutils import Vector, Quaternion

PARAMS = {
    'walk': {'speed': 1.6, 'stride': 1.4, 'stance': .60, 'duration': 52 / 60},
    'jog': {'speed': 6.8, 'stride': 4.0, 'stance': .22, 'duration': 35 / 60},
    'sprint': {'speed': 10.0, 'stride': 4.6, 'stance': .20, 'duration': 28 / 60},
}


def curve(t, keys, start_slope=0.0, end_slope=0.0):
    """Shape-preserving cubic, with specified contact velocity at its ends."""
    slopes = [(b[1] - a[1]) / (b[0] - a[0]) for a, b in zip(keys, keys[1:])]
    tangents = [start_slope]
    tangents += [2*a*b/(a+b) if a*b > 0 else 0 for a,b in zip(slopes, slopes[1:])]
    tangents += [end_slope]
    for i, ((a,x),(b,y)) in enumerate(zip(keys, keys[1:])):
        if t <= b:
            u = max(0,min(1,(t-a)/(b-a))); span=b-a
            return ((2*u**3-3*u*u+1)*x + (u**3-2*u*u+u)*span*tangents[i]
                    + (-2*u**3+3*u*u)*y + (u**3-u*u)*span*tangents[i+1])
    return keys[-1][1]


def q(x=0,y=0,z=0):
    return (Quaternion((0,0,1),math.radians(z))
            @ Quaternion((0,1,0),math.radians(y))
            @ Quaternion((1,0,0),math.radians(x)))


def solve_leg(side, ankle, positions, rotations, names, P):
    h=positions['hip'+side]
    A=P[names.index('hip'+side)]; B=P[names.index('knee'+side)]; D=P[names.index('ankle'+side)]
    l1=(B-A).length; l2=(D-B).length; delta=ankle-h
    length=max(abs(l1-l2)+.002,min(delta.length,l1+l2-.001))
    clamped=abs(length-delta.length)
    axis=delta.normalized(); ankle=h+axis*length
    along=(l1*l1-l2*l2+length*length)/(2*length)
    # A sagittal knee pole: the knee tracks forwards, never out to either side.
    pole=Vector((0,0,-1)); pole=(pole-axis*pole.dot(axis)).normalized()
    knee=h+axis*along+pole*math.sqrt(max(0,l1*l1-along*along))
    positions['knee'+side]=knee; positions['ankle'+side]=ankle
    rotations['hip'+side]=(B-A).rotation_difference(knee-h)
    rotations['knee'+side]=(D-B).rotation_difference(ankle-knee)
    return clamped


def gait_pose(name,t,names,parents,P,foot_data):
    g=PARAMS[name]; walk=name=='walk'; fast=name=='sprint'; t=t%1; ph=math.tau*t
    if walk:
        hip_height=curve(t%.5,[(0,.912),(.10,.916),(.25,.934),(.35,.921),(.5,.912)])
    else:
        h=t%.5
        hip_height=curve(h,[(0,.870 if fast else .883),(.075,.834 if fast else .850),
                            (g['stance'],.864 if fast else .883),(.36,.903 if fast else .910),(.5,.870 if fast else .883)])
    offset=Vector((.009*math.sin(ph),hip_height-.93,0))
    r={n:Quaternion() for n in names}
    r['pelvis']=q(-2 if walk else -8 if fast else -3,-1.6*math.cos(ph),.8*math.sin(ph))
    r['lumbar']=q(0 if walk else -6 if fast else -4,1.2*math.cos(ph))
    r['chest']=q(0 if walk else -3 if fast else -4,2.5*math.cos(ph))
    r['head']=q(1 if walk else 13 if fast else 9,-1.2*math.cos(ph))
    pos={}; rot={}
    for i,n in enumerate(names):
        if parents[i]<0:pos[n]=P[i]+offset;rot[n]=r[n]
        else:
            pn=names[parents[i]];pos[n]=pos[pn]+rot[pn]@(P[i]-P[parents[i]]);rot[n]=rot[pn]@r[n]
    info={'sides':{}}
    for side,shift in [('L',0),('R',.5)]:
        phase=(t+shift)%1; stance=g['stance']; fd=foot_data[side]
        yaw=fd['yaw_correction_deg']; heel=Vector(fd['heel']); toe=Vector(fd['toe'])
        land_roll=17 if walk else 5; off_roll=-47 if walk else -60 if fast else -57
        basez=-.285 if walk else -.25 if fast else -.235
        def footrot(pitch):return q(pitch)@q(0,yaw)
        endrot=footrot(off_roll); landrot=footrot(land_roll)
        startz=basez+g['stride']*stance+toe.z-(endrot@toe).z
        contactz=basez+heel.z-(landrot@heel).z
        starty=-(endrot@toe).y; contacty=-(landrot@heel).y
        if phase<=stance:
            roll_keys=([(0,land_roll),(.09,0),(.25,-2),(.40,-25),(stance,off_roll)] if walk
                       else [(0,land_roll),(.045,0),(.10,-2),(stance,off_roll)])
            roll=curve(phase,roll_keys)
            pivot=heel if roll>=0 else toe
            rotation=footrot(roll)
            ankle=Vector((P[names.index('ankle'+side)].x,-(rotation@pivot).y,
                          basez+g['stride']*phase+pivot.z-(rotation@pivot).z))
            clearance=0.002
        else:
            if walk:
                roll=curve(phase,[(stance,off_roll),(.68,-27),(.78,2),(.90,18),(1,land_roll)])
                z=curve(phase,[(stance,startz),(.62,startz+.003),(.69,.265),(.76,.055),(.88,-.24),(.94,contactz-.025),(1,contactz)],g['stride'],g['stride'])
                clearance=curve(phase,[(stance,.002),(.67,.025),(.76,.048),(.85,.039),(.94,.010),(1,.002)])
                rotation=footrot(roll)
                floor=min((rotation@Vector(v)).y for v in fd['sole'])
                ankle=Vector((P[names.index('ankle'+side)].x,-floor+clearance,z))
            else:
                roll=curve(phase,[(stance,off_roll),(.36,-66 if fast else -61),(.49,-42),(.65,-3),(.83,14),(1,land_roll)])
                z=curve(phase,[(stance,startz),(stance+.045,startz+.025),(.40,.40 if fast else .37),(.56,.13),(.74,-.255),(.86,contactz-.070),(1,contactz)],g['stride'],g['stride'])
                height=curve(phase,[(stance,starty),(stance+.04,starty+.10),(.35,.61 if fast else .55),(.46,.56 if fast else .49),(.60,.32),(.76,.245),(.87,.230),(.96,.195),(1,contacty)])
                rotation=footrot(roll)
                floor=min((rotation@Vector(v)).y for v in fd['sole'])
                clearance=max(.002,height+floor)
                ankle=Vector((P[names.index('ankle'+side)].x,max(height,-floor+.002),z))
        rot['ankle'+side]=rotation
        clamp=solve_leg(side,ankle,pos,rot,names,P)
        thigh=math.degrees(math.atan2(-(pos['knee'+side]-pos['hip'+side]).z,-(pos['knee'+side]-pos['hip'+side]).y))
        # Opposite arm follows the hip, with relaxed walking elbows and a compact
        # running elbow. No shoulder yaw/outward leg swing is used to fake travel.
        armphase=(t+shift)*math.tau
        shoulder_pitch=(-22*math.cos(armphase)) if walk else (10+(44 if fast else 38)*math.sin(armphase-math.tau*.09))
        upper=q(shoulder_pitch,0,-2 if side=='L' else 2)
        elbow=q((13 if walk else 72)+(4 if walk else 8)*math.sin(armphase-.3))
        for bone,rotation_arm in [('shoulder'+side,upper),('elbow'+side,elbow),('wrist'+side,q(-4))]:
            i=names.index(bone);pn=names[parents[i]]
            pos[bone]=pos[pn]+rot[pn]@(P[i]-P[parents[i]]);rot[bone]=rot[pn]@rotation_arm
        info['sides'][side]={'phase':phase,'stance':phase<=stance,'clearance':clearance,'roll':roll,'initial_clamp_m':clamp,'requested_ankle':list(ankle)}
    return pos,rot,info
