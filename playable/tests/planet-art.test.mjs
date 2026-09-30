import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {createPlanetArtBatch,normalizeBiomes,sampleArtMaterial,BIOME_IDS,placePlanetArt} from '../src/planet-art/index.mjs';
const THREE=await import(pathToFileURL(path.resolve(process.env.THREE_ROOT || 'node_modules/three','build/three.module.js')));
test('all geometry attributes finite; correct bounds, deterministic output and reduced LOD',()=>{
  for(const kind of ['tree','reed','pebble']){
    const opts={kind,records:[{position:[100,20,-30],up:[1,0,0],scale:2,yaw:.5}],seed:15};
    const a=createPlanetArtBatch(THREE,opts),b=createPlanetArtBatch(THREE,opts),low=createPlanetArtBatch(THREE,{...opts,lod:1});
    const positions=a.mesh.geometry.attributes.position.array;
    assert(positions.every(Number.isFinite));assert(a.mesh.geometry.attributes.normal.array.every(Number.isFinite));
    assert.deepEqual(positions,b.mesh.geometry.attributes.position.array);
    assert(low.mesh.geometry.attributes.position.count<a.mesh.geometry.attributes.position.count);
    assert(a.mesh.boundingSphere.radius>0);assert.equal(a.mesh.count,1);
    const m=new THREE.Matrix4();a.mesh.getMatrixAt(0,m);const up=new THREE.Vector3(0,1,0).transformDirection(m);
    assert(up.distanceTo(new THREE.Vector3(1,0,0))<1e-6);
    let disposed=0;a.mesh.geometry.addEventListener('dispose',()=>disposed++);a.mesh.material.addEventListener('dispose',()=>disposed++);a.dispose();assert.equal(disposed,2);b.dispose();low.dispose();
  }
});
test('global placement preserves legacy area, rejects wet trees, applies origin and exports colliders',()=>{
  let legacyWeight=0,water=0;
  const field={sampleSurface:()=>({slope:.1,legacyWeight,biomes:{forest:1}}),surfacePoint:()=>({x:120000,y:10,z:20})};
  const opts={kind:'tree',field,candidates:[{id:44,direction:{x:1,y:0,z:0}}],origin:{x:119999,y:5,z:15},getWaterDepthM:()=>water};
  let result=placePlanetArt(opts);assert.deepEqual(result.records[0].position,[1,5,5]);assert.deepEqual(result.records[0].up,[1,0,0]);assert.equal(result.colliders[0].base.x,120000);
  legacyWeight=.01;assert.equal(placePlanetArt(opts).records.length,0);
  legacyWeight=0;water=.1;assert.equal(placePlanetArt(opts).records.length,0);
  water=NaN;assert.equal(placePlanetArt(opts).records.length,0);
});
test('bad input rejected and biome material weighting finite',()=>{
  assert.throws(()=>createPlanetArtBatch(THREE,{kind:'tree',records:[{position:[NaN,0,0],up:[0,1,0],scale:1,yaw:0}]}));
  const w=normalizeBiomes({forest:2,river:1,wetland:-1,basin:NaN});
  assert.equal(Object.values(w).reduce((a,b)=>a+b,0),1);assert.equal(w.forest,2/3);assert.equal(w.wetland,0);
  assert.equal(normalizeBiomes({}).basin,1);
  for(const id of BIOME_IDS){const m=sampleArtMaterial(THREE,{[id]:1});assert(m.color.toArray().every(Number.isFinite));assert(m.roughness>=0&&m.roughness<=1);}
});
