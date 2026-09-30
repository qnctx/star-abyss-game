import { terrainHeight, insideWreck, ROCK_FIELD, rockSurfaceHeight, PROP_SOLIDS, WALLS, GATE } from './layout.mjs';
import { dustCoverage } from './ground-cover.mjs';

// Read the surface under the sole, not everything within the player capsule.
// referenceY prevents a swing target on a nearby wall becoming a giant leg lift.
export function sampleFooting(x, z, referenceY = terrainHeight(x, z), { gateOpen = false, vehicle = null, vehicleHeight = 1.3 } = {}) {
  const indoor = insideWreck(x, z), terrain = terrainHeight(x, z);
  let height = indoor ? Math.max(terrain, .02) : terrain;
  let surface = indoor ? 'metal' : dustCoverage(x, z) >= .58 ? 'dust' : 'gravel';
  for (const rock of ROCK_FIELD.query(x, z, 0)) {
    const top = rockSurfaceHeight(rock, x, z);
    if (top > height) { height = top; surface = rock.solid ? 'rock' : 'gravel'; }
  }
  const contains = box => Math.abs(x - box.x) < box.w / 2 && Math.abs(z - box.z) < box.d / 2;
  for (const box of PROP_SOLIDS) if (contains(box)) {
    const top = terrainHeight(box.x, box.z) + box.h;
    if (top > height) { height = top; surface = box.finish === 'stone' ? 'rock' : 'metal'; }
  }
  if (vehicle && !vehicle.mounted && Math.hypot(x - vehicle.x, z - vehicle.z) < 1.35) {
    const top = terrainHeight(vehicle.x, vehicle.z) + vehicleHeight;
    if (top > height) { height = top; surface = 'metal'; }
  }
  const blocked = height > referenceY + .3 || WALLS.some(contains) || (!gateOpen && contains(GATE));
  return { height, surface, indoor, blocked };
}

export function sampleImpact(x, z, { gateOpen = false, vehicle = null } = {}) {
  const indoor = insideWreck(x, z);
  if (vehicle && !vehicle.mounted && Math.hypot(x - vehicle.x, z - vehicle.z) < 1.7) return { surface: 'metal', indoor };
  let nearest = null, range = .65;
  for (const box of [...WALLS, ...PROP_SOLIDS, ...(!gateOpen ? [GATE] : [])]) {
    const distance = Math.hypot(Math.max(0, Math.abs(x - box.x) - box.w / 2), Math.max(0, Math.abs(z - box.z) - box.d / 2));
    if (distance < range) { nearest = box; range = distance; }
  }
  return { surface: nearest ? nearest.finish === 'stone' ? 'rock' : 'metal' : indoor ? 'metal' : 'rock', indoor };
}
