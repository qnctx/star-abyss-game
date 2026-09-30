import test from 'node:test';import assert from 'node:assert/strict';
import {aerialFootwork} from '../src/aerial-footwork.mjs';
import {flightControls,createFlight,stepFlight} from '../src/planet-gameplay/index.mjs';
const world={id:'footwork',radius:120000,sample:p=>({ready:true,altitude:p.y,agl:p.y,grounded:false,waterDepth:0}),advance:(p,d)=>({x:p.x+d.east,y:p.y+d.up,z:p.z-d.north}),sweep:()=>({ready:true,clear:true})};
test('close aerial W has controllable sub-metre 0.2s travel; Shift deliberately exits footwork',()=>{
 const p={x:0,y:12,z:0},foes=[{x:0,y:12,z:-1.3,alive:true}],controls={forward:true};
 const precise=aerialFootwork(controls,p,foes);assert.equal(precise.precision,true);
 const state=createFlight(p);state.active=true;for(let i=0;i<12;i++)stepFlight(state,flightControls(precise),1/60,true,world,{realm:4});
 assert.ok(-state.position.z>.4&&-state.position.z<.8);assert.ok(state.speed<=5);
 const escape=aerialFootwork({...controls,sprint:true},p,foes);assert.equal(escape.precision,undefined);stepFlight(state,flightControls(escape),.05,true,world,{realm:4});assert.ok(state.speed>5);assert.equal(state.boosting,true);
});
test('footwork ignores distant, vertical-separated and dead targets, with Ctrl precise flight anywhere',()=>{
 const p={x:0,y:12,z:0},c={forward:true};for(const e of [{x:20,y:12,z:0},{x:0,y:30,z:0},{x:0,y:12,z:1,alive:false}])assert.equal(aerialFootwork(c,p,[e]),c);
 assert.equal(aerialFootwork({...c,walk:true},p,[]).precision,true);
});
