// One duration contract for the evolution page, live resource spending and
// defensive limits. Resource percentages and saved levels remain unchanged.
const baseSeconds = 30, secondsPerLevel = 30, maxLevel = 3, capacity = 100;
const durations = Object.freeze(Array.from({ length: maxLevel + 1 }, (_, level) => baseSeconds + secondsPerLevel * level));
export const ENDURANCE = Object.freeze({ baseSeconds, secondsPerLevel, maxLevel, capacity, durations });

export function enduranceDrain(value) {
  const base = capacity / durations[0], minimum = capacity / durations[maxLevel];
  return Number.isFinite(value) ? Math.max(minimum, Math.min(base, value)) : base;
}
