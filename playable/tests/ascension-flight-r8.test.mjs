import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlight, stepFlight, flightEnvelope, previewAscensionStep, commitAscensionStep, advanceFlightAbilityTime, FLIGHT_RULES } from '../src/planet-gameplay/flight.mjs';
import { flightControls } from '../src/planet-gameplay/index.mjs';
import { ASCENSION_RULES, blinkRules } from '../src/planet-gameplay/ascension-rules.mjs';
import { createRuntimeWorld } from '../src/planet-gameplay/runtime-world.mjs';
import { createProgression } from '../src/planet-gameplay/progression.mjs';
import { attachPlanet, restorePlanet } from '../src/planet-gameplay/save.mjs';
import { toCartesian, length } from '../src/planet/coordinates.mjs';

const RADIUS = 120000;
function sphere({ loaded = () => true, solidSweep = () => ({ ready: true, clear: true }), height = 0 } = {}) {
  return createRuntimeWorld({ field: { planet: { id: 'r8-test', seed: 'r8', radius: RADIUS }, maxSurfaceHeight: 100,
    sampleSurface: () => ({ height, waterHeight: null, slope: 0, biomes: { plain: 1 } }) }, loaded, solidSweep });
}
const at = height => createFlight(toCartesian({ lat: 0, lon: 0, height }));
const request = (mode = 'short', distance) => ({ mode, east: 1, north: 0, ...(distance ? { distance } : {}) });
const clone = state => structuredClone(state);

test('R4 stays 48→420; R4–R9 boost and cruise caps taper smoothly near ground', () => {
  const sample = agl => ({ ready: true, agl, altitude: agl, waterDepth: 0 });
  for (const [realm, rules] of Object.entries(ASCENSION_RULES)) {
    assert.equal(flightEnvelope(sample(0), RADIUS, { realm: +realm }).speed, 48);
    assert.equal(flightEnvelope(sample(0), RADIUS, { realm: +realm, boost: true }).speed, 48);
    assert.equal(flightEnvelope(sample(350), RADIUS, { realm: +realm }).speed, rules.cruise);
    assert.equal(flightEnvelope(sample(350), RADIUS, { realm: +realm, boost: true }).speed, rules.boost);
    assert.ok(flightEnvelope(sample(20), RADIUS, { realm: +realm, boost: true }).speed < rules.boost * .1);
  }
  assert.equal(flightEnvelope(sample(2000), RADIUS, { realm: 9, boost: true }).ceiling, 2000);
  assert.equal(flightEnvelope(sample(30), RADIUS, { realm: 9, boost: true }).descent,
    flightEnvelope(sample(30), RADIUS).descent);
  assert.deepEqual(flightControls({ sprint: true, lift: false, jump: true }),
    { east: 0, north: 0, lift: false, descend: false, boost: true });
});

test('boost uses separate flight energy; low energy falls back to realm cruise', () => {
  const world = { id: 'flat', radius: RADIUS, sample: p => ({ ready: true, altitude: p.y, agl: p.y,
    waterDepth: 0, grounded: false }), advance: (p, d) => ({ x: p.x + d.east, y: p.y + d.up, z: p.z + d.north }),
    sweep: () => ({ ready: true, clear: true }) };
  const normal = createFlight({ x: 0, y: 350, z: 0 }); normal.active = true;
  const boosted = clone(normal);
  for (let i = 0; i < 80; i++) {
    stepFlight(normal, { east: 1 }, .05, true, world, { realm: 9 });
    stepFlight(boosted, { east: 1, boost: true }, .05, true, world, { realm: 9 });
  }
  assert.ok(boosted.speed > normal.speed && boosted.energy < normal.energy - 5);
  assert.equal(normal.boosting, false);
  assert.equal(boosted.boosting, true);
  stepFlight(boosted, { east: 1 }, .05, true, world, { realm: 9 });
  assert.equal(boosted.boosting, false, 'release clears actual boost in the same tick');
  stepFlight(boosted, { boost: true }, .05, true, world, { realm: 9 });
  assert.equal(boosted.boosting, false, 'Shift alone does not boost while coasting');
  const low = createFlight({ x: 0, y: 350, z: 0 }); low.active = true; low.energy = FLIGHT_RULES.boostMinEnergy - .01;
  stepFlight(low, { east: 1, boost: true }, .05, true, world, { realm: 9 });
  assert.equal(low.boosting, false);
  assert.ok(Math.abs(low.energy - (FLIGHT_RULES.boostMinEnergy - .01 - FLIGHT_RULES.drain * .05)) < 1e-8);
});

test('boost visual state clears on collision and landing and is never saved', () => {
  const airborne = at(100); airborne.active = true;
  const clearWorld = sphere();
  stepFlight(airborne, { east: 1, boost: true }, .05, true, clearWorld, { realm: 6 });
  assert.equal(airborne.boosting, true);
  const blockedWorld = sphere({ solidSweep: () => ({ ready: true, clear: false }) });
  assert.equal(stepFlight(airborne, { east: 1, boost: true }, .05, true, blockedWorld, { realm: 6 }).reason, 'collision');
  assert.equal(airborne.boosting, false);
  const flat = { id: 'flat', radius: RADIUS, sample: p => ({ ready: true, altitude: p.y, agl: p.y,
    waterDepth: 0, grounded: p.y <= .001 }), advance: (p, d) => ({ x: p.x + d.east, y: Math.max(0, p.y + d.up), z: p.z + d.north }),
    sweep: () => ({ ready: true, clear: true }) };
  const landing = createFlight({ x: 0, y: .1, z: 0 }); landing.active = true; landing.verticalSpeed = -10;
  assert.equal(stepFlight(landing, { east: 1, boost: true, descend: true }, .05, true, flat, { realm: 6 }).reason, 'landed');
  assert.equal(landing.boosting, false);
  const saved = attachPlanet({}, { status: 'active', progression: createProgression(), flight: landing }, clearWorld);
  assert.equal('boosting' in saved.planet.gameplay, false);
});

test('spherical R6 short and R9 long advance through real adapter and commit once', () => {
  let sweeps = 0;
  const world = sphere({ solidSweep: () => { sweeps++; return { ready: true, clear: true }; } });
  const state = at(100);
  const short = previewAscensionStep(state, request(), world, { realm: 6 });
  assert.equal(short.ok, true, short.reason);
  assert.equal(sweeps, 1);
  assert.deepEqual(state, at(100), 'preview must not mutate');
  const accepted = commitAscensionStep(state, short.ticket, world, { realm: 6 });
  assert.equal(accepted.ok, true, accepted.reason);
  assert.ok(Math.abs(length(state.position) - (RADIUS + 100)) < .01);
  assert.equal(state.energy, 88);
  assert.equal(state.blinkCooldownUntil, 8);
  assert.equal(state.blinkSerial, 1);
  assert.equal(commitAscensionStep(state, short.ticket, world, { realm: 6 }).reason, 'stale-preview');
  state.abilityTime = 9;
  const far = previewAscensionStep(state, request('long'), world, { realm: 9 });
  assert.equal(far.ok, true, far.reason);
  assert.ok(sweeps >= 77, `long geodesic must segment and sweep, got ${sweeps}`);
  assert.equal(commitAscensionStep(state, far.ticket, world, { realm: 9 }).ok, true);
  assert.ok(Math.abs(length(state.position) - (RADIUS + 100)) < .01);
});

test('wall, pending chunk, unsafe surface, energy and cooldown reject without mutation', () => {
  const base = at(10);
  const blocked = sphere({ solidSweep: (a, b) => ({ ready: true, clear: b.z > -6 }) });
  assert.equal(previewAscensionStep(base, request(), blocked, { realm: 6 }).reason, 'blocked');
  assert.deepEqual(base, at(10));
  const pending = sphere({ loaded: p => p.z >= -6 });
  assert.equal(previewAscensionStep(base, request(), pending, { realm: 6 }).reason, 'terrain-pending');
  const unsafe = sphere({ height: 20 });
  assert.equal(previewAscensionStep(base, request(), unsafe, { realm: 6 }).reason, 'unsafe-surface');
  base.energy = blinkRules(6, 'short').energy - 1;
  assert.equal(previewAscensionStep(base, request(), sphere(), { realm: 6 }).reason, 'insufficient-energy');
  base.energy = 100; base.blinkCooldownUntil = 5; base.abilityTime = 4.9;
  assert.equal(previewAscensionStep(base, request(), sphere(), { realm: 6 }).reason, 'cooldown');
  assert.deepEqual(base.position, at(10).position);
  assert.equal(previewAscensionStep(base, request('long'), sphere(), { realm: 5 }).reason, 'realm-locked');
  assert.equal(previewAscensionStep(base, request('short', 13), sphere(), { realm: 6 }).reason, 'distance-limit');
});

test('confirm revalidates changed streaming and preserves state on failure', () => {
  let ready = true;
  const world = sphere({ loaded: () => ready });
  const state = at(20);
  const preview = previewAscensionStep(state, request(), world, { realm: 6 });
  assert.equal(preview.ok, true);
  const before = clone(state);
  ready = false;
  assert.equal(commitAscensionStep(state, preview.ticket, world, { realm: 6 }).reason, 'terrain-pending');
  assert.deepEqual(state, before);
  ready = true;
  assert.equal(commitAscensionStep(state, preview.ticket, world, { realm: 6 }).ok, true);
});

test('ability time and cooldown survive save/restore, old v1 saves migrate to zero', () => {
  const world = sphere();
  const state = at(100);
  state.abilityTime = 15.5; state.blinkCooldownUntil = 18; state.blinkSerial = 7;
  const session = { status: 'active', progression: createProgression(), flight: state };
  const encoded = attachPlanet({ version: 1, custom: 'keep' }, session, world);
  assert.equal(encoded.custom, 'keep');
  const restored = restorePlanet(encoded, {}, world, () => { throw new Error('legacy converter'); });
  assert.equal(restored.status, 'restored');
  assert.equal(restored.flight.abilityTime, 15.5);
  assert.equal(restored.flight.blinkCooldownUntil, 18);
  assert.equal(restored.flight.blinkSerial, 7);
  const old = structuredClone(encoded); delete old.planet.gameplay.abilityTime;
  delete old.planet.gameplay.blinkCooldownUntil; delete old.planet.gameplay.blinkSerial;
  const migrated = restorePlanet(old, {}, world, () => { throw new Error('legacy converter'); });
  assert.equal(migrated.status, 'restored');
  assert.equal(migrated.flight.abilityTime, 0);
  assert.equal(migrated.flight.blinkCooldownUntil, 0);
  assert.equal(migrated.flight.blinkSerial, 0);
});

test('simulation cooldown clock runs on ground ticks without double-counting flight or paused frames', () => {
  const state = at(100);
  const world = sphere();
  advanceFlightAbilityTime(state, 1 / 60);
  assert.equal(state.abilityTime, 1 / 60);
  stepFlight(state, {}, 1 / 60, true, world, { realm: 6, clockAdvanced: true });
  assert.equal(state.abilityTime, 1 / 60);
  advanceFlightAbilityTime(state, 0);
  assert.equal(state.abilityTime, 1 / 60);
  stepFlight(state, {}, 1 / 60, true, world, { realm: 6 });
  assert.equal(state.abilityTime, 2 / 60, 'standalone callers retain automatic clock advancement');
});
