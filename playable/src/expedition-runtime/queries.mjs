import {MOBILITY} from '../mobility.mjs';

// Match the original parked-vehicle footprint (1.35m); add the moving actor's
// radius for a swept-body query. Read the current vehicle on every call.
const vehicleRadius=MOBILITY.vehicleRadius+.25;
const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
function touchesFootprint(a,b,v,radius,lo=0,hi=1) {
  const dx=b.x-a.x,dz=b.z-a.z,length2=dx*dx+dz*dz;
  const t=length2?Math.max(lo,Math.min(hi,((v.x-a.x)*dx+(v.z-a.z)*dz)/length2)):lo;
  return Math.hypot(a.x+dx*t-v.x,a.z+dz*t-v.z)<=vehicleRadius+radius;
}

/** Compose, never mutate, WORLD's frozen static queries. */
export function createExpeditionQueries({worldQueries,getVehicle}) {
  for(const key of ['terrainHeight','canOccupy','canTraverse','hasLineOfSight']) {
    if(typeof worldQueries?.[key]!=='function')throw new TypeError('Missing static query: '+key);
  }
  if(typeof getVehicle!=='function')throw new TypeError('Vehicle query required');
  function groundBlocked(a,b,radius=.65) {
    const v=getVehicle();
    if(!finitePoint(a)||!finitePoint(b)||!finitePoint(v)||!Number.isFinite(radius)||radius<0)return true;
    // A mounted vehicle still occupies the world for enemies and spawn anchors.
    return touchesFootprint(a,b,v,radius);
  }
  function vehicleOccludes(a,b) {
    const v=getVehicle();if(!finitePoint(a)||!finitePoint(b)||!finitePoint(v))return true;
    const ay=Number.isFinite(a.y)?a.y:worldQueries.terrainHeight(a.x,a.z)+1;
    const by=Number.isFinite(b.y)?b.y:worldQueries.terrainHeight(b.x,b.z)+1;
    const bottom=worldQueries.terrainHeight(v.x,v.z),top=bottom+MOBILITY.vehicleBodyHeight;
    if(![ay,by,bottom,top].every(Number.isFinite))return true;
    const dy=by-ay;let lo=0,hi=1;
    if(Math.abs(dy)<1e-12) {if(ay<bottom||ay>top)return false;}
    else {const t0=(bottom-ay)/dy,t1=(top-ay)/dy;lo=Math.max(0,Math.min(t0,t1));hi=Math.min(1,Math.max(t0,t1));if(lo>hi)return false;}
    return touchesFootprint(a,b,v,0,lo,hi);
  }
  return Object.freeze({
    terrainHeight:worldQueries.terrainHeight,
    dynamicBlocked:(p,radius=.65)=>groundBlocked(p,p,radius),
    canOccupy:(p,radius=.65)=>worldQueries.canOccupy(p,radius)&&!groundBlocked(p,p,radius),
    canTraverse:(a,b,radius=.65)=>worldQueries.canTraverse(a,b,radius)&&!groundBlocked(a,b,radius),
    canAirTraverse(a,b,radius=.9,height=1.8){
      if(!worldQueries.canAirTraverse?.(a,b,radius,height))return false;
      const v=getVehicle();if(!finitePoint(v))return false;
      const bottom=Number.isFinite(v.y)?v.y:worldQueries.terrainHeight(v.x,v.z),top=bottom+MOBILITY.vehicleBodyHeight;
      const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)/.15));
      for(let i=0;i<=n;i++){const t=i/n,p={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},y=a.y+(b.y-a.y)*t;if(y<top&&y+height>bottom&&touchesFootprint(p,p,v,radius))return false;}
      return true;
    },
    hasLineOfSight:(a,b)=>worldQueries.hasLineOfSight(a,b)&&!vehicleOccludes(a,b),
  });
}
