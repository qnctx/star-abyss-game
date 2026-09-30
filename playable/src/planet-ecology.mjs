import {createPlanetArtBatch,placePlanetArt,ASSET_RULES} from './planet-art/index.mjs';
import {tangentFrame,globalToLocal,unit,dot} from './planet/coordinates.mjs';
import {FACES,cubeDirection,directionToCube} from './planet/chunks.mjs';

// Image-first meshes: docs/art/planet-v1/surface-transition-concept.png, panels 03/04.
// R1 evidence SHA256: 4ca8838b93acda6a492e1b0a96a4467cec2058fd9eafc36b88edbfca398588dc.
// R2: immutable cube-sphere cells cover all faces; interior candidates have unique owners.
export const ECOLOGY_BUDGET=Object.freeze({cellSize:64,radius:260,maxInstances:192,maxTriangles:240000,maxAltitude:180});
function hash(x,z,k){let h=Math.imul(x|0,73856093)^Math.imul(z|0,19349663)^Math.imul(k+1,83492791);h^=h>>>16;return h>>>0;}
export function ecologyCandidates(cell,kind){
  const {face,level,x:cx,y:cz}=cell,n=2**level,fi=FACES.indexOf(face);
  if(fi<0||!Number.isInteger(level)||level<0||level>18||cx<0||cz<0||cx>=n||cz>=n)throw new RangeError('Invalid ecology cell');
  const kinds={tree:0,reed:1,pebble:2},count=kind==='tree'?16:8,out=[];
  if(!(kind in kinds))throw new TypeError('Unknown ecology kind');
  for(let i=0;i<count;i++){
    const id=(((fi*n+cz)*n+cx)*3+kinds[kind])*16+i,a=hash(cx,cz,fi*1024+kinds[kind]*32+i+256)/4294967296,b=hash(cx,cz,fi*1024+kinds[kind]*32+i+512)/4294967296;
    const u=2*(cx+(i%4+.15+.7*a)/4)/n-1,v=2*(cz+(Math.floor(i/4)+.15+.7*b)/(count/4))/n-1;
    out.push({id,direction:cubeDirection(face,u,v)});
  }return out;
}

/** update after terrain.update; canonical and field remain double precision.
 * blocked accepts immutable anchor-local coordinates (including feet), not rebased render coordinates.
 * The host may rebase root.position, but must translate collision input back to the anchor.
 * blockedCanonical uses radial feet/up anywhere on the planet, including poles/backside.
 */
export function createPlanetEcology({THREE,scene,field,frame=tangentFrame(),terrain,budget={}}){
  if(!THREE?.Group||!scene?.add||!field?.sampleSurface||!field?.surfacePoint||!terrain?.sampleRenderedSurface)throw new TypeError('Ecology requires art, field and rendered terrain support');
  const limits={...ECOLOGY_BUDGET,...budget},root=new THREE.Group();root.name='planet-ecology';scene.add(root);
  const batches=new Map();let colliders=[],destroyed=false,lastKey='',stats={instances:0,triangles:0,unready:0};
  const rotate=p=>[dot(p,frame.east),dot(p,frame.up),dot(p,frame.south)];
  function clear(){for(const b of batches.values()){root.remove(b.mesh);b.dispose();}batches.clear();colliders=[];stats={instances:0,triangles:0,unready:0};}
  function update(position){
    if(destroyed)throw new Error('Ecology disposed');
    const direction=unit(position),radius=field.planet.radius,level=Math.ceil(Math.log2(radius*2/limits.cellSize)),n=2**level,span=radius*2/n;
    const sample=field.sampleSurface(position),altitude=Math.hypot(position.x,position.y,position.z)-field.planet.radius-sample.height;
    if(altitude>limits.maxAltitude){clear();lastKey='';return snapshot();}
    // Re-evaluate at 16m increments; unload at altitude immediately. Retry missing terrain.
    const surfaceRevision=terrain.root?.children?.map(mesh=>mesh.name).join('|')??'';
    const cube=directionToCube(direction),key=`${cube.face}/${Math.floor(cube.u*n*4)}/${Math.floor(cube.v*n*4)}/${surfaceRevision}`;
    if(key===lastKey&&!stats.unready)return snapshot();lastKey=key;
    const cells=[],reach=Math.ceil(limits.radius*3/span)+2;
    for(const face of FACES){
      const normal=cubeDirection(face,0,0),den=dot(direction,normal);if(den<=0)continue;
      const du=cubeDirection(face,1,0),dv=cubeDirection(face,0,1);
      const u=(Math.SQRT2*dot(direction,du)-den)/den,v=(Math.SQRT2*dot(direction,dv)-den)/den;
      const cx=Math.floor((u+1)*n/2),cy=Math.floor((v+1)*n/2);
      for(let y=Math.max(0,cy-reach);y<=Math.min(n-1,cy+reach);y++)for(let x=Math.max(0,cx-reach);x<=Math.min(n-1,cx+reach);x++){
        const d=cubeDirection(face,2*(x+.5)/n-1,2*(y+.5)/n-1),distance=radius*Math.hypot(d.x-direction.x,d.y-direction.y,d.z-direction.z);
        if(distance<limits.radius+span)cells.push({face,level,x,y,distance});
      }
    }cells.sort((a,b)=>a.distance-b.distance||FACES.indexOf(a.face)-FACES.indexOf(b.face)||a.x-b.x||a.y-b.y);
    clear();
    stream: for(const cell of cells)for(const kind of ['tree','reed','pebble']){
      if(stats.instances>=limits.maxInstances||stats.triangles>=limits.maxTriangles)break stream;
      const rule=ASSET_RULES[kind];if(cell.distance>rule.lodM[1])continue;
      const lod=cell.distance>rule.lodM[0]?1:0,records=[],trees=[];
      for(const candidate of ecologyCandidates(cell,kind)){
        const s=field.sampleSurface(candidate.direction);
        if(s.legacyWeight>0||s.slope>rule.maxSlope||!Number.isFinite(s.waterDepth)||s.waterDepth>rule.maxWaterDepthM)continue;
        // Single-record placement retains the candidate-to-collider correspondence.
        const placed=placePlanetArt({kind,field,candidates:[candidate],origin:frame.origin,getWaterDepthM:(_,v)=>v.waterDepth});
        if(!placed.records.length)continue;
        const canonical=field.surfacePoint(candidate.direction),support=terrain.sampleRenderedSurface(canonical);
        if(!support.ready||!support.position){stats.unready++;continue;}
        if(!Number.isFinite(support.waterDepth)||support.waterDepth>rule.maxWaterDepthM)continue;
        const p=globalToLocal(support.position,frame);
        if(dot(candidate.direction,frame.up)>0&&Math.max(Math.abs(p.x),Math.abs(p.z))<4000)continue;
        const rec=placed.records[0];rec.position=[p.x,p.y,p.z];rec.up=rotate(unit(candidate.direction));records.push(rec);
        if(kind==='tree')trees.push({id:candidate.id,x:p.x,y:p.y,z:p.z,up:rec.up,radius:.43*rec.scale,height:8*rec.scale});
      }
      if(!records.length)continue;
      const batch=createPlanetArtBatch(THREE,{kind,records,seed:190916,lod});
      const per=batch.mesh.geometry.getAttribute('position').count/3;
      const count=Math.max(0,Math.min(records.length,limits.maxInstances-stats.instances,Math.floor((limits.maxTriangles-stats.triangles)/per)));
      if(!count){batch.dispose();continue;}batch.mesh.count=count;
      stats.instances+=count;stats.triangles+=count*per;colliders.push(...trees.slice(0,count));
      root.add(batch.mesh);batches.set(`${cell.face}/${cell.level}/${cell.x}/${cell.y}/${kind}/${lod}`,batch);
    }return snapshot();
  }
  function blocked(x,z,radius=.42,feet=0){
    return blockedAlong({x,y:feet,z},[0,1,0],radius,1.85);
  }
  function blockedCanonical(position,radius=.42,height=1.85){
    if(!position||![position.x,position.y,position.z].every(Number.isFinite)||Math.hypot(position.x,position.y,position.z)===0)return true;
    return blockedAlong(globalToLocal(position,frame),rotate(unit(position)),radius,height);
  }
  function blockedAlong(position,up,radius,height){
    const {x,y:feet,z}=position;
    if(![x,z,radius,feet,height].every(Number.isFinite)||radius<0||height<0)return true;
    // Each trunk follows its radial up direction. Test the player's vertical capsule
    // at bottom/middle/top against the tapered tree axis, including tilted far-slice trees.
    return colliders.some(c=>{
      for(const h of [0,height/2,height]){const dx=x+up[0]*h-c.x,dy=feet+up[1]*h-c.y,dz=z+up[2]*h-c.z,t=dx*c.up[0]+dy*c.up[1]+dz*c.up[2];
        if(t<-.05||t>c.height)continue;
        const r=c.radius*(1-.75*t/c.height)+radius;
        if(Math.hypot(dx-c.up[0]*t,dy-c.up[1]*t,dz-c.up[2]*t)<r)return true;
      }return false;
    });
  }
  function snapshot(){return {...stats,cells:batches.size,colliders:colliders.map(c=>({...c,up:[...c.up]})),keys:[...batches.keys()],lods:[...batches.values()].map(b=>b.mesh.userData.lod),disposed:destroyed};}
  return {root,update,blocked,blockedCanonical,snapshot,dispose(){if(destroyed)return;clear();scene.remove(root);destroyed=true;}};
}
