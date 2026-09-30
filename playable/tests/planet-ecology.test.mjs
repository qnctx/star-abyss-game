// Verification guide: node --test playable/tests/planet-ecology.test.mjs
// Host: update terrain before ecology; pass canonical camera; wire blocked into
// movement/sweep with anchor-local feet; root can share the terrain render rebase.
// Independent tests use real Three geometries and the image-derived art module.
// R1 test SHA256: 9114a5312ff4448181579432b2255afe2ed5c46d6854855e5fc78eb4d62d65fb.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPlanetEcology,ecologyCandidates} from '../src/planet-ecology.mjs';
import {tangentFrame,localToGlobal,unit,scale} from '../src/planet/coordinates.mjs';
import {FACES,directionToCube} from '../src/planet/chunks.mjs';
const frame=tangentFrame(),radius=120000;
function fixture(options={}){
  let ready=true;const scene=new THREE.Scene();
  const field={planet:{radius},sampleSurface:()=>({height:0,biomes:{[options.biome||'forest']:1},slope:options.slope||0,waterDepth:options.depth||0,legacyWeight:options.legacy||0}),surfacePoint:d=>scale(unit(d),radius)};
  const terrain={sampleRenderedSurface:p=>({ready,position:scale(unit(p),radius+3),waterDepth:options.renderDepth??options.depth??0})};
  const api=createPlanetEcology({THREE,scene,field,frame,terrain,budget:options.budget||{maxInstances:24,maxTriangles:120000}});
  const point=x=>scale(unit(localToGlobal({x,y:0,z:0},frame)),radius+4);
  return {api,scene,point,setReady:v=>ready=v,field};
}
test('global candidate cells and reloaded batches are deterministic',()=>{
  const cell={face:'px',level:12,x:90,y:4};
  assert.deepEqual(ecologyCandidates(cell,'tree'),ecologyCandidates(cell,'tree'));
  assert.notDeepEqual(ecologyCandidates(cell,'tree'),ecologyCandidates({...cell,x:91},'tree'));
  const a=fixture(),b=fixture();a.api.update(a.point(6000));b.api.update(b.point(6000));
  assert.deepEqual(a.api.snapshot(),b.api.snapshot());assert.ok(a.api.snapshot().instances>0);
  a.api.dispose();b.api.dispose();
});
test('budget, rendered support and real trunk collision are enforced',()=>{
  const f=fixture(),s=f.api.update(f.point(6000));assert.ok(s.instances<=24&&s.triangles<=120000);
  const trunk=s.colliders[0];assert.ok(trunk);
  const canonical=localToGlobal({x:trunk.x,y:trunk.y,z:trunk.z},frame);
  assert.ok(Math.abs(Math.hypot(canonical.x,canonical.y,canonical.z)-(radius+3))<1e-6);
  assert.equal(f.api.blocked(trunk.x,trunk.z,.42,trunk.y),true);
  assert.equal(f.api.blocked(trunk.x,trunk.z,.42,trunk.y+20),false);f.api.dispose();
});
test('movement unloads old cells, altitude unloads all, disposal releases geometry',()=>{
  const f=fixture();f.api.update(f.point(6000));const before=f.api.snapshot().keys;let disposed=0;
  for(const mesh of f.api.root.children)mesh.geometry.addEventListener('dispose',()=>disposed++);
  f.api.update(f.point(12000));assert.ok(disposed>0);assert.ok(f.api.snapshot().keys.every(k=>!before.includes(k)));
  f.api.update(scale(unit(f.point(12000)),radius+500));assert.equal(f.api.snapshot().instances,0);
  f.api.dispose();assert.equal(f.scene.children.length,0);assert.throws(()=>f.api.update(f.point(6000)),/disposed/);
});
test('authoritative water, slopes, legacy ownership and missing triangles exclude art',()=>{
  for(const options of [{depth:.1},{slope:.8},{legacy:.01},{renderDepth:.1}]){const f=fixture(options);assert.equal(f.api.update(f.point(6000)).instances,0);f.api.dispose();}
  const f=fixture();f.setReady(false);assert.equal(f.api.update(f.point(6000)).instances,0);f.setReady(true);assert.ok(f.api.update(f.point(6000)).instances>0);f.api.dispose();
  const basin=fixture();assert.equal(basin.api.update(basin.point(0)).instances,0);basin.api.dispose();
});
test('reeds and shoreline stones are visible but never blocking',()=>{
  for(const biome of ['wetland','river']){const f=fixture({biome,depth:.1});const s=f.api.update(f.point(6000));assert.ok(s.instances>0);assert.equal(s.colliders.length,0);assert.equal(f.api.blocked(6000,0,.42,0),false);f.api.dispose();}
});
test('distant tree batches use reduced geometry LOD',()=>{
  const f=fixture({budget:{maxInstances:300,maxTriangles:2000000}}),s=f.api.update(f.point(6000));
  assert.ok(s.lods.includes(0));assert.ok(s.lods.includes(1));
  const near=f.api.root.children.find(m=>m.userData.lod===0),far=f.api.root.children.find(m=>m.userData.lod===1);
  assert.ok(far.geometry.getAttribute('position').count<near.geometry.getAttribute('position').count);f.api.dispose();
});
test('far-slice grid selection inverts radial projection instead of drifting behind player',()=>{
  const f=fixture(),point=f.point(30000),s=f.api.update(point);
  assert.ok(s.colliders.length>0);
  const nearest=Math.min(...s.colliders.map(c=>{const p=localToGlobal({x:c.x,y:c.y,z:c.z},frame);return Math.hypot(p.x-point.x,p.y-point.y,p.z-point.z);}));
  assert.ok(nearest<80,`nearest ${nearest}`);f.api.dispose();
});
test('backside and both poles generate radial colliders and unload independently',()=>{
  const f=fixture({budget:{maxInstances:300,maxTriangles:2000000}});let old=[];
  for(const d of [{x:-1,y:0,z:0},{x:0,y:1,z:0},{x:0,y:-1,z:0}]){
    const s=f.api.update(scale(d,radius+4));assert.ok(s.instances>0);assert.ok(s.lods.includes(1));
    assert.ok(s.keys.every(k=>!old.includes(k)));old=s.keys;
    const c=s.colliders[0],base=localToGlobal({x:c.x,y:c.y,z:c.z},frame);
    assert.equal(f.api.blockedCanonical(base),true);
    assert.equal(f.api.blockedCanonical(scale(unit(base),radius+30)),false);
  }f.api.dispose();
});
test('cube edges have unique stable IDs and strictly face-owned directions',()=>{
  const ids=new Set(),positions=new Set();
  for(const face of FACES)for(const x of [0,4095])for(const y of [0,4095])for(const kind of ['tree','reed','pebble']){
    const candidates=ecologyCandidates({face,level:12,x,y},kind);
    for(const c of candidates){assert.equal(ids.has(c.id),false);ids.add(c.id);assert.equal(directionToCube(c.direction).face,face);
      const key=JSON.stringify(c.direction);assert.equal(positions.has(key),false);positions.add(key);}
  }
});
test('face seam neighborhood loads both owners without duplicated colliders',()=>{
  const f=fixture({budget:{maxInstances:400,maxTriangles:3000000}}),point=scale(unit({x:-1,y:1,z:0}),radius+4),s=f.api.update(point);
  assert.ok(s.keys.some(k=>k.startsWith('nx/')));assert.ok(s.keys.some(k=>k.startsWith('py/')));
  assert.equal(new Set(s.colliders.map(c=>c.id)).size,s.colliders.length);
  const saved=s.colliders;f.api.update(scale(unit({x:0,y:0,z:1}),radius+500));
  assert.deepEqual(f.api.update(point).colliders,saved);f.api.dispose();
});
