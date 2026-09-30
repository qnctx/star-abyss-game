import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/planet/index.mjs';
const near=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const field=P.createPlanetField();
test('R3 mathematical surface bound rejects unknown arbitrary legacy maxima',()=>{
 assert.equal(field.maxSurfaceHeight,5085);
 assert.equal(P.createPlanetField({legacyHeight:()=>100000}).maxSurfaceHeight,null);
 assert.equal(P.createPlanetField({legacyHeight:()=>310,legacyMaxHeight:310}).maxSurfaceHeight,5085);
 const bounded=P.createPlanetField({legacyHeight:()=>10000,legacyMaxHeight:10000});assert.ok(bounded.maxSurfaceHeight>10000);
 for(let i=0;i<500;i++){const p={x:Math.sin(i*.91)+.01,y:Math.cos(i*.53),z:Math.cos(i*.77)};assert.ok(field.sample(p).height<=field.maxSurfaceHeight);assert.ok(bounded.sample(p).height<=bounded.maxSurfaceHeight);}
 assert.throws(()=>P.createPlanetField({legacyMaxHeight:Infinity}));
});
test('geodetic roundtrips including poles, seam and high orbit',()=>{
  for(const lat of [-Math.PI/2,-1,0,1,Math.PI/2])for(const lon of [-Math.PI,-2,0,2,Math.PI])for(const height of [-1000,0,2e6]){
    const p=P.toCartesian({lat,lon,height}),g=P.toGeodetic(p),q=P.toCartesian(g);near(P.length(P.sub(p,q)),0,1e-6);}
});
test('legacy flat basin is preserved geometrically on the sphere',()=>{
  const h=(x,z)=>Math.sin(x*.009)*Math.cos(z*.008)*9, f=P.createPlanetField({legacyHeight:h});
  for(let x=-3000;x<=3000;x+=150)for(let z=-3000;z<=3000;z+=150){const local={x,y:h(x,z),z},global=P.localToGlobal(local),surface=f.surfacePoint(global);near(P.length(P.sub(global,surface)),0,1e-6);}
});
test('seed and direction scale deterministic; fields continuous and normalized',()=>{
  const other=P.createPlanetField({planet:{...P.DEFAULT_PLANET,seed:'other'}});let differences=0;
  for(let i=0;i<1000;i++){const p=P.unit({x:Math.sin(i*1.23),y:Math.cos(i*2.45),z:Math.sin(i*.13)}),a=field.sample(p),b=field.sample(P.scale(p,200000));
    near(a.height,b.height);near(Object.values(a.biomes).reduce((a,b)=>a+b),1);assert.equal(Object.keys(a.biomes).length,9);
    const next=field.sample({x:p.x+1e-8,y:p.y,z:p.z});assert.ok(Math.abs(next.height-a.height)<.1);
    if(Math.abs(other.sample(p).height-a.height)>1)differences++;assert.ok(Number.isFinite(field.sampleSurface(p).slope));
  }assert.ok(differences>900);
});
test('cube faces share identical edges and mesh normals face outward',()=>{
  for(const face of P.FACES)for(const u of [.1,.4,.9])for(const v of [.1,.4,.9]){const c=P.directionToCube(P.cubeDirection(face,u*2-1,v*2-1));assert.equal(c.face,face);near(c.u,u);near(c.v,v);}
  for(let i=0;i<=16;i++){const v=i/8-1;near(P.length(P.sub(P.cubeDirection('px',-1,v),P.cubeDirection('pz',1,v))),0);}
  for(const face of P.FACES){const m=P.buildChunk({face,level:2,x:1,y:1},field,{segments:4}),[a,b,c]=m.indices;
    const p=i=>({x:m.positions[i*3],y:m.positions[i*3+1],z:m.positions[i*3+2]}),u=P.sub(p(b),p(a)),v=P.sub(p(c),p(a));
    const cross={x:u.y*v.z-u.z*v.y,y:u.z*v.x-u.x*v.z,z:u.x*v.y-u.y*v.x};assert.ok(P.dot(cross,m.center)>0,face);
  }
});
test('LOD retains full sphere area and budget from ground to orbit',()=>{
  for(const altitude of [0,50,2000,10000,120000,2000000]){const chunks=P.selectChunks({x:120000+altitude,y:0,z:0});assert.ok(chunks.length<=192);
    for(const face of P.FACES)near(chunks.filter(c=>c.face===face).reduce((sum,c)=>sum+1/4**c.level,0),1);
    assert.equal(new Set(chunks.map(P.chunkKey)).size,chunks.length);
  }
});
test('R3 globally distributed elevated land gets reserved ground precision in 192 chunks',()=>{
 for(let i=0;i<256;i++){
  const direction=P.unit({x:Math.sin(i*1.234)+.01,y:Math.cos(i*2.321),z:Math.sin(i*.783)}),position=field.surfacePoint(direction),surfaceRadius=P.length(position),tile=P.directionToCube(position);
  const chunks=P.selectChunks(position,{surfaceRadius,segments:32});assert.ok(chunks.length<=192);
  const ground=chunks.find(c=>{const n=2**c.level;return c.face===tile.face&&c.x===Math.min(n-1,Math.floor(tile.u*n))&&c.y===Math.min(n-1,Math.floor(tile.v*n));});
  assert.ok(ground);assert.ok(2*Math.max(120000,surfaceRadius)/2**ground.level/32<=20);
  for(const face of P.FACES)near(chunks.filter(c=>c.face===face).reduce((sum,c)=>sum+1/4**c.level,0),1);
 }
});
test('floating origin changes render coordinates only and save envelope preserves story',()=>{
  const f=P.createFloatingOrigin(),p={x:212345.678,y:-84321.2,z:5555.123},save={version:1,player:{x:10,y:4,z:20},story:{flags:{signal:true}}};
  f.update(p);near(P.length(P.sub(f.toGlobal(f.toRender(p)),p)),0);const packed=P.attachPlanetPosition(save,p);assert.equal(packed.story,save.story);assert.deepEqual(P.readPlanetPosition(packed),p);assert.equal(save.planet,undefined);
  near(P.length(P.sub(P.readPlanetPosition(save),P.localToGlobal(save.player))),0);assert.throws(()=>P.readPlanetPosition({...packed,planet:{...packed.planet,seed:'wrong'}}));
  const extended={...packed,planet:{...packed.planet,gameplay:{energy:55}}};assert.deepEqual(P.attachPlanetPosition(extended,p).planet.gameplay,{energy:55});
});
test('cache rollback, bounded eviction and destroy',()=>{
  const roots=P.FACES.map(face=>({face,level:0,x:0,y:0})),disposed=[];let fail=false;
  const cache=P.createChunkCache({capacity:6,load:c=>{if(fail&&c.face==='ny')throw Error('load');return P.chunkKey(c);},dispose:v=>disposed.push(v)});
  cache.update(roots);fail=true;assert.throws(()=>cache.update(roots.map(c=>({...c,level:1}))));assert.deepEqual([...cache.active.keys()],roots.map(P.chunkKey));assert.equal(cache.size,6);
  fail=false;cache.update(roots.map(c=>({...c,level:1})));assert.equal(cache.size,6);cache.destroy();assert.equal(cache.size,0);assert.equal(cache.active.size,0);assert.ok(disposed.length>=12);
});
