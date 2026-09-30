import test from 'node:test';
import assert from 'node:assert/strict';
import {createFlight,stepFlight,flightEnvelope,cameraEnvelope,chaseCameraPosition,flightAvatarVisible,FLIGHT_RULES} from '../src/planet-gameplay/flight.mjs';
import {createRuntimeWorld} from '../src/planet-gameplay/runtime-world.mjs';
import {createPlanetField} from '../src/planet/field.mjs';
import {toCartesian,unit} from '../src/planet/coordinates.mjs';
import {selectChunks,directionToCube,FACES} from '../src/planet/chunks.mjs';
import {enhancePlanetSurfaceMaterial} from '../src/planet-art/surface-material.mjs';
import * as THREE from 'three';

const surface=p=>({ready:true,altitude:p.y,agl:p.y,grounded:p.y<=.001,waterDepth:0});
const world={id:'star-abyss',radius:120000,sample:surface,advance:(p,d)=>({x:p.x+d.east,y:Math.max(0,p.y+d.up),z:p.z+d.north}),sweep:()=>({ready:true,clear:true})};
function advance(state,seconds,controls){for(let n=0;n<Math.round(seconds/.05);n++)stepFlight(state,controls,.05,true,world);return state;}
const flying=y=>{const s=createFlight({x:0,y,z:0});s.active=true;return s;};

test('real metre-space travel accelerates at low and high altitude, with bounded turns and braking',()=>{
  const low=flying(10),high=flying(350);
  advance(low,1,{north:1});advance(high,1,{north:1});
  assert.ok(low.position.z>35&&low.position.z<60,`low 1s ${low.position.z}`);
  assert.ok(high.position.z>75&&high.position.z<125,`high 1s ${high.position.z}`);
  advance(low,4,{north:1});advance(high,4,{north:1});
  assert.ok(low.position.z>190&&low.position.z<300,`low 5s ${low.position.z}`);
  assert.ok(high.position.z>1300&&high.position.z<1800,`high 5s ${high.position.z}`);
  const before={...high.position},speed=high.speed;
  stepFlight(high,{east:1},.05,true,world);
  assert.ok(high.northSpeed>0&&high.eastSpeed>0&&high.speed<=FLIGHT_RULES.cruiseSpeed+.001,'turn retains momentum without an instant right-angle jump');
  assert.ok(high.turnBank>0&&high.turnBank<=1,'right turn exports a bounded bank cue');
  assert.ok(Math.hypot(high.position.x-before.x,high.position.z-before.z)<=speed*.05+.01);
  advance(high,1.1,{});assert.equal(high.speed,0);
  const parked={...high.position};advance(high,1,{});assert.deepEqual(high.position,parked);
});

test('release settles into hover; descent and 2000m AGL ceiling remain bounded',()=>{
  const state=flying(100);advance(state,2,{lift:true});
  assert.ok(state.verticalSpeed>0);advance(state,1,{});
  assert.equal(state.verticalSpeed,0);const hovered=state.position.y;
  advance(state,2,{});assert.ok(Math.abs(state.position.y-hovered)<1e-8);assert.equal(state.active,true);
  const high=flying(1990);advance(high,5,{lift:true});
  assert.ok(high.position.y<=2000+.00001);assert.ok(high.position.y>=1990);
  advance(high,2,{descend:true});assert.ok(high.position.y<1990);
  assert.equal(flightEnvelope(surface({y:2000}),world.radius).ceiling,2000);
});

test('W remains effective at exactly 2000m AGL across a gently falling surface',()=>{
  const sloped={...world,sample:p=>({...surface(p),agl:p.y+.02*p.x,grounded:false})};
  const state=flying(2000);
  for(let n=0;n<100;n++){
    const result=stepFlight(state,{east:1},.05,true,sloped);
    assert.equal(result.reason,'flight');
    assert.ok(sloped.sample(state.position).agl<=2000+.00001);
  }
  assert.ok(state.position.x>1300,`5s ceiling travel ${state.position.x}`);
  assert.ok(state.speed>400,`ceiling speed ${state.speed}`);
});

test('the real spherical adapter keeps moving at the ceiling over the planet field',()=>{
  const field=createPlanetField();
  const seed=toCartesian({lat:0,lon:0,height:0});
  const ground=field.sampleSurface(unit(seed)).height;
  const state=createFlight(toCartesian({lat:0,lon:0,height:ground+2000}));state.active=true;
  const globe=createRuntimeWorld({field,loaded:()=>true,solidSweep:()=>({ready:true,clear:true})});
  const start={...state.position};
  for(let n=0;n<100;n++)stepFlight(state,{east:1},.05,true,globe);
  const distance=Math.hypot(state.position.x-start.x,state.position.y-start.y,state.position.z-start.z);
  assert.ok(distance>1000,`real field 5s travel ${distance}`);
  assert.ok(globe.sample(state.position).agl<=2000+.00001);
});

test('camera follows smoothly, snaps after relocation, and hides the body in both first-person modes',()=>{
  const near=cameraEnvelope(surface({y:10}),world.radius),high=cameraEnvelope(surface({y:2000}),world.radius);
  assert.ok(near.distance>=4.5&&high.distance<=6.5&&high.distance>near.distance);
  assert.ok(high.near<1&&high.far>high.near);
  const followed=chaseCameraPosition({x:0,y:2,z:0},{x:10,y:2,z:0},1/60);
  assert.ok(followed.x>0&&followed.x<10&&10-followed.x<=1.5);
  assert.deepEqual(chaseCameraPosition(followed,{x:100,y:2,z:0},1/60),{x:100,y:2,z:0});
  assert.equal(flightAvatarVisible('first'),false);
  assert.equal(flightAvatarVisible('vehicle-first'),false);
  assert.equal(flightAvatarVisible('third'),true);
});

test('flight-altitude terrain retains six-face coverage and its distant material composes with Three',()=>{
  const position=toCartesian({lat:0,lon:0,height:2000});
  const chunks=selectChunks(position,{radius:120000,surfaceRadius:120000,segments:32});
  assert.equal(chunks.length,192);
  assert.deepEqual(new Set(chunks.map(c=>c.face)),new Set(FACES));
  const tile=directionToCube(position),support=chunks.find(c=>{const n=2**c.level;return c.face===tile.face&&c.x===Math.min(n-1,Math.floor(tile.u*n))&&c.y===Math.min(n-1,Math.floor(tile.v*n));});
  assert.ok(support&&240000/(2**support.level*32)<=30);
  const material=enhancePlanetSurfaceMaterial(new THREE.MeshStandardMaterial({vertexColors:true}));
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  assert.doesNotThrow(()=>material.onBeforeCompile(shader));
  assert.ok(shader.fragmentShader.includes('planetArtOverviewFade')&&shader.fragmentShader.includes('planetArtRegional'));
  material.dispose();
});
