import test from 'node:test';
import assert from 'node:assert/strict';
import {createFlight,stepFlight,flightEnvelope,FLIGHT_RULES} from '../src/planet-gameplay/flight.mjs';

const ground=x=>Math.max(0,x*.8);
const fixture=(slope=false)=>({
 id:'descent-r5',radius:120000,
 sample:p=>{const floor=slope?ground(p.x):0,agl=p.y-floor;return {ready:true,altitude:p.y,agl,grounded:agl<=.001,waterDepth:0};},
 advance:(p,d)=>{const x=p.x+d.east,floor=slope?ground(x):0,y=p.y+d.up;
   return {x,y:!slope||Math.abs(d.east)<1e-6?Math.max(floor,y):y,z:p.z+d.north};},
 sweep:(from,to)=>{if(!slope)return {ready:true,clear:true};
   for(let i=0;i<=32;i++){const t=i/32,x=from.x+(to.x-from.x)*t,y=from.y+(to.y-from.y)*t;if(y<ground(x)-1e-5)return {ready:true,clear:false};}
   return {ready:true,clear:true};},
});
const flying=height=>{const state=createFlight({x:0,y:height,z:0});state.active=true;return state;};

test('braking-distance envelope reaches ground in practical time at 30 and 200 metres across frame rates',t=>{
 for(const dt of [1/30,1/60,1/120])for(const height of [30,200]){
   const world=fixture(),state=flying(height);let elapsed=0,previous=height;
   while(state.active&&elapsed<15){const result=stepFlight(state,{descend:true},dt,true,world);elapsed+=dt;
     assert.notEqual(result.reason,'collision');assert.notEqual(result.reason,'unsafe-surface');
     assert(state.position.y<=previous+1e-8);assert(state.position.y>=0);
     assert(-state.verticalSpeed<=FLIGHT_RULES.descent+1e-8);previous=state.position.y;
   }
   assert.equal(state.active,false,`${height} m at ${dt} s`);
   assert.equal(state.position.y,0);
   const [minimum,maximum]=height===30?[3,5]:[7,10];
   assert(elapsed>=minimum&&elapsed<=maximum,`${height} m at ${dt} s: ${elapsed.toFixed(2)} s`);
   t.diagnostic(`${height} m at ${Math.round(1/dt)} FPS: ${elapsed.toFixed(2)} s`);
   assert.equal(stepFlight(state,{descend:true},dt,true,world).reason,'ground');
 }
 assert(flightEnvelope(fixture().sample({x:0,y:30,z:0}),120000).descent>15);
 assert(flightEnvelope(fixture().sample({x:0,y:200,z:0}),120000).descent>45);
});

test('overspeed near ground uses vertical braking and cannot bounce or penetrate',()=>{
 for(const dt of [1/30,1/60,1/120]){
   const world=fixture(),state=flying(30);state.verticalSpeed=-FLIGHT_RULES.descent;
   const before=state.verticalSpeed;stepFlight(state,{descend:true},dt,true,world);
   assert(state.verticalSpeed>before);
   assert(state.verticalSpeed-before<=FLIGHT_RULES.verticalBraking*dt+1e-8);
   let previous=state.position.y;
   for(let i=0;i<3000&&state.active;i++){
     stepFlight(state,{descend:true},dt,true,world);
     assert(state.position.y>=0);assert(state.position.y<=previous+1e-8);previous=state.position.y;
   }
   assert.equal(state.active,false);assert.equal(state.position.y,0);
 }
});

test('steep rising terrain blocks horizontal descent and retains a safe landing path',()=>{
 for(const dt of [1/30,1/60,1/120]){
   const world=fixture(true),state=flying(30);let blocked=false;
   for(let i=0;i<100&&!blocked&&state.active;i++){
     const before={...state.position},result=stepFlight(state,{east:1,descend:true},dt,true,world);
     blocked=result.reason==='collision';
     assert(world.sample(state.position).agl>=-1e-5);
     if(blocked)assert.deepEqual(state.position,before,'collision must not commit a penetrating endpoint');
   }
   assert(blocked,'steep slope should stop the diagonal descent before penetration');
   for(let i=0;i<1000&&state.active;i++){
     const result=stepFlight(state,{descend:true},dt,true,world);
     assert.notEqual(result.reason,'unsafe-surface');
     assert(world.sample(state.position).agl>=-1e-5);
   }
   assert.equal(state.active,false);
   assert(Math.abs(world.sample(state.position).agl)<1e-5);
 }
});
