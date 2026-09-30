import { createProgression, restoreProgression } from './progression.mjs';
import { createFlight, validPosition, validSample, validateWorld } from './flight.mjs';
export const PLANET_SAVE_VERSION = 1;
export function restoreSurfaceVehicle(raw, context, world) {
  if (raw === undefined) return { status: 'absent' };
  if (!validPosition(raw?.position) || !Number.isFinite(raw?.yaw) || !Number.isFinite(raw?.battery) || typeof raw?.mounted !== 'boolean') return { status: 'invalid' };
  const sample = world.sampleVehicle ? world.sampleVehicle(raw.position, raw.yaw) : world.sample(raw.position);
  if (!validSample(sample)) return { status: 'pending' };
  // Older saves placed the root at the center sample. Migrate only when that
  // exact old contact was valid; never accept arbitrary penetrated coordinates.
  const center = raw.grounded === undefined && sample.agl < -.15 ? world.sample(raw.position) : null;
  const migrate = center && validSample(center) && center.grounded === true && Math.abs(center.agl) <= .015 && center.waterDepth <= .15 && validPosition(sample.supportPosition);
  const falling = raw.grounded === false && raw.mounted && Number.isFinite(raw.vy) && raw.vy <= 0;
  if (falling ? sample.agl < -.01 || sample.altitude > world.radius * 2.5 : !migrate && (Math.abs(sample.agl) > .15 || sample.waterDepth > .15 || sample.grounded !== true)) return { status: 'unsafe' };
  return { status: 'restored', value: { position: { ...(migrate ? sample.supportPosition : raw.position) }, yaw: raw.yaw % (Math.PI * 2),
    battery: Math.max(0, Math.min(100, raw.battery)), mounted: raw.mounted && context?.mobility?.vehicle?.repaired === true, ...(falling ? { grounded: false, vy: raw.vy } : {}) } };
}
export function serializeSurfaceVehicle(vehicle) {
  if (!validPosition(vehicle?.position) || !Number.isFinite(vehicle?.yaw) || !Number.isFinite(vehicle?.battery) || typeof vehicle?.mounted !== 'boolean') throw new TypeError('Invalid surface vehicle');
  return { position: { ...vehicle.position }, yaw: vehicle.yaw % (Math.PI * 2), battery: Math.max(0, Math.min(100, vehicle.battery)), mounted: vehicle.mounted,
    ...(vehicle.grounded === false ? { grounded: false, vy: Number.isFinite(vehicle.vy) ? vehicle.vy : 0 } : {}) };
}
// Never run legacy restorePlayer/restoreMobility over canonical planet coordinates:
// their six-kilometre boundary/support correction intentionally belongs to chapter one.
export function restorePlanet(snapshot, context, world, legacyToCanonical) {
  validateWorld(world);
  const raw = snapshot?.planet;
  const fallback = () => ({ status: 'legacy', progression: createProgression(), flight: createFlight(legacyToCanonical(snapshot?.player)) });
  if (raw === undefined) return fallback();
  // Preserve unsupported or mismatched saves for a future compatible build.
  if (raw?.version !== PLANET_SAVE_VERSION || raw?.id !== world.id || raw?.seed !== world.seed || raw?.radius !== world.radius ||
      raw.gameplay !== undefined && raw.gameplay?.version !== 1) return { status: 'incompatible', writable: false };
  if (!validPosition(raw.position)) return { status: 'invalid', writable: false };
  const sample = world.sample(raw.position);
  if (!validSample(sample)) return { status: 'pending', writable: false };
  if (sample.agl < -.01 || sample.altitude > world.radius * 2.5 + .01 || sample.waterDepth > .15 && sample.agl <= .15) return { status: 'unsafe', writable: false };
  const surfaceVehicle = restoreSurfaceVehicle(raw.gameplay?.surfaceVehicle, context, world);
  if (!['absent', 'restored'].includes(surfaceVehicle.status)) return { status: surfaceVehicle.status, writable: false };
  const progression = restoreProgression(raw.gameplay?.progression, context), flight = createFlight(raw.position);
  flight.energy = Number.isFinite(raw.gameplay?.energy) ? Math.max(0, Math.min(100, raw.gameplay.energy)) : 0;
  flight.abilityTime = Number.isFinite(raw.gameplay?.abilityTime) ? Math.max(0, raw.gameplay.abilityTime) : 0;
  flight.blinkCooldownUntil = Number.isFinite(raw.gameplay?.blinkCooldownUntil) ? Math.max(0, raw.gameplay.blinkCooldownUntil) : 0;
  flight.blinkSerial = Number.isSafeInteger(raw.gameplay?.blinkSerial) && raw.gameplay.blinkSerial >= 0 ? raw.gameplay.blinkSerial : 0;
  flight.active = sample.grounded !== true;
  flight.verticalSpeed = flight.active ? -1 : 0;
  if (surfaceVehicle.value?.mounted && Math.hypot(...['x', 'y', 'z'].map(k => flight.position[k] - raw.gameplay.surfaceVehicle.position[k])) > .2) return { status: 'unsafe', writable: false };
  if (surfaceVehicle.value?.mounted) { flight.position = { ...surfaceVehicle.value.position }; flight.active = false; flight.verticalSpeed = 0; }
  return { status: 'restored', progression, flight, ...(surfaceVehicle.value ? { surfaceVehicle: surfaceVehicle.value } : {}) };
}
export function attachPlanet(snapshot, session, world) {
  validateWorld(world);
  if (!['legacy', 'restored', 'active'].includes(session?.status) || !validPosition(session.flight?.position)) throw new Error('Planet save is not writable');
  if (snapshot.planet !== undefined && (snapshot.planet?.version !== PLANET_SAVE_VERSION || snapshot.planet?.id !== world.id || snapshot.planet?.seed !== world.seed || snapshot.planet?.radius !== world.radius ||
      snapshot.planet.gameplay !== undefined && snapshot.planet.gameplay?.version !== 1)) throw new Error('Refuse incompatible planet overwrite');
  return { ...snapshot, planet: { ...snapshot.planet, version: PLANET_SAVE_VERSION, id: world.id, seed: world.seed, radius: world.radius,
    position: { ...session.flight.position }, gameplay: { version: 1, energy: session.flight.energy,
      abilityTime: Math.max(0, Number.isFinite(session.flight.abilityTime) ? session.flight.abilityTime : 0),
      blinkCooldownUntil: Math.max(0, Number.isFinite(session.flight.blinkCooldownUntil) ? session.flight.blinkCooldownUntil : 0),
      blinkSerial: Number.isSafeInteger(session.flight.blinkSerial) && session.flight.blinkSerial >= 0 ? session.flight.blinkSerial : 0,
      ...(session.surfaceVehicle ? { surfaceVehicle: serializeSurfaceVehicle(session.surfaceVehicle) } : {}),
      progression: { surveys: [...session.progression.surveys], commissioned: session.progression.commissioned === true } } } };
}
