import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlanetField } from '../src/planet/field.mjs';
import { DEFAULT_PLANET, toCartesian, toGeodetic, localToGlobal, globalToLocal, tangentFrame } from '../src/planet/coordinates.mjs';
import { createRuntimeWorld } from '../src/planet-gameplay/runtime-world.mjs';
import { createFlight, stepFlight } from '../src/planet-gameplay/flight.mjs';
import { restorePlanet, attachPlanet, restoreSurfaceVehicle } from '../src/planet-gameplay/save.mjs';
import { flightControls } from '../src/planet-gameplay/index.mjs';
const make = (extra = {}) => createRuntimeWorld({ field: createPlanetField({ legacyHeight: () => 7 }), loaded: () => true,
  solidSweep: () => ({ ready: true, clear: true }), ...extra });
test('runtime adapter requires real stream and solid readiness callbacks', () => {
  assert.throws(() => createRuntimeWorld({ field: createPlanetField() }));
  const w = make({ loaded: () => false });
  assert.equal(w.sample(toCartesian({ lat: 0, lon: 0 })).ready, false);
});
test('actual field preserves old basin contact and dry ground sample', () => {
  const w = make();
  for (const x of [-2900, 0, 2900]) for (const z of [-2900, 0, 2900]) {
    const position = w.legacyToCanonical({ x, y: 7, z }), s = w.sample(position);
    assert.ok(Math.abs(s.agl) < 1e-5); assert.equal(s.grounded, true); assert.equal(s.biome, 'basin');
    const back = globalToLocal(position);
    assert.ok(Math.hypot(back.x-x, back.y-7, back.z-z) < 1e-6);
  }
});
test('local tangent east and north remain continuous across longitude seam and near pole', () => {
  const w = make();
  for (const lat of [0, Math.PI / 2 - 1e-6]) {
    const p = toCartesian({ lat, lon: Math.PI-1e-7, height: 9000 });
    const q = w.advance(p, { east: 20, north: 4, up: 3 });
    assert.ok(Math.abs(toGeodetic(q).height-9003) < 1e-6);
    assert.ok(Math.hypot(q.x-p.x,q.y-p.y,q.z-p.z) < 21);
    assert.equal(w.sweep(p, q).clear, true);
  }
});
test('radial movement does not accumulate tangent-plane altitude error', () => {
  const w = make(); let p = toCartesian({ lat: .4, lon: 1, height: 9000 });
  for (let i = 0; i < 2000; i++) p = w.advance(p, { east: 20, north: 0, up: 0 });
  assert.ok(Math.abs(toGeodetic(p).height-9000) < 1e-5);
});
test('sweep refuses original solids, missing path chunks and terrain ridge between endpoints', () => {
  const start = localToGlobal({ x: 0, y: 10, z: 0 }), end = localToGlobal({ x: 10, y: 10, z: 0 });
  assert.equal(make({ solidSweep: () => ({ ready: true, clear: false }) }).sweep(start, end).clear, false);
  assert.equal(make({ loaded: p => Math.abs(globalToLocal(p).x-5) > .5 }).sweep(start, end).ready, false);
  const field = createPlanetField({ legacyHeight: (x) => Math.abs(x-5) < .5 ? 14 : 0 });
  assert.equal(make({ field }).sweep(start, end).clear, false);
});
test('actual spherical field supports takeoff, descent and contact without changing legacy body', () => {
  const w = make(), s = createFlight(w.legacyToCanonical({ x: 0, y: 7, z: 0 }));
  for (let i = 0; i < 40; i++) assert.equal(stepFlight(s, { lift: true }, .05, true, w).reason, 'flight');
  assert.ok(w.sample(s.position).agl > 3);
  for (let i = 0; i < 180 && s.active; i++) stepFlight(s, {descend:true}, .05, true, w);
  assert.equal(s.active, false); assert.ok(Math.abs(w.sample(s.position).agl) < .015);
});
test('unready destination halts actual flight before crossing chunk boundary', () => {
  const w = make({ loaded: p => globalToLocal(p).x < 1 });
  const s = createFlight(localToGlobal({ x: 0, y: 2000, z: 0 })); s.active = true;
  s.speed = 420; s.eastSpeed = 420; // A moving flight needs its authoritative velocity vector.
  const start = { ...s.position };
  assert.equal(stepFlight(s, { east: 1, lift: true }, .05, true, w).reason, 'terrain-pending');
  assert.deepEqual(s.position, start);
});
test('spherical canonical save reload survives far origin and architecture envelope', () => {
  const w = make(), p = toCartesian({ lat: .7, lon: -2.8, height: 12000 });
  const legacy = { version: 1, player: { x: 12, y: 7, z: 24 }, story: { original: 'kept' },
    planet: { version: 1, id: DEFAULT_PLANET.id, seed: DEFAULT_PLANET.seed, radius: DEFAULT_PLANET.radius, position: p, architectureExtra: 55 } };
  const restored = restorePlanet(legacy, {}, w, w.legacyToCanonical);
  assert.equal(restored.status, 'restored'); assert.equal(restored.flight.active, true);
  const encoded = attachPlanet(legacy, restored, w);
  assert.equal(encoded.planet.architectureExtra, 55); assert.deepEqual(encoded.player, legacy.player);
  const roundtrip = restorePlanet(JSON.parse(JSON.stringify(encoded)), {}, w, w.legacyToCanonical);
  assert.deepEqual(roundtrip.flight.position, p); assert.equal(roundtrip.flight.liftHeld, false);
});
test('negative legacy basin is dry and supports launch and landing below sea level', () => {
  const w = make({ field: createPlanetField({ legacyHeight: () => -20 }) });
  const p = w.legacyToCanonical({ x: 0, y: -20, z: 0 }), surface = w.sample(p);
  assert.equal(surface.waterDepth, 0); assert.equal(surface.grounded, true); assert.equal(surface.agl, 0);
  const s = createFlight(p);
  for (let i = 0; i < 20; i++) stepFlight(s, { lift: true }, .05, true, w);
  for (let i = 0; i < 100 && s.active; i++) stepFlight(s, {descend:true}, .05, true, w);
  assert.equal(s.active, false); assert.ok(Math.abs(w.sample(s.position).agl) < .015);
});
test('surface vehicle snapshot carries canonical parking position, physical yaw, battery and mounted state', () => {
  const w = make(), p = w.legacyToCanonical({ x: 45, y: 7, z: 64 });
  const context = { mobility: { vehicle: { repaired: true } } };
  const surfaceVehicle = { position: p, yaw: 2, battery: 43, mounted: true };
  const saved = attachPlanet({ version: 1 }, { status: 'active', progression: { surveys: [], commissioned: false }, flight: createFlight(p), surfaceVehicle }, w);
  const restored = restorePlanet(JSON.parse(JSON.stringify(saved)), context, w, w.legacyToCanonical);
  assert.deepEqual(restored.surfaceVehicle, surfaceVehicle);
  assert.equal(restored.flight.active, false);
  assert.equal(restoreSurfaceVehicle(surfaceVehicle, {}, w).value.mounted, false);
  assert.equal(restoreSurfaceVehicle({ ...surfaceVehicle, battery: NaN }, context, w).status, 'invalid');
  assert.equal(restoreSurfaceVehicle(surfaceVehicle, context, make({ loaded: () => false })).status, 'pending');
  const inconsistent = structuredClone(saved); inconsistent.planet.position = w.legacyToCanonical({ x: 90, y: 7, z: 64 });
  assert.equal(restorePlanet(inconsistent, context, w, w.legacyToCanonical).status, 'unsafe');
});
test('legacy yaw converts forward/strafe to the actual tangent axes', () => {
  assert.deepEqual(flightControls({ forward: true }, 0), { east: 0, north: 1, lift: false,descend:false,boost:false });
  assert.equal(flightControls({forward:true,sprint:true},0).boost,true);
  const right = flightControls({ right: true }, 0); assert.equal(right.east, 1); assert.equal(right.north, 0);
  assert.ok(Math.abs(flightControls({ forward: true }, Math.PI / 2).east + 1) < 1e-10);
});
