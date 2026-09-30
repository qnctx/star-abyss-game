import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import * as P from '../src/planet/index.mjs';
const base=process.env.PLANET_BASELINE;
const require=createRequire(import.meta.url);
const THREE=require('three');
const {terrainHeight}=await import(base ? pathToFileURL(base+'/playable/src/layout.mjs') : new URL('../src/layout.mjs',import.meta.url));
const field=P.createPlanetField({legacyHeight:terrainHeight});
test('actual R4 legacy mesh heights preserved across 3721 basin samples',()=>{
 for(let x=-3000;x<=3000;x+=100)for(let z=-3000;z<=3000;z+=100){const p=P.localToGlobal({x,y:terrainHeight(x,z),z});assert.ok(P.length(P.sub(p,field.surfacePoint(p)))<.0001,`${x},${z}`);}
});
test('route is continuously walkable through coast, landmark biomes dominate',()=>{
 let maxSlope=0;
 for(let s=4000;s<=35000;s+=25){const p=field.routeDirection(s),sample=field.sampleSurface(p);maxSlope=Math.max(maxSlope,sample.slope);assert.ok(sample.height>=0,`underwater ${s}`);assert.ok(sample.slope<.22,`slope ${s}: ${sample.slope}`);}
 for(const mark of field.routeLandmarks){if(mark.id==='basin')continue;const sample=field.sample(mark.position),dominant=Object.entries(sample.biomes).sort((a,b)=>b[1]-a[1])[0][0];assert.equal(dominant,mark.id);}
 console.log('route max slope degrees',maxSlope*180/Math.PI);
});
test('river water surface drains monotonically from uplands to ocean',()=>{
 let previous=Infinity;
 for(let s=6500;s<=35000;s+=25){const sample=field.sample(field.routeDirection(s,320));assert.ok(sample.waterHeight<=previous+1e-8);assert.ok(sample.waterDepth>4.9);previous=sample.waterHeight;}
});
test('R2 basin connects to broad dry mainland north, south and west',()=>{
 let count=0,minHeight=Infinity;
 for(let x=-40000;x<=0;x+=1000)for(let z=-30000;z<=30000;z+=1000){if(Math.hypot(x,z)<4500)continue;
   const sample=field.sample(P.localToGlobal({x,y:0,z}));assert.ok(sample.height>0,`submerged mainland ${x},${z}: ${sample.height}`);assert.equal(sample.waterDepth,0);minHeight=Math.min(minHeight,sample.height);count++;}
 for(let angle=0;angle<Math.PI*2;angle+=Math.PI/90){const sample=field.sample(P.localToGlobal({x:6000*Math.cos(angle),y:0,z:6000*Math.sin(angle)}));assert.ok(sample.height>0);assert.equal(sample.waterDepth,0);}
 for(let east=55000;east<=85000;east+=2500)for(let side=-15000;side<=15000;side+=2500){const sample=field.sample(field.routeDirection(east,side));assert.ok(sample.waterDepth>100,`eastern shelf ${east},${side}`);}
 console.log('R2 mainland samples',count,'minimum metres',minHeight,'eastern sea samples',169);
});
test('real Three adapter anchor transform, masking, raycast and disposal',()=>{
 const scene=new THREE.Scene(),terrain=P.createPlanetTerrain({THREE,scene,field,lod:{maxChunks:48,maxLevel:8},segments:8,legacyMaskHalfSize:3000});
 const position=field.surfacePoint(field.routeDirection(8000)),state=terrain.update(position);
 assert.ok(P.length(P.sub(state.cameraRender,P.globalToLocal(position)))<1e-7);assert.ok(state.activeChunks<=48);
  const material=terrain.root.children[0].material,shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);assert.ok(shader.fragmentShader.includes('discard'));assert.ok(shader.fragmentShader.includes('planetArtTone'));
 const basin=P.localToGlobal({x:100,y:terrainHeight(100,100),z:100});assert.equal(terrain.sampleRenderedSurface(basin).source,'legacy');
 terrain.setLegacyMaskEnabled(false);assert.equal(shader.uniforms.planetLegacyHalf.value,0);assert.equal(terrain.legacyMaskEnabled,false);assert.notEqual(terrain.sampleRenderedSurface(basin).source,'legacy');terrain.setLegacyMaskEnabled(true);assert.equal(shader.uniforms.planetLegacyHalf.value,3000);
 terrain.root.updateMatrixWorld(true);const up=new THREE.Vector3(state.upRender.x,state.upRender.y,state.upRender.z),origin=new THREE.Vector3(state.cameraRender.x,state.cameraRender.y,state.cameraRender.z).addScaledVector(up,1000);
 const ray=new THREE.Raycaster(origin,up.negate(),0,3000),hits=terrain.raycastSurface(ray);assert.ok(hits.length>0);
 const sampled=terrain.sampleRenderedSurface(position);assert.equal(sampled.source,'triangles');assert.ok(sampled.ready);assert.ok(P.length(P.sub(P.globalToLocal(sampled.position),hits[0].point))<.1);assert.equal(terrain.isReady(position,sampled.spacing+1),true);
 terrain.destroy();assert.equal(scene.children.length,0);assert.throws(()=>terrain.update(position));
});
test('R3 actual backside mountain and polar meshes ready without increasing budget',()=>{
 const scene=new THREE.Scene(),terrain=P.createPlanetTerrain({THREE,scene,field});const stats=[];
 try{for(const [name,direction]of [['backside',{x:-1,y:0,z:0}],['north',{x:0,y:1,z:0}],['south',{x:0,y:-1,z:0}],['polar-north',{x:.01,y:1,z:.01}],['polar-south',{x:-.01,y:-1,z:.01}],['cube-corner',{x:-1,y:1,z:1}]]){
   const position=field.surfacePoint(direction),info=terrain.update(position),sample=terrain.sampleRenderedSurface(position);
   assert.equal(sample.ready,true,name);assert.equal(terrain.isReady(position,30),true,`${name}: ${sample.spacing}`);assert.ok(sample.spacing<=30);assert.ok(info.activeChunks<=192);assert.ok(info.cachedChunks<=384);
   stats.push({name,height:field.sample(position).height,spacing:sample.spacing,active:info.activeChunks});
   const moved=P.add(position,{x:.1,y:.1,z:-.1});terrain.update(moved);assert.equal(terrain.isReady(moved,30),true,name+' short step');
 }}finally{terrain.destroy();}console.log('R3 actual ground',JSON.stringify(stats));
});
