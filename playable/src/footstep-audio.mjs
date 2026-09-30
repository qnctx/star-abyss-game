// Contact sound, not a gait clock. Outside, sole/suit structure conduction is
// dominant: thin atmosphere attenuates the airborne layer. Cabin reflections
// are short/weak, not a claim that the abandoned ship has breathable air.
export const FOOTSTEP_PROFILES = Object.freeze({
  dust: Object.freeze({ duration: .19, attack: .006, decay: .031, bodyHz: 135, scuffHz: 850, scuff: .11, grains: 0, hardness: .60 }),
  gravel: Object.freeze({ duration: .25, attack: .0035, decay: .029, bodyHz: 180, scuffHz: 2500, scuff: .15, grains: 9, hardness: .78 }),
  rock: Object.freeze({ duration: .15, attack: .0015, decay: .022, bodyHz: 270, scuffHz: 3900, scuff: .12, grains: 0, hardness: .92 }),
  metal: Object.freeze({ duration: .24, attack: .0018, decay: .024, bodyHz: 310, scuffHz: 3600, scuff: .10, grains: 0, hardness: .86 }),
});

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
export function validContact(event) {
  return !!event && ['step', 'land'].includes(event.type) && [-1, 1].includes(event.foot)
    && Object.hasOwn(FOOTSTEP_PROFILES, event.surface) && typeof event.indoor === 'boolean'
    && Number.isFinite(event.speed) && event.speed >= 0 && Number.isFinite(event.intensity) && event.intensity >= 0
    && ((typeof event.stanceId === 'number' && Number.isSafeInteger(event.stanceId))
      || (typeof event.stanceId === 'string' && event.stanceId.length > 0 && event.stanceId.length < 160));
}

function randomFor(key) {
  let seed = 2166136261;
  for (const character of String(key)) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  return () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
}

// Bounded microvariation is deterministic per contact; no global RNG or assets.
export function synthesizeFootstep(event, options = {}) {
  if (!validContact(event)) throw new TypeError('Invalid foot contact');
  const sampleRate = options.sampleRate ?? 48000;
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000) throw new RangeError('Invalid audio sample rate');
  const profile = FOOTSTEP_PROFILES[event.surface], landing = event.type === 'land';
  const duration = profile.duration + (landing ? .045 : 0), length = Math.ceil(duration * sampleRate);
  const samples = new Float32Array(length), random = randomFor(`${event.stanceId}:${event.foot}:${options.variation ?? 0}`);
  const strength = clamp(event.intensity, 0, 1.5), load = .65 + strength * .35 + (landing ? .22 : 0);
  const variation = .96 + random() * .08, bodyRate = 1 - Math.exp(-2 * Math.PI * profile.bodyHz * variation / sampleRate);
  const scuffRate = 1 - Math.exp(-2 * Math.PI * Math.min(sampleRate * .4, profile.scuffHz) / sampleRate);
  const lowRate = 1 - Math.exp(-2 * Math.PI * 280 / sampleRate);
  const grains = Array.from({ length: profile.grains }, (_, index) => ({
    at: .006 + (index + random() * .6) * .016, decay: .002 + random() * .004, amplitude: .13 + random() * .19,
  }));
  const modes = event.surface === 'metal' ? [233, 419, 733].map((frequency, index) => {
    const radius = Math.exp(-1 / (sampleRate * (.032 - index * .006)));
    return { feedback: 2 * radius * Math.cos(2 * Math.PI * frequency * variation / sampleRate), radius2: radius * radius, previous: 0, older: 0 };
  }) : [];
  let body = 0, scuff = 0, low = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate, noise = random() * 2 - 1;
    body += bodyRate * (noise - body); scuff += scuffRate * (noise - scuff); low += lowRate * (noise - low);
    const attack = 1 - Math.exp(-t / profile.attack);
    const bodyEnvelope = attack * Math.exp(-t / (profile.decay * (landing ? 1.5 : 1)));
    const scuffEnvelope = (1 - Math.exp(-t / .014)) * Math.exp(-t / .050);
    let contact = body * bodyEnvelope * 5.6 + (scuff - low) * scuffEnvelope * profile.scuff;
    for (const grain of grains) {
      const age = t - grain.at;
      if (age >= 0 && age < grain.decay * 6) contact += noise * grain.amplitude * Math.exp(-age / grain.decay);
    }
    for (const mode of modes) {
      // Noise-excited, rapidly damped panel modes, not beep oscillators.
      const value = noise * attack * Math.exp(-t / .005) * .0015 + mode.feedback * mode.previous - mode.radius2 * mode.older;
      mode.older = mode.previous; mode.previous = value; contact += value * .7;
    }
    samples[i] = contact * profile.hardness * load;
  }
  if (event.indoor) {
    const original = samples.slice(), first = Math.round(sampleRate * .011), second = Math.round(sampleRate * .019);
    for (let i = first; i < length; i++) samples[i] += original[i - first] * .10 + (i >= second ? original[i - second] * .055 : 0);
  }
  const cutoff = event.indoor ? 5400 : 1350, filterRate = 1 - Math.exp(-2 * Math.PI * cutoff / sampleRate);
  const transmission = event.indoor ? .84 : .65;
  let filtered = 0, peak = 0;
  for (let i = 0; i < length; i++) {
    filtered += filterRate * (samples[i] - filtered);
    const tail = clamp((length - 1 - i) / (sampleRate * .022), 0, 1);
    // Soft limiting preserves material transients without clipping hard landings.
    samples[i] = Math.tanh(filtered * 1.9) * .25 * transmission * tail;
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  samples[0] = 0; samples[length - 1] = 0;
  if (!strength) samples.fill(0);
  return { samples, sampleRate, duration: length / sampleRate, surface: event.surface, foot: event.foot, peak: strength ? peak : 0 };
}
