import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPlanetRuntime} from '../src/planet-runtime.mjs';
import {createMobility,serializeMobility} from '../src/mobility.mjs';
import {unit,scale,dot,tangentFrame,length,localToGlobal} from '../src/planet/coordinates.mjs';
import {restoreSurfaceVehicle} from '../src/planet-gameplay/save.mjs';

test('real radial controller follows slopes, falls off a cliff, preserves falling saves and lands',()=>{
 const c={player:{x:0,y:0,z:190,yaw:0,heading:0,pitch:0},story:{flags:{complete:true}},mobility:createMobility()};c.mobility.vehicle.repaired=true;
 const runtime=createPlanetRuntime({world:{scene:new THREE.Scene(),setPlanetController(){}},getContext:()=>c,toast(){}});
 try{
  const original={player:{...c.player},story:c.story,mobility:serializeMobility(c.mobility)};runtime.reset(original);
  const base=runtime.save(original),R=runtime.field.planet.radius,basis=tangentFrame(0,Math.PI,R);
  let height=(x,z)=>1000+z*.3;
  runtime.terrain.update=()=>{};runtime.terrain.isReady=()=>true;
  runtime.terrain.sampleRenderedSurface=p=>{
   const direction=unit(p);let radial=R+1000;
   for(let i=0;i<8;i++){const point=scale(direction,radial);radial=(R+height(dot(point,basis.east),dot(point,basis.south)))/dot(direction,basis.up);}
   const position=scale(direction,radial);return {ready:true,spacing:1,position,height:radial-R,waterDepth:0,waterHeight:null,slope:0,biomes:{mountains:1}};
  };
  runtime.setEcology({blockedCanonical:()=>false,update(){},dispose(){}});
  const start=runtime.adapter.sampleVehicle(scale(basis.up,R+1000),0).supportPosition;
  const raw={...base,planet:{...base.planet,position:start,pose:{yaw:0,heading:0,pitch:0},gameplay:{...base.planet.gameplay,surfaceVehicle:{position:start,yaw:0,battery:100,mounted:true,grounded:true}}}};
  runtime.reset(raw);const before=length(runtime.position);
  for(let i=0;i<120;i++)runtime.step({forward:true},1/60);
  assert.ok(length(runtime.position)<before-.5,'downhill advances and descends instead of being rejected');
  assert.equal(c.mobility.vehicle.grounded,true);
  assert.ok(Math.abs(runtime.adapter.sampleVehicle(runtime.position,0).agl)<.01);
  assert.ok(Math.abs(c.mobility.vehicle.surfaceNormal.y)>.1,'slope normal is projected into anchor coordinates');
  const savedSlope=runtime.save({...original,player:{...c.player}});runtime.reset(savedSlope);
  assert.equal(c.mobility.vehicle.mounted,true);assert.equal(runtime.active,false);
  height=()=>970;
  runtime.step({},1/60);
  assert.equal(c.mobility.vehicle.grounded,false);assert.ok(c.mobility.vehicle.vy<0);
  const fallingY=length(runtime.position)-R;assert.ok(fallingY>990,'cliff does not teleport the car to its bottom');
  assert.equal(runtime.vehicleAction(),false,'cannot dismount while airborne');
  const savedFall=runtime.save({...original,player:{...c.player}});runtime.reset(savedFall);
  assert.equal(runtime.active,false,'vehicle gravity must not become high-altitude equipment');
  assert.equal(c.mobility.vehicle.grounded,false);assert.ok(c.mobility.vehicle.vy<0);
  for(let i=0;i<180;i++)runtime.step({lift:true},1/60);
  assert.equal(c.mobility.vehicle.grounded,true);assert.ok(Math.abs(runtime.adapter.sampleVehicle(runtime.position,0).agl)<.01);
  const camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene();scene.fog={density:0};
  const objects={camera,scene,ground:new THREE.Object3D(),avatar:new THREE.Object3D(),skimmer:new THREE.Object3D(),sky:new THREE.Object3D(),stars:new THREE.Object3D(),ringPlanet:new THREE.Object3D(),ringGroup:new THREE.Object3D(),dust:new THREE.Object3D()};
  objects.sky.material={uniforms:{orbitalMix:{value:0}}};
  runtime.updateScene({player:{...c.player,pitch:.7},cameraMode:'third'},objects);
  const cameraCanonical=localToGlobal(camera.position,runtime.frame);
  assert.ok(length(cameraCanonical)-R>=970+.2,'downward rear camera boom is shortened before entering the ground');
  assert.ok(objects.avatar.quaternion.angleTo(objects.skimmer.quaternion)<1e-9,'mounted rider shares vehicle support frame');
  const beforeMissing={...runtime.position};runtime.terrain.sampleRenderedSurface=()=>({ready:false});runtime.step({forward:true},1/60);
  assert.deepEqual(runtime.position,beforeMissing,'unloaded mesh fails closed');
 }finally{runtime.dispose();}
});

test('support-based restore accepts a raised crest plane, rejects penetration, migrates only valid old center saves',()=>{
 const position={x:121000,y:0,z:0},raw={position,yaw:0,battery:70,mounted:true},context={mobility:{vehicle:{repaired:true}}};
 const sample={ready:true,altitude:1000,agl:0,waterDepth:0,grounded:true,biome:'mountains',slope:0,atService:false};
 const world={radius:120000,sample:()=>({...sample,agl:.7,grounded:false}),sampleVehicle:()=>sample};
 assert.equal(restoreSurfaceVehicle(raw,context,world).status,'restored');
 world.sampleVehicle=()=>({...sample,agl:-.7,grounded:false,supportPosition:{x:121000.7,y:0,z:0}});
 assert.equal(restoreSurfaceVehicle({...raw,grounded:true},context,world).status,'unsafe');
 assert.equal(restoreSurfaceVehicle(raw,context,world).status,'unsafe');
 world.sample=()=>sample;
 assert.equal(restoreSurfaceVehicle(raw,context,world).value.position.x,121000.7);
});
