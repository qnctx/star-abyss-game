import { WORLD, terrainHeight, collidesAtHeight, WALLS, PROP_SOLIDS, GATE, ROCK_FIELD, rockSurfaceHeight } from '../layout.mjs';

const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);
// Uses the original triangle-interpolated terrain and existing solid footprints.
// There is no second navmesh or authority state in WORLD.
export function createWorldQueries({ gateOpen = () => false } = {}) {
  function canOccupy(p, radius = .65) {
    if (!finitePoint(p) || !Number.isFinite(radius) || radius < 0 || radius > 10) return false;
    const feet=terrainHeight(p.x,p.z);
    return Number.isFinite(feet)&&!collidesAtHeight(p.x,p.z,feet,gateOpen(),radius,1.35);
  }
  function canTraverse(a,b,radius=.65) {
    if (!finitePoint(a)||!finitePoint(b)) return false;
    const length=Math.hypot(b.x-a.x,b.z-a.z);
    if(length>WORLD.halfSize*3) return false;
    const n=Math.max(1,Math.ceil(length/.2));
    const segmentLength=length/n;
    let previous=terrainHeight(a.x,a.z);
    for(let i=0;i<=n;i++) {
      const p={x:a.x+(b.x-a.x)*i/n,z:a.z+(b.z-a.z)*i/n};
      const y=terrainHeight(p.x,p.z);
      // Same 45-degree limit for a whole path and a single high-FPS step.
      // An absolute .2m rise allowed arbitrarily steep slopes at short dt.
      if(!canOccupy(p,radius)||(i>0&&Math.abs(y-previous)>segmentLength+1e-7)) return false;
      previous=y;
    }
    return true;
  }
  function hasLineOfSight(a,b) {
    if(!finitePoint(a)||!finitePoint(b))return false;
    const ay=Number.isFinite(a.y)?a.y:terrainHeight(a.x,a.z)+1;
    const by=Number.isFinite(b.y)?b.y:terrainHeight(b.x,b.z)+1;
    const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.15));
    if(n>120000)return false;
    const solids=[...WALLS,...PROP_SOLIDS,...(gateOpen()?[]:[GATE])];
    for(let i=1;i<n;i++) {
      const t=i/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=ay+(by-ay)*t;
      if(terrainHeight(x,z)>y)return false;
      if(solids.some(s=>Math.abs(x-s.x)<s.w/2&&Math.abs(z-s.z)<s.d/2&&y<(WALLS.includes(s)||s===GATE?0:terrainHeight(s.x,s.z))+s.h))return false;
      if(ROCK_FIELD.query(x,z).some(r=>r.solid&&rockSurfaceHeight(r,x,z)>y))return false;
    }
    return true;
  }
  function canAirTraverse(a,b,radius=.9,height=1.8){
    if(!finitePoint(a)||!finitePoint(b)||![a.y,b.y,radius,height].every(Number.isFinite)||radius<0||radius>10||height<=0||height>12)return false;
    const distance=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);if(distance>128)return false;
    const n=Math.max(1,Math.ceil(distance/.15));
    for(let i=0;i<=n;i++){
      const t=i/n,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t,z=a.z+(b.z-a.z)*t,ground=terrainHeight(x,z);
      if(!Number.isFinite(ground)||Math.max(Math.abs(x),Math.abs(z))>2990-radius||y<ground-.02||y-ground>2000||collidesAtHeight(x,z,y,gateOpen(),radius,height))return false;
      // Eight body-edge probes keep wings/body from clipping a rising slope.
      for(let j=0;j<8;j++){const angle=j*Math.PI/4,edge=terrainHeight(x+Math.cos(angle)*radius,z+Math.sin(angle)*radius);if(!Number.isFinite(edge)||edge>y+Math.min(radius,.65))return false;}
    }
    return true;
  }
  return Object.freeze({terrainHeight,canOccupy,canTraverse,canAirTraverse,hasLineOfSight});
}
