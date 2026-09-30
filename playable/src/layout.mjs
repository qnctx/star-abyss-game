import { createRockField, touchesRock } from './rocks.mjs';
import { SURVEY_SOLIDS } from './survey-sites.mjs';
import { dustCoverage } from './ground-cover.mjs';
import { phase1Relief } from './phase1-terrain.mjs';
import {physicalPropSupport,physicalPropBlocked} from './foundation/physical-props.mjs';
// Coordinates are metres. Camera yaw 0 looks toward -Z; the wreck is real geometry.
export const WORLD = Object.freeze({ halfSize: 3000, eyeHeight: 1.72, radius: 0.42, suitAltitude: 4.5, spawn: { x: 0, z: 190 } });
export const POINTS = [
  { id: 'beacon', name: '返回信标', x: 0, z: 196, type: 'beacon' },
  { id: 'signal', name: '失真的求救信号', x: 12, z: -330, type: 'relay' },
  { id: 'breach', name: '船体破口', x: 0, z: -472, type: 'entry' },
  { id: 'fuse', name: '备用电芯', x: -29, z: -544, type: 'pickup' },
  { id: 'power', name: '应急配电箱', x: -5, z: -579, type: 'power' },
  { id: 'log', name: '值班员记录', x: 26, z: -635, type: 'log' },
  { id: 'relay-1', name: '一号中继 · 环', x: 15, z: -647, type: 'terminal' },
  { id: 'relay-2', name: '二号中继 · 裂', x: 26, z: -647, type: 'terminal' },
  { id: 'relay-3', name: '三号中继 · 星', x: 37, z: -647, type: 'terminal' },
  { id: 'blackbox', name: '黑匣子', x: 0, z: -766, type: 'blackbox' },
  { id: 'echo', name: '无名石碑', x: -420, z: -160, type: 'anomaly' },
  { id: 'capsule', name: '空的逃生舱', x: 610, z: -450, type: 'anomaly' },
  { id: 'rift', name: '地下回声源', x: -300, z: -520, type: 'rift' },
];
// Every rendered structural wall uses these same collision boxes.
const wall = (x, z, w, d, h = 7) => ({ x, z, w, d, h });
export const WALLS = [
  wall(-28, -470, 40, 2), wall(28, -470, 40, 2),
  wall(-49, -630, 2, 322, 12), wall(49, -630, 2, 322, 12), wall(0, -791, 100, 2, 12),
  wall(-8, -494, 2, 46), wall(-8, -578, 2, 36), wall(-8, -670, 2, 150),
  wall(8, -541, 2, 140), wall(8, -700, 2, 100),
  wall(-28, -519, 40, 2), wall(-28, -569, 40, 2),
  wall(28, -613, 40, 2), wall(28, -652, 40, 2),
  wall(-29, -745, 40, 2), wall(29, -745, 40, 2),
];
export const GATE = wall(0, -711, 14, 1.4, 7);
// Small physical props and perimeter equipment remain solid after their pickup is removed.
export const PROP_SOLIDS = [
  ...SURVEY_SOLIDS,
  wall(0,196,2.8,2.2,4.5), wall(-6,200,5.5,8,2.4), wall(12,-330,1.7,1.4,1.1),
  wall(-29,-544,1.2,.9,.75), wall(-5,-579,1.4,.7,1.65),
  ...[26,15,26,37].map((x,i)=>wall(x,i===0?-635:-647,1.25,.8,1.6)),
  wall(0,-766,2.4,2.4,1.3), {...wall(-420,-160,2.2,1.9,4),finish:'stone'}, wall(610,-450,5.5,3.5,3),
  ...[-529,-551].flatMap(z=>[-42,-39].map(x=>wall(x,z,2.4,4.5,1.7))),
  ...[-622,-628,-634,-640].map(z=>wall(45,z,1.3,3.6,4.8)),
  ...[wall(-300,-520,3.2,3.2,1.25), wall(-304,-522,1.15,1.15,3.8), wall(-296,-522,1.15,1.15,3.8)].map(box=>({...box,finish:'stone'})),
];
export const ROCK_FIELD = createRockField(POINTS);
export const TERRAIN_SEGMENTS = 600;
function rawHeight(x, z) {
  const relief = Math.sin(x * .009) * Math.cos(z * .008) * 9 + Math.sin(x * .027 + z * .013) * 2.8;
  const corridor = Math.max(0, Math.min(1, (Math.abs(x) - 65) / 110));
  const ends = Math.max(0, Math.min(1, (Math.max(z - 260, -z - 840)) / 150));
  return relief * Math.max(corridor, ends) + phase1Relief(x,z);
}
// Immutable terrain: evaluate geology once per grid vertex, shared by rendering
// and every physics query instead of repeating the landform synthesis per foot.
const heightGrid=new Float64Array((TERRAIN_SEGMENTS+1)**2).fill(NaN);
// The planet's 3–4 km blend samples legacy grid vertices just outside the
// original 6 km plane. Those vertices are immutable too; without a cache each
// high-speed sweep recomputes the same crater synthesis hundreds of times.
const OUTER_GRID_CACHE_LIMIT=32768,outerHeightGrid=new Map();
function gridHeight(ix,iz,step){
  if(ix<0||iz<0||ix>TERRAIN_SEGMENTS||iz>TERRAIN_SEGMENTS){
    const key=`${ix},${iz}`;
    if(outerHeightGrid.has(key))return outerHeightGrid.get(key);
    const height=rawHeight(ix*step-WORLD.halfSize,iz*step-WORLD.halfSize);
    if(outerHeightGrid.size>=OUTER_GRID_CACHE_LIMIT)outerHeightGrid.delete(outerHeightGrid.keys().next().value);
    outerHeightGrid.set(key,height);
    return height;
  }
  const index=iz*(TERRAIN_SEGMENTS+1)+ix;
  if(Number.isNaN(heightGrid[index]))heightGrid[index]=rawHeight(ix*step-WORLD.halfSize,iz*step-WORLD.halfSize);
  return heightGrid[index];
}
// Match PlaneGeometry's actual triangle interpolation, not an unrelated smooth surface.
let worldExtension = null;
// Installed by the planet runtime only. The original chapter remains an exact,
// independently usable collision world when no extension is attached.
export function configureWorldExtension(extension) {
  if (extension && !['height', 'blocked', 'surface'].every(key => typeof extension[key] === 'function')) throw new TypeError('Complete terrain extension required');
  worldExtension = extension;
}
export function outsideLegacyWorld(x,z,radius=0) {
  return Math.abs(x)>WORLD.halfSize-radius || Math.abs(z)>WORLD.halfSize-radius;
}
export function worldBoundaryBlocked(x,z,radius=WORLD.radius,feet=null) {
  if (!Number.isFinite(x)||!Number.isFinite(z)) return true;
  if (!outsideLegacyWorld(x,z,radius)) return false;
  return !worldExtension || worldExtension.blocked(x,z,radius,feet)!==false;
}
export function terrainHeight(x,z) {
  return worldExtension && outsideLegacyWorld(x,z) ? worldExtension.height(x,z) : legacyTerrainHeight(x,z);
}
export function legacyTerrainHeight(x, z) {
  const step = WORLD.halfSize * 2 / TERRAIN_SEGMENTS;
  const gx=(x+WORLD.halfSize)/step, gz=(z+WORLD.halfSize)/step;
  const ix=Math.floor(gx+1e-9), iz=Math.floor(gz+1e-9), u=Math.max(0,gx-ix), v=Math.max(0,gz-iz);
  const a=gridHeight(ix,iz,step), b=gridHeight(ix,iz+1,step), d=gridHeight(ix+1,iz,step);
  return u+v<=1 ? a+(d-a)*u+(b-a)*v : gridHeight(ix+1,iz+1,step)*(u+v-1)+b*(1-u)+d*(1-v);
}
export function insideWreck(x, z) { return Math.abs(x) < 48 && z < -470 && z > -790; }
export function collides(x, z, gateOpen = false) {
  if (worldBoundaryBlocked(x,z)) return true;
  if(physicalPropBlocked(x,z,terrainHeight(x,z),WORLD.radius))return true;
  return [...WALLS,...PROP_SOLIDS,...(gateOpen?[]:[GATE])].some(b => Math.abs(x - b.x) < b.w / 2 + WORLD.radius && Math.abs(z - b.z) < b.d / 2 + WORLD.radius)
    || ROCK_FIELD.query(x,z,WORLD.radius).some(rock=>rock.solid&&touchesRock(rock,x,z,WORLD.radius));
}

// Height-aware capsule queries share the exact rendered rock triangles. Walking
// retains its original footprint collision; only the suit can clear low debris.
function triangleHeight(x,z,a,b,c) {
  const denominator=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);
  if(Math.abs(denominator)<1e-10)return -Infinity;
  const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/denominator;
  const v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/denominator;
  return u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7 ? u*a.y+v*b.y+(1-u-v)*c.y : -Infinity;
}
const cliffSurfaceCache=new WeakMap();
export function rockSurfaceHeight(rock,x,z) {
  if(!touchesRock(rock,x,z))return -Infinity;
  if(rock.meshPositions){
    // Build the same world triangles as the renderer once; no alternate collider.
    if(!cliffSurfaceCache.has(rock)){const p=rock.meshPositions,v=[],triangles=[];for(let i=0;i<p.length;i+=3){const px=rock.x+p[i],pz=rock.z+p[i+2];v.push({x:px,y:terrainHeight(px,pz)+p[i+1],z:pz});}for(let i=0;i<rock.meshIndices.length;i+=3)triangles.push(rock.meshIndices.slice(i,i+3).map(j=>v[j]));cliffSurfaceCache.set(rock,triangles);}
    let height=-Infinity;
    for(const [a,b,c] of cliffSurfaceCache.get(rock))height=Math.max(height,triangleHeight(x,z,a,b,c));
    return height;
  }
  const point=(vertex,scale,rise)=>{const px=rock.x+vertex.x*scale,pz=rock.z+vertex.z*scale;return {x:px,z:pz,y:terrainHeight(px,pz)-.015+rock.height*rise};};
  const top={x:rock.x,z:rock.z,y:terrainHeight(rock.x,rock.z)+rock.height};
  let height=-Infinity;
  for(let i=0;i<rock.vertices.length;i++) {
    const a=point(rock.vertices[i],1,.32),b=point(rock.vertices[(i+1)%8],1,.32);
    const c=point(rock.vertices[i],.43,.88),d=point(rock.vertices[(i+1)%8],.43,.88);
    height=Math.max(height,triangleHeight(x,z,a,c,b),triangleHeight(x,z,b,c,d),triangleHeight(x,z,c,top,d));
  }
  return height;
}
// A support is a vertical ray beneath the feet, not the capsule's side radius.
// Inflating this footprint lets a nearby cliff hold the player above empty air.
export function supportHeight(x,z,_radius=0,maxHeight=Infinity) {
  let height=Math.max(terrainHeight(x,z),physicalPropSupport(x,z,maxHeight));
  for(const rock of ROCK_FIELD.query(x,z))if(rock.solid){const top=rockSurfaceHeight(rock,x,z);if(top<=maxHeight)height=Math.max(height,top);}
  for(const box of PROP_SOLIDS)if(Math.abs(x-box.x)<box.w/2&&Math.abs(z-box.z)<box.d/2){const top=terrainHeight(box.x,box.z)+box.h;if(top<=maxHeight)height=Math.max(height,top);}
  return height;
}
function sideObstacleHeight(x,z,radius) {
  let height=terrainHeight(x,z);
  const samples=[{x,z}];
  if(radius>0)for(let i=0;i<8;i++)samples.push({x:x+Math.cos(i*Math.PI/4)*radius,z:z+Math.sin(i*Math.PI/4)*radius});
  for(const rock of ROCK_FIELD.query(x,z,radius))if(rock.solid)for(const p of samples)height=Math.max(height,rockSurfaceHeight(rock,p.x,p.z));
  for(const box of PROP_SOLIDS)if(Math.abs(x-box.x)<box.w/2+radius&&Math.abs(z-box.z)<box.d/2+radius)height=Math.max(height,terrainHeight(box.x,box.z)+box.h);
  return height;
}
export function collidesAtHeight(x,z,feet,gateOpen=false,radius=WORLD.radius,height=1.85) {
  if(worldBoundaryBlocked(x,z,radius,feet))return true;
  if(physicalPropBlocked(x,z,feet,radius,height))return true;
  const overlaps=(box,base)=>Math.abs(x-box.x)<box.w/2+radius&&Math.abs(z-box.z)<box.d/2+radius&&feet+height>base&&feet<base+box.h-.02;
  if(WALLS.some(box=>overlaps(box,0))||(!gateOpen&&overlaps(GATE,0)))return true;
  if(PROP_SOLIDS.some(box=>overlaps(box,terrainHeight(box.x,box.z))))return true;
  if(insideWreck(x,z)&&feet+height>11.9)return true;
  // The lower hemisphere narrows to the foot centre; a sloping surface beside
  // the sole must not immobilise a player who is standing on that same surface.
  return sideObstacleHeight(x,z,radius)>feet+radius+.035;
}
export function surfaceAt(x,z) {
  if(worldExtension&&outsideLegacyWorld(x,z))return worldExtension.surface(x,z);
  if(insideWreck(x,z))return 'metal';
  return ROCK_FIELD.query(x,z,0).some(rock=>touchesRock(rock,x,z))?'rock':dustCoverage(x,z)>=.58?'dust':'gravel';
}
