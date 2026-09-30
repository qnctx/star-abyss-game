import {Quaternion,Euler} from 'three';
import authored from '../assets/flight-r2/flight-clips.mjs';
import {sampleAirCombatPose,createAirCombatPose} from './air-combat-pose.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const q1=new Quaternion(),q2=new Quaternion();
const fresh=()=>({position:[0,0,0],rotations:authored.boneNames.map(()=>[0,0,0,1])});
function mix(a,b,t,out){
  for(let i=0;i<3;i++)out.position[i]=a.position[i]+(b.position[i]-a.position[i])*t;
  for(let i=0;i<out.rotations.length;i++){q1.fromArray(a.rotations[i]);q2.fromArray(b.rotations[i]);q1.slerp(q2,t).toArray(out.rotations[i]);}
  return out;
}
function sample(name,time,out){
  const clip=authored.clips[name],t=((time%clip.duration)+clip.duration)%clip.duration;
  const index=Math.min(clip.keys.length-2,Math.floor(t/clip.duration*(clip.keys.length-1)));
  const a=clip.keys[index],b=clip.keys[index+1];return mix(a,b,(t-a.time)/(b.time-a.time),out);
}
const a=fresh(),b=fresh(),c=fresh(),boostPose=createAirCombatPose(),bankQ=new Quaternion(),bankEuler=new Euler();
// Local XYZW bone keys exported from the editable Blender armature.
export function yuanYingFlightPose(flight,time=0,bank=0,out=fresh(),boost=Number(!!flight?.boosting)){
  if(!flight?.active)return null;
  const speed=clamp((Number(flight.speed)||0)/120,0,1);
  const landing=clamp(1-(Number(flight.agl)||0)/2.5,0,1)*(1-speed*.8);
  // Ordinary flight retains the upright reference; boost alone streamlines the whole body.
  sample('hover',time,c);sampleAirCombatPose('boost',(time%2)/2,boostPose);mix(c,boostPose,clamp(boost,0,1),c);
  if(Math.abs(bank)>.001){bankQ.setFromEuler(bankEuler.set(0,0,clamp(bank,-1,1)*.23*speed));q1.fromArray(c.rotations[0]).premultiply(bankQ).toArray(c.rotations[0]);}
  sample('land',time,b);return mix(c,b,landing,out);
}
// One controller per avatar, easing both flight entry and return to ground gait.
export function createYuanYingFlightAnimator(){
  const target=fresh(),smoothed=fresh(),output=fresh();let weight=0,bank=0,boost=0,initialized=false;
  return {update(flight,time=0,dt=1/60,groundPose){
    const active=!!flight?.active,step=clamp(dt||1/60,0,.1),ease=1-Math.exp(-9*step);
    if(active){
      bank+=(clamp(Number(flight.turnBank)||0,-1,1)-bank)*ease;
      boost+=(Number(!!flight.boosting)-boost)*(1-Math.exp(-7*step));
      yuanYingFlightPose(flight,time,bank,target,boost);
      if(!initialized){mix(target,target,0,smoothed);initialized=true;}else mix(smoothed,target,ease,smoothed);
    }
    weight+=(Number(active)-weight)*(1-Math.exp(-(active?8:12)*step));
    if(!active&&weight<.002){weight=0;bank=0;boost=0;initialized=false;return null;}
    return groundPose?mix(groundPose,smoothed,weight,output):smoothed;
  },snapshot:()=>({version:'flight-air-combat-r9',weight,bank,boost})};
}
