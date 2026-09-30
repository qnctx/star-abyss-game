"""R7 explicit hip/knee events; offline authoring only, no production writes."""
import math
from mathutils import Vector,Quaternion
from gait_r6 import curve,q,solve_leg

PARAMS={
 'walk':{'speed':1.6,'stride':1.4,'stance':.60,'duration':52/60},
 'jog':{'speed':6.8,'stride':4.,'stance':.22,'duration':35/60},
 'sprint':{'speed':10.,'stride':4.6,'stance':.20,'duration':28/60},
}
SWING={
 'walk':[(.60,-20,22),(.68,-6,39),(.78,13,38),(.90,24,20),(1,25,15)],
 'jog':[(.22,-24,28),(.32,-15,88),(.43,6,112),(.55,28,95),(.67,45,80),(.78,43,46),(.91,33,22),(1,29,20)],
 'sprint':[(.20,-30,22),(.30,-18,99),(.40,4,119),(.52,29,110),(.65,49,86),(.78,45,48),(.91,34,25),(1,30,22)],
}

def smooth(x):
 x=max(0,min(1,x));return x*x*(3-2*x)

def fk_ankle(h,side,thigh,knee,names,P):
 """The hip swing and knee unfolding determine the free leg, not a foot arc."""
 A=P[names.index('hip'+side)];B=P[names.index('knee'+side)];D=P[names.index('ankle'+side)]
 l1=(B-A).length;l2=(D-B).length
 sign=-1 if side=='L' else 1;dx=.009*sign
 s1=math.sqrt(l1*l1-dx*dx);s2=math.sqrt(l2*l2-dx*dx)
 a=math.radians(thigh);b=math.radians(thigh-knee)
 return h+Vector((2*dx,-s1*math.cos(a)-s2*math.cos(b),-s1*math.sin(a)-s2*math.sin(b)))

def gait_pose(name,t,names,parents,P,foot_data):
 g=PARAMS[name];walk=name=='walk';fast=name=='sprint';t=t%1;ph=math.tau*t;half=t%.5
 if walk:
  hy=curve(half,[(0,.918),(.10,.917),(.25,.936),(.36,.933),(.5,.918)])
 else:
  hy=curve(half,[(0,.885 if fast else .900),(.08,.846 if fast else .858),
                 (g['stance'],.892 if fast else .905),(.35,.943 if fast else .938),(.5,.885 if fast else .900)])
 # Shift toward the stance side. R6 had the opposite lateral shift.
 offset=Vector((-(.018 if walk else .010)*math.sin(ph),hy-.93,0))
 r={n:Quaternion() for n in names}
 r['pelvis']=q(-2 if walk else -10 if fast else -3,-(4 if walk else 3)*math.cos(ph),-1.6*math.sin(ph))
 r['lumbar']=q(0 if walk else -6 if fast else -3,1.8*math.cos(ph))
 r['chest']=q(0 if walk else -4 if fast else -2,3.2*math.cos(ph),.5*math.sin(ph))
 r['head']=q(1 if walk else 14 if fast else 6,-1.5*math.cos(ph))
 pos={};rot={}
 for i,n in enumerate(names):
  if parents[i]<0:pos[n]=P[i]+offset;rot[n]=r[n]
  else:
   pn=names[parents[i]];pos[n]=pos[pn]+rot[pn]@(P[i]-P[parents[i]]);rot[n]=rot[pn]@r[n]
 info={'sides':{}}
 for side,shift in [('L',0),('R',.5)]:
  p=(t+shift)%1;s=g['stance'];fd=foot_data[side]
  heel=Vector(fd['heel']);toe=Vector(fd['toe']);yaw=fd['yaw_correction_deg']
  def footrot(a):return q(a)@q(0,yaw)
  land=14 if walk else 5;off=-46 if walk else -62 if fast else -58
  basez=-.28 if walk else -.25 if fast else -.235
  endrot=footrot(off);contactrot=footrot(land)
  contact=Vector((P[names.index('ankle'+side)].x,-(contactrot@heel).y,basez+heel.z-(contactrot@heel).z))
  end=Vector((contact.x,-(endrot@toe).y,basez+g['stride']*s+toe.z-(endrot@toe).z))
  if p<=s:
   roll=curve(p,[(0,land),(.09,0),(.25,-2),(.38,-12),(.50,-29),(s,off)]) if walk else curve(p,[(0,land),(.045,0),(.095,-4),(s,off)])
   rotation=footrot(roll);pivot=heel if roll>=0 else toe
   ankle=Vector((contact.x,-(rotation@pivot).y,basez+g['stride']*p+pivot.z-(rotation@pivot).z))
   clearance=.002
   target_thigh=None;target_knee=None
  else:
   keys=SWING[name]
   target_thigh=curve(p,[(x,a) for x,a,_ in keys]);target_knee=curve(p,[(x,b) for x,_,b in keys])
   ankle=fk_ankle(pos['hip'+side],side,target_thigh,target_knee,names,P)
   first=fk_ankle(pos['hip'+side],side,keys[0][1],keys[0][2],names,P)
   ankle+=(end-first)*(1-smooth((p-s)/(.075 if walk else .07)))
   # A brief late-swing retraction reaches the same moving contact trajectory;
   # it does not pause the shoe in space before striking the floor.
   late=smooth((p-.90)/.10)
   approach=contact+Vector((0,(1-p)*(1.0 if walk else 1.4),g['stride']*(p-1)))
   ankle=ankle.lerp(approach,late)
   roll=(curve(p,[(s,off),(.68,-26),(.78,2),(.91,16),(1,land)]) if walk else
         curve(p,[(s,off),(.32,-70 if fast else -64),(.44,-46),(.58,-12),(.74,9),(.87,14),(1,land)]))
   rotation=footrot(roll)
   # In free swing this is only a minimum safety clearance. Do not lower the
   # authored FK pose to a prescribed foot-height curve.
   clearance=.002+(.010 if walk else .012)*math.sin(math.pi*(p-s)/(1-s))**2
  rot['ankle'+side]=rotation
  clamp=solve_leg(side,ankle,pos,rot,names,P)
  ap=(t+shift)%1
  if walk:
   shoulder=curve(ap,[(0,-19),(.125,-12),(.25,0),(.375,15),(.5,19),(.625,12),(.75,0),(.875,-15),(1,-19)])
   bend=14+3*math.sin(math.tau*ap)
  else:
   shoulder=curve(ap,[(0,-20),(.12,2),(.25,36),(.38,34),(.5,20),(.62,-2),(.75,-36),(.88,-34),(1,-20)])*(1.16 if fast else 1)
   shoulder+=12 if fast else 6
   bend=curve(ap,[(0,72),(.25,85),(.5,82),(.75,64),(1,72)])
  for n,local in [('shoulder'+side,q(shoulder,0,-2 if side=='L' else 2)),('elbow'+side,q(bend)),('wrist'+side,q(-3))]:
   i=names.index(n);pn=names[parents[i]];pos[n]=pos[pn]+rot[pn]@(P[i]-P[parents[i]]);rot[n]=rot[pn]@local
  info['sides'][side]={'phase':p,'stance':p<=s,'clearance':clearance,'roll':roll,'initial_clamp_m':clamp,
    'requested_ankle':list(ankle),'authored_swing_thigh_deg':target_thigh,'authored_swing_knee_deg':target_knee,
    'shoulder_pitch_deg':shoulder,'elbow_flexion_deg':bend}
 return pos,rot,info
