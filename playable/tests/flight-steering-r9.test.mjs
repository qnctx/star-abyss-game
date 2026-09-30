import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlight, stepFlight, chaseCameraPosition, applyFlightKnockback, FLIGHT_RULES } from '../src/planet-gameplay/flight.mjs';
import { createRuntimeWorld } from '../src/planet-gameplay/runtime-world.mjs';
import { toCartesian, length } from '../src/planet/coordinates.mjs';
import {flightControls} from '../src/planet-gameplay/index.mjs';

const flat = { id: 'steering', radius: 120000,
  sample: p => ({ ready: true, altitude: p.y, agl: p.y, waterDepth: 0, grounded: p.y <= .001 }),
  advance: (p, d) => ({ x: p.x + d.east, y: Math.max(0, p.y + d.up), z: p.z + d.north }),
  sweep: () => ({ ready: true, clear: true }) };
function fast() {
  const state = createFlight({ x: 0, y: 350, z: 0 });
  Object.assign(state, { active: true, northSpeed: 1500, eastSpeed: 0, speed: 1500 });
  return state;
}
test('held Shift+A/D preserves bank after steering settles, blends reversal and freezes on zero dt',()=>{
 const s=createFlight({x:0,y:1600,z:0});s.active=true;
 for(const forward of [false,true]){
   for(const side of ['left','right']){
     const c=flightControls({[side]:true,forward,sprint:true});let previous=s.turnBank;
     for(let i=0;i<240;i++){stepFlight(s,c,1/60,true,flat,{realm:4});assert.ok(Math.abs(s.turnBank-previous)<.15);previous=s.turnBank;}
     assert.ok(s.boosting);assert.ok(side==='left'?s.turnBank<-.6:s.turnBank>.6);
     const before=structuredClone(s);stepFlight(s,c,0,true,flat,{realm:4});assert.deepEqual(s,before);
   }
 }
 for(let i=0;i<240;i++)stepFlight(s,flightControls({forward:true,sprint:true}),1/60,true,flat,{realm:4});
 assert.ok(Math.abs(s.turnBank)<.01);assert.ok(s.boosting);
});
function turn(fps) {
  const state = fast(), dt = 1 / fps;
  let camera = null, previousHeading = Math.PI / 2, previousPosition = { ...state.position };
  for (let i = 0; i < fps * 2; i++) {
    const result = stepFlight(state, { east: 1, boost: true }, dt, true, flat, { realm: 9 });
    assert.equal(result.reason, 'flight');
    assert.ok(state.speed >= 1499 && state.speed <= 1500.0001, `speed dip at ${fps} FPS: ${state.speed}`);
    const heading = Math.atan2(state.northSpeed, state.eastSpeed);
    assert.ok(heading <= previousHeading + 1e-8, 'side steering turns monotonically');
    assert.ok(previousHeading - heading <= FLIGHT_RULES.maxTurnRate * dt + 1e-8, 'heading has a per-frame angular bound');
    assert.ok(Math.hypot(state.position.x - previousPosition.x, state.position.z - previousPosition.z) <= state.speed * dt + .001);
    camera = chaseCameraPosition(camera, state.position, dt);
    assert.ok(Math.hypot(camera.x - state.position.x, camera.z - state.position.z) <= 1.50001);
    previousHeading = heading; previousPosition = { ...state.position };
  }
  return { x: state.position.x, z: state.position.z, heading: previousHeading, bank: state.turnBank };
}

test('R9 full-speed A/D steering keeps speed and camera continuous at 30/60/120 FPS', () => {
  const outcomes = [30, 60, 120].map(turn);
  for (const outcome of outcomes) {
    assert.ok(outcome.x > 1000 && outcome.z > 1000, `arc ${JSON.stringify(outcome)}`);
    assert.ok(outcome.heading > 0 && outcome.heading < Math.PI / 2);
    assert.ok(outcome.bank > 0 && outcome.bank <= 1);
  }
  assert.ok(Math.hypot(outcomes[0].x - outcomes[2].x, outcomes[0].z - outcomes[2].z) < 25,
    `frame-rate paths diverged: ${JSON.stringify(outcomes)}`);
});

test('rapid opposite A/D requests rotate through bounded angles without speed collapse', () => {
  const state = fast(), dt = 1 / 60;
  let previous = Math.atan2(state.northSpeed, state.eastSpeed);
  for (let i = 0; i < 180; i++) {
    const side = i % 24 < 12 ? 1 : -1;
    stepFlight(state, { east: side, boost: true }, dt, true, flat, { realm: 9 });
    const heading = Math.atan2(state.northSpeed, state.eastSpeed);
    const delta = Math.atan2(Math.sin(heading - previous), Math.cos(heading - previous));
    assert.ok(Math.abs(delta) <= FLIGHT_RULES.maxTurnRate * dt + 1e-8);
    assert.ok(state.speed > 1499, `speed collapsed on alternating A/D: ${state.speed}`);
    assert.ok(Number.isFinite(state.turnBank) && Math.abs(state.turnBank) <= 1);
    previous = heading;
  }
});

function sphere({ loaded = () => true, solidSweep = () => ({ ready: true, clear: true }) } = {}) {
  return createRuntimeWorld({ field: { planet: { id: 'steering-globe', seed: 'r9', radius: 120000 }, maxSurfaceHeight: 0,
    sampleSurface: () => ({ height: 0, waterHeight: null, slope: 0 }) }, loaded, solidSweep });
}

test('canonical aerial knockback sweeps a real sphere and rejects wall/unloaded segments without mutation', () => {
  const state = createFlight(toCartesian({ lat: 0, lon: 0, height: 30 })); state.active = true; state.energy = 63;
  const before = structuredClone(state);
  const pending = sphere({ loaded: p => p.z > -3 });
  assert.equal(applyFlightKnockback(state, { east: 5, north: 0, up: 0 }, pending).reason, 'terrain-pending');
  assert.deepEqual(state, before);
  const wall = sphere({ solidSweep: () => ({ ready: true, clear: false }) });
  assert.equal(applyFlightKnockback(state, { east: 5, north: 0, up: 0 }, wall).reason, 'blocked');
  assert.deepEqual(state, before);
  assert.equal(applyFlightKnockback(state, { east: 13, north: 0, up: 0 }, sphere()).reason, 'invalid-displacement');
  assert.deepEqual(state, before);
  const moved = applyFlightKnockback(state, { east: 5, north: 0, up: 0 }, sphere());
  assert.equal(moved.ok, true);
  assert.equal(moved.landed, false);
  assert.ok(Math.abs(length(state.position) - 120030) < .01);
  assert.equal(state.energy, before.energy);
  assert.equal(state.abilityTime, before.abilityTime);
});
