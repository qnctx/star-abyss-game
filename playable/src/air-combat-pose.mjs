import {Quaternion} from 'three';
import authored from '../assets/air-combat-r9/air-combat-clips.mjs';

export const AIR_COMBAT_CLIPS=Object.freeze(Object.fromEntries(Object.entries(authored.clips).map(([name,clip])=>[name,Object.freeze({loop:clip.loop,peak:clip.peak,boneCount:authored.boneNames.length})])));
export function createAirCombatPose(){return {position:[0,0,0],rotations:authored.boneNames.map(()=>[0,0,0,1])};}
const qa=new Quaternion(),qb=new Quaternion();
/** Canonical pose only. Caller owns timing, transition blends, movement and hits. */
export function sampleAirCombatPose(clipId,progress01=0,out=createAirCombatPose()){
  const clip=authored.clips[clipId];if(!clip)throw new RangeError(`Unknown air combat clip: ${clipId}`);
  const t=Math.max(0,Math.min(1,Number.isFinite(progress01)?progress01:0));
  let index=0;while(index<clip.keys.length-2&&clip.keys[index+1].progress<t)index++;
  const a=clip.keys[index],b=clip.keys[index+1],linear=(t-a.progress)/(b.progress-a.progress),blend=linear*linear*(3-2*linear);
  for(let i=0;i<3;i++)out.position[i]=a.position[i]+(b.position[i]-a.position[i])*blend;
  for(let i=0;i<out.rotations.length;i++)qa.fromArray(a.rotations[i]).normalize().slerp(qb.fromArray(b.rotations[i]).normalize(),blend).normalize().toArray(out.rotations[i]);
  return out;
}
