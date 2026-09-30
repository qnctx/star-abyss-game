import { ENDURANCE, enduranceDrain } from './endurance.mjs';
export const STAMINA = Object.freeze({ max: ENDURANCE.capacity, drain: enduranceDrain(), delay: 1.5, walkingRecovery: 8, restingRecovery: 14, restart: 25 });
const clamp = (value, max) => Math.max(0, Math.min(max, value));
const sprintDrain = rules => enduranceDrain(rules?.sprintDrain);

export function createStamina() {
  return { value: STAMINA.max, recoveryRemaining: 0, shiftHeld: false, armed: false, sprinting: false, moving: false };
}

// A new press grants a sprint session. Exhaustion disarms it until release/repress.
export function prepareSprint(state, controls) {
  const shift = !!controls.sprint;
  if (!shift) state.armed = false;
  else if (!state.shiftHeld) state.armed = state.value >= STAMINA.restart;
  state.shiftHeld = shift;
  if (state.value <= 0) state.armed = false;
  return state.armed && !!controls.forward && !controls.backward;
}

export function updateStamina(state, motion, delta, rules = {}) {
  const dt = Number.isFinite(delta) ? Math.max(0, delta) : 0;
  if (dt === 0) return;
  state.moving = !!motion.moving;
  state.sprinting = state.armed && state.shiftHeld && !!motion.sprinting && state.moving;
  if (state.sprinting) {
    // Evolution improves efficiency, never current resource values or recovery debt.
    state.value = Math.max(0, state.value - sprintDrain(rules) * dt);
    state.recoveryRemaining = STAMINA.delay;
    if (state.value < 1e-8) { state.value = 0; state.armed = false; state.sprinting = false; }
  } else if (state.shiftHeld) {
    // Holding sprint is never also resting, including while exhausted or at a wall.
    if (state.value < STAMINA.max) state.recoveryRemaining = STAMINA.delay;
  } else {
    const recoveryTime = Math.max(0, dt - state.recoveryRemaining);
    state.recoveryRemaining = Math.max(0, state.recoveryRemaining - dt);
    const rate = state.moving ? STAMINA.walkingRecovery : STAMINA.restingRecovery;
    state.value = Math.min(STAMINA.max, state.value + rate * recoveryTime);
  }
}

// Menu transitions reset only intent. They must not refill stamina or erase delay.
export function clearStaminaInput(state) {
  state.shiftHeld = false; state.armed = false; state.sprinting = false; state.moving = false;
}

export function serializeStamina(state) { return { value: state.value, recoveryRemaining: state.recoveryRemaining }; }
export function restoreStamina(raw, legacyCharge) {
  const state = createStamina();
  const value = Number.isFinite(raw?.value) ? raw.value : Number.isFinite(legacyCharge) ? legacyCharge : STAMINA.max;
  state.value = clamp(value, STAMINA.max);
  state.recoveryRemaining = Number.isFinite(raw?.recoveryRemaining) ? clamp(raw.recoveryRemaining, STAMINA.delay) : state.value < STAMINA.max ? STAMINA.delay : 0;
  return state;
}

export function staminaView(state, rules) {
  let phase, label;
  if (state.sprinting) { phase = 'sprinting'; label = '冲刺中 · 消耗体力'; }
  else if (state.shiftHeld && !state.armed) { phase = 'exhausted'; label = '体力不足 · 松开 Shift'; }
  else if (state.shiftHeld && state.value < STAMINA.max) { phase = 'held'; label = '松开 Shift 后恢复'; }
  else if (state.value >= STAMINA.max) { phase = 'ready'; label = '体力充沛'; }
  else if (state.recoveryRemaining > .01) { phase = 'delay'; label = `恢复等待 ${(Math.ceil(state.recoveryRemaining * 10) / 10).toFixed(1)} 秒`; }
  else { phase = 'recovering'; label = state.value < STAMINA.restart ? '恢复中 · 25% 可再冲刺' : state.moving ? '步行恢复中' : '休息恢复中'; }
  return { value: state.value, recoveryRemaining: state.recoveryRemaining, phase, label, canStart: state.value >= STAMINA.restart,
    ...(rules === undefined ? {} : { sprintDrain: sprintDrain(rules), maxSprintSeconds: STAMINA.max / sprintDrain(rules) }) };
}
