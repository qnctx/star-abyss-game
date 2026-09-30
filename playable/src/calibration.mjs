// Field measurements are deterministic clues, not hidden guesses or timed reflex checks.
// Sources stay fixed for a location; only a player's three compensation angles change.
const CHANNEL_NAMES = Object.freeze(['裂', '环', '星']);
const PROFILES = Object.freeze({
  echo: { title: '无名石碑 · 现场相位', source: [120, 240, 60], target: 0 },
  capsule: { title: '空的逃生舱 · 原始时钟', source: [45, 195, 300], target: 0 },
  rift: { title: '地下回声源 · 反相隔离', source: [270, 90, 225], target: 180 },
  'survey-west': { title: '断环观测架 · 余波校准', source: [75, 210, 330], target: 0 },
  'survey-east': { title: '埋沙镜阵 · 镜面时差', source: [300, 135, 30], target: 0 },
  'survey-north': { title: '倾斜石柱 · 静默基准', source: [165, 315, 105], target: 0 },
});

function profileFor(id) {
  return typeof id === 'string' && Object.hasOwn(PROFILES, id) ? PROFILES[id] : null;
}

function validAngle(value) {
  return typeof value === 'number' && Number.isFinite(value)
    && value >= 0 && value <= 345 && value % 15 === 0;
}

function validValues(values) {
  return Array.isArray(values) && values.length === 3
    && [0, 1, 2].every(index => Object.hasOwn(values, index) && validAngle(values[index]));
}

function validSession(session) {
  return session !== null && typeof session === 'object' && !Array.isArray(session)
    && Object.hasOwn(session, 'id') && profileFor(session.id)
    && Object.hasOwn(session, 'values') && validValues(session.values);
}

export function createCalibration(id) {
  return profileFor(id) ? { id, values: [0, 0, 0] } : null;
}

// Invalid input is rejected rather than rounded, coerced or written into the session.
export function setCalibrationValue(session, index, value) {
  if (!validSession(session) || !Number.isInteger(index) || index < 0 || index > 2 || !validAngle(value)) return false;
  session.values[index] = value;
  return true;
}

export function calibrationView(session) {
  if (!validSession(session)) return null;
  const profile = profileFor(session.id);
  const channels = CHANNEL_NAMES.map((name, index) => {
    const value = session.values[index];
    const phase = (profile.source[index] + value) % 360;
    const delta = Math.abs(phase - profile.target);
    const residual = Math.min(delta, 360 - delta);
    return { name, value, sourceAngle: profile.source[index], targetAngle: profile.target, residual, aligned: residual === 0 };
  });
  return {
    id: session.id,
    title: profile.title,
    instruction: profile.target === 180
      ? '只接收，不发送。将「实测相位 + 补偿」调到 180°，三路反相后切断返流；角度超过 360° 时从 0° 重新计。'
      : '以原始时钟为基准，将「实测相位 + 补偿」调到 0°，三路对齐后保存样本；角度达到 360° 等同于 0°。',
    mode: profile.target === 180 ? 'invert' : 'align',
    channels,
    ready: channels.every(channel => channel.aligned),
    quality: Math.round(100 * (1 - channels.reduce((sum, channel) => sum + channel.residual, 0) / 540)),
  };
}

export function calibrationMatches(id, values) {
  const profile = profileFor(id);
  return !!profile && validValues(values)
    && values.every((value, index) => (profile.source[index] + value) % 360 === profile.target);
}

export function requiresCalibration(story, id) {
  const flags = story?.flags;
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)
    || !Object.hasOwn(flags, 'returned') || flags.returned !== true) return false;
  if (id === 'echo' || id === 'capsule') return true;
  return id === 'rift' && Object.hasOwn(flags, 'echoCalibrated') && flags.echoCalibrated === true
    && Object.hasOwn(flags, 'capsuleCalibrated') && flags.capsuleCalibrated === true;
}
