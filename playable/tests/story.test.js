const assert = require('node:assert/strict');
const { test, before } = require('node:test');

let createStory, restoreStory, objective, interact, getJournal, pointIds;
let createCalibration, calibrationView, setCalibrationValue;
before(async () => {
  ({ createStory, restoreStory, objective, interact, getJournal } = await import('../src/story.mjs'));
  ({ createCalibration, calibrationView, setCalibrationValue } = await import('../src/calibration.mjs'));
  const { POINTS } = await import('../src/layout.mjs');
  pointIds = new Set(POINTS.map(point => point.id));
});

// Solve the same visible phase clues as the player; story advancement still validates them.
function measurementFor(id) {
  const session = createCalibration(id);
  if (!session) return undefined;
  for (const [index, channel] of calibrationView(session).channels.entries()) {
    assert.equal(setCalibrationValue(session, index, (channel.targetAngle - channel.sourceAngle + 360) % 360), true);
  }
  assert.equal(calibrationView(session).ready, true);
  return { values: session.values };
}

function poweredStory() {
  const state = createStory();
  for (const id of ['signal', 'breach', 'fuse', 'power', 'log']) interact(state, id);
  return state;
}

function returnedStory() {
  const state = poweredStory();
  for (const id of ['relay-2', 'relay-1', 'relay-3', 'blackbox', 'beacon']) interact(state, id);
  return state;
}

test('mystery loop connects the wreck, first return, field calibration and final offline return', () => {
  const state = createStory();
  const route = ['signal', 'breach', 'fuse', 'power', 'log', 'relay-2', 'relay-1', 'relay-3', 'blackbox', 'beacon', 'echo', 'capsule', 'rift', 'beacon'];
  for (const id of route) {
    assert.equal(objective(state).target, id);
    assert.ok(pointIds.has(id));
    const result = interact(state, id, measurementFor(id));
    assert.equal(result.changed, true, id);
    assert.ok(result.message.length > 0);
  }
  assert.equal(state.flags.complete, true);
  assert.equal(objective(state).target, null);
  assert.ok(Object.values(state.flags).every(Boolean));
  assert.equal(getJournal(state).length, 15);
});

test('reaching a landmark out of order cannot bypass power, records or the sealed gate', () => {
  const state = createStory();
  for (const id of ['fuse', 'power', 'log', 'relay-2', 'blackbox', 'beacon', 'rift', 'not-a-point']) {
    assert.equal(interact(state, id).changed, false, id);
  }
  assert.deepEqual(state, createStory());
  interact(state, 'breach');
  assert.equal(state.flags.entered, true, 'entry is physical, not blocked by skipping a radio');
  interact(state, 'fuse');
  assert.equal(state.flags.fuse, true);
  interact(state, 'power');
  assert.equal(interact(state, 'relay-2').changed, false, 'must read the explicit clue first');
  assert.deepEqual(state.sequence, []);
});

test('the clue explicitly maps named symbols to real terminals', () => {
  const state = poweredStory();
  const text = getJournal(state).find(entry => entry.title.startsWith('05')).text;
  for (const clue of ['先裂，再环，最后星', '二号', '一号', '三号', '按错会清空']) assert.ok(text.includes(clue));
  assert.match(interact(state, 'log').message, /二号「裂」.*一号「环」.*三号「星」/);
});

test('a wrong relay clears the partial sequence and can be retried to completion', () => {
  const state = poweredStory();
  interact(state, 'relay-2');
  assert.deepEqual(state.sequence, [2]);
  const failure = interact(state, 'relay-3');
  assert.equal(failure.changed, true);
  assert.match(failure.message, /清空/);
  assert.deepEqual(state.sequence, []);
  assert.equal(state.flags.gateOpen, false);
  assert.equal(objective(state).target, 'relay-2');
  assert.equal(interact(state, 'relay-1').changed, false, 'empty sequence does not create a fake save change');
  for (const id of ['relay-2', 'relay-1', 'relay-3']) interact(state, id);
  assert.equal(state.flags.gateOpen, true);
});

test('pickups, calibrations, the opened gate and each return are idempotent', () => {
  const state = createStory();
  for (const id of ['signal', 'breach', 'fuse', 'power', 'log', 'relay-2', 'relay-1', 'relay-3', 'blackbox', 'beacon', 'echo', 'capsule', 'rift', 'beacon']) {
    interact(state, id, measurementFor(id));
    if (!id.startsWith('relay-')) {
      const snapshot = JSON.stringify(state);
      assert.equal(interact(state, id).changed, false, id);
      assert.equal(interact(state, id, measurementFor(id)).changed, false, `${id} measured again`);
      assert.equal(JSON.stringify(state), snapshot, id);
    }
  }
  const snapshot = JSON.stringify(state);
  for (const id of ['relay-1', 'relay-2', 'relay-3']) assert.equal(interact(state, id).changed, false);
  assert.equal(JSON.stringify(state), snapshot);
  assert.equal(new Set(state.logs).size, state.logs.length);
});

test('optional anomalies enrich the journal without gating the main route', () => {
  const state = createStory();
  interact(state, 'echo');
  interact(state, 'capsule');
  assert.equal(getJournal(state).length, 3);
  assert.equal(objective(state).target, 'signal');
  assert.ok(Object.values(state.flags).every(value => !value));
});

test('save round-trip preserves partial relay progress and optional discoveries', () => {
  const state = poweredStory();
  interact(state, 'relay-2');
  interact(state, 'echo');
  const restored = restoreStory(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored, state);
  assert.notEqual(restored.flags, state.flags);
  assert.notEqual(restored.sequence, state.sequence);
  assert.equal(objective(restored).target, 'relay-1');
  for (const id of ['relay-1', 'relay-3', 'blackbox', 'beacon']) interact(restored, id);
  assert.equal(restoreStory(restored).flags.returned, true);
  assert.equal(restoreStory(restored).flags.complete, false);
});

test('contradictory save flags are clipped to their prerequisites', () => {
  const state = restoreStory({ flags: { signal: true, entered: false, fuse: true, power: true, log: true, gateOpen: true, blackbox: true, complete: true }, sequence: [2, 1, 3], logs: ['complete'] });
  assert.deepEqual(state.flags, { ...createStory().flags, signal: true });
  assert.deepEqual(state.sequence, []);
  assert.deepEqual(state.logs, ['signal']);
  assert.equal(objective(state).target, 'breach');
});

test('untrusted saves cannot inject text, flags or an invalid relay order', () => {
  for (const raw of [null, undefined, 4, 'saved', [], { flags: [] }, { flags: null }]) assert.deepEqual(restoreStory(raw), createStory());
  const raw = JSON.parse('{"flags":{"signal":"true","entered":1,"complete":true,"__proto__":{"polluted":true}},"logs":["<script>alert(1)</script>",{"title":"injected"}],"sequence":[2,1,3,4],"extra":"no"}');
  assert.deepEqual(restoreStory(raw), createStory());
  assert.equal({}.polluted, undefined);
  for (const sequence of [[1], [2, 3], [2, 1, 3], ['2'], [2, 1, 3, 4], '21', { 0: 2 }]) {
    const state = poweredStory();
    state.sequence = sequence;
    assert.deepEqual(restoreStory(state).sequence, []);
  }
  const inherited = Object.create({ signal: true, entered: true });
  assert.deepEqual(restoreStory({ flags: inherited }), createStory());
});

test('restored completed relay normalizes its sequence and journals return immutable copies', () => {
  const state = poweredStory();
  for (const id of ['relay-2', 'relay-1', 'relay-3']) interact(state, id);
  state.sequence = [1, 3, 2];
  state.logs = ['log', 'log', '<img onerror=alert(1)>'];
  const restored = restoreStory(state);
  assert.deepEqual(restored.sequence, [2, 1, 3]);
  assert.equal(restored.logs.length, 6);
  const journal = getJournal(restored);
  journal[0].text = 'overwritten';
  assert.notEqual(getJournal(restored)[0].text, 'overwritten');
});

test('first return starts a new investigation and old optional logs do not count as calibrated samples', () => {
  const state = poweredStory();
  for (const id of ['echo', 'capsule', 'relay-2', 'relay-1', 'relay-3', 'blackbox', 'beacon']) interact(state, id);
  assert.equal(state.flags.returned, true);
  assert.equal(state.flags.complete, false);
  assert.equal(state.flags.echoCalibrated, false);
  assert.equal(state.flags.capsuleCalibrated, false);
  assert.equal(objective(state).target, 'echo');
  assert.match(objective(state).detail, /0\/2/);
  assert.match(objective(state).detail, /顺序不限/);
  assert.match(interact(state, 'rift').message, /两处/);
  assert.equal(interact(state, 'beacon').changed, false);
  assert.equal(interact(state, 'echo').changed, false, 'a field visit alone is no longer a measurement');
  assert.equal(interact(state, 'echo', measurementFor('echo')).changed, true, 'a prior optional discovery still requires new manual phase alignment');
  assert.equal(state.flags.echoCalibrated, true);
  assert.equal(objective(state).target, 'capsule');
  assert.equal(state.logs.filter(id => id === 'echo').length, 1);
});

test('field calibration works in either order and reveals the source only when both samples exist', () => {
  for (const order of [['echo', 'capsule'], ['capsule', 'echo']]) {
    const state = returnedStory();
    assert.equal(interact(state, 'rift').changed, false);
    assert.equal(interact(state, order[0], measurementFor(order[0])).changed, true);
    assert.equal(objective(state).target, order[1]);
    assert.match(objective(state).detail, /1\/2/);
    assert.equal(interact(state, 'rift').changed, false, 'a single sample is insufficient');
    assert.equal(state.flags.riftClosed, false);
    assert.equal(interact(state, 'beacon').changed, false, 'return cannot bypass the source');
    assert.match(interact(state, order[1], measurementFor(order[1])).message, /地下回声源已标入地图/);
    assert.equal(objective(state).target, 'rift');
    assert.equal(interact(state, 'rift', measurementFor('rift')).changed, true);
    assert.equal(state.flags.complete, false, 'source closure still requires an offline return');
    assert.equal(objective(state).target, 'beacon');
    assert.equal(interact(state, 'beacon').changed, true);
    assert.equal(state.flags.complete, true);
  }
});

test('chapter two records explain the field procedure without revealing the source in advance', () => {
  const state = returnedStory();
  const returned = getJournal(state).find(entry => entry.title.startsWith('08'));
  assert.match(returned.text, /旧调查记录.*不能用于定位/);
  assert.equal(getJournal(state).some(entry => entry.title.startsWith('11')), false);
  interact(state, 'capsule', measurementFor('capsule'));
  const maintenance = getJournal(state).find(entry => entry.title.startsWith('10'));
  for (const clue of ['先隔离上行', '两端实测相位', '不可使用缓存样本', '不要回答']) assert.ok(maintenance.text.includes(clue));
  interact(state, 'echo', measurementFor('echo'));
  interact(state, 'rift', measurementFor('rift'));
  assert.match(getJournal(state).find(entry => entry.title.startsWith('11')).text, /不向深处发送/);
  assert.match(interact(state, 'blackbox').message, /返回信标隔离保存/);
});

test('legacy completed saves migrate to the first return and must perform new field calibration', () => {
  const old = returnedStory();
  delete old.chapterVersion;
  old.flags.complete = true;
  old.flags.echoCalibrated = true;
  old.flags.capsuleCalibrated = true;
  old.flags.riftClosed = true;
  old.logs.push('echo', 'capsule', 'complete');
  const restored = restoreStory(old);
  assert.equal(restored.chapterVersion, 2);
  assert.equal(restored.flags.blackbox, true);
  assert.equal(restored.flags.returned, true);
  for (const flag of ['echoCalibrated', 'capsuleCalibrated', 'riftClosed', 'complete']) assert.equal(restored.flags[flag], false, flag);
  assert.ok(restored.logs.includes('echo'));
  assert.ok(restored.logs.includes('capsule'));
  assert.ok(!restored.logs.includes('complete'));
  assert.equal(objective(restored).target, 'echo');
  assert.deepEqual(restoreStory(restored), restored, 'migration is stable after the first load');
  for (const id of ['capsule', 'echo', 'rift', 'beacon']) interact(restored, id, measurementFor(id));
  assert.equal(restored.flags.complete, true);
  assert.equal(restoreStory(restored).flags.complete, true, 'new completed saves do not migrate again');
});

test('legacy unfinished progress is preserved without granting the first return', () => {
  const old = poweredStory();
  delete old.chapterVersion;
  interact(old, 'relay-2');
  old.flags.returned = true;
  const restored = restoreStory(old);
  assert.equal(restored.flags.returned, false);
  assert.deepEqual(restored.sequence, [2]);
  assert.equal(objective(restored).target, 'relay-1');
});

test('chapter two saves preserve each calibration and remaining objective across reloads', () => {
  let state = returnedStory();
  for (const id of ['capsule', 'echo', 'rift', 'beacon']) {
    interact(state, id, measurementFor(id));
    const restored = restoreStory(JSON.parse(JSON.stringify(state)));
    assert.deepEqual(restored.flags, state.flags);
    assert.deepEqual(objective(restored), objective(state));
    assert.deepEqual(getJournal(restored), getJournal(state));
    state = restored;
  }
  assert.equal(state.flags.complete, true);
});

test('chapter two save sanitization enforces all prerequisites and ignores forged log completion', () => {
  const base = createStory();
  const forged = restoreStory({ ...base, flags: { ...base.flags, returned: true, echoCalibrated: true, capsuleCalibrated: true, riftClosed: true, complete: true }, logs: ['returned', 'echoCalibrated', 'capsuleCalibrated', 'riftClosed', 'complete'] });
  assert.deepEqual(forged, base);
  for (const missing of ['returned', 'echoCalibrated', 'capsuleCalibrated', 'riftClosed']) {
    const state = returnedStory();
    for (const flag of ['echoCalibrated', 'capsuleCalibrated', 'riftClosed', 'complete']) state.flags[flag] = true;
    state.flags[missing] = false;
    const restored = restoreStory(state);
    assert.equal(restored.flags.complete, false, missing);
    if (missing !== 'riftClosed') assert.equal(restored.flags.riftClosed, false, missing);
    if (missing === 'returned') {
      assert.equal(restored.flags.echoCalibrated, false);
      assert.equal(restored.flags.capsuleCalibrated, false);
    }
  }
  const state = returnedStory();
  state.flags.echoCalibrated = 'true';
  state.flags.capsuleCalibrated = 1;
  state.logs.push('echoCalibrated', 'capsuleCalibrated');
  const restored = restoreStory(state);
  assert.equal(restored.flags.echoCalibrated, false);
  assert.equal(restored.flags.capsuleCalibrated, false);
});

test('fresh field visits reject missing, malformed, wrong and mismatched-site phase data without mutating the story', () => {
  const state = returnedStory();
  const before = JSON.stringify(state);
  const invalid = [undefined, null, true, [], {}, { values: null }, { values: [0, 0, 0] },
    { values: [240, 120] }, { values: [240, 120, 300, 0] }, { values: ['240', 120, 300] },
    { values: [240, NaN, 300] }, { values: [240, 120, Infinity] }, { values: [240, 120, 660] },
    measurementFor('capsule'), measurementFor('rift')];
  for (const measurement of invalid) {
    assert.equal(interact(state, 'echo', measurement).changed, false);
    assert.equal(JSON.stringify(state), before);
  }
  assert.match(interact(state, 'echo').message, /现场调谐.*0°/);
  assert.equal(interact(state, 'echo', measurementFor('echo')).changed, true);
  assert.equal(interact(state, 'capsule', measurementFor('capsule')).changed, true);
  const sampled = JSON.stringify(state);
  for (const measurement of [undefined, { values: [0, 0, 0] }, measurementFor('echo')]) {
    assert.equal(interact(state, 'rift', measurement).changed, false);
    assert.equal(JSON.stringify(state), sampled);
  }
  assert.match(interact(state, 'rift').message, /现场调谐.*180°/);
  assert.equal(interact(state, 'rift', measurementFor('rift')).changed, true);
});

test('a solved phase cannot bypass original-clock acquisition or the pair of independent samples', () => {
  const state = createStory();
  interact(state, 'echo', measurementFor('echo'));
  interact(state, 'capsule', measurementFor('capsule'));
  assert.deepEqual(state.flags, createStory().flags, 'before first return these are only optional journal readings');
  assert.equal(state.logs.length, 2);
  assert.equal(interact(state, 'rift', measurementFor('rift')).changed, false);
  const returned = returnedStory();
  assert.equal(interact(returned, 'rift', measurementFor('rift')).changed, false);
  interact(returned, 'echo', measurementFor('echo'));
  assert.equal(interact(returned, 'rift', measurementFor('rift')).changed, false);
  assert.equal(returned.flags.riftClosed, false);
  assert.equal(interact(returned, 'survey-west', measurementFor('survey-west')).changed, false, 'survey progress belongs to the expedition system, not story flags');
});
