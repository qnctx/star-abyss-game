// Double precision authoritative coordinates. Three.js receives origin-relative data only.
export const DEFAULT_PLANET = Object.freeze({ id:'star-abyss', seed:'star-abyss-planet-v1', radius:120000, version:1 });
export const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
export const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
export const scale=(v,s)=>({x:v.x*s,y:v.y*s,z:v.z*s});
export const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
export const length=v=>Math.hypot(v.x,v.y,v.z);
export function unit(v){const n=length(v);if(!Number.isFinite(n)||n===0)throw new RangeError('Finite nonzero vector required');return scale(v,1/n);}
export function toCartesian({lat,lon,height=0},radius=DEFAULT_PLANET.radius){
  if(![lat,lon,height,radius].every(Number.isFinite)||Math.abs(lat)>Math.PI/2||radius<=0||radius+height<=0)throw new RangeError('Invalid geodetic position');
  return scale({x:Math.cos(lat)*Math.cos(lon),y:Math.sin(lat),z:-Math.cos(lat)*Math.sin(lon)},radius+height);
}
export function toGeodetic(p,radius=DEFAULT_PLANET.radius){const n=unit(p);return {lat:Math.asin(Math.max(-1,Math.min(1,n.y))),lon:Math.atan2(-n.z,n.x),height:length(p)-radius};}
export function tangentFrame(lat=0,lon=0,radius=DEFAULT_PLANET.radius){
  const up=unit(toCartesian({lat,lon},radius));
  return {origin:scale(up,radius),up,east:{x:-Math.sin(lon),y:0,z:-Math.cos(lon)},south:{x:Math.sin(lat)*Math.cos(lon),y:-Math.cos(lat),z:-Math.sin(lat)*Math.sin(lon)}};
}
export function localToGlobal(p,frame=tangentFrame()){return add(frame.origin,add(scale(frame.east,p.x),add(scale(frame.up,p.y),scale(frame.south,p.z))));}
export function globalToLocal(p,frame=tangentFrame()){const d=sub(p,frame.origin);return {x:dot(d,frame.east),y:dot(d,frame.up),z:dot(d,frame.south)};}
export function createFloatingOrigin({threshold=2048,grid=256,origin={x:0,y:0,z:0}}={}){
  if(!(threshold>0)||!(grid>0)||!Number.isFinite(threshold+grid)||grid>threshold)throw new RangeError('Invalid rebase policy');
  let current={...origin},revision=0;
  return { get origin(){return {...current};},get revision(){return revision;},toRender:p=>sub(p,current),toGlobal:p=>add(p,current),
    update(camera){if(length(sub(camera,current))<=threshold)return null;
      const next={x:Math.round(camera.x/grid)*grid,y:Math.round(camera.y/grid)*grid,z:Math.round(camera.z/grid)*grid};
      const delta=sub(next,current);current=next;revision++;return {origin:{...current},delta,revision};}
  };
}
// Additive envelope: legacy story, inventories, vehicle coordinates and version are untouched.
export function attachPlanetPosition(save,position,planet=DEFAULT_PLANET){
  unit(position);
  if(save.planet)readPlanetPosition(save,planet);
  return {...save,planet:{...save.planet,version:1,id:planet.id,seed:planet.seed,radius:planet.radius,position:{...position}}};
}
export function readPlanetPosition(save,planet=DEFAULT_PLANET,frame=tangentFrame(0,0,planet.radius)){
  if(save.planet){const p=save.planet;
    if(p.version!==1||p.id!==planet.id||p.seed!==planet.seed||p.radius!==planet.radius)throw new Error('Planet identity/version mismatch; explicit migration required');
    unit(p.position);return {...p.position};}
  const p=save.player;
  if(!p||![p.x,p.y??0,p.z].every(Number.isFinite))throw new Error('Invalid legacy position');
  return localToGlobal({x:p.x,y:p.y??0,z:p.z},frame);
}
