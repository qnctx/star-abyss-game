import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgression, progressAction, progressionView, restoreProgression, SURVEY_ROUTE } from '../src/planet-gameplay/progression.mjs';
import { createFlight, stepFlight, flightEnvelope, cameraEnvelope, FLIGHT_RULES } from '../src/planet-gameplay/flight.mjs';
import { restorePlanet, attachPlanet } from '../src/planet-gameplay/save.mjs';
const context = () => ({ realm: 0, story: { flags: { complete: true } }, mobility: { vehicle: { repaired: true, mounted: false }, flight: { airborne: false } } });
const sample = (extra = {}) => ({ ready: true, altitude: 0, agl: 0, grounded: true, waterDepth: 0, biome: 'plains', atService: false, ...extra });
// Deterministic adapter fixture: metre-space flat surface only for domain tests,
// not a user-facing scene or evidence that the spherical world has been integrated.
const world = (extra = {}) => ({ id: 'star-abyss', seed: 'star-abyss-planet-v1', radius: 120000,
  sample: p => sample({ altitude: p.y, agl: p.y, grounded: p.y <= .001 }),
  advance: (p, d) => ({ x: p.x + d.east, y: Math.max(0, p.y + d.up), z: p.z + d.north }),
  sweep: () => ({ ready: true, clear: true }), ...extra });
function commissioned() {
  const state = createProgression(), ctx = context();
  for (const biome of SURVEY_ROUTE) assert.equal(progressAction(state, 'survey', ctx, sample({ biome })).changed, true);
  assert.equal(progressAction(state, 'commission', ctx, sample({ atService: true })).changed, true);
  return state;
}
test('new players and old complete-only snapshots do not gain high flight', () => {
  const raw = commissioned(), ctx = context(); ctx.story.flags.complete = false;
  assert.equal(progressionView(raw, ctx).unlocked, false);
  assert.deepEqual(restoreProgression(raw, ctx), createProgression());
  const old = restorePlanet({ version: 1, player: { x: 3, z: 2 }, story: { flags: { complete: true } } }, context(), world(), p => ({ x: p.x, y: 0, z: p.z }));
  assert.equal(old.status, 'legacy'); assert.equal(old.progression.commissioned, false);
});
test('route enforces ordered ground samples, vehicle repair and return to service', () => {
  const s = createProgression(), ctx = context();
  assert.equal(progressAction(s, 'survey', ctx, sample({ biome: 'coast' })).changed, false);
  ctx.mobility.vehicle.repaired = false;
  assert.equal(progressAction(s, 'survey', ctx, sample()).changed, false);
  ctx.mobility.vehicle.repaired = true;
  for (const biome of SURVEY_ROUTE) {
    assert.equal(progressAction(s, 'survey', ctx, sample({ biome })).changed, true);
    assert.equal(progressAction(s, 'survey', ctx, sample({ biome })).changed, false);
  }
  assert.equal(progressionView(s, ctx).unlocked, false);
  assert.equal(progressAction(s, 'commission', ctx, sample()).changed, false);
  assert.equal(progressAction(s, 'commission', ctx, sample({ atService: true })).changed, true);
  assert.equal(progressionView(s, ctx).unlocked, false, 'ecosystem survey alone does not grant R4 flight');
  ctx.realm = 4;
  assert.equal(progressionView(s, ctx).unlocked, true);
});
test('sampling refuses airborne, mounted, submerged and unloaded samples', () => {
  for (const change of [{ agl: 8 }, { grounded: false }, { ready: false }, { waterDepth: 2 }, { agl: NaN }])
    assert.equal(progressAction(createProgression(), 'survey', context(), sample(change)).changed, false);
  const ctx = context(); ctx.mobility.vehicle.mounted = true;
  assert.equal(progressAction(createProgression(), 'survey', ctx, sample()).changed, false);
});
test('malformed progression cannot turn coast-only into completed route', () => {
  assert.deepEqual(restoreProgression({ surveys: ['coast'], commissioned: true }, context()), createProgression());
  assert.equal(restoreProgression({ surveys: ['plains'], commissioned: true }, context()).commissioned, false);
});
test('AGL, not mountain elevation, determines safe speed; camera is continuous', () => {
  assert.ok(Math.abs(flightEnvelope(sample({ altitude: 5000, agl: 1 }), 120000).speed-FLIGHT_RULES.nearSpeed)<.1);
  assert.equal(flightEnvelope(sample({ altitude: 5000, agl: 2000 }), 120000).speed, FLIGHT_RULES.cruiseSpeed);
  let prev = cameraEnvelope(sample(), 120000);
  for (let y = 1; y <= 300000; y += 100) {
    const cam = cameraEnvelope(sample({ altitude: y, agl: y }), 120000);
    assert.ok(cam.globe >= prev.globe && cam.continent >= prev.continent);
    assert.ok(cam.globe - prev.globe < .002); assert.ok(cam.far > cam.near);
    prev = cam;
  }
  assert.equal(prev.globe, 1);
});
test('launch gate, bounded dt, held input and real energy consumption', () => {
  const s = createFlight({ x: 0, y: 0, z: 0 }), w = world();
  assert.equal(stepFlight(s, { lift: true }, .05, false, w).handled, false);
  assert.equal(stepFlight(s, { lift: true }, .05, true, w).handled, false);
  stepFlight(s, {}, .05, true, w);
  assert.equal(stepFlight(s, { lift: true }, 50, true, w).handled, true);
  assert.ok(s.position.y > 0 && s.position.y <= FLIGHT_RULES.verticalAcceleration*.05*.05+1e-9); assert.ok(s.energy < 100);
});
test('terrain streaming and collision failures stop all movement', () => {
  for (const w of [world({ sample: () => ({ ready: false }) }), world({ sweep: () => ({ ready: false }) }), world({ sweep: () => ({ ready: true, clear: false }) })]) {
    const s = createFlight({ x: 0, y: 2000, z: 0 }); s.active = true;
    const start = { ...s.position };
    stepFlight(s, { north: 1, lift: true }, .05, true, w);
    assert.deepEqual(s.position, start); assert.equal(s.speed, 0);
  }
});
test('sweep receives complete high-speed motion; no endpoint-only collision test', () => {
  let sweepLength = 0;
  const w = world({ sweep: (a, b) => { sweepLength = Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z); return { ready: true, clear: false }; } });
  const s = createFlight({ x: 0, y: 2000, z: 0 }); s.active = true; s.speed = 420;s.eastSpeed=420/Math.SQRT2;s.northSpeed=420/Math.SQRT2;
  stepFlight(s, { east: 1, north: 1 }, .05, true, w);
  assert.ok(sweepLength >= 20 && sweepLength < 22); assert.equal(s.position.x, 0);
});
test('exhaustion descends, safely lands, and never regains charge in air', () => {
  const s = createFlight({ x: 0, y: 10, z: 0 }); s.active = true; s.energy = 0;
  for (let i = 0; i < 300 && s.active; i++) stepFlight(s, {}, .05, true, world());
  assert.equal(s.active, false); assert.ok(Math.abs(s.position.y)<1e-6); assert.equal(s.energy, 0);
});
test('ceiling and unsafe ocean endpoint are enforced', () => {
  const s = createFlight({ x: 0, y: 2000, z: 0 }); s.active = true;
  stepFlight(s, { lift: true }, .05, true, world()); assert.equal(s.position.y, 2000);
  for(let i=0;i<100;i++)stepFlight(s,{north:1,lift:true},.05,true,world());
  assert.ok(s.position.z>1000&&s.position.y<=2000+1e-8,'horizontal flight remains available at the ceiling');
  const sea = createFlight({ x: 0, y: .2, z: 0 }); sea.active = true; sea.verticalSpeed = -10;
  const w = world({ sample: p => sample({ altitude: p.y, agl: p.y, waterDepth: 10, grounded: false }) });
  assert.equal(stepFlight(sea, {descend:true}, .05, true, w).reason, 'unsafe-surface'); assert.equal(sea.position.y, .2);
});
test('save preserves every legacy field and round-trips canonical coordinates without held input', () => {
  const legacy = { version: 1, story: { flags: { complete: true } }, mobility: { vehicle: { repaired: true } }, expedition: { worldId: 'original:abc' }, player: { x: 3, z: 2 }, custom: ['preserved'] };
  const before = structuredClone(legacy);
  const s = { status: 'active', progression: commissioned(), flight: createFlight({ x: 1e7, y: 9000, z: -3e7 }) };
  s.flight.active = true; s.flight.liftHeld = true; s.flight.energy = 72;
  const encoded = attachPlanet(legacy, s, world()); assert.deepEqual(legacy, before);
  for (const key of Object.keys(legacy)) assert.deepEqual(encoded[key], legacy[key]);
  const restored = restorePlanet(JSON.parse(JSON.stringify(encoded)), context(), world(), () => assert.fail('legacy converter invoked'));
  assert.equal(restored.status, 'restored'); assert.deepEqual(restored.flight.position, s.flight.position);
  assert.equal(restored.flight.liftHeld, false); assert.equal(restored.flight.verticalSpeed, -1);
  assert.equal(restored.flight.energy, 72); assert.equal(restored.progression.commissioned, true);
});
test('unknown schemas/worlds are read-only, unready or unsafe saves never teleport', () => {
  const good = attachPlanet({ version: 1 }, { status: 'active', progression: commissioned(), flight: createFlight({ x: 0, y: 3, z: 0 }) }, world());
  for (const raw of [{ ...good.planet, version: 999 }, { ...good.planet, id: 'different' }, { ...good.planet, radius: 5 }, { ...good.planet, gameplay: { version: 999 } }]) {
    const snapshot = { planet: raw };
    assert.equal(restorePlanet(snapshot, context(), world(), () => assert.fail()).status, 'incompatible');
    assert.throws(() => attachPlanet(snapshot, { status: 'active', progression: commissioned(), flight: createFlight({ x: 0, y: 0, z: 0 }) }, world()));
  }
  assert.equal(restorePlanet(good, context(), world({ sample: () => ({ ready: false }) }), () => assert.fail()).status, 'pending');
  assert.equal(restorePlanet(good, context(), world({ sample: () => sample({ agl: -10 }) }), () => assert.fail()).status, 'unsafe');
});
