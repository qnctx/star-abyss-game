import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPlanetTerrain,fullyCoveredByLegacyMask} from '../src/planet/scene-adapter.mjs';
import {createPlanetField} from '../src/planet/field.mjs';
import {localToGlobal} from '../src/planet/coordinates.mjs';

test('only strictly internal front-side Float32 chunks are fully covered',()=>{
 const half=3000;
 assert.equal(fullyCoveredByLegacyMask(new Float32Array([0,0,120000,150,200,119920]),half),true);
 assert.equal(fullyCoveredByLegacyMask(new Float32Array([0,0,120000,3000,0,120000]),half),false);
 assert.equal(fullyCoveredByLegacyMask(new Float32Array([0,0,120000,-3000,0,120000]),half),false);
 assert.equal(fullyCoveredByLegacyMask(new Float32Array([0,0,120000,0,-3000,120000]),half),false);
 assert.equal(fullyCoveredByLegacyMask(new Float32Array([0,0,120000,2999.999,0,120000]),half),false);
 assert.equal(fullyCoveredByLegacyMask(new Float32Array([0,0,-1,150,200,-1]),half),false);
 assert.equal(fullyCoveredByLegacyMask(new Float32Array([0,0,0]),half),false);
 assert.equal(fullyCoveredByLegacyMask(new Float32Array([0,0,120000,NaN,0,120000]),half),false);
});

function campTerrain(field){return createPlanetTerrain({THREE,scene:new THREE.Scene(),field,segments:4,legacyMaskHalfSize:3000,lod:{maxChunks:48,maxLevel:10}});}

test('fully masked dry chunks skip drawing but keep geometry and exact sampling through transitions',()=>{
 const field=createPlanetField({legacyHeight:()=>0,legacyMaxHeight:0}),terrain=campTerrain(field);
 try{
  const camp=field.surfacePoint(localToGlobal({x:0,y:0,z:0}));terrain.setLegacyBlend(.25);terrain.update(camp);
  const hidden=terrain.root.children.filter(mesh=>mesh.userData.fullyLegacyMasked&&mesh.children.length===0);
  assert(hidden.length>0,'expected an interior dry chunk');
  assert(hidden.every(mesh=>mesh.visible===true),'new chunks load visible during a nonzero blend');
  terrain.setLegacyBlend(0);
  assert(hidden.every(mesh=>mesh.visible===false));
  const geometry=hidden[0].geometry,insideSample=terrain.sampleRenderedSurface(camp);
  assert.equal(insideSample.source,'legacy');assert.equal(insideSample.ready,true);
  terrain.setLegacyBlend(.25);assert(hidden.every(mesh=>mesh.visible===true));
  assert.deepEqual(terrain.sampleRenderedSurface(camp),insideSample);
  terrain.setLegacyBlend(0);assert(hidden.every(mesh=>mesh.visible===false));
  terrain.setLegacyMaskEnabled(false);assert(terrain.root.children.every(mesh=>mesh.visible===true));
  assert.equal(terrain.sampleRenderedSurface(camp).ready,true);
  terrain.setLegacyMaskEnabled(true);assert(hidden.every(mesh=>mesh.visible===false));
  assert.equal(hidden[0].geometry,geometry);
  assert.deepEqual(terrain.sampleRenderedSurface(camp),insideSample);
  // A cached chunk can be inactive while the mask changes; publication reapplies it.
  terrain.setLegacyMaskEnabled(false);
  terrain.update(field.surfacePoint(localToGlobal({x:5000,y:0,z:0})));
  terrain.setLegacyMaskEnabled(true);
  terrain.update(camp);
  assert(terrain.root.children.includes(hidden[0]));
  assert.equal(hidden[0].visible,false);
  assert.equal(hidden[0].geometry,geometry);
  assert.deepEqual(terrain.sampleRenderedSurface(camp),insideSample);
 }finally{terrain.destroy();}
});

test('a fully internal chunk with water retains its parent draw during the legacy mask',()=>{
 const source=createPlanetField({legacyHeight:()=>0,legacyMaxHeight:0});
 const field={...source,sample(position){return {...source.sample(position),waterDepth:1,waterHeight:1};}};
 const terrain=campTerrain(field);
 try{
  terrain.update(field.surfacePoint(localToGlobal({x:0,y:0,z:0})));
  const wet=terrain.root.children.filter(mesh=>mesh.userData.fullyLegacyMasked&&mesh.children.length>0);
  assert(wet.length>0,'expected an interior wet chunk');
  assert(wet.every(mesh=>mesh.visible===true));
  terrain.setLegacyBlend(.5);terrain.setLegacyBlend(0);terrain.setLegacyMaskEnabled(false);terrain.setLegacyMaskEnabled(true);
  assert(wet.every(mesh=>mesh.visible===true));
 }finally{terrain.destroy();}
});
