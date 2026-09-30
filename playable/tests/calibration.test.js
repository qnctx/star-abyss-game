const assert = require('node:assert/strict');
const { test, before } = require('node:test');

let createCalibration, setCalibrationValue, calibrationView, calibrationMatches, requiresCalibration;
before(async () => {
  ({ createCalibration, setCalibrationValue, calibrationView, calibrationMatches, requiresCalibration } = await import('../src/calibration.mjs'));
});

const IDS = ['echo', 'capsule', 'rift', 'survey-west', 'survey-east', 'survey-north'];

function solve(session) {
  for (const [index, channel] of calibrationView(session).channels.entries()) {
    assert.equal(setCalibrationValue(session, index, (channel.targetAngle - channel.sourceAngle + 360) % 360), true);
  }
  return session;
}

test('each location exposes three deterministic, understandable phase clues with an independent session', () => {
  const sourceSets = new Set();
  for (const id of IDS) {
    const session = createCalibration(id);
    assert.deepEqual(session, { id, values: [0, 0, 0] });
    const view = calibrationView(session);
    assert.equal(view.id, id);
    assert.deepEqual(view.channels.map(channel => channel.name), ['裂', '环', '星']);
    assert.equal(view.ready, false);
    assert.equal(view.mode, id === 'rift' ? 'invert' : 'align');
    assert.ok(view.title.length > 3);
    assert.match(view.instruction, /实测相位 \+ 补偿/);
    assert.ok(view.quality >= 0 && view.quality < 100);
    sourceSets.add(view.channels.map(channel => channel.sourceAngle).join(','));
    for (const channel of view.channels) {
      assert.equal(channel.value, 0);
      assert.equal(channel.targetAngle, id === 'rift' ? 180 : 0);
      assert.ok(channel.sourceAngle >= 0 && channel.sourceAngle < 360);
      assert.equal(channel.sourceAngle % 15, 0);
      assert.ok(channel.residual >= 0 && channel.residual <= 180);
    }
    session.values[0] = 15;
    assert.deepEqual(createCalibration(id).values, [0, 0, 0]);
  }
  assert.equal(sourceSets.size, IDS.length, 'locations do not reuse one memorized solution');
});

test('manual compensation of visible clues aligns all three channels, including reverse isolation at 180 degrees', () => {
  for (const id of IDS) {
    const session = solve(createCalibration(id));
    const view = calibrationView(session);
    assert.equal(view.ready, true, id);
    assert.equal(view.quality, 100, id);
    assert.ok(view.channels.every(channel => channel.residual === 0 && channel.aligned));
    assert.equal(calibrationMatches(id, session.values), true);
    for (let index = 0; index < 3; index++) {
      const wrong = [...session.values];
      wrong[index] = (wrong[index] + 15) % 360;
      assert.equal(calibrationMatches(id, wrong), false, `${id} channel ${index} must also align`);
    }
  }
  assert.deepEqual(solve(createCalibration('echo')).values, [240, 120, 300]);
  assert.deepEqual(solve(createCalibration('rift')).values, [270, 90, 315]);
});

test('residual follows shortest circular distance, so a wrap-around near zero is not nearly a full-turn error', () => {
  const session = solve(createCalibration('echo'));
  setCalibrationValue(session, 0, 225);
  assert.equal(calibrationView(session).channels[0].residual, 15);
  setCalibrationValue(session, 0, 255);
  assert.equal(calibrationView(session).channels[0].residual, 15);
  setCalibrationValue(session, 0, 60);
  assert.equal(calibrationView(session).channels[0].residual, 180);
  assert.equal(calibrationView(session).ready, false);
});

test('input rejects coercions, fractional steps, invalid ranges and unknown channels without mutating the session', () => {
  const session = createCalibration('echo');
  for (const value of [NaN, Infinity, -Infinity, '15', null, undefined, true, {}, [], -15, 360, 720, 7, 15.5]) {
    const original = structuredClone(session);
    assert.equal(setCalibrationValue(session, 0, value), false, String(value));
    assert.deepEqual(session, original);
  }
  for (const index of [-1, 3, 1.5, '1', NaN, Infinity, null]) {
    assert.equal(setCalibrationValue(session, index, 15), false);
  }
  assert.deepEqual(session.values, [0, 0, 0]);
  assert.equal(setCalibrationValue(session, 0, 345), true);
  assert.equal(setCalibrationValue(session, 1, 0), true);
  assert.equal(setCalibrationValue(session, 2, 15), true);
  assert.deepEqual(session.values, [345, 0, 15]);
});

test('unknown profiles and malformed session/value shapes cannot create a ready measurement', () => {
  for (const id of [undefined, null, 1, {}, [], 'constructor', '__proto__', 'toString', 'beacon', 'survey']) {
    assert.equal(createCalibration(id), null);
    assert.equal(calibrationMatches(id, [0, 0, 0]), false);
  }
  const sparse = new Array(3);
  sparse[0] = 240;
  sparse[2] = 300;
  for (const values of [null, undefined, [], [240, 120], [240, 120, 300, 0], ['240', 120, 300], [240, 120, NaN],
    [240, 120, 300.5], [240, 120, 660], sparse, new Uint16Array([240, 120, 300]), { 0: 240, 1: 120, 2: 300, length: 3 }]) {
    assert.equal(calibrationMatches('echo', values), false);
    assert.equal(calibrationView({ id: 'echo', values }), null);
    assert.equal(setCalibrationValue({ id: 'echo', values }, 0, 240), false);
  }
  for (const session of [null, undefined, false, 'echo', [], {}, { id: 'unknown', values: [0, 0, 0] },
    Object.create({ id: 'echo', values: [0, 0, 0] })]) {
    assert.equal(calibrationView(session), null);
    assert.equal(setCalibrationValue(session, 0, 15), false);
  }
});

test('read views are independent copies and cannot alter the source clue or session by mutation', () => {
  const session = createCalibration('echo');
  const view = calibrationView(session);
  view.channels[0].sourceAngle = 0;
  view.channels[0].value = 240;
  view.channels.push({ aligned: true });
  view.ready = true;
  assert.deepEqual(session.values, [0, 0, 0]);
  assert.equal(calibrationView(session).channels.length, 3);
  assert.equal(calibrationView(session).channels[0].sourceAngle, 120);
  assert.equal(calibrationMatches('echo', session.values), false);
});

test('the original clock gates field tuning and two fresh samples gate reverse isolation; completed locations permit retesting', () => {
  for (const story of [null, undefined, {}, { flags: null }, { flags: [] }, { flags: { returned: 'true' } },
    { flags: Object.create({ returned: true, echoCalibrated: true, capsuleCalibrated: true }) }]) {
    for (const id of IDS) assert.equal(requiresCalibration(story, id), false);
  }
  const story = { flags: { returned: true, echoCalibrated: false, capsuleCalibrated: false } };
  assert.equal(requiresCalibration(story, 'echo'), true);
  assert.equal(requiresCalibration(story, 'capsule'), true);
  assert.equal(requiresCalibration(story, 'rift'), false);
  story.flags.echoCalibrated = true;
  assert.equal(requiresCalibration(story, 'rift'), false);
  story.flags.capsuleCalibrated = true;
  assert.equal(requiresCalibration(story, 'rift'), true);
  story.flags.riftClosed = true;
  story.flags.complete = true;
  for (const id of ['echo', 'capsule', 'rift']) assert.equal(requiresCalibration(story, id), true);
  for (const id of ['survey-west', 'survey-east', 'survey-north', 'beacon', 'constructor', null]) assert.equal(requiresCalibration(story, id), false);
});
