import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createChunkCache,FACES} from '../src/planet/chunks.mjs';
import {createPlanetTerrain} from '../src/planet/scene-adapter.mjs';
import {createPlanetField} from '../src/planet/field.mjs';
import {createCreatureRig} from '../src/expedition-world/creature-rig.mjs';
const chunks=level=>FACES.map(face=>({face,level,x:0,y:0}));
test('cooperative cache keeps old complete coverage, atomically publishes, cancels and disposes staging',()=>{
 const disposed=[],cancelled=[];let clock=0;
 const cache=createChunkCache({capacity:12,load:function*(c){try{for(let i=0;i<3;i++)yield;return {...c};}finally{cancelled.push(c.level);}},dispose:d=>disposed.push(d)});
 cache.update(chunks(0));assert.equal(cache.revision,1);
 for(let i=0;i<5;i++){cache.update(chunks(1),{budgetMs:.5,now:()=>clock+=.3});assert.equal(cache.active.size,6);assert.ok([...cache.active.values()].every(c=>c.level===0));}
 cache.update(chunks(2),{budgetMs:.5,now:()=>clock+=.3});assert.ok(cancelled.includes(1));
 let pumps=0;while(cache.pending){cache.update(chunks(2),{budgetMs:.5,now:()=>clock+=.3});assert.ok(++pumps<100);}
 assert.ok([...cache.active.values()].every(c=>c.level===2));assert.ok(cache.size<=12);assert.equal(cache.revision,2);cache.destroy();assert.ok(disposed.length>=12);
});
test('cooperative exception preserves published data and closes the failed generator',()=>{
 let fail=false,closed=false;
 const cache=createChunkCache({load:function*(c){try{yield;if(fail)throw Error('injected');return c;}finally{closed=true;}}});
 cache.update(chunks(0));fail=true;assert.throws(()=>cache.update(chunks(1)),/injected/);assert.equal(cache.active.size,6);assert.ok([...cache.active.values()].every(c=>c.level===0));assert.equal(cache.pending,false);assert.ok(closed);cache.destroy();
});
test('force teleport supersedes staged destination and preserves all six faces',()=>{
 const field=createPlanetField(),terrain=createPlanetTerrain({THREE:T,scene:new T.Scene(),field,segments:8,lod:{maxChunks:48,maxLevel:8}});
 terrain.update(field.surfacePoint({x:1,y:0,z:0}));const revision=terrain.revision;
 terrain.update(field.surfacePoint({x:0,y:1,z:0}),{budgetMs:0,maxLoads:1});assert.equal(terrain.revision,revision);assert.equal(terrain.pending,true);
 const target=field.surfacePoint({x:-1,y:0,z:0});terrain.update(target);assert.equal(terrain.pending,false);assert.ok(terrain.sampleRenderedSurface(target).ready);assert.equal(new Set(terrain.root.children.map(m=>m.userData.planetChunk.chunk.face)).size,6);terrain.destroy();
});
test('optimized authored creature collision matches exhaustive deformed-vertex clearance',async()=>{
 const bytes=fs.readFileSync(new URL('../assets/creatures/rift-prowler-v1/rift-prowler.glb',import.meta.url)),rig=JSON.parse(fs.readFileSync(new URL('../assets/creatures/rift-prowler-v1/rig-map.json',import.meta.url)));
 const gltf=await new GLTFLoader().register(()=>({name:'test-material',loadMaterial:()=>Promise.resolve(new T.MeshStandardMaterial())})).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const ground=(x,z)=>x*.12+z*.04,anchor=new T.Group(),actor=createCreatureRig(gltf.scene,rig,anchor,ground),v=new T.Vector3();
 assert.ok(actor.stats.collisionVertices<43002);
 for(const [time,phase,hp]of [[0,'idle',10],[.2,'chase',10],[.3,'dead',0],[.5,'dead',0],[1,'dead',0],[3,'dead',0]]){
  actor.update({id:'test',phase,hp,x:0,z:0,yaw:0},time);const mesh=actor.mesh;
  if(hp===0){let min=Infinity;for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);min=Math.min(min,v.y-ground(v.x,v.z));}assert.ok(Math.abs(min)<1e-8,`full clearance ${min}`);}
  else for(const leg of actor.legs){let min=Infinity;for(const i of leg.indices){mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);min=Math.min(min,v.y-ground(v.x,v.z));}assert.ok(Math.abs(min-leg.clearance)<1e-8);}
 }
 actor.dispose();
});
