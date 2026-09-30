import { WORLD, collides, supportHeight, terrainHeight, surfaceAt } from './layout.mjs';
import { groundMobilityBlocked } from './mobility.mjs';
import { STAMINA } from './stamina.mjs';
import { movementHeading } from './movement.mjs';

export const DASH = Object.freeze({ duration: .35, distance: 4, cooldown: 6 });
const SAMPLE = .1;
const clamp = (value, max) => Math.max(0, Math.min(max, value));

// Only the cooldown survives a reload; displacement and effects are transient.
export function createDash(raw) {
  return { active: false, remaining: 0, cooldown: Number.isFinite(raw?.cooldown) ? clamp(raw.cooldown, DASH.cooldown) : 0,
    dirX: 0, dirZ: -1, distance: 0, origin: null, serial: 0 };
}
export function serializeDash(state) { return { cooldown: clamp(state.cooldown, DASH.cooldown) }; }

function clearAt(x, z, context) {
  return context.mobility ? !groundMobilityBlocked(x, z, context.mobility, context.gateOpen) : !collides(x, z, context.gateOpen);
}
function stepHeight(player, x, z, context) {
  if (!clearAt(x, z, context)) return null;
  const floor = supportHeight(x, z, WORLD.radius), feet = Number.isFinite(player.y) ? player.y : terrainHeight(player.x, player.z);
  // Follow continuous ground, never project a horizontal dash onto a ledge below.
  const span = Math.hypot(x - player.x, z - player.z);
  if (Math.abs(floor - feet) > Math.max(.035, span * .8)) return null;
  return floor;
}
function grounded(player, context) {
  return context.grounded === true && !context.mounted && !context.mobility?.vehicle.mounted && !context.mobility?.flight.airborne;
}
function stop(state, player) { state.active = false; state.remaining = 0; player.vx = 0; player.vz = 0; }

export function startDash(state, player, stamina, controls = {}, context = {}) {
  if (state.active) return { changed: false, message: '正在矢量闪避。' };
  if (state.cooldown > 1e-8) return { changed: false, message: `闪避恢复中 · ${state.cooldown.toFixed(1)} 秒` };
  if (!grounded(player, context)) return { changed: false, message: '矢量闪避需要落地并离开载具。' };
  const duration = Number.isFinite(context.sprintDuration) && context.sprintDuration > 0 ? context.sprintDuration : 30;
  const cost = STAMINA.max / duration * 6;
  if (!Number.isFinite(stamina.value) || stamina.value + 1e-8 < cost) return { changed: false, message: `体力不足 · 闪避需要 ${cost.toFixed(1)}%` };
  let forward = Number(!!controls.forward) - Number(!!controls.backward), side = Number(!!controls.right) - Number(!!controls.left);
  if (!forward && !side) forward = 1;
  const length = Math.hypot(forward, side), yaw = movementHeading(player);
  const dirX = (-Math.sin(yaw) * forward + Math.cos(yaw) * side) / length;
  const dirZ = (-Math.cos(yaw) * forward - Math.sin(yaw) * side) / length;
  if (!clearAt(player.x, player.z, context) || stepHeight(player, player.x + dirX * SAMPLE, player.z + dirZ * SAMPLE, context) === null)
    return { changed: false, message: '前方没有安全的闪避空间。' };
  Object.assign(state, { active: true, remaining: DASH.duration, cooldown: DASH.cooldown, dirX, dirZ, distance: 0,
    origin: { x: player.x, y: Number.isFinite(player.y) ? player.y : terrainHeight(player.x, player.z), z: player.z }, serial: state.serial + 1 });
  stamina.value = Math.max(0, stamina.value - cost);
  stamina.recoveryRemaining = STAMINA.delay;
  stamina.sprinting = false;
  // Never manufacture a fresh Shift press or clear an exhausted sprint latch.
  if (stamina.value <= 1e-8) { stamina.value = 0; stamina.armed = false; }
  player.vx = 0; player.vz = 0;
  return { changed: true, message: '矢量闪避 · 无无敌保护' };
}

// Call exactly once per running simulation frame, including while inactive.
// The caller skips ordinary movement and stamina recovery on non-null motion.
export function stepDash(state, player, stamina, delta, context = {}) {
  const dt = Number.isFinite(delta) ? clamp(delta, .05) : 0;
  state.cooldown = Math.max(0, state.cooldown - dt);
  if (!state.active) return null;
  let distance = 0, blocked = false;
  if (dt > 0) {
    if (!grounded(player, context)) { blocked = true; stop(state, player); }
    else {
      const travel = Math.min(DASH.distance - state.distance, DASH.distance / DASH.duration * Math.min(dt, state.remaining));
      const count = Math.max(1, Math.ceil(travel / SAMPLE));
      for (let i = 0; i < count; i++) {
        const x = player.x + state.dirX * travel / count, z = player.z + state.dirZ * travel / count;
        const y = stepHeight(player, x, z, context);
        if (y === null) { blocked = true; break; }
        distance += Math.hypot(x - player.x, z - player.z);
        Object.assign(player, { x, y, z });
      }
      state.distance += distance; state.remaining = Math.max(0, state.remaining - dt);
      if (blocked || state.remaining <= 1e-8 || state.distance >= DASH.distance - 1e-8) stop(state, player);
    }
    stamina.recoveryRemaining = STAMINA.delay; stamina.sprinting = false;
    player.vx = 0; player.vz = 0;
  }
  return { distance, moving: distance > .0005, blocked, sprinting: false, surface: surfaceAt(player.x, player.z) };
}
