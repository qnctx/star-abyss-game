import { unit, scale, add, length, toGeodetic, tangentFrame, localToGlobal } from '../planet/coordinates.mjs';
import { validPosition } from './flight.mjs';
// Conservative closest point on the *whole* segment, not endpoint altitude.
// The field owner proves maxSurfaceHeight, including every blended legacy region.
export function segmentClearsSurface(from, to, radius, bound, clearance = .9) {
  if (!validPosition(from) || !validPosition(to) || !Number.isFinite(radius) || radius <= 0 ||
      !Number.isFinite(bound) || bound < 0 || !Number.isFinite(clearance) || clearance < 0) return false;
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const squared = dx * dx + dy * dy + dz * dz;
  const projection = from.x * dx + from.y * dy + from.z * dz;
  if (!Number.isFinite(squared) || !Number.isFinite(projection)) return false;
  const t = squared === 0 ? 0 : Math.max(0, Math.min(1, -projection / squared));
  const nearest = Math.hypot(from.x + dx * t, from.y + dy * t, from.z + dz * t);
  const shell = radius + bound + clearance;
  // Roundoff must never turn contact with the bound into a positive clearance.
  return Number.isFinite(shell) && nearest > shell + Math.max(1, shell) * Number.EPSILON * 32;
}
// loaded and solidSweep are deliberately required: the terrain function alone cannot
// promise that scene geometry, doors, wrecks and streamed mesh colliders are ready.
export function createRuntimeWorld({ field, loaded, solidSweep, serviceAt = () => false, sampleTerrain } = {}) {
  if (!field?.planet || typeof loaded !== 'function' || typeof solidSweep !== 'function') throw new TypeError('field, loaded and solidSweep required');
  const { planet } = field, radius = planet.radius;
  const terrain = p => {
    const raw = field.sampleSurface ? field.sampleSurface(unit(p)) : field.sample(unit(p));
    // Optional rendered-mesh height/slope substitution keeps contact and visible LOD identical.
    return sampleTerrain ? sampleTerrain(p, raw) : raw;
  };
  function sample(position) {
    if (!validPosition(position) || length(position) <= 0 || loaded(position) !== true) return { ready: false };
    const surface = terrain(position);
    if (!surface || surface.ready === false || !Number.isFinite(surface.height)) return { ready: false };
    const altitude = length(position) - radius;
    // Legacy basin can have negative radial elevation and is still dry land.
    const waterHeight = surface.waterHeight === null || surface.legacyWeight >= 1 - 1e-9 ? null :
      Number.isFinite(surface.waterHeight) ? surface.waterHeight : 0;
    const waterDepth = waterHeight === null ? 0 : Math.max(0, waterHeight - surface.height);
    const agl = altitude - (waterDepth > 0 ? waterHeight : surface.height);
    const slope = Number.isFinite(surface.slope) ? surface.slope : 0;
    const weights = Object.entries(surface.biomes || {}).filter(([, w]) => Number.isFinite(w) && w >= 0).sort((a, b) => b[1] - a[1]);
    return { ready: true, altitude, agl, waterDepth, grounded: Math.abs(agl) <= .015 && waterDepth <= .15 && slope < Math.PI / 3,
      biome: weights[0]?.[0] || 'basin', biomes: { ...surface.biomes }, slope, waterHeight, atService: serviceAt(position) === true };
  }
  function advance(position, displacement) {
    const { lat, lon, height } = toGeodetic(position, radius), frame = tangentFrame(lat, lon, radius);
    const tangent = add(position, add(scale(frame.east, displacement.east), scale(frame.south, -displacement.north)));
    const direction = unit(tangent);
    let altitude = height + displacement.up;
    let next = scale(direction, radius + altitude);
    if (displacement.up < 0 && loaded(next) === true) {
      const surface = terrain(next), floor = surface?.height;
      const dry = surface?.waterHeight === null || surface?.legacyWeight >= 1 - 1e-9 || floor >= (Number.isFinite(surface?.waterHeight) ? surface.waterHeight : 0);
      // Snap only a downward crossing to dry land. The sweep still validates every intermediate point.
      if (Number.isFinite(floor) && dry && altitude < floor && floor - altitude <= -displacement.up + .02) {
        altitude = floor; next = scale(direction, radius + altitude);
      }
    }
    return next;
  }
  function sweep(from, to, clearance = .9) {
    if (!validPosition(from) || !validPosition(to) || !Number.isFinite(clearance) || clearance < 0) return { ready: false, clear: false };
    if (segmentClearsSurface(from, to, radius, field.maxSurfaceHeight, clearance)) {
      const solids = solidSweep(from, to, clearance);
      return { ready: solids?.ready === true, clear: solids?.ready === true && solids.clear === true };
    }
    const distance = Math.hypot(to.x-from.x, to.y-from.y, to.z-from.z), count = Math.max(1, Math.ceil(distance / .25));
    if (count > 4096) return { ready: false, clear: false };
    for (let i = 0; i <= count; i++) {
      const t = i / count, p = { x: from.x+(to.x-from.x)*t, y: from.y+(to.y-from.y)*t, z: from.z+(to.z-from.z)*t };
      const s = sample(p);
      if (!s.ready) return { ready: false, clear: false };
      if (s.agl < -.015) return { ready: true, clear: false };
      const { lat, lon } = toGeodetic(p, radius), frame = tangentFrame(lat, lon, radius);
      for (const axis of [frame.east, frame.south]) for (const sign of [-1, 1]) {
        const edge = add(p, scale(axis, clearance * sign));
        const side = sample(edge);
        if (!side.ready) return { ready: false, clear: false };
        if (side.agl < -clearance - .015) return { ready: true, clear: false };
      }
    }
    const solids = solidSweep(from, to, clearance);
    return { ready: solids?.ready === true, clear: solids?.ready === true && solids.clear === true };
  }
  return { id: planet.id, seed: planet.seed, radius, sample, advance, sweep,
    legacyToCanonical: player => localToGlobal({ x: player.x, y: player.y ?? 0, z: player.z }, tangentFrame(0, 0, radius)) };
}
