import { SURVEY_CLEARINGS } from './survey-sites.mjs';
import { createPhase1Outcrops } from './phase1-outcrops.mjs';
// One deterministic field feeds both the visible meshes and physical queries.
// A 32 m spatial hash keeps a local footstep/camera query independent of map size.
export const ROCK_CELL = 32;
// These recovery sites remain reachable before either mobility upgrade is usable.
export const METEOR_CLEARINGS = Object.freeze([{ x: 72, z: 80, radius: 8 }, { x: 98, z: 62, radius: 8 }]);
const CLEARINGS = [...METEOR_CLEARINGS, ...SURVEY_CLEARINGS];
export function createRockField(points = []) {
  let seed = 918204;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const rocks = [], cells = new Map(), impacts = [];
  const key = (x, z) => `${Math.floor(x / ROCK_CELL)},${Math.floor(z / ROCK_CELL)}`;
  function add(x, z, radius, height, solid, details = {}) {
    if (Math.abs(x) < 58 && z < -457 && z > -810) return;
    if (points.some(p => Math.hypot(p.x - x, p.z - z) < radius + (solid ? 13 : 4))) return;
    // The beacon-to-breach route is a navigable erosion channel, not a pebble maze.
    if (solid && Math.abs(x) < 17 && z < 235 && z > -465) return;
    const rotation = random() * Math.PI * 2;
    const vertices = Array.from({ length: 8 }, (_, i) => {
      const angle = rotation + i * Math.PI / 4;
      const size = radius * (.84 + random() * .16);
      return { x: Math.cos(angle) * size, z: Math.sin(angle) * size * .82 };
    });
    const rock = { id: rocks.length, x, z, radius, height, solid, vertices, shade: random(), ...details };
    // Consume the original shape randoms before clearing these sites, so unrelated
    // existing boulders (and the fixed collision-test landmarks) retain their shape.
    if (CLEARINGS.some(p => Math.hypot(p.x - x, p.z - z) < radius + p.radius)) return;
    rocks.push(rock);
    for (let ix = Math.floor((x - radius) / ROCK_CELL); ix <= Math.floor((x + radius) / ROCK_CELL); ix++) {
      for (let iz = Math.floor((z - radius) / ROCK_CELL); iz <= Math.floor((z + radius) / ROCK_CELL); iz++) {
        const cell = `${ix},${iz}`;
        if (!cells.has(cell)) cells.set(cell, []);
        cells.get(cell).push(rock);
      }
    }
    return rock;
  }
  for (let i = 0; i < 3400; i++) {
    const near = i < 2300;
    add((random() - .5) * (near ? 230 : 2600), near ? 270 - random() * 1150 : 850 - random() * 3300,
      .09 + random() * .23, .035 + random() * .095, false);
  }
  for (let i = 0; i < 470; i++) {
    const near = i < 180;
    const radius = .65 + random() * 1.8;
    add((random() - .5) * (near ? 430 : 4800), near ? 280 - random() * 1220 : 2400 - random() * 4800,
      radius, .55 + radius * (.48 + random() * .55), true);
  }
  // Near-path boulders make the distinction from loose underfoot gravel legible.
  for (const [x, z, r, h] of [[24,130,1.5,1.7],[-25,45,2.1,2.4],[28,-95,1.2,1.15],[-24,-205,1.8,2.1],[30,-390,2.2,2.8]]) add(x,z,r,h,true);
  // Broken iron falls in small strewn fields, not a uniform carpet. The central
  // erosion channel and every investigation/recovery site keep their clearances.
  // Only ankle-low grit is cosmetic; every readable obstacle has a shared solid footprint.
  const clusters = [
    [38,154],[-43,109],[45,4],[-39,-70],[56,-179],[-43,-288],[73,-404],
    [-142,93],[-194,-242],[-347,-110],[-478,-225],[-227,-459],[-345,-600],
    [187,-105],[337,-301],[530,-407],[660,-528],[-111,-902],[155,-888],
  ];
  for(let i=0;i<34;i++) {
    const angle=random()*Math.PI*2, distance=400+random()*2000;
    clusters.push([Math.cos(angle)*distance,Math.sin(angle)*distance]);
  }
  for(const [x,z] of clusters) {
    const cluster=impacts.length, radius=1.6+random()*1.65;
    const direction=random()*Math.PI*2;
    const core=add(x,z,radius,1.4+random()*2.4,true,{kind:'meteor',cluster,fractured:true});
    if(!core)continue;
    impacts.push({id:cluster,x,z,radius:radius*2.2+1.5,direction});
    for(let i=0;i<8;i++) {
      const angle=direction+i*2.39996+(random()-.5)*.7;
      const spread=radius+2.3+random()*9.5;
      add(x+Math.cos(angle)*spread,z+Math.sin(angle)*spread*.76,
        .32+random()*.66,.30+random()*.65,true,{kind:'meteor',cluster,fractured:i===2});
    }
    for(let i=0;i<6;i++) {
      const angle=random()*Math.PI*2, spread=radius+random()*13;
      add(x+Math.cos(angle)*spread,z+Math.sin(angle)*spread*.76,
        .12+random()*.22,.045+random()*.075,false,{kind:'meteor',cluster});
    }
  }
  for(const data of createPhase1Outcrops()) {
    const rock={...data,id:rocks.length};rocks.push(rock);
    for(let ix=Math.floor((rock.x-rock.radius)/ROCK_CELL);ix<=Math.floor((rock.x+rock.radius)/ROCK_CELL);ix++)for(let iz=Math.floor((rock.z-rock.radius)/ROCK_CELL);iz<=Math.floor((rock.z+rock.radius)/ROCK_CELL);iz++){
      const cell=`${ix},${iz}`;if(!cells.has(cell))cells.set(cell,[]);cells.get(cell).push(rock);
    }
  }
  return { rocks, cells, impacts, query(x, z, radius = 0) {
    if (radius === 0) return cells.get(key(x, z)) || [];
    const found = new Set();
    for (let ix = Math.floor((x-radius)/ROCK_CELL); ix <= Math.floor((x+radius)/ROCK_CELL); ix++) {
      for (let iz = Math.floor((z-radius)/ROCK_CELL); iz <= Math.floor((z+radius)/ROCK_CELL); iz++) {
        for (const rock of cells.get(`${ix},${iz}`) || []) found.add(rock);
      }
    }
    return [...found];
  } };
}

// Exact circle / visible convex footprint contact (not an invisible bounding square).
export function touchesRock(rock, x, z, radius = 0) {
  if (Math.hypot(x-rock.x,z-rock.z) > rock.radius + radius) return false;
  const px=x-rock.x,pz=z-rock.z,vertices=rock.vertices;
  let inside=true;
  for(let i=0;i<vertices.length;i++) {
    const a=vertices[i],b=vertices[(i+1)%vertices.length],dx=b.x-a.x,dz=b.z-a.z;
    if(dx*(pz-a.z)-dz*(px-a.x)<0)inside=false;
    const t=Math.max(0,Math.min(1,((px-a.x)*dx+(pz-a.z)*dz)/(dx*dx+dz*dz)));
    if(Math.hypot(px-a.x-t*dx,pz-a.z-t*dz)<=radius)return true;
  }
  return inside;
}
