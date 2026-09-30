import { synthesizeFootstep, validContact } from './footstep-audio.mjs';

// Playback consumes real grounded contacts. It has no second gait clock.
export function createAudio(options = {}) {
  let context, muted = false, suspended = true, lastImpact = -Infinity, impactId = 0, contactCount = 0, lastContact = null, lastNumericContact = -Infinity;
  const voices = new Set(), contacts = new Set();
  function ready() { return !!context && !muted && !suspended && context.state === 'running'; }
  function wake() {
    try {
      const Context = options.AudioContextClass || globalThis.window?.AudioContext || globalThis.window?.webkitAudioContext;
      context ||= new Context(); suspended = false;
      context.resume()?.catch(() => {});
      return true;
    } catch { return false; }
  }
  function track(source, gain, extra, kind = 'device') {
    const voice = { source, gain, extra, kind }; voices.add(voice);
    source.onended = () => { voices.delete(voice); source.disconnect(); gain.disconnect(); extra?.disconnect(); };
  }
  function silence() {
    if (!context) return;
    const now = context.currentTime;
    for (const { source, gain } of voices) {
      try {
        gain.gain.cancelScheduledValues(now); gain.gain.setTargetAtTime(0, now, .003);
        source.stop(now + .015);
      } catch { /* A voice can finish while stopping it. */ }
    }
  }
  function tone(frequency, duration, volume = .035) {
    if (!ready()) return false;
    const oscillator = context.createOscillator(), gain = context.createGain(), now = context.currentTime;
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * .55, now + duration);
    gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain); gain.connect(context.destination); track(oscillator, gain);
    oscillator.start(now); oscillator.stop(now + duration);
    return true;
  }
  function playContact(event) {
    if (!ready()) return false;
    // A slow frame/test fast-forward must not pile a whole walk onto one audio
    // timestamp. Normal locomotion has at most two overlapping short tails.
    if ([...voices].filter(voice => voice.kind === 'contact').length >= 6) return false;
    const sound = synthesizeFootstep(event, { sampleRate: context.sampleRate });
    const buffer = context.createBuffer(1, sound.samples.length, sound.sampleRate);
    buffer.getChannelData(0).set(sound.samples);
    const source = context.createBufferSource(), gain = context.createGain();
    const panner = context.createStereoPanner?.();
    source.buffer = buffer; gain.gain.value = .64; source.connect(gain);
    if (panner) { panner.pan.value = event.foot * .075; gain.connect(panner); panner.connect(context.destination); }
    else gain.connect(context.destination);
    track(source, gain, panner, 'contact'); source.start(context.currentTime);
    return true;
  }
  function step(event) {
    if (!validContact(event)) return false;
    const id = `${typeof event.stanceId}:${event.stanceId}`;
    // Numeric stance IDs from locomotion are strictly increasing. A high-water
    // mark also rejects very old contacts after the bounded string cache rolls.
    if (typeof event.stanceId === 'number') {
      if (event.stanceId <= lastNumericContact) return false;
      lastNumericContact = event.stanceId;
    }
    if (contacts.has(id)) return false;
    // Consume suppressed contacts too: resume/unmute must not replay old steps.
    contacts.add(id); if (contacts.size > 64) contacts.delete(contacts.values().next().value);
    const played = playContact(event);
    if (played) { contactCount++; lastContact = { ...event }; }
    return played;
  }
  function impact(time, material = {}) {
    if (!Number.isFinite(time) || (time >= lastImpact && time - lastImpact <= .8)) return false;
    lastImpact = time;
    return playContact({ type: 'land', foot: 1, surface: material.surface === 'metal' ? 'metal' : 'rock', indoor: !!material.indoor, speed: 0, intensity: .65, stanceId: `impact-${impactId++}` });
  }
  function reset() { silence(); contacts.clear(); lastNumericContact = -Infinity; lastImpact = -Infinity; contactCount = 0; lastContact = null; }
  return {
    wake, step, impact, pulse() { return tone(620, .55, .025); }, interact() { return tone(190, .16); },
    suspend() { suspended = true; silence(); }, reset,
    snapshot() { return { contactCount, lastContact: lastContact ? { ...lastContact } : null, suspended, muted, activeVoices: voices.size }; },
    toggle() { muted = !muted; if (muted) silence(); return muted; }, get muted() { return muted; },
    dispose() { suspended = true; reset(); context?.close()?.catch(() => {}); context = undefined; },
  };
}
