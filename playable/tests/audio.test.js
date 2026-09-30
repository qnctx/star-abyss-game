const test = require('node:test');
const assert = require('node:assert/strict');

const modules = Promise.all([import('../src/footstep-audio.mjs'), import('../src/audio.mjs')]);
const contact = (overrides = {}) => ({ type: 'step', foot: -1, surface: 'dust', indoor: false, speed: 4.7, intensity: .55, stanceId: 1, ...overrides });
const rms = samples => Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
const roughness = samples => {
  let difference = 0, power = 0;
  for (let i = 1; i < samples.length; i++) { difference += (samples[i] - samples[i - 1]) ** 2; power += samples[i] ** 2; }
  return difference / Math.max(power, 1e-20);
};

test('four contact materials synthesize finite bounded transients at supported sample rates', async () => {
  const [{ synthesizeFootstep, FOOTSTEP_PROFILES }] = await modules;
  assert.deepEqual(Object.keys(FOOTSTEP_PROFILES), ['dust', 'gravel', 'rock', 'metal']);
  for (const sampleRate of [8000, 22050, 44100, 48000, 96000]) {
    for (const surface of Object.keys(FOOTSTEP_PROFILES)) {
      for (const type of ['step', 'land']) {
        const sound = synthesizeFootstep(contact({ surface, type, indoor: surface === 'metal', intensity: 100 }), { sampleRate });
        assert.equal(sound.samples.length, Math.ceil(sound.duration * sampleRate));
        assert.ok(sound.duration >= .15 && sound.duration < .30);
        assert.ok(sound.samples.every(value => Number.isFinite(value) && Math.abs(value) <= .25));
        assert.equal(sound.samples[0], 0); assert.equal(sound.samples.at(-1), 0);
        assert.ok(rms(sound.samples) > .0005 && rms(sound.samples) < .10);
      }
    }
  }
});

test('dust, gravel, stone and metal differ in waveform, energy and texture', async () => {
  const [{ synthesizeFootstep }] = await modules;
  const sounds = Object.fromEntries(['dust', 'gravel', 'rock', 'metal'].map(surface => [surface, synthesizeFootstep(contact({ surface, indoor: false }))]));
  const energies = Object.values(sounds).map(sound => rms(sound.samples));
  assert.equal(new Set(energies.map(value => value.toFixed(5))).size, 4);
  assert.ok(roughness(sounds.gravel.samples) > roughness(sounds.dust.samples) * 1.8);
  assert.ok(roughness(sounds.rock.samples) > roughness(sounds.dust.samples));
  assert.ok(energies[0] < energies[2]);
  // Gravel has a scattering tail after the initial impact; stone decays quickly.
  const tail = sound => rms(sound.samples.slice(Math.floor(sound.sampleRate * .080)));
  assert.ok(tail(sounds.gravel) > tail(sounds.rock) * 2);
});

test('outdoor transmission attenuates high frequencies and level; cabin reflection remains short', async () => {
  const [{ synthesizeFootstep }] = await modules;
  for (const surface of ['dust', 'gravel', 'rock', 'metal']) {
    const outside = synthesizeFootstep(contact({ surface }));
    const inside = synthesizeFootstep(contact({ surface, indoor: true }));
    assert.ok(rms(outside.samples) < rms(inside.samples));
    assert.ok(roughness(outside.samples) < roughness(inside.samples));
    assert.equal(outside.duration, inside.duration);
    assert.ok(inside.duration <= .25);
  }
});

test('same contact is deterministic; feet and successive contacts have bounded variation', async () => {
  const [{ synthesizeFootstep }] = await modules;
  const first = synthesizeFootstep(contact({ surface: 'rock' }));
  assert.deepEqual(first.samples, synthesizeFootstep(contact({ surface: 'rock' })).samples);
  for (const change of [{ foot: 1 }, { stanceId: 2 }, { stanceId: 10000 }]) {
    const next = synthesizeFootstep(contact({ surface: 'rock', ...change }));
    assert.notDeepEqual(first.samples, next.samples);
    const ratio = rms(next.samples) / rms(first.samples);
    assert.ok(ratio > .6 && ratio < 1.7, `variation RMS ratio ${ratio}`);
  }
});

test('running load is stronger, landing longer; zero load is silent and force is bounded', async () => {
  const [{ synthesizeFootstep }] = await modules;
  const walking = synthesizeFootstep(contact({ intensity: .4, speed: 2 }));
  const running = synthesizeFootstep(contact({ intensity: 1.1, speed: 8.6 }));
  const landing = synthesizeFootstep(contact({ type: 'land', intensity: 1.4 }));
  assert.ok(rms(running.samples) > rms(walking.samples) * 1.10);
  assert.ok(landing.duration > running.duration);
  assert.ok(rms(landing.samples) > rms(walking.samples));
  assert.equal(rms(synthesizeFootstep(contact({ intensity: 0 })).samples), 0);
  assert.deepEqual(synthesizeFootstep(contact({ intensity: 1.5 })).samples, synthesizeFootstep(contact({ intensity: 1000 })).samples);
});

test('invalid or legacy pace calls cannot produce a footstep', async () => {
  const [{ synthesizeFootstep, validContact }] = await modules;
  for (const input of [null, 3.14, {}, contact({ type: 'fly' }), contact({ surface: 'unknown' }), contact({ speed: NaN }), contact({ intensity: Infinity }), contact({ stanceId: NaN }), contact({ foot: 0 }), contact({ indoor: undefined })]) {
    assert.equal(validContact(input), false);
    assert.throws(() => synthesizeFootstep(input), TypeError);
  }
  for (const sampleRate of [0, 7999, Infinity, 48000.1, 96001]) assert.throws(() => synthesizeFootstep(contact(), { sampleRate }), RangeError);
});

function fakeAudio() {
  const instances = [];
  class Parameter {
    value = 0; operations = [];
    setValueAtTime(...args) { this.operations.push(['set', ...args]); this.value = args[0]; }
    exponentialRampToValueAtTime(...args) { this.operations.push(['ramp', ...args]); }
    cancelScheduledValues(...args) { this.operations.push(['cancel', ...args]); }
    setTargetAtTime(...args) { this.operations.push(['target', ...args]); }
  }
  class Node {
    gain = new Parameter(); frequency = new Parameter(); pan = new Parameter(); starts = []; stops = []; connections = []; disconnected = false;
    connect(node) { this.connections.push(node); return node; }
    disconnect() { this.disconnected = true; }
    start(time) { this.starts.push(time); }
    stop(time) { this.stops.push(time); }
    end() { this.onended?.(); }
  }
  class Context {
    state = 'running'; sampleRate = 22050; currentTime = 10; destination = {}; sources = []; oscillators = []; gains = []; panners = [];
    constructor() { instances.push(this); }
    resume() { this.state = 'running'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
    createBuffer(channels, length, sampleRate) { assert.equal(channels, 1); const values = new Float32Array(length); return { sampleRate, getChannelData: () => values }; }
    createBufferSource() { const node = new Node(); this.sources.push(node); return node; }
    createGain() { const node = new Node(); this.gains.push(node); return node; }
    createOscillator() { const node = new Node(); this.oscillators.push(node); return node; }
    createStereoPanner() { const node = new Node(); this.panners.push(node); return node; }
  }
  return { Context, instances };
}

test('playback requires wake and does not replay contacts missed before wake', async () => {
  const [, { createAudio }] = await modules, fake = fakeAudio(), audio = createAudio({ AudioContextClass: fake.Context });
  assert.equal(audio.step(contact()), false); assert.equal(fake.instances.length, 0);
  assert.equal(audio.wake(), true);
  assert.equal(audio.step(contact()), false);
  assert.equal(audio.step(contact({ stanceId: 2 })), true);
  assert.equal(fake.instances[0].sources.length, 1);
  assert.equal(fake.instances[0].oscillators.length, 0);
  assert.equal(audio.snapshot().contactCount, 1);
});

test('one contact produces one noise buffer, slight left/right pan, immutable diagnostics', async () => {
  const [, { createAudio }] = await modules, fake = fakeAudio(), audio = createAudio({ AudioContextClass: fake.Context });
  audio.wake(); assert.equal(audio.step(contact()), true); assert.equal(audio.step(contact()), false);
  assert.equal(audio.step(contact({ stanceId: 2, foot: 1 })), true);
  const ctx = fake.instances[0]; assert.equal(ctx.sources.length, 2); assert.equal(ctx.oscillators.length, 0);
  assert.equal(ctx.panners[0].pan.value, -.075); assert.equal(ctx.panners[1].pan.value, .075);
  assert.equal(audio.snapshot().contactCount, 2);
  audio.snapshot().lastContact.stanceId = 999;
  assert.equal(audio.snapshot().lastContact.stanceId, 2);
  ctx.sources.forEach(source => source.end());
  assert.equal(audio.snapshot().activeVoices, 0);
  assert.ok(ctx.sources.every(source => source.disconnected));
});

test('pause quickly fades pending audio and never queues or catches up old contacts', async () => {
  const [, { createAudio }] = await modules, fake = fakeAudio(), audio = createAudio({ AudioContextClass: fake.Context });
  audio.wake(); audio.step(contact()); audio.pulse();
  const ctx = fake.instances[0]; audio.suspend();
  assert.equal(audio.snapshot().suspended, true);
  assert.ok([...ctx.sources, ...ctx.oscillators].every(source => source.stops.at(-1) === 10.015));
  assert.ok(ctx.gains.every(gain => gain.gain.operations.some(operation => operation[0] === 'target' && operation[1] === 0)));
  assert.equal(audio.step(contact({ stanceId: 2 })), false); assert.equal(audio.interact(), false);
  audio.wake(); assert.equal(audio.step(contact()), false); assert.equal(audio.step(contact({ stanceId: 2 })), false);
  assert.equal(audio.step(contact({ stanceId: 3 })), true); assert.equal(audio.snapshot().contactCount, 2);
});

test('muting stops tails, silent contacts are consumed and reset permits a fresh game', async () => {
  const [, { createAudio }] = await modules, fake = fakeAudio(), audio = createAudio({ AudioContextClass: fake.Context });
  audio.wake(); audio.step(contact()); assert.equal(audio.toggle(), true);
  assert.equal(audio.step(contact({ stanceId: 2 })), false);
  assert.equal(audio.toggle(), false); assert.equal(audio.step(contact({ stanceId: 2 })), false);
  audio.reset(); assert.equal(audio.snapshot().contactCount, 0); assert.equal(audio.snapshot().lastContact, null);
  assert.equal(audio.step(contact()), true); audio.dispose(); assert.equal(fake.instances[0].state, 'closed');
  assert.equal(audio.step(contact({ stanceId: 3 })), false);
});

test('rock collisions are throttled contact noise while intentional device feedback stays electronic', async () => {
  const [, { createAudio }] = await modules, fake = fakeAudio(), audio = createAudio({ AudioContextClass: fake.Context });
  audio.wake(); assert.equal(audio.impact(1), true); assert.equal(audio.impact(1.2), false);
  assert.equal(audio.impact(NaN), false); assert.equal(audio.impact(2), true);
  assert.equal(fake.instances[0].oscillators.length, 0); assert.equal(fake.instances[0].sources.length, 2);
  audio.pulse(); audio.interact(); assert.equal(fake.instances[0].oscillators.length, 2);
  // Collision diagnostics do not masquerade as gait foot contacts.
  assert.equal(audio.snapshot().contactCount, 0);
});

test('stalled-frame contact burst is bounded and dropped contacts are never queued', async () => {
  const [, { createAudio }] = await modules, fake = fakeAudio(), audio = createAudio({ AudioContextClass: fake.Context });
  audio.wake();
  for (let stanceId = 1; stanceId <= 24; stanceId++) audio.step(contact({ stanceId }));
  const ctx = fake.instances[0]; assert.equal(ctx.sources.length, 6);
  assert.equal(audio.snapshot().contactCount, 6);
  ctx.sources.forEach(source => source.end());
  assert.equal(audio.step(contact({ stanceId: 24 })), false);
  assert.equal(audio.step(contact({ stanceId: 25 })), true);
});

test('monotonic numeric contacts cannot replay after a long muted interval', async () => {
  const [, { createAudio }] = await modules, fake = fakeAudio(), audio = createAudio({ AudioContextClass: fake.Context });
  audio.wake(); audio.toggle();
  for (let stanceId = 1; stanceId <= 120; stanceId++) audio.step(contact({ stanceId }));
  audio.toggle();
  assert.equal(audio.step(contact()), false);
  assert.equal(audio.step(contact({ stanceId: 120, foot: 1, type: 'land' })), false);
  assert.equal(audio.step(contact({ stanceId: 121 })), true);
});

test('collision material and enclosed environment choose metal structure instead of outdoor rock', async () => {
  const [, { createAudio }] = await modules, fake = fakeAudio(), audio = createAudio({ AudioContextClass: fake.Context });
  audio.wake(); audio.impact(1); audio.impact(2, { surface: 'metal', indoor: true });
  const [rock, metal] = fake.instances[0].sources;
  assert.ok(metal.buffer.getChannelData(0).length > rock.buffer.getChannelData(0).length);
  assert.notEqual(rms(rock.buffer.getChannelData(0)), rms(metal.buffer.getChannelData(0)));
  assert.equal(fake.instances[0].oscillators.length, 0);
});
