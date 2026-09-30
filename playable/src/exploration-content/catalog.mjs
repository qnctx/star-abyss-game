import {globalToLocal,tangentFrame} from '../planet/coordinates.mjs';

// This is the authored eastern watershed, not the six future cultivation regions.
// Existing iron/moss art and D3 definitions are reused; no new creature/material is implied.
export const DESTINATIONS=Object.freeze([
 {id:'basin-fall',name:'营地陨落带',biome:'basin',legacy:{x:80,z:100},kind:'legacy',text:'陨石散落在营地东侧。附近掠兽有自己的巡游领地；侧向绕行可采矿，击败后按 H 拾取血液。物资可带回营地仓库。'},
 {id:'wind-stones',name:'长风冲积矿滩',biome:'plains',distance:8000,offset:-90,kind:'iron',itemId:'meteor-iron',quantity:3,text:'河谷风蚀剥露了铁陨碎块。检查沉积方向，采走有限矿样；本处不按离线时间补货。'},
 {id:'forest-dew',name:'林缘月露地',biome:'forest',distance:17000,offset:-110,kind:'herb',itemId:'moon-moss',quantity:3,text:'树冠下的湿润凹地保存月露苔。药苔与周围普通植被不同，靠近低矮苔簇后取样。'},
 {id:'wetland-bank',name:'芦滩水脉',biome:'wetland',distance:27000,offset:-120,kind:'herb',itemId:'moon-moss',quantity:2,text:'芦苇标出了浅滩边界。沿干岸辨识月露苔，不需要走入深水；水道与采样点共同留下测绘记录。'},
 {id:'tide-stones',name:'潮线陨砂滩',biome:'coast',distance:34000,offset:-100,kind:'iron',itemId:'meteor-iron',quantity:2,text:'潮线以外保留铁陨碎屑。先查明干燥立足点再采样；海水中的闪光不代表可以潜入领取奖励。'},
 {id:'sea-watch',name:'海口远望点',biome:'ocean',distance:34600,offset:-220,kind:'observe',text:'在海口干岸观察大陆架向深海下沉，记录回程方向。深海目前没有潜水、海底宝箱或洞府入口。'}
].map(Object.freeze));
export const definitionFor=id=>DESTINATIONS.find(d=>d.id===id);

export function createDestinations(field,{legacyHeight=()=>0,frame=tangentFrame(0,0,field.planet.radius)}={}) {
 return DESTINATIONS.map(def=>{
  if(def.legacy){const local={...def.legacy,y:legacyHeight(def.legacy.x,def.legacy.z)};
   const position={x:frame.origin.x+frame.east.x*local.x+frame.up.x*local.y+frame.south.x*local.z,y:frame.origin.y+frame.east.y*local.x+frame.up.y*local.y+frame.south.y*local.z,z:frame.origin.z+frame.east.z*local.x+frame.up.z*local.y+frame.south.z*local.z};
   return {...def,position,local};}
  // Deterministic dry-ground search: never relocate towards the camera or into water.
  for(const delta of [0,-60,60,-160,160,-320,320]){
   const direction=field.routeDirection(def.distance,def.offset+delta),s=field.sampleSurface(direction);
   if(s.waterDepth<=.1&&s.slope<.35){const position=field.surfacePoint(direction);return {...def,position,local:globalToLocal(position,frame)};}
  }
  throw new Error('No safe authored exploration point: '+def.id);
 });
}
