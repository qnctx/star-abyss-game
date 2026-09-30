import {unit,scale,sub,length,DEFAULT_PLANET} from './coordinates.mjs';
export const FACES=Object.freeze(['px','nx','py','ny','pz','nz']);
export function cubeDirection(face,u,v){
  const p={px:{x:1,y:v,z:-u},nx:{x:-1,y:v,z:u},py:{x:u,y:1,z:-v},ny:{x:u,y:-1,z:v},pz:{x:u,y:v,z:1},nz:{x:-u,y:v,z:-1}}[face];
  if(!p)throw new RangeError('Invalid cube face');return unit(p);
}
export function chunkKey(c){return `${c.face}/${c.level}/${c.x}/${c.y}`;}
export function directionToCube(p){const a=Math.abs(p.x),b=Math.abs(p.y),c=Math.abs(p.z);unit(p);
  if(a>=b&&a>=c)return p.x>=0?{face:'px',u:(-p.z/a+1)/2,v:(p.y/a+1)/2}:{face:'nx',u:(p.z/a+1)/2,v:(p.y/a+1)/2};
  if(b>=c)return p.y>=0?{face:'py',u:(p.x/b+1)/2,v:(-p.z/b+1)/2}:{face:'ny',u:(p.x/b+1)/2,v:(p.z/b+1)/2};
  return p.z>=0?{face:'pz',u:(p.x/c+1)/2,v:(p.y/c+1)/2}:{face:'nz',u:(-p.x/c+1)/2,v:(p.y/c+1)/2};
}
export function chunkDirection(c,u=.5,v=.5){const n=2**c.level;return cubeDirection(c.face,2*(c.x+u)/n-1,2*(c.y+v)/n-1);}
const children=c=>[0,1,2,3].map(i=>({face:c.face,level:c.level+1,x:c.x*2+(i%2),y:c.y*2+Math.floor(i/2)}));
// Complete six-face coverage at every altitude. Budget exhaustion retains parent coverage.
export function selectChunks(camera,{radius=DEFAULT_PLANET.radius,surfaceRadius=radius,segments=32,groundSpacing=20,groundRange=100,maxLevel=12,maxChunks=192,splitFactor=2.5}={}){
  if(!Number.isInteger(maxLevel)||maxLevel<0||maxLevel>20||!Number.isInteger(maxChunks)||maxChunks<6||!(splitFactor>0)||![radius,surfaceRadius,segments,groundSpacing,groundRange].every(Number.isFinite)||radius<=0||surfaceRadius<=0||segments<2||groundSpacing<=0||groundRange<0)throw new RangeError('Invalid LOD policy');
  unit(camera);
  const leaves=FACES.map(face=>({face,level:0,x:0,y:0}));
  // Reserve the support tile before spending the remaining fixed budget on distant scenery.
  // Using sea-level radius here confuses mountain height with distance above the ground.
  if(Math.abs(length(camera)-surfaceRadius)<=groundRange){const tile=directionToCube(camera);
    const targetLevel=Math.min(maxLevel,Math.max(0,Math.ceil(Math.log2(2*Math.max(radius,surfaceRadius)/(segments*groundSpacing)))));
    while(leaves.length+3<=maxChunks){const index=leaves.findIndex(c=>{const n=2**c.level;return c.face===tile.face&&c.x===Math.min(n-1,Math.floor(tile.u*n))&&c.y===Math.min(n-1,Math.floor(tile.v*n));});
      if(index<0||leaves[index].level>=targetLevel)break;leaves.splice(index,1,...children(leaves[index]));
    }
  }
  const scores=new Map();
  const score=c=>{const key=chunkKey(c);if(!scores.has(key)){const span=surfaceRadius*2/2**c.level;scores.set(key,span/Math.max(1,length(sub(camera,scale(chunkDirection(c),surfaceRadius)))-span*.75));}return scores.get(key);};
  while(leaves.length+3<=maxChunks){let best=-1,value=1/splitFactor;
    for(let i=0;i<leaves.length;i++)if(leaves[i].level<maxLevel){const s=score(leaves[i]);if(s>value){value=s;best=i;}}
    if(best<0)break;leaves.splice(best,1,...children(leaves[best]));
  }
  return leaves.sort((a,b)=>chunkKey(a).localeCompare(chunkKey(b)));
}
// Geometry data only, not a visual asset. Collision must query these surface triangles.
// Skirts close mixed-LOD edges visually; they are excluded from surfaceIndexCount.
export function buildChunk(c,field,{segments=16,skirtDepth=80}={}){
  const work=buildChunkSteps(c,field,{segments,skirtDepth});let step;do{step=work.next();}while(!step.done);return step.value;
}
// One vertex per cooperative unit: legacy basin height can perform many expensive
// fixed-point samples per vertex, so a whole 33-vertex row exceeds frame budgets.
export function* buildChunkSteps(c,field,{segments=16,skirtDepth=80}={}){
  if(!Number.isInteger(segments)||segments<2||segments>256||skirtDepth<0)throw new RangeError('Invalid mesh policy');
  const center=field.surfacePoint(chunkDirection(c)),points=[],indices=[],n=segments+1;
  const push=(p)=>{const q=sub(p,center);points.push(q.x,q.y,q.z);};
  for(let y=0;y<=segments;y++)for(let x=0;x<=segments;x++){
    push(field.surfacePoint(chunkDirection(c,x/segments,y/segments)));
    yield;
  }
  for(let y=0;y<segments;y++)for(let x=0;x<segments;x++){const a=y*n+x,b=a+n;indices.push(a,a+1,b,a+1,b+1,b);}
  const surfaceIndexCount=indices.length;
  const edges=[Array.from({length:n},(_,i)=>i),Array.from({length:n},(_,i)=>i*n+segments),Array.from({length:n},(_,i)=>segments*n+segments-i),Array.from({length:n},(_,i)=>(segments-i)*n)];
  if(skirtDepth)for(const edge of edges){const start=points.length/3;
    for(const i of edge){const p={x:points[i*3]+center.x,y:points[i*3+1]+center.y,z:points[i*3+2]+center.z};push(sub(p,scale(unit(p),skirtDepth)));}
    for(let i=0;i<segments;i++)indices.push(edge[i],start+i,edge[i+1],edge[i+1],start+i,start+i+1);
  }
  return {key:chunkKey(c),chunk:{...c},center,positions:new Float32Array(points),indices:new Uint32Array(indices),surfaceIndexCount};
}
// Build into staging before publishing the new active set. A build failure preserves old coverage.
// Loader is deliberately synchronous: call from a worker or use small budgets in the integration.
export function createChunkCache({load,dispose=()=>{},capacity=384}={}){
  if(typeof load!=='function'||!Number.isInteger(capacity)||capacity<6)throw new TypeError('Loader and capacity >=6 required');
  let active=new Map(),job=null,revision=0;const cache=new Map();
  const cancel=()=>{if(!job)return;job.iterator?.return?.();for(const data of job.created)dispose(data);job=null;};
  return {get active(){return new Map(active);},get size(){return cache.size;},get pending(){return !!job;},get revision(){return revision;},
    update(chunks,{budgetMs=Infinity,maxLoads=Infinity,now=()=>performance.now()}={}){
      if(chunks.length>capacity)throw new RangeError('Selection exceeds cache capacity');
      const signature=chunks.map(chunkKey).join(',');
      if(job&&job.signature!==signature)cancel();
      job??={signature,chunks,staged:new Map(),created:[],index:0,iterator:null};
      const start=now();let loads=0;
      try{while(job.index<chunks.length){const c=job.chunks[job.index],key=chunkKey(c);let data=cache.get(key);
        if(!cache.has(key)){
          if(!job.iterator){data=load(c);if(data?.then)throw new TypeError('Synchronous or cooperative loader required');if(data?.next)job.iterator=data;}
          if(job.iterator){const step=job.iterator.next();if(!step.done){if(now()-start>=budgetMs)break;continue;}data=step.value;job.iterator=null;}
          job.created.push(data);loads++;
        }
        job.staged.set(key,data);job.index++;
        if(loads>=maxLoads||now()-start>=budgetMs)break;
      }}catch(error){cancel();throw error;}
      if(job.index===chunks.length){
        for(const [key,data]of job.staged){cache.delete(key);cache.set(key,data);}active=job.staged;job=null;revision++;
        for(const [key,data]of cache){if(cache.size<=capacity)break;if(!active.has(key)){cache.delete(key);dispose(data);}}
      }
      return new Map(active);
    },destroy(){cancel();for(const data of cache.values())dispose(data);cache.clear();active.clear();}
  };
}
