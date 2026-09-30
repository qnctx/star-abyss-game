const test = require('node:test');
const assert = require('node:assert/strict');
const modules = Promise.all([
  import('../src/stamina.mjs'), import('../src/mobility.mjs'),
  import('../src/movement.mjs'), import('../src/layout.mjs'), import('../src/evolution.mjs'),
]);
const setup = async () => {
  const m = Object.assign({}, ...await modules);
  return { ...m, maximum: m.evolutionStats({ bodyLevel: 3, equipmentLevel: 3 }) };
};
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `expected ${expected}, got ${actual}`);
const run = { forward: true, sprint: true };

function sprintFor(m, state, seconds, controls = run, rules = m.maximum) {
  for (let left = seconds; left > 1e-9; left -= 1 / 60) {
    const allowed = m.prepareSprint(state, controls), dt = Math.min(left, 1 / 60);
    m.updateStamina(state, { moving: !!controls.forward, sprinting: allowed && !!controls.forward }, dt, rules);
  }
}
function flyFor(m, player, state, seconds, controls = { lift: true }, rules = m.maximum, inspect = () => {}) {
  for (let left = seconds; left > 1e-9; left -= 1 / 60) {
    m.stepMobility(player, state, controls, Math.min(left, 1 / 60), false, rules);
    inspect();
  }
}

test('body evolution extends continuous sprint from thirty to one hundred twenty seconds without changing capacity', async () => {
  const m = await setup(), base = m.createStamina(), evolved = m.createStamina();
  sprintFor(m, base, 30, run, {});
  sprintFor(m, evolved, 30);
  assert.equal(base.value, 0);
  close(evolved.value, 75);
  assert.equal(evolved.sprinting, true);
  sprintFor(m, evolved, 90);
  assert.equal(evolved.value, 0);
  assert.equal(evolved.armed, false);
  sprintFor(m, evolved, 10);
  assert.equal(evolved.value, 0, 'a held key must not replenish an evolved body');
  assert.equal(evolved.armed, false);
  assert.equal(m.STAMINA.max, 100);
  assert.equal(m.staminaView(evolved, m.maximum).maxSprintSeconds, 120);
});

test('evolved sprint keeps the release requirement, recovery delay and twenty-five percent restart gate', async () => {
  const m = await setup(), state = m.restoreStamina({ value: 24, recoveryRemaining: 0 });
  assert.equal(m.prepareSprint(state, run), false);
  sprintFor(m, state, 2);
  assert.equal(state.value, 24);
  sprintFor(m, state, m.STAMINA.delay + 1 / m.STAMINA.restingRecovery, {});
  close(state.value, 25);
  assert.equal(m.prepareSprint(state, run), true);
  sprintFor(m, state, 1);
  close(state.value, 25 - 100 / 120);
  m.prepareSprint(state, {});
  assert.equal(m.prepareSprint(state, run), false, 'a new press below twenty-five percent is still denied');
});

test('equipment evolution grants one hundred twenty powered seconds but keeps the same low ceiling and forced landing', async () => {
  const m = await setup(), base = m.createMobility(), evolved = m.createMobility(), p0 = m.createPlayer(), p1 = m.createPlayer();
  flyFor(m, p0, base, 30, { lift: true }, {});
  assert.equal(base.flight.energy, 0);
  assert.equal(base.flight.thrusting, false);
  flyFor(m, p1, evolved, 119, { lift: true }, m.maximum, () => {
    assert.ok(p1.y - m.terrainHeight(p1.x, p1.z) <= 4.5 + 1e-8);
  });
  close(evolved.flight.energy, 100 / 120);
  assert.equal(evolved.flight.thrusting, true);
  flyFor(m, p1, evolved, 1);
  assert.equal(evolved.flight.energy, 0);
  assert.equal(evolved.flight.exhausted, true);
  assert.equal(evolved.flight.thrusting, false);
  flyFor(m, p1, evolved, 10);
  assert.equal(evolved.flight.airborne, false);
  assert.equal(evolved.flight.energy, 0, 'held Space cannot recharge or relaunch after evolved flight expires');
  assert.equal(p1.y, m.terrainHeight(p1.x, p1.z));
  assert.equal(m.mobilityView(p1, evolved, m.maximum).maxFlightSeconds, 120);
});

test('duration evolution cannot enable cabin flight or pass a closed story bulkhead', async () => {
  const m = await setup(), state = m.createMobility(), player = { ...m.createPlayer(), x: 0, z: -705 };
  flyFor(m, player, state, 3);
  assert.equal(state.flight.airborne, false);
  assert.equal(state.flight.energy, 100);
  assert.match(m.mobilityView(player, state, m.maximum).status, /禁用/);
  assert.equal(m.collidesAtHeight(0, -711, 4.5, false), true);
  assert.equal(m.collidesAtHeight(0, -711, 4.5, true), false);
});

test('applying improved efficiency does not fill stamina, flight energy or erase their recovery debt', async () => {
  const m = await setup(), stamina = m.restoreStamina({ value: 40, recoveryRemaining: 1.2 });
  const player = m.createPlayer(), mobility = m.restoreMobility({ flight: { energy: 40, recoveryRemaining: 1.7 } }, player);
  const oldStamina = m.serializeStamina(stamina), oldMobility = m.serializeMobility(mobility);
  m.staminaView(stamina, m.maximum);
  m.mobilityView(player, mobility, m.maximum);
  m.updateStamina(stamina, { moving: true, sprinting: true }, 0, m.maximum);
  m.stepMobility(player, mobility, { lift: true }, 0, false, m.maximum);
  assert.deepEqual(m.serializeStamina(stamina), oldStamina);
  assert.deepEqual(m.serializeMobility(mobility), oldMobility);
  sprintFor(m, stamina, 1);
  close(stamina.value, 40 - 100 / 120);
  flyFor(m, player, mobility, 1);
  close(mobility.flight.energy, 40 - 100 / 120);
});

test('evolution preserves baseline recovery rates and launch thresholds', async () => {
  const m = await setup(), s0 = m.restoreStamina({ value: 20, recoveryRemaining: 1 }), s1 = m.restoreStamina({ value: 20, recoveryRemaining: 1 });
  sprintFor(m, s0, 2, {}, {});
  sprintFor(m, s1, 2, {});
  assert.deepEqual(m.serializeStamina(s1), m.serializeStamina(s0));
  const p0 = m.createPlayer(), p1 = m.createPlayer();
  const f0 = m.restoreMobility({ flight: { energy: 10, recoveryRemaining: 2 } }, p0);
  const f1 = m.restoreMobility({ flight: { energy: 10, recoveryRemaining: 2 } }, p1);
  flyFor(m, p0, f0, 3, {}, {});
  flyFor(m, p1, f1, 3, {});
  close(f1.flight.energy, 22);
  close(f1.flight.energy, f0.flight.energy);
  flyFor(m, p1, f1, 1);
  assert.equal(f1.flight.airborne, false);
  close(f1.flight.energy, 22);
});

test('resource save round-trips retain current percentages and take duration solely from external progression', async () => {
  const m = await setup(), stamina = m.createStamina(), p = m.createPlayer(), flight = m.createMobility();
  sprintFor(m, stamina, 2);
  flyFor(m, p, flight, 2);
  const sRaw = JSON.parse(JSON.stringify(m.serializeStamina(stamina)));
  const fRaw = JSON.parse(JSON.stringify(m.serializeMobility(flight)));
  assert.deepEqual(Object.keys(sRaw).sort(), ['recoveryRemaining', 'value']);
  assert.deepEqual(Object.keys(fRaw.flight).sort(), ['energy', 'recoveryRemaining']);
  const restoredS = m.restoreStamina(sRaw), restoredP = m.restorePlayer(p), restoredF = m.restoreMobility(fRaw, restoredP);
  close(restoredS.value, stamina.value);
  close(restoredF.flight.energy, flight.flight.energy);
  assert.equal(restoredS.shiftHeld, false);
  assert.equal(restoredF.flight.liftHeld, false);
  assert.equal(restoredF.flight.thrusting, false);
  sprintFor(m, restoredS, 2);
  flyFor(m, restoredP, restoredF, 2);
  close(restoredS.value, 100 - 4 * 100 / 120);
  close(restoredF.flight.energy, 100 - 4 * 100 / 120);
});

test('pre-rebalance resource percentages are preserved while earned levels gain the new endurance', async () => {
  const m = await setup(), player = m.createPlayer();
  const savedStamina = { value: 37, recoveryRemaining: 1.2 };
  const savedFlight = { flight: { energy: 41, recoveryRemaining: 1.7 } };
  const stamina = m.restoreStamina(savedStamina), mobility = m.restoreMobility(savedFlight, player);
  const rules = m.evolutionStats({ bodyLevel: 2, equipmentLevel: 1 });
  assert.deepEqual(m.serializeStamina(stamina), savedStamina);
  assert.deepEqual(m.serializeMobility(mobility).flight, savedFlight.flight);
  close(m.staminaView(stamina, rules).maxSprintSeconds, 90);
  close(m.mobilityView(player, mobility, rules).maxFlightSeconds, 60);
  sprintFor(m, stamina, 3, run, rules);
  flyFor(m, player, mobility, 3, { lift: true }, rules);
  close(stamina.value, 37 - 300 / 90);
  close(mobility.flight.energy, 41 - 300 / 60);
});

test('malformed duration rules fail safe and finite values cannot exceed the supported duration caps', async () => {
  const m = await setup();
  for (const rule of [null, {}, { sprintDrain: NaN, flightDrain: Infinity }, { sprintDrain: '5', flightDrain: '6' }]) {
    const stamina = m.createStamina(), p = m.createPlayer(), mobility = m.createMobility();
    sprintFor(m, stamina, 1, run, rule);
    flyFor(m, p, mobility, 1, { lift: true }, rule);
    close(stamina.value, 100 - 100 / 30);
    close(mobility.flight.energy, 100 - 100 / 30);
  }
  for (const rule of [{ sprintDrain: -100, flightDrain: 0 }, { sprintDrain: 1000, flightDrain: 1000 }]) {
    const sView = m.staminaView(m.createStamina(), rule), fView = m.mobilityView(m.createPlayer(), m.createMobility(), rule);
    assert.ok(sView.maxSprintSeconds >= 30 && sView.maxSprintSeconds <= 120);
    assert.ok(fView.maxFlightSeconds >= 30 && fView.maxFlightSeconds <= 120);
  }
});

test('suit and body efficiency never changes vehicle speed or battery consumption', async () => {
  const m = await setup(), p0 = m.createPlayer(), p1 = m.createPlayer(), s0 = m.createMobility(), s1 = m.createMobility();
  for (const state of [s0, s1]) Object.assign(state.vehicle, { x: 0, z: 180, mounted: true, repaired: true });
  p0.z = 180; p1.z = 180;
  flyFor(m, p0, s0, 3.5, { forward: true, boost: true }, {});
  flyFor(m, p1, s1, 3.5, { forward: true, boost: true }, m.maximum);
  assert.deepEqual(p1, p0);
  assert.equal(s1.vehicle.battery, s0.vehicle.battery);
  assert.ok(Math.hypot(p1.vx, p1.vz) > 30);
});

test('each branch delivers exactly 30, 60, 90 and 120 seconds, agrees with HUD and cannot restart while held', async () => {
  const m = await setup();
  for (let level = 0; level <= 3; level++) {
    const rules = m.evolutionStats({ bodyLevel: level, equipmentLevel: level });
    const seconds = [30, 60, 90, 120][level];
    const stamina = m.createStamina(), p = m.createPlayer(), mobility = m.createMobility();
    assert.equal(rules.sprintDuration, seconds);
    assert.equal(rules.flightDuration, seconds);
    close(m.staminaView(stamina, rules).maxSprintSeconds, seconds);
    close(m.mobilityView(p, mobility, rules).maxFlightSeconds, seconds);
    sprintFor(m, stamina, seconds - .5, run, rules);
    flyFor(m, p, mobility, seconds - .5, { lift: true }, rules);
    close(stamina.value, 50 / seconds);
    close(mobility.flight.energy, 50 / seconds);
    assert.equal(stamina.sprinting, true);
    assert.equal(mobility.flight.thrusting, true);
    sprintFor(m, stamina, .5, run, rules);
    flyFor(m, p, mobility, .5, { lift: true }, rules);
    assert.equal(stamina.value, 0);
    assert.equal(mobility.flight.energy, 0);
    assert.equal(stamina.armed, false);
    assert.equal(mobility.flight.thrusting, false);
    sprintFor(m, stamina, 10, run, rules);
    flyFor(m, p, mobility, 10, { lift: true }, rules);
    assert.equal(stamina.value, 0);
    assert.equal(mobility.flight.energy, 0);
    assert.equal(mobility.flight.airborne, false);
  }
});
