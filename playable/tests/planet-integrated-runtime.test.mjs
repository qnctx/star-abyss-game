import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPlanetRuntime} from '../src/planet-runtime.mjs';
import {createMobility,serializeMobility} from '../src/mobility.mjs';
import {localToGlobal} from '../src/planet/coordinates.mjs';
test('integrated terrain/gameplay save roundtrip preserves chapter pose and canonical high orbit',()=>{
 const context={player:{x:0,y:0,z:190,yaw:0,pitch:0},story:{flags:{complete:true}},mobility:createMobility()};context.mobility.vehicle.repaired=true;
 const runtime=createPlanetRuntime({world:{scene:new THREE.Scene(),setPlanetController(){}},getContext:()=>context,toast(){}});
 try{
  const legacy={version:1,player:{...context.player},story:context.story,mobility:serializeMobility(context.mobility)};
  runtime.reset(legacy);assert.equal(runtime.legacyActive(),true);
  const base=runtime.save(legacy);assert.ok(base.planet);assert.equal(base.planet.gameplay.progression.commissioned,false);
  const high={...base,planet:{...base.planet,position:localToGlobal({x:0,y:240000,z:0}),gameplay:{...base.planet.gameplay,progression:{surveys:['plains','forest','wetland','coast'],commissioned:true}}}};
  runtime.reset(high);assert.equal(runtime.active,true);assert.equal(runtime.legacyActive(),false);
  context.player.yaw=-1.2;context.player.heading=-1.1;context.player.pitch=-.8;
  const saved=runtime.save({...legacy,player:{...context.player}});assert.equal(saved.player.z,190);assert.equal(saved.planet.position.x,360000);
  runtime.reset(saved);assert.equal(runtime.position.x,360000);
  assert.equal(context.player.yaw,-1.2);assert.equal(context.player.pitch,-.8);assert.equal(context.player.heading,-1.1);
  context.player={x:0,y:0,z:190,yaw:0,pitch:0};runtime.rescue();assert.equal(runtime.active,false);assert.equal(runtime.legacyActive(),true);
  const back=runtime.field.surfacePoint({x:-1,y:0,z:0}),support=runtime.prepare(back);
  assert.equal(support.ready,true);
  const distant={...saved,planet:{...saved.planet,position:support.position,gameplay:{version:1,energy:100,progression:{surveys:['plains','forest','wetland','coast'],commissioned:true}}}};
  runtime.reset(distant);assert.equal(runtime.legacyActive(),false);assert.equal(runtime.radialFrame(),true);
  const before={...runtime.position};runtime.step({forward:true},1/60);
  assert.ok(runtime.position.x<0,'backside must stay on the backside');
  assert.ok(Math.hypot(runtime.position.x-before.x,runtime.position.y-before.y,runtime.position.z-before.z)>0,'backside ground movement must advance');
 }finally{runtime.dispose();}
});
