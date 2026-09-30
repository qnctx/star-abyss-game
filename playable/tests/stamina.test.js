const test = require('node:test');
const assert = require('node:assert/strict');
const modulePromise = import('../src/stamina.mjs');

const RUN = { forward: true, sprint: true };
const WALK = { forward: true };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `expected ${expected}, got ${actual}`);

// Synthetic movement feedback isolates endurance rules from collision/rendering.
function tick(m, state, controls, delta, movement = {}) {
  const allowed = m.prepareSprint(state, controls);
  const intent = !!((Number(!!controls.forward) - Number(!!controls.backward)) ||
    (Number(!!controls.right) - Number(!!controls.left)));
  const moving = movement.moving ?? intent;
  m.updateStamina(state, { moving, sprinting: movement.sprinting ?? (allowed && moving) }, delta);
  return allowed;
}

function advance(m, state, seconds, controls = {}, movement = {}, step = 1 / 60) {
  for (let remaining = seconds; remaining > 1e-9; remaining -= step) {
    tick(m, state, controls, Math.min(step, remaining), movement);
  }
}

test('full stamina grants thirty seconds of continuous running and reaches exactly zero', async () => {
  const m = await modulePromise, state = m.createStamina();
  assert.equal(m.STAMINA.max, 100);
  assert.equal(m.STAMINA.drain, 100 / 30);
  advance(m, state, 29.5, RUN);
  close(state.value, 100 / 60);
  assert.equal(state.sprinting, true);
  advance(m, state, .5, RUN);
  assert.equal(state.value, 0);
  assert.equal(state.armed, false);
  assert.equal(state.sprinting, false);
  assert.equal(m.prepareSprint(state, RUN), false);
});

test('holding Shift for ninety seconds never regenerates or automatically restarts after exhaustion', async () => {
  const m = await modulePromise, state = m.createStamina();
  advance(m, state, 30, RUN);
  for (let second = 30; second < 90; second++) {
    advance(m, state, 1, RUN);
    assert.equal(state.value, 0);
    assert.equal(state.armed, false);
    assert.equal(state.sprinting, false);
    assert.equal(state.recoveryRemaining, m.STAMINA.delay);
  }
});

test('release waits 1.5 seconds, then resting restores fourteen points per second', async () => {
  const m = await modulePromise, state = m.createStamina();
  advance(m, state, 15, RUN);
  advance(m, state, 1.49);
  close(state.value, 50);
  close(state.recoveryRemaining, .01);
  advance(m, state, .01);
  close(state.value, 50);
  close(state.recoveryRemaining, 0);
  advance(m, state, 1);
  close(state.value, 64);
});

test('walking recovery is eight per second and never also consumes stamina', async () => {
  const m = await modulePromise, state = m.restoreStamina({ value: 40, recoveryRemaining: 1.5 });
  advance(m, state, 2.5, WALK);
  close(state.value, 48);
  assert.equal(state.sprinting, false);
  assert.equal(state.moving, true);
});

test('recovery crossing its delay is invariant to time-step subdivision', async () => {
  const m = await modulePromise;
  for (const controls of [{}, WALK]) {
    const single = m.restoreStamina({ value: 30, recoveryRemaining: .65 });
    const split = m.restoreStamina({ value: 30, recoveryRemaining: .65 });
    tick(m, single, controls, 2);
    advance(m, split, 2, controls, {}, .013);
    close(single.value, split.value);
    close(single.recoveryRemaining, split.recoveryRemaining);
    close(single.value, 30 + 1.35 * (controls.forward ? 8 : 14));
  }
});

test('a premature Shift press stays denied until released and freshly pressed at the restart threshold', async () => {
  const m = await modulePromise, state = m.restoreStamina({ value: 20, recoveryRemaining: 0 });
  assert.equal(tick(m, state, RUN, 1), false);
  assert.equal(state.value, 20);
  assert.equal(state.recoveryRemaining, 1.5);
  advance(m, state, 4, RUN);
  assert.equal(state.value, 20);
  assert.equal(state.armed, false);
  advance(m, state, 1.5 + 5 / 8, WALK);
  close(state.value, 25);
  assert.equal(m.prepareSprint(state, RUN), true);
  m.updateStamina(state, { moving: true, sprinting: true }, 1.5);
  close(state.value, 20);
  assert.equal(m.prepareSprint(state, RUN), true, 'an already-authorized sprint can continue below 25');
});

test('releasing a low but not empty sprint requires recovery before starting another session', async () => {
  const m = await modulePromise, state = m.createStamina();
  advance(m, state, 24, RUN);
  close(state.value, 20);
  assert.equal(m.prepareSprint(state, RUN), true);
  m.prepareSprint(state, WALK);
  assert.equal(m.prepareSprint(state, RUN), false);
  assert.equal(state.armed, false);
});

test('stationary Shift and pushing a wall neither drain nor recover stamina', async () => {
  const m = await modulePromise;
  for (const controls of [{ sprint: true }, RUN]) {
    const state = m.restoreStamina({ value: 60, recoveryRemaining: 0 });
    advance(m, state, 5, controls, { moving: false, sprinting: true });
    assert.equal(state.value, 60);
    assert.equal(state.sprinting, false);
    assert.equal(state.recoveryRemaining, 1.5);
  }
});

test('forward intent is required; backward, strafe, and opposing directions cannot sprint or regenerate with Shift held', async () => {
  const m = await modulePromise;
  for (const controls of [
    { backward: true, sprint: true },
    { left: true, sprint: true },
    { right: true, sprint: true },
    { forward: true, backward: true, sprint: true },
    { forward: true, backward: true, right: true, sprint: true },
    { left: true, right: true, sprint: true },
  ]) {
    const state = m.restoreStamina({ value: 60, recoveryRemaining: 0 });
    assert.equal(m.prepareSprint(state, controls), false);
    advance(m, state, 3, controls);
    assert.equal(state.value, 60);
    assert.equal(state.sprinting, false);
    assert.equal(state.recoveryRemaining, 1.5);
  }
});

test('forward diagonal sprint uses the same drain as straight running', async () => {
  const m = await modulePromise;
  for (const controls of [RUN, { ...RUN, left: true }, { ...RUN, right: true }]) {
    const state = m.createStamina();
    assert.equal(tick(m, state, controls, 2), true);
    close(state.value, 100 - 200 / 30);
  }
});

test('holding Shift during a non-sprint resets the recovery delay until release', async () => {
  const m = await modulePromise, state = m.restoreStamina({ value: 50, recoveryRemaining: .2 });
  tick(m, state, { sprint: true }, .1);
  assert.equal(state.recoveryRemaining, 1.5);
  advance(m, state, 1.4);
  close(state.value, 50);
  tick(m, state, { sprint: true }, .1);
  assert.equal(state.recoveryRemaining, 1.5);
  advance(m, state, 1.5);
  close(state.value, 50);
  advance(m, state, .5);
  close(state.value, 57);
});

test('menu input clearing preserves stamina and delay, including exhaustion', async () => {
  const m = await modulePromise;
  for (const seconds of [2, 30]) {
    const state = m.createStamina();
    advance(m, state, seconds, RUN);
    const saved = m.serializeStamina(state);
    m.clearStaminaInput(state);
    assert.deepEqual(m.serializeStamina(state), saved);
    assert.equal(state.shiftHeld, false);
    assert.equal(state.armed, false);
    assert.equal(state.sprinting, false);
    assert.equal(state.moving, false);
    assert.equal(m.prepareSprint(state, RUN), saved.value >= 25);
  }
});

test('save round-trip persists recovery debt but does not restore held inputs or active sprint', async () => {
  const m = await modulePromise, state = m.createStamina();
  advance(m, state, 2, RUN);
  const raw = JSON.parse(JSON.stringify(m.serializeStamina(state)));
  assert.deepEqual(Object.keys(raw).sort(), ['recoveryRemaining', 'value']);
  const restored = m.restoreStamina({ ...raw, shiftHeld: true, armed: true, sprinting: true, moving: true });
  assert.deepEqual(m.serializeStamina(restored), raw);
  for (const key of ['shiftHeld', 'armed', 'sprinting', 'moving']) assert.equal(restored[key], false);
  advance(m, restored, 1);
  close(restored.value, raw.value);
  close(restored.recoveryRemaining, .5);
  const exhausted = m.restoreStamina({ value: 0, recoveryRemaining: .7 });
  assert.equal(m.prepareSprint(exhausted, RUN), false);
  advance(m, exhausted, 5, RUN);
  assert.equal(exhausted.value, 0);
});

test('legacy charge and malformed saves are normalized without granting a free refill', async () => {
  const m = await modulePromise;
  for (const [raw, legacy, value, delay] of [
    [undefined, 42, 42, 1.5],
    [null, 0, 0, 1.5],
    [{ value: 30, recoveryRemaining: .7 }, 80, 30, .7],
    [{ value: NaN, recoveryRemaining: NaN }, 32, 32, 1.5],
    [{ value: -10, recoveryRemaining: 8 }, undefined, 0, 1.5],
    [{ value: 140, recoveryRemaining: -1 }, undefined, 100, 0],
    [{ value: '40', recoveryRemaining: '1' }, '60', 100, 0],
    [undefined, Infinity, 100, 0],
  ]) {
    const state = m.restoreStamina(raw, legacy);
    assert.equal(state.value, value);
    assert.equal(state.recoveryRemaining, delay);
    assert.equal(state.armed, false);
    assert.equal(state.shiftHeld, false);
  }
});

test('recovery is capped at full stamina and invalid deltas cannot change resource values', async () => {
  const m = await modulePromise, full = m.restoreStamina({ value: 95, recoveryRemaining: 0 });
  advance(m, full, 10);
  assert.equal(full.value, 100);
  for (const delta of [-1, NaN, Infinity, undefined]) {
    const state = m.restoreStamina({ value: 40, recoveryRemaining: 1 });
    tick(m, state, {}, delta);
    assert.equal(state.value, 40);
    assert.equal(state.recoveryRemaining, 1);
  }
});

test('HUD describes running, held input, exhaustion, delay, recovery, and readiness', async () => {
  const m = await modulePromise, state = m.createStamina();
  assert.deepEqual(m.staminaView(state), { value: 100, recoveryRemaining: 0, phase: 'ready', label: '体力充沛', canStart: true });
  tick(m, state, RUN, 1);
  assert.equal(m.staminaView(state).phase, 'sprinting');
  assert.match(m.staminaView(state).label, /消耗体力/);
  tick(m, state, { sprint: true }, .1);
  assert.equal(m.staminaView(state).phase, 'held');
  assert.match(m.staminaView(state).label, /松开 Shift/);
  tick(m, state, {}, .2);
  assert.equal(m.staminaView(state).phase, 'delay');
  assert.match(m.staminaView(state).label, /1\.3 秒/);
  advance(m, state, 1.4);
  assert.equal(m.staminaView(state).phase, 'recovering');
  assert.equal(m.staminaView(state).label, '休息恢复中');
  tick(m, state, WALK, .1);
  assert.equal(m.staminaView(state).label, '步行恢复中');
  const exhausted = m.restoreStamina({ value: 0, recoveryRemaining: 0 });
  tick(m, exhausted, RUN, 1);
  assert.equal(m.staminaView(exhausted).phase, 'exhausted');
  assert.match(m.staminaView(exhausted).label, /松开 Shift/);
  assert.equal(m.staminaView(exhausted).canStart, false);
  advance(m, exhausted, 1.5);
  assert.match(m.staminaView(exhausted).label, /25% 可再冲刺/);
});
