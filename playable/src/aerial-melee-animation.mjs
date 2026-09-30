import {Quaternion} from 'three';
import {createAirCombatPose,sampleAirCombatPose} from './air-combat-pose.mjs';

const clips={jab:'left-jab',cross:'right-cross',lunge:'right-cross',kick:'rising-kick',uppercut:'rising-kick',guard:'air-guard',impact:'impact',launch:'launch'};
const clamp=v=>Math.max(0,Math.min(1,v));
// The combat clock (not render time) drives contact frames and pauses with menus.
export function meleePoseTiming(state,time){
  if(!state)return null;
  const reaction=state.reaction;
  if(reaction&&time<(reaction.end??0))return {clip:reaction.kind==='launch'?'launch':'impact',progress:clamp((time-reaction.start)/Math.max(.01,reaction.end-reaction.start))};
  if(state.move&&time<(state.end??0)){
    const start=state.start??time,contact=state.contact??start+.2,end=state.end;
    const progress=time<=contact ? .45*clamp((time-start)/Math.max(.01,contact-start)) : .45+.55*clamp((time-contact)/Math.max(.01,end-contact));
    return {clip:clips[state.move]||state.move,progress};
  }
  if(state.guarding)return {clip:'air-guard',progress:.5};
  if(time<(state.stunUntil??0))return {clip:state.launched?'launch':'impact',progress:.45};
  return null;
}
export function createAerialMeleeAnimator(){
  const pose=createAirCombatPose(),smooth=createAirCombatPose(),output=createAirCombatPose(),ready=sampleAirCombatPose('air-guard',.5),hover=sampleAirCombatPose('hover',0),a=new Quaternion(),b=new Quaternion();
  let weight=0,last=null,readyUntil=-Infinity;
  return {update(base,state,time,dt){
    const timing=meleePoseTiming(state,time),ease=1-Math.exp(-40*Math.min(.1,Math.max(0,dt||0)));
    const attack=timing&&['left-jab','right-cross','rising-kick'].includes(timing.clip);
    if(attack)readyUntil=(state.end??time)+.16;
    else if(!state||timing)readyUntil=-Infinity;
    const bridging=!timing&&time<readyUntil;
    weight+=(Number(!!timing||bridging)-weight)*ease;
    if(timing||bridging){
      if(timing){sampleAirCombatPose(timing.clip,timing.progress,pose);last=timing.clip;}
      else{for(let i=0;i<pose.rotations.length;i++)pose.rotations[i]=[...hover.rotations[i]];pose.position=[...hover.position];last='ready';}
      // Reuse the authored guard as a relaxed ready stance between strikes.
      // It is visual only; it does not grant blocking. Preserve full extension
      // at the authoritative contact frame instead of filtering the punch away.
      const stance=bridging?.65:attack?.65*Math.pow(Math.min(1,Math.abs(timing.progress-.45)/.35),2):0;
      if(stance)for(let i=5;i<=12;i++)a.fromArray(pose.rotations[i]).slerp(b.fromArray(ready.rotations[i]),stance).toArray(pose.rotations[i]);
    }
    if(weight<.002&&!timing&&!bridging){weight=0;last=null;return base;}
    for(let i=0;i<pose.rotations.length;i++){
      a.fromArray(smooth.rotations[i]);b.fromArray(pose.rotations[i]);a.slerp(b,ease).toArray(smooth.rotations[i]);
      a.fromArray(base.rotations[i]);b.fromArray(smooth.rotations[i]);a.slerp(b,weight).toArray(output.rotations[i]);
    }
    for(let i=0;i<3;i++){smooth.position[i]+=(pose.position[i]-smooth.position[i])*ease;output.position[i]=base.position[i]+(smooth.position[i]-base.position[i])*weight;}
    return output;
  },snapshot:()=>({clip:last,weight})};
}
