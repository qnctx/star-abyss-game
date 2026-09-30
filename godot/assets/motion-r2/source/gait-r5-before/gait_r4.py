"""Heel recovery gait: pose silhouettes first, rooted distance second.
Coordinates are original C2 canonical Y-up/-Z forward, original bone lengths.
"""
import math
from mathutils import Vector,Quaternion

PARAMS={
 'walk':{'speed':1.6,'stride':1.4,'stance':.55,'duration':.875},
 'jog':{'speed':6.8,'stride':4.0,'stance':.20,'duration':4.0/6.8},
 'sprint':{'speed':10.,'stride':4.6,'stance':.18,'duration':.46},
}

def curve(t,keys):
    # Monotone Hermite: move through intermediate keys, ease only at extrema.
    slopes=[(b[1]-a[1])/(b[0]-a[0]) for a,b in zip(keys,keys[1:])]
    tangents=[0]+[2*slopes[i-1]*slopes[i]/(slopes[i-1]+slopes[i]) if slopes[i-1]*slopes[i]>0 else 0 for i in range(1,len(slopes))]+[0]
    for i,((a,x),(b,y)) in enumerate(zip(keys,keys[1:])):
        if t<=b:
            u=max(0,min(1,(t-a)/(b-a)));span=b-a
            return (2*u**3-3*u*u+1)*x+(u**3-2*u*u+u)*span*tangents[i]+(-2*u**3+3*u*u)*y+(u**3-u*u)*span*tangents[i+1]
    return keys[-1][1]

def q(x=0,y=0,z=0):
    return Quaternion((0,0,1),math.radians(z))@Quaternion((0,1,0),math.radians(y))@Quaternion((1,0,0),math.radians(x))

def gait_pose(name,t,names,parents,P,foot_data):
    g=PARAMS[name];walk=name=='walk';fast=name=='sprint';ph=2*math.pi*t
    # Walking lifts the center over the stance leg; running absorbs contact.
    bob=(-.007*math.sin(ph*2)) if walk else (-.012*math.sin(ph*2)+.004*math.cos(ph*2))
    offset=Vector((.012*math.sin(ph),-.040+bob if walk else -.058+bob,0))
    r={n:Quaternion() for n in names}
    r['pelvis']=q(-2 if walk else -5 if fast else -3,-2*math.cos(ph),1.2*math.sin(ph))
    r['lumbar']=q(0 if walk else -5,1.5*math.cos(ph))
    r['chest']=q(0 if walk else -6,3*math.cos(ph))
    r['head']=q(1 if walk else 9,-1.5*math.cos(ph))
    positions={};rotations={}
    for i,n in enumerate(names):
        if parents[i]<0:positions[n]=P[i]+offset;rotations[n]=r[n]
        else:
            pn=names[parents[i]];positions[n]=positions[pn]+rotations[pn]@(P[i]-P[parents[i]]);rotations[n]=rotations[pn]@r[n]
    for side,shift in [('L',0),('R',.5)]:
        phase=(t+shift)%1;stance=g['stance'];fd=foot_data[side]
        toe=Vector(fd['toe']);heel=Vector(fd['heel'])
        if phase<stance:
            if walk:roll=curve(phase,[(0,14),(.10,0),(.34,0),(stance,-38)])
            else:roll=curve(phase,[(0,3),(.04,-2),(.10,-10),(stance,-45 if fast else -42)])
            pivot=heel if roll>=0 else toe
            rot=q(roll);basez=(-.25 if walk else -.26 if fast else -.23)+g['stride']*phase
            # A fixed sole pivot lets the ankle rise and travel as the heel rolls.
            ankle=Vector((P[names.index('ankle'+side)].x,-(rot@pivot).y,basez+pivot.z-(rot@pivot).z))
        else:
            endroll=-38 if walk else -45 if fast else -42
            endrot=q(endroll)
            startz=(-.25 if walk else -.26 if fast else -.23)+g['stride']*stance+toe.z-(endrot@toe).z
            starty=-(endrot@toe).y
            contactrot=q(14 if walk else 3)
            contactz=(-.25 if walk else -.26 if fast else -.23)+heel.z-(contactrot@heel).z
            contacty=-(contactrot@heel).y
            if walk:
                roll=curve(phase,[(stance,-38),(.65,-20),(.78,3),(.91,16),(1,14)])
                z=curve(phase,[(stance,startz),(.62,.40),(.76,.04),(.9,-.21),(1,contactz)])
                clearance=curve(phase,[(stance,0),(.64,.018),(.78,.028),(.90,.018),(1,0)])
                floor=min((q(roll)@Vector(v)).y for v in fd['sole'])
                ankle=Vector((P[names.index('ankle'+side)].x,-floor+clearance,z))
            else:
                roll=curve(phase,[(stance,-45 if fast else -42),(.33,-64),(.48,-45),(.62,-4),(.80,12),(1,3)])
                z=curve(phase,[(stance,startz),(.32,.62 if fast else .59),(.45,.43),(.60,.10),(.77,-.28 if fast else -.25),(.86,-.30 if fast else -.28),(1,contactz)])
                height=curve(phase,[(stance,starty),(.33,.53 if fast else .46),(.46,.43),(.60,.20),(.76,.167),(.86,.16),(1,contacty)])
                floor=min((q(roll)@Vector(v)).y for v in fd['sole'])
                ankle=Vector((P[names.index('ankle'+side)].x,max(height,-floor+.016*math.sin(math.pi*(phase-stance)/(1-stance))),z))
        h=positions['hip'+side];A=P[names.index('hip'+side)];B=P[names.index('knee'+side)];D=P[names.index('ankle'+side)]
        l1=(B-A).length;l2=(D-B).length;delta=ankle-h
        length=max(abs(l1-l2)+.002,min(delta.length,l1+l2-.001));axis=delta.normalized();ankle=h+axis*length
        along=(l1*l1-l2*l2+length*length)/(2*length)
        pole=Vector((0,0,-1));pole=(pole-axis*pole.dot(axis)).normalized()
        k=h+axis*along+pole*math.sqrt(max(0,l1*l1-along*along))
        positions['knee'+side]=k;positions['ankle'+side]=ankle
        rotations['hip'+side]=(B-A).rotation_difference(k-h)
        rotations['knee'+side]=(D-B).rotation_difference(ankle-k)
        rotations['ankle'+side]=q(roll)
        thigh=math.degrees(math.atan2(-(k-h).z,-(k-h).y))
        # Opposite arm follows thigh, with elbow overlap rather than a metronome.
        upper=q(max(-31,min(31,-thigh*(.62 if walk else .72))),0,-3 if side=='L' else 3)
        armphase=(t+shift)*math.tau
        elbow=q((14 if walk else 66)+ (5 if walk else 9)*math.sin(armphase-.4))
        parent='clavicle'+side
        for bone,rotation in [('shoulder'+side,upper),('elbow'+side,elbow),('wrist'+side,q(-4))]:
            i=names.index(bone);pn=names[parents[i]]
            positions[bone]=positions[pn]+rotations[pn]@(P[i]-P[parents[i]])
            rotations[bone]=rotations[pn]@rotation
    return positions,rotations
