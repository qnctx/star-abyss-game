import {combatBody,spatialDistance} from './rules.mjs';
export const BOLT_REACH=64;

export const AIR_ATTACKS=Object.freeze({
  4:{kind:'air-blade',name:'元婴气刃',windup:.5,recovery:.75,reach:32,radius:.9,maxTargets:1,costPercent:'0.03',power:'basic'},
  5:{kind:'afterimage-blade',name:'化神残影刃',windup:.42,recovery:.65,reach:38,radius:1.1,maxTargets:1,costPercent:'0.04',power:'heavy'},
  6:{kind:'rift-slash',name:'炼虚裂斩',windup:.65,recovery:.85,reach:42,radius:2.3,maxTargets:3,costPercent:'0.08',power:'heavy'},
  8:{kind:'void-break',name:'星劫破虚',windup:1.8,recovery:1.5,reach:50,radius:6,maxTargets:8,costPercent:'0.18',power:'heavy'},
  9:{kind:'void-break-great',name:'道源破虚',windup:2.2,recovery:1.8,reach:60,radius:9,maxTargets:12,costPercent:'0.24',power:'heavy'}
});

export function airAttackForRealm(realm){
  if(realm>=9)return AIR_ATTACKS[9];
  if(realm>=8)return AIR_ATTACKS[8];
  if(realm>=6)return AIR_ATTACKS[6];
  if(realm>=5)return AIR_ATTACKS[5];
  return realm>=4?AIR_ATTACKS[4]:null;
}

export const airSkill=attack=>({id:`expedition-${attack.kind}`,kind:attack.power,minimumRealm:attack===AIR_ATTACKS[4]?4:attack===AIR_ATTACKS[5]?5:attack===AIR_ATTACKS[6]?6:attack===AIR_ATTACKS[8]?8:9,
  channel:'spiritual',element:'space',weights:['1'],maxTargets:attack.maxTargets,costPercent:attack.costPercent});

export function aimVector(yaw,pitch=0){const horizontal=Math.cos(pitch);return {x:-Math.sin(yaw)*horizontal,y:Math.sin(pitch),z:-Math.cos(yaw)*horizontal};}
export function aimedPoint(origin,yaw,pitch,distance){const v=aimVector(yaw,pitch);return {x:origin.x+v.x*distance,y:origin.y+v.y*distance,z:origin.z+v.z*distance};}
export function rayContact(origin,target,yaw,pitch,reach,radius){
  const v=aimVector(yaw,pitch),dx=target.x-origin.x,dy=target.y-origin.y,dz=target.z-origin.z;
  const along=dx*v.x+dy*v.y+dz*v.z;
  if(along<0||along>reach)return null;
  const miss=Math.hypot(dx-v.x*along,dy-v.y*along,dz-v.z*along);
  return miss<=radius?along:null;
}
export function airTargets({from,enemies,body,aim,attack,lineOfSight}){
  const source=body(from);
  const center=aim.position||aimedPoint(source,aim.yaw,aim.pitch,attack.reach);
  const rift=attack.maxTargets>1;
  if(rift&&(spatialDistance(source,center)>attack.reach||rayContact(source,center,aim.yaw,aim.pitch,attack.reach,attack.radius)===null||!lineOfSight(source,center)))return [];
  return enemies.map(([id,position])=>{
    const target=body(position);
    const along=rayContact(source,target,aim.yaw,aim.pitch,attack.reach,rift?attack.radius:attack.radius+.35);
    const radial=rift?spatialDistance(target,center):Infinity;
    return {id,position,target,along,radial};
  }).filter(x=>rift?x.radial<=attack.radius:x.along!==null)
    .filter(x=>lineOfSight(source,x.target))
    .sort((a,b)=>(a.along??attack.reach)-(b.along??attack.reach))
    .slice(0,attack.maxTargets);
}

export function boltHitsAim(from,to,aim,terrainHeight,lineOfSight,radius=1.15){
  const source=combatBody(from,terrainHeight),target=combatBody(to,terrainHeight);
  if(spatialDistance(source,target)>BOLT_REACH||!lineOfSight(source,target))return false;
  return spatialDistance(target,aim)<=radius;
}
