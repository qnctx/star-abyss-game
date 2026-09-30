import {Quaternion,Euler} from 'three';
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
/** Animation uses the committed simulation clock, never a second damage timer. */
export function pulsePhase(combat){
  const cast=combat?.playerCast,t=combat?.time;
  if(combat?.screen!=='playing'||!cast||!Number.isFinite(t)||t<cast.start||t>=cast.end)return null;
  const wind=Math.max(.001,cast.due-cast.start),recovery=Math.max(.001,cast.end-cast.due);
  const anticip=smooth((t-cast.start)/wind),release=smooth((t-cast.due+.08)/.12);
  const fade=1-smooth((t-cast.due)/recovery);
  return {phase:t<cast.due?'anticipation':t<cast.due+.12?'release':'recovery',weight:t<cast.due?anticip:fade,extension:release,yaw:cast.yaw};
}
const q=new Quaternion(),e=new Euler();
export function applyPulsePose(bones,combat){
  const p=pulsePhase(combat);if(!p)return null;
  // Torso counter-rotation and articulated shoulder/elbow keep the hand connected
  // to the real world skeleton. Lower-body gait and foot IK remain authoritative.
  const a=p.extension,w=p.weight;
  const targets=[[1,.03,-.16+.25*a,0],[2,.04,-.12+.2*a,0],[3,.03,-.12+.18*a,0],
    [6,.35,-.1,-.22],[7,1.1,0,0],[10,.35+1.12*a,.20,-.10],
    [11,1.18*(1-a)+.12*a,0,0],[12,-.22,0,.08]];
  for(const [i,x,y,z]of targets){q.setFromEuler(e.set(x,y,z,'XYZ'));bones[i].quaternion.slerp(q,w);}
  return p;
}
