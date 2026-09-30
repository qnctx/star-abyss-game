import {createCombatState,computeAttributes} from '../d3-combat/index.mjs';
import {createState} from '../d3-inventory/index.mjs';
import {createDirector} from '../world-director/director.mjs';
import {createRoot} from '../d3-session/index.mjs';

export const PACK='ST-PACK-01', CAMP='ST-CAMP';
export const ITEMS={
  'meteor-iron':{name:'铁陨材',unitVolumeMl:'400',unitMassGrams:'2000'},
  'moon-moss':{name:'月露苔',unitVolumeMl:'200',unitMassGrams:'100'},
  'scavenger-blood':{name:'掠兽血液',unitVolumeMl:'300',unitMassGrams:'250'},
  'riftwing-plume':{name:'裂翼羽核',unitVolumeMl:'280',unitMassGrams:'180'},
};
export const ATTACK={id:'expedition-pulse',kind:'basic',minimumRealm:0,channel:'physical',weights:['1'],maxTargets:1};
export const TIMING={player:{windup:.35,recovery:.5,reach:4.2},enemy:{windup:.85,recovery:1.1,reach:2.5}};
export const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
// Navigation stays on the terrain chart; combat measures actual body centres.
// Legacy callers without vertical coordinates retain their planar contract.
export const verticalSeparation=(a,b)=>Number.isFinite(a.y)&&Number.isFinite(b.y)?Math.abs(a.y-b.y):0;
export const spatialDistance=(a,b)=>Math.hypot(distance(a,b),verticalSeparation(a,b));
export const combatBody=(p,terrainHeight)=>({...p,y:(Number.isFinite(p.y)?p.y:terrainHeight(p.x,p.z))+1});
export const pose=p=>({x:p.x,z:p.z,...(Number.isFinite(p.y)?{y:p.y}:{}),yaw:angle(p.yaw),pitch:Math.max(-1.35,Math.min(1.35,p.pitch||0))});
export const itemSpec=(definitionId,quantity)=>({definitionId,quantity,maxStack:20,...Object.fromEntries(Object.entries(ITEMS[definitionId]).filter(([k])=>k!=='name'))});
const capacity={maxSlots:24,maxVolumeMl:'40000',maxMassGrams:'35000'};
export const ARENA_ID='arena-sparring-enemy';
export const ARENA_SITE=Object.freeze({id:'arena-sparring-site',x:126,z:48,radius:30});
export const ARENA_ENEMY=Object.freeze({id:ARENA_ID,siteId:ARENA_SITE.id,anchorId:ARENA_SITE.id,home:{x:126,z:48},name:'空战陪练',kind:'sparring',realm:4,level:1,x:126,z:48,radius:.65,height:1.8,perceptionRadius:40,territoryRadius:55,moveSpeed:5.2});
export const RIFTWING_ID='riftwing-hunter';
export const RIFTWING_SITE=Object.freeze({id:'riftwing-ridge',x:1370,z:-1030,radius:80});
export const RIFTWING_ENEMY=Object.freeze({id:RIFTWING_ID,siteId:RIFTWING_SITE.id,anchorId:RIFTWING_SITE.id,
  home:{x:1370,z:-1030},name:'裂翼巡猎兽',kind:'monster',species:'riftwing',realm:4,level:1,x:1370,z:-1030,
   radius:2.16,height:2.85,perceptionRadius:42,territoryRadius:86,moveSpeed:3.4,airSpeed:10.5,diveSpeed:15,climbSpeed:8.5,descendSpeed:7.5});
const riftwingAttributes=computeAttributes({realm:4}).effective;
const riftwingActor=Object.freeze({realm:4,level:1,hp:String(Number(riftwingAttributes.maxHp)*2),
  maxHp:String(Number(riftwingAttributes.maxHp)*2),attack:String(Math.round(Number(riftwingAttributes.attack)*.4)),
  defense:riftwingAttributes.defense});
export function rulesFor(world,{arena=false,playerActor=()=>null}={}) {
  const entries=[...world.resources.map(x=>({...x,kind:'resource'})),...world.enemies.map(x=>({...x,kind:'monster'})),RIFTWING_ENEMY,...(arena?[{...ARENA_ENEMY,kind:'monster'}]:[])];
  const definitions={schemaVersion:1,rulesVersion:'ORIGINAL-CORE-R1',anchors:entries.map(e=>({
    id:e.id,planetId:'P1',zoneId:e.siteId,kind:e.kind,cooldown:[720,1200],offlineCredit:false,populationCap:e.kind==='resource'?e.count:1,
    combinations:['a','b'].map(variant=>({id:e.id+'-'+variant,family:e.itemId||'M00',count:e.kind==='resource'?e.count:1,
      layout:e.id,route:e.siteId,appearance:variant,weight:1}))}))};
  function materialize(instance) {
    const source=entries.find(x=>x.id===instance.anchorId);
    if(!source)throw Error('unknownWorldAnchor');
    return instance.kind==='resource'?{container:capacity,items:[itemSpec(source.itemId,instance.remaining)]}:
      {members:instance.members.map(()=>({actor:source.id===ARENA_ID?(()=>{const p=playerActor(),realm=Math.max(4,Math.min(9,Number(p?.realm)||4)),hp=String(Math.round(Number(p?.maxHp||120)*8));return {realm,level:1,hp,maxHp:hp,attack:String(Math.max(1,Math.round(Number(p?.attack||40)/2))),defense:String(p?.defense||8)};})():
        source.id===RIFTWING_ID?{...riftwingActor}:{realm:0,level:1,hp:'96',maxHp:'96',attack:'24',defense:'8'},
        container:capacity,loot:[itemSpec(source.id===RIFTWING_ID?'riftwing-plume':'scavenger-blood',2)]}))};
  }
  return {entries,definitions,materialize};
}
export function initialRoot(link,rules,spatialQuery) {
  const director=createDirector({definitions:rules.definitions,worldId:link.worldId,worldSeed:link.worldId,clock:()=>0,spatialQuery});
  return createRoot({worldId:link.worldId,director:director.serializeDirector(),
    combat:createCombatState({worldId:link.worldId,actors:[{id:link.playerId,realm:0,level:1,hp:'120',maxHp:'120',attack:'40',defense:'8'}]}),
    inventory:createState({worldId:link.worldId,holders:[{holderId:link.playerId,baseMassGrams:'10000',safeCarryGrams:'30000'}],
      containers:[{...capacity,containerId:PACK,holderId:link.playerId,shellMassGrams:'2000'},
        {containerId:CAMP,kind:'warehouse',maxSlots:120,maxVolumeMl:'2000000',maxMassGrams:'10000000'}]})});
}
export function canHit(from,to,yaw,reach,lineOfSight) {
  const d=spatialDistance(from,to);
  return d<=reach && Math.abs(angle(Math.atan2(from.x-to.x,from.z-to.z)-yaw))<=.8 &&
    verticalSeparation(from,to)<2 && lineOfSight(from,to);
}
