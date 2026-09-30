const test = require('node:test');
const assert = require('node:assert/strict');
const modulePromise = import('../src/evolution.mjs');
const SAFE = { grounded: true, mounted: false, canCalibrate: true };
const storyWith = (...names) => ({ flags: Object.fromEntries(names.map(name => [name, true])) });
const fullStory = () => storyWith('signal', 'blackbox', 'echoCalibrated', 'capsuleCalibrated', 'power', 'returned', 'riftClosed');
const rest = (m, state, seconds = 3) => m.recordEvolutionMotion(state, { mode: 'foot', moving: false, distance: 0 }, seconds);
const walk = (m, state, distance) => m.recordEvolutionMotion(state, { mode: 'foot', moving: true, distance }, distance / 5);

test('new expedition starts at base endurance and no free adaptation', async () => {
  const m = await modulePromise, state = m.createEvolution();
  assert.deepEqual(state, { bodyLevel: 0, equipmentLevel: 0, footDistance: 0, restTime: 0 });
  assert.deepEqual(m.evolutionStats(state), { bodyLevel: 0, equipmentLevel: 0, sprintDuration: 30, flightDuration: 30, sprintDrain: 100 / 30, flightDrain: 100 / 30 });
  const view = m.evolutionView(state, storyWith(), SAFE);
  assert.equal(view.body.ready, false);
  assert.equal(view.equipment.ready, false);
  assert.deepEqual(view.body.roadmap.map(t => t.duration), [60, 90, 120]);
  assert.deepEqual(view.equipment.roadmap.map(t => t.duration), [60, 90, 120]);
});

test('only real grounded foot distance advances training, never vehicle, air, blocked or teleport feedback', async () => {
  const m = await modulePromise, state = m.createEvolution();
  walk(m, state, 100);
  for (const motion of [
    { mode: 'vehicle', moving: true, distance: 24 },
    { mode: 'flight', moving: true, distance: 12 },
    { mode: 'air', moving: true, distance: 12 },
    { mode: 'foot', moving: false, distance: 0 },
    { mode: 'foot', moving: false, distance: 2 },
    { mode: 'foot', moving: true, distance: 1000 },
    { mode: 'foot', moving: true, distance: -5 },
    { mode: 'foot', moving: true, distance: Infinity },
    { mode: 'foot', moving: true, distance: NaN },
    { mode: 'foot', moving: true, distance: '5' },
  ]) m.recordEvolutionMotion(state, motion, 1);
  assert.equal(state.footDistance, 100);
  assert.equal(state.restTime, 0);
  walk(m, state, 100);
  assert.equal(state.footDistance, 200);
});

test('body requires story milestone plus movement then three real stationary seconds', async () => {
  const m = await modulePromise, state = m.createEvolution();
  walk(m, state, 200);
  assert.equal(m.evolve(state, 'body', storyWith(), SAFE).changed, false);
  const story = storyWith('signal');
  rest(m, state, 2.9);
  assert.equal(m.evolutionView(state, story, SAFE).body.ready, false);
  assert.ok(Math.abs(m.evolutionView(state, story, SAFE).restRemaining - .1) < 1e-7);
  rest(m, state, .1);
  assert.equal(m.evolutionView(state, story, SAFE).body.ready, true);
  assert.equal(m.evolve(state, 'body', story, SAFE).changed, true);
  assert.equal(state.bodyLevel, 1);
  assert.equal(m.evolutionStats(state).sprintDuration, 60);
  assert.equal(m.evolve(state, 'body', story, SAFE).changed, false);
});

test('movement or leaving foot mode restarts adaptation rest; invalid time is ignored', async () => {
  const m = await modulePromise, state = m.createEvolution();
  rest(m, state, 2);
  walk(m, state, .5);
  assert.equal(state.restTime, 0);
  rest(m, state, 2);
  m.recordEvolutionMotion(state, { mode: 'flight', moving: false, distance: 0 }, .1);
  assert.equal(state.restTime, 0);
  rest(m, state, 2);
  for (const delta of [0, -1, undefined, NaN, Infinity]) m.recordEvolutionMotion(state, { mode: 'foot', moving: true, distance: 10 }, delta);
  assert.equal(state.restTime, 2);
  assert.equal(state.footDistance, .5);
  rest(m, state, 10);
  assert.equal(state.restTime, 3);
});

test('paused UI reads and repeated upgrade attempts do not advance rest or progress', async () => {
  const m = await modulePromise, state = m.createEvolution(), story = storyWith('signal');
  walk(m, state, 200); rest(m, state, 1);
  const before = structuredClone(state);
  for (let frame = 0; frame < 120; frame++) {
    assert.equal(m.evolutionView(state, story, SAFE).restRemaining, 2);
    assert.equal(m.evolve(state, 'body', story, SAFE).changed, false);
  }
  assert.deepEqual(state, before);
});

test('ground safety is rechecked on click and cannot be bypassed with an old ready view', async () => {
  const m = await modulePromise, state = m.createEvolution(), story = fullStory();
  walk(m, state, 800); rest(m, state);
  assert.equal(m.evolutionView(state, story, SAFE).body.ready, true);
  for (const context of [{}, { ...SAFE, grounded: false }, { ...SAFE, mounted: true }]) {
    assert.equal(m.evolve(state, 'body', story, context).changed, false);
    assert.equal(m.evolve(state, 'equipment', story, context).changed, false);
  }
  assert.equal(state.bodyLevel, 0);
  assert.equal(state.equipmentLevel, 0);
});

test('equipment requires powered calibration location and progresses independent of walking or rest', async () => {
  const m = await modulePromise, state = m.createEvolution(), story = storyWith('power');
  assert.equal(m.evolve(state, 'equipment', story, { ...SAFE, canCalibrate: false }).changed, false);
  assert.equal(m.evolve(state, 'equipment', storyWith(), SAFE).changed, false);
  assert.equal(m.evolve(state, 'equipment', story, SAFE).changed, true);
  assert.equal(state.equipmentLevel, 1);
  assert.equal(state.footDistance, 0);
  assert.equal(state.restTime, 0);
  assert.equal(state.bodyLevel, 0);
  assert.equal(m.evolutionStats(state).flightDuration, 60);
  assert.equal(m.evolve(state, 'equipment', story, SAFE).changed, false);
});

test('both complete branches advance one explicit tier per action, stay capped and never touch resource pools', async () => {
  const m = await modulePromise, state = m.createEvolution(), story = fullStory();
  walk(m, state, 800); rest(m, state);
  // These foreign properties model normalized resource pools and must not change.
  state.stamina = 17; state.energy = 9;
  for (let level = 1; level <= 3; level++) {
    assert.equal(m.evolve(state, 'body', story, SAFE).changed, true);
    assert.equal(m.evolve(state, 'equipment', story, SAFE).changed, true);
    assert.equal(state.bodyLevel, level);
    assert.equal(state.equipmentLevel, level);
  }
  const before = structuredClone(state);
  assert.equal(m.evolve(state, 'body', story, SAFE).changed, false);
  assert.equal(m.evolve(state, 'equipment', story, SAFE).changed, false);
  assert.deepEqual(state, before);
  assert.equal(state.stamina, 17);
  assert.equal(state.energy, 9);
  assert.equal(m.evolutionStats(state).sprintDrain, 100 / 120);
  assert.equal(m.evolutionStats(state).flightDrain, 100 / 120);
  for (const branch of ['body', 'equipment']) {
    const card = m.evolutionView(state, story, SAFE)[branch];
    assert.equal(card.completed, true);
    assert.equal(card.ready, false);
    assert.equal(card.nextDuration, null);
    assert.equal(card.roadmap.filter(tier => tier.completed).length, 3);
  }
});

test('later milestones cannot skip the prerequisite tier', async () => {
  const m = await modulePromise, state = m.createEvolution();
  walk(m, state, 1000); rest(m, state);
  const lateOnly = storyWith('blackbox', 'echoCalibrated', 'capsuleCalibrated', 'returned', 'riftClosed');
  assert.equal(m.evolve(state, 'body', lateOnly, SAFE).changed, false);
  assert.equal(m.evolve(state, 'equipment', lateOnly, SAFE).changed, false);
});

test('save whitelist preserves earned levels and exact distance but never restores rest intent', async () => {
  const m = await modulePromise, state = m.createEvolution(), story = fullStory();
  walk(m, state, 812.345); rest(m, state);
  m.evolve(state, 'body', story, SAFE); m.evolve(state, 'equipment', story, SAFE);
  const saved = m.serializeEvolution(state);
  assert.deepEqual(Object.keys(saved).sort(), ['bodyLevel', 'equipmentLevel', 'footDistance', 'version']);
  const restored = m.restoreEvolution({ ...saved, restTime: 3, equipped: true }, story);
  assert.deepEqual(m.serializeEvolution(restored), saved);
  assert.equal(restored.restTime, 0);
  assert.equal(restored.equipped, undefined);
});

test('existing version-one progression keeps earned levels under the new thirty-second-per-level schedule', async () => {
  const m = await modulePromise;
  for (let level = 0; level <= 3; level++) {
    const saved = { version: 1, bodyLevel: level, equipmentLevel: level, footDistance: 812.345 };
    const restored = m.restoreEvolution(saved, fullStory());
    assert.deepEqual(m.serializeEvolution(restored), saved);
    assert.equal(m.evolutionStats(restored).sprintDuration, 30 + 30 * level);
    assert.equal(m.evolutionStats(restored).flightDuration, 30 + 30 * level);
  }
});

test('legacy saves unlock story blueprints but grant no historical distance or free levels', async () => {
  const m = await modulePromise, story = fullStory();
  for (const raw of [undefined, null, {}, [], { version: 99, bodyLevel: 3, equipmentLevel: 3, footDistance: 5000 }]) {
    const state = m.restoreEvolution(raw, story);
    assert.deepEqual(state, m.createEvolution());
    assert.equal(m.evolutionView(state, story, SAFE).equipment.ready, true);
    assert.equal(m.evolutionView(state, story, SAFE).body.ready, false);
  }
});

test('malformed saves clamp values and never accept a level above earned ordered requirements', async () => {
  const m = await modulePromise;
  const base = { version: 1, bodyLevel: 3, equipmentLevel: 3, footDistance: 1000 };
  assert.deepEqual(m.restoreEvolution(base, storyWith()), { bodyLevel: 0, equipmentLevel: 0, footDistance: 1000, restTime: 0 });
  let state = m.restoreEvolution(base, storyWith('signal', 'blackbox', 'power'));
  assert.equal(state.bodyLevel, 2); assert.equal(state.equipmentLevel, 1);
  state = m.restoreEvolution({ ...base, footDistance: 250 }, fullStory());
  assert.equal(state.bodyLevel, 1); assert.equal(state.equipmentLevel, 3);
  state = m.restoreEvolution({ ...base, bodyLevel: 30.8, equipmentLevel: 2.9, footDistance: 1e20 }, fullStory());
  assert.equal(state.bodyLevel, 3); assert.equal(state.equipmentLevel, 2);
  assert.equal(state.footDistance, m.EVOLUTION.maxFootDistance);
  for (const invalid of [NaN, Infinity, -100, '1000']) {
    state = m.restoreEvolution({ ...base, bodyLevel: invalid, equipmentLevel: invalid, footDistance: invalid }, fullStory());
    assert.deepEqual(state, m.createEvolution());
  }
});

test('unknown actions are inert, and visible roadmap describes conditions without final plot spoilers', async () => {
  const m = await modulePromise, state = m.createEvolution(), before = structuredClone(state);
  assert.equal(m.evolve(state, 'instant-unlock', fullStory(), SAFE).changed, false);
  assert.deepEqual(state, before);
  const text = JSON.stringify(m.evolutionView(state, storyWith(), SAFE));
  assert.match(text, /实际地面步行 200 米/);
  assert.match(text, /靠近返回信标或已供电的配电终端/);
  assert.doesNotMatch(text, /关闭裂隙|结局|真相|riftClosed/);
});
