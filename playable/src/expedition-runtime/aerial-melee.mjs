import {angle,combatBody,spatialDistance} from './rules.mjs';

export const AIR_MELEE=Object.freeze({
  jab:Object.freeze({kind:'air-melee-jab',windup:.16,recovery:.24,reach:1.8,cone:.82,height:1.6,costPercent:'0.006',power:'basic',impulse:.7}),
  cross:Object.freeze({kind:'air-melee-cross',windup:.21,recovery:.28,reach:1.8,cone:.78,height:1.6,costPercent:'0.008',power:'basic',impulse:1.0}),
  kick:Object.freeze({kind:'air-melee-kick',windup:.30,recovery:.43,reach:2.1,cone:.75,height:1.9,costPercent:'0.015',power:'heavy',impulse:2.2,launch:1.8}),
  uppercut:Object.freeze({kind:'air-melee-uppercut',windup:.29,recovery:.46,reach:2.1,cone:.70,height:2.0,costPercent:'0.015',power:'heavy',impulse:1.2,launch:2.8}),
  lunge:Object.freeze({kind:'air-melee-lunge',windup:.42,recovery:.66,reach:2.1,cone:.85,height:1.8,costPercent:'0',power:'basic',impulse:1.5})
});
export const meleeMoveForKind=kind=>Object.entries(AIR_MELEE).find(([,move])=>move.kind===kind)?.[0]||null;
export const meleeSkill=(name,realm=4)=>{const move=AIR_MELEE[name];return {id:'expedition-'+move.kind,kind:move.power,minimumRealm:name==='lunge'?0:4,channel:'physical',weights:['1'],maxTargets:1,costPercent:move.costPercent};};
export const COMBO_CHAIN_WINDOW=1.35;
export function nextMeleeMove(combo=0,lastContact=-Infinity,now=0,uppercut=false){
  if(uppercut)return {combo:3,move:'uppercut'};
  const next=now-lastContact<=COMBO_CHAIN_WINDOW&&combo<3?combo+1:1;
  return {combo:next,move:next===1?'jab':next===2?'cross':'kick'};
}
export function meleeContact(from,to,yaw,move,lineOfSight,terrainHeight){
  const source=combatBody(from,terrainHeight),target=combatBody(to,terrainHeight),dx=source.x-target.x,dz=source.z-target.z;
  return spatialDistance(source,target)<=move.reach&&Math.abs(source.y-target.y)<=move.height&&
    Math.abs(angle(Math.atan2(dx,dz)-yaw))<=move.cone&&lineOfSight(source,target);
}
export function guardedImpact({guarding=false,guardSince=-Infinity,guardBreakUntil=0,guardYaw=0,guardMeter=0},attacker,defender,now,terrainHeight){
  if(!guarding||now<guardBreakUntil)return {kind:'hit',meter:guardMeter};
  const from=combatBody(attacker,terrainHeight),to=combatBody(defender,terrainHeight);
  if(Math.abs(angle(Math.atan2(to.x-from.x,to.z-from.z)-guardYaw))>.95)return {kind:'hit',meter:guardMeter};
  const meter=guardMeter+38;
  if(meter>=100)return {kind:'break',meter:0};
  return {kind:now-guardSince<=.22?'parry':'block',meter};
}
export function meleeImpulse(from,to,move,terrainHeight){
  const a=combatBody(from,terrainHeight),b=combatBody(to,terrainHeight),dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz)||1;
  return {dx:dx/length*move.impulse,dy:move.launch||.35,dz:dz/length*move.impulse};
}
