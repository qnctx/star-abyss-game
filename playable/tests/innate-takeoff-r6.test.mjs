import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPlanetRuntime} from '../src/planet-runtime.mjs';
import {createMobility,serializeMobility} from '../src/mobility.mjs';
import {routeInnateTakeoff} from '../src/innate-takeoff.mjs';
import {SURVEY_ROUTE} from '../src/planet-gameplay/progression.mjs';
import {createFlight,stepFlight} from '../src/planet-gameplay/flight.mjs';
import {innateFlightBasePose} from '../src/avatar.mjs';
import {restingPose} from '../src/authored-motion.mjs';
import {createYuanYingFlightAnimator} from '../src/yuan-ying-flight-pose.mjs';

const makeRuntime=realm=>{
 const context={player:{x:0,y:0,z:190,yaw:0,heading:0,pitch:0,posture:'stand'},story:{flags:{complete:true}},mobility:createMobility(),realm};
 context.mobility.vehicle.repaired=true;
 const runtime=createPlanetRuntime({world:{scene:new THREE.Scene(),setPlanetController(){}},getContext:()=>context,toast(){}});
 const legacy={version:1,player:{...context.player},story:context.story,mobility:serializeMobility(context.mobility)};
 runtime.reset(legacy);
 const base=runtime.save(legacy);
 const ready={...base,planet:{...base.planet,gameplay:{...base.planet.gameplay,progression:{surveys:[...SURVEY_ROUTE],commissioned:true}}}};
 runtime.reset(ready);
 return {context,runtime,ready};
};

test('real basin runtime keeps Space as ground jump and launches G with legacy thrust cleared',()=>{
 const{context,runtime,ready}=makeRuntime(4);
 try{
  assert.equal(runtime.flightUnlocked(),true);
  const space=routeInnateTakeoff({jump:true,lift:false},{unlocked:runtime.flightUnlocked()});
  assert.equal(space.redirected,false);assert.equal(space.legacy.jump,true);
  assert.equal(runtime.step(space.planet,1/60),false);assert.equal(runtime.active,false);
  runtime.reset(ready);
  Object.assign(context.mobility.flight,{thrusting:true,liftHeld:true,vy:4});
  Object.assign(context.mobility.jump,{held:true,vy:3,time:.2});
  const g=routeInnateTakeoff({jump:false,lift:true},{unlocked:runtime.flightUnlocked()});
  assert.equal(g.redirected,true);assert.equal(g.planet.lift,true);assert.equal(g.legacy.lift,false);
  assert.equal(runtime.step(g.planet,1/60),true);assert.equal(runtime.active,true);
  assert.equal(context.mobility.flight.thrusting,false);
  assert.equal(context.mobility.flight.liftHeld,false);
  assert.equal(context.mobility.jump.held,false);assert.equal(context.mobility.jump.vy,0);
 }finally{runtime.dispose();}
});

test('Space held during real innate flight neither climbs nor starts legacy thrust',()=>{
 const{context,runtime}=makeRuntime(4);
 try{
  assert.equal(runtime.step({lift:true},1/60),true);
  for(let i=0;i<6;i++)runtime.step({},1/60);
  const before=runtime.hud().agl;
  for(let i=0;i<60;i++)assert.equal(runtime.step({jump:true,lift:false},1/60),true);
  assert.equal(runtime.active,true);
  assert.ok(Math.abs(runtime.hud().agl-before)<.001);
  assert.equal(context.mobility.flight.thrusting,false);
  assert.equal(context.mobility.flight.airborne,false);
 }finally{runtime.dispose();}
});

test('realm gate, takeoff restriction and mounted brake leave legacy controls intact',()=>{
 const{runtime}=makeRuntime(0);
 try{
  assert.equal(runtime.flightUnlocked(),false);
  const lowRealm=routeInnateTakeoff({jump:true,lift:false},{unlocked:runtime.flightUnlocked()});
  assert.equal(lowRealm.legacy.jump,true);
  assert.equal(runtime.step(lowRealm.planet,1/60),false);
  assert.equal(runtime.active,false);
  const filtered=routeInnateTakeoff({jump:false,lift:false},{unlocked:true});
  assert.equal(filtered.redirected,false);
  const vehicle=routeInnateTakeoff({jump:false,lift:true},{unlocked:true,mounted:true});
  assert.equal(vehicle.redirected,false);assert.equal(vehicle.legacy.lift,true);
 }finally{runtime.dispose();}
});

test('holding C with G through touchdown does not relaunch until G is released',()=>{
 const world={id:'takeoff-r6',radius:120000,sample:p=>({ready:true,altitude:p.y,agl:p.y,grounded:p.y<=.001,waterDepth:0}),advance:(p,d)=>({x:p.x+d.east,y:Math.max(0,p.y+d.up),z:p.z+d.north}),sweep:()=>({ready:true,clear:true})};
  const flight=createFlight({x:0,y:3,z:0});flight.active=true;
  for(let i=0;i<400&&flight.active;i++)stepFlight(flight,{lift:true,descend:true},1/60,true,world);
  assert.equal(flight.active,false);
  assert.equal(flight.liftHeld,true);
  for(let i=0;i<60;i++)assert.equal(stepFlight(flight,{lift:true,descend:true},1/60,true,world).handled,false);
  assert.equal(flight.active,false);
  stepFlight(flight,{lift:false},1/60,true,world);
  assert.equal(stepFlight(flight,{lift:true},1/60,true,world).handled,true);
});

test('first innate animation frame blends from neutral idle, not the old airborne clip',()=>{
 const stale=restingPose('flight',.35),stalePose={position:stale.position,rotations:stale.rotations.map(q=>q.toArray())};
 const idle=restingPose('idle',0),neutral={position:idle.position,rotations:idle.rotations.map(q=>q.toArray())};
 const base=innateFlightBasePose({pose:stalePose},{active:true},0);
 assert.deepEqual(base,neutral);
 assert.notDeepEqual(base,stalePose);
 assert.equal(innateFlightBasePose({pose:stalePose},{active:false},0),stalePose);
 const animator=createYuanYingFlightAnimator(),flight={active:true,speed:0,agl:10,turnBank:0};
 const first=structuredClone(animator.update(flight,0,1/60,base));
 const staleFirst=createYuanYingFlightAnimator().update(flight,0,1/60,stalePose);
 assert.notDeepEqual(first,staleFirst);
});
