import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlight, stepFlight, flightEnvelope, FLIGHT_RULES } from '../src/planet-gameplay/flight.mjs';
import { createRuntimeWorld, segmentClearsSurface } from '../src/planet-gameplay/runtime-world.mjs';
import { createPlanetField } from '../src/planet/field.mjs';
import { localToGlobal, toCartesian } from '../src/planet/coordinates.mjs';
const sample = height => ({ ready: true, altitude: height, agl: height, waterDepth: 0, grounded: height <= .001 });
const flat = { id: 'timing-fixture', radius: 120000, sample: p => sample(p.y),
  advance: (p, d) => ({ x: p.x + d.east, y: Math.max(0, p.y + d.up), z: p.z + d.north }),
  sweep: () => ({ ready: true, clear: true }) };
test('AGL envelope rises continuously from launch speed to 2000m ceiling', () => {
  let previous=null;
  for (const agl of [0, 20, 80, 175, 350, 1600, 2000]) {
    const e = flightEnvelope(sample(agl), 120000);
    assert.equal(e.acceleration, FLIGHT_RULES.acceleration); assert.equal(e.verticalAcceleration, FLIGHT_RULES.verticalAcceleration);
    assert.equal(e.ceiling, 2000);assert.equal(e.orbital,0);
    if(previous){assert.ok(e.speed>=previous.speed&&e.climb>=previous.climb);}
    previous=e;
  }
  assert.equal(flightEnvelope(sample(0),120000).speed,FLIGHT_RULES.nearSpeed);
  assert.equal(flightEnvelope(sample(0),120000).climb,FLIGHT_RULES.nearClimb);
  assert.equal(flightEnvelope(sample(350),120000).speed,FLIGHT_RULES.cruiseSpeed);
  assert.equal(flightEnvelope(sample(350),120000).climb,FLIGHT_RULES.cruiseClimb);
  for (const boundary of [0, 350, 2000]) {
    const before = flightEnvelope(sample(boundary - .001), 120000), after = flightEnvelope(sample(boundary + .001), 120000);
    for (const key of ['speed', 'climb', 'descent', 'acceleration', 'verticalAcceleration']) assert.ok(Math.abs(after[key]-before[key]) < .01, `${boundary} ${key}`);
  }
  const mountain = flightEnvelope({ ...sample(40000), agl: 40 }, 120000);
  assert.equal(mountain.speed,flightEnvelope(sample(40),120000).speed);
  assert.equal(mountain.climb,flightEnvelope(sample(40),120000).climb);
});
test('ground to 2000m, hover and controlled descent finish with bounded acceleration', t => {
  const state = createFlight({ x: 0, y: 0, z: 0 });
  let upTime = 0, downTime = 0, maxNearDescent = 0;
  const dt = .05;
  while (state.position.y < FLIGHT_RULES.maxAgl && upTime < 120) {
    const prev = state.verticalSpeed, allowed = flightEnvelope(flat.sample(state.position), flat.radius).verticalAcceleration;
    stepFlight(state, { lift: true }, dt, true, flat); upTime += dt;
    if(state.position.y<FLIGHT_RULES.maxAgl-.001)assert.ok(Math.abs(state.verticalSpeed-prev) <= allowed*dt+1e-8);
  }
  assert.ok(state.position.y>=FLIGHT_RULES.maxAgl-1e-6&&state.position.y<=FLIGHT_RULES.maxAgl);
  for(let i=0;i<20;i++)stepFlight(state,{},dt,true,flat);
  assert.equal(state.position.y,FLIGHT_RULES.maxAgl);assert.equal(state.verticalSpeed,0);
  while (state.active && downTime < 120) {
    const height = state.position.y, prev = state.verticalSpeed, allowed = FLIGHT_RULES.verticalBraking;
    stepFlight(state, {descend:true}, dt, true, flat); downTime += dt;
    if (state.active) assert.ok(Math.abs(state.verticalSpeed-prev) <= allowed*dt+1e-8);
    if (height < 1600) maxNearDescent = Math.max(maxNearDescent, -state.verticalSpeed);
  }
  assert.equal(state.active, false); assert.ok(Math.abs(state.position.y)<1e-6);
  t.diagnostic(JSON.stringify({ upSeconds: +upTime.toFixed(2), downSeconds: +downTime.toFixed(2), totalSeconds: +(upTime+downTime).toFixed(2), maxNearDescent }));
  assert.ok(upTime + downTime < 120, `roundtrip ${upTime+downTime}`);
  assert.ok(maxNearDescent <= FLIGHT_RULES.descent + .1, `near descent ${maxNearDescent}`);
});
test('fast path requires finite declared bound and checks interior chord and strict shell clearance', () => {
  const radius = 120000, bound = 5085, shell = radius+bound+.9;
  const a = { x: shell+100, y: 0, z: 0 }, b = { x: shell+200, y: 10, z: 0 };
  assert.equal(segmentClearsSurface(a,b,radius,bound), true);
  for (const invalid of [null, undefined, NaN, Infinity, -1]) assert.equal(segmentClearsSurface(a,b,radius,invalid), false);
  assert.equal(segmentClearsSurface({ x: shell, y: 0, z: 0 }, { x: shell, y: 0, z: 0 }, radius, bound), false);
  assert.equal(segmentClearsSurface(a, { x: -a.x, y: 0, z: 0 }, radius, bound), false);
  // Endpoints clear the shell; midpoint of the long chord does not.
  assert.equal(segmentClearsSurface({ x: shell-1,y: 1000,z:0 }, { x: shell-1,y:-1000,z:0 }, radius, bound), false);
});
test('proven high-air sweep skips every terrain ray but still obeys blocking or pending solids', () => {
  const field = createPlanetField(); assert.ok(Number.isFinite(field.maxSurfaceHeight));
  for (const status of [{ ready:true, clear:true }, { ready:true, clear:false }, { ready:false, clear:false }]) {
    let loaded = 0, rays = 0, solids = 0;
    const world = createRuntimeWorld({ field, loaded: () => { loaded++; return true; },
      sampleTerrain: (_, raw) => { rays++; return raw; }, solidSweep: () => { solids++; return status; } });
    const from = toCartesian({ lat:0,lon:0,height:240000 }), to = world.advance(from,{ east:100,north:0,up:0 });
    assert.deepEqual(world.sweep(from,to),status); assert.equal(solids,1); assert.equal(loaded,0); assert.equal(rays,0);
  }
});
test('legacy field without proved bound cannot skip missing terrain', () => {
  const field = createPlanetField({ legacyHeight: () => 0 }); assert.equal(field.maxSurfaceHeight, null);
  let solids = 0;
  const world = createRuntimeWorld({ field, loaded: () => false, solidSweep: () => { solids++; return {ready:true,clear:true}; } });
  assert.deepEqual(world.sweep(toCartesian({lat:0,lon:0,height:240000}),toCartesian({lat:0,lon:.0001,height:240000})), {ready:false,clear:false});
  assert.equal(solids,0);
});
test('declared bound does not bypass low-altitude obstacle or missing path data', () => {
  const field = createPlanetField({ legacyHeight: x => Math.abs(x-5)<.5 ? 14 : 0, legacyMaxHeight:14 });
  assert.ok(Number.isFinite(field.maxSurfaceHeight));
  const from = localToGlobal({x:0,y:10,z:0}), to = localToGlobal({x:10,y:10,z:0});
  const world = createRuntimeWorld({ field, loaded: () => true, solidSweep: () => ({ ready:true,clear:true }) });
  assert.equal(world.sweep(from,to).clear, false);
  const missing = createRuntimeWorld({ field, loaded: () => false, solidSweep: () => assert.fail('missing terrain should stop sweep') });
  assert.equal(missing.sweep(from,to).ready, false);
});
test('segment clearance agrees with dense reference chords around the protected shell', () => {
  let seed = 187;
  const random = () => ((seed = Math.imul(seed, 1664525)+1013904223 >>> 0) / 4294967296);
  const radius = 120000, bound = 5085, shell = radius+bound+.9;
  for (let i = 0; i < 200; i++) {
    const a = toCartesian({ lat: (random()-.5)*Math.PI, lon: random()*Math.PI*2, height: random()*100000 });
    const b = toCartesian({ lat: (random()-.5)*Math.PI, lon: random()*Math.PI*2, height: random()*100000 });
    if (!segmentClearsSurface(a,b,radius,bound)) continue;
    for (let j = 0; j <= 1000; j++) {
      const t = j/1000;
      assert.ok(Math.hypot(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t) > shell);
    }
  }
});
test('2000m descent lands safely across frame rates and power states', () => {
  for (const dt of [1/120, 1/60, .05]) for (const powered of [true, false]) {
    const s = createFlight({x:0,y:2000,z:0}); s.active = true; s.verticalSpeed = -FLIGHT_RULES.descent; s.energy = powered?100:0;
    let frames = 0;
    while (s.active && frames++ < 120/dt) {
      const previousHeight = s.position.y;
      stepFlight(s, powered?{descend:true}:{}, dt, true, flat);
      assert.ok(s.position.y <= previousHeight);
      assert.ok(-s.verticalSpeed <= FLIGHT_RULES.descent+.1, `${dt} ${s.position.y} ${s.verticalSpeed}`);
      assert.ok(s.position.y >= 0);
    }
    assert.equal(s.active,false); assert.ok(Math.abs(s.position.y)<1e-6);
    if(!powered)assert.equal(s.energy,0);
  }
});
test('spherical adapter fast path stays collision safe for out-of-range restored altitude', () => {
  const field = createPlanetField({legacyHeight:()=>0,legacyMaxHeight:0});
  let rays = 0, solids = 0;
  const w = createRuntimeWorld({field,loaded:()=>true,sampleTerrain:(_,raw)=>{rays++;return raw;},
    solidSweep:()=>{solids++;return {ready:true,clear:true};}});
  const s = createFlight(toCartesian({lat:0,lon:0,height:240000}));s.active=true;s.speed=2000;s.verticalSpeed=-2000;
  const result = stepFlight(s,{east:1},.05,true,w);
  assert.equal(result.reason,'flight');assert.equal(solids,1);assert.ok(rays<=3, `rays ${rays}`);
  assert.ok(w.sample(s.position).altitude < 240000);
});
