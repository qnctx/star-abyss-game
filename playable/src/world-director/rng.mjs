// FNV-1a over UTF-8, followed by a purpose-local Mulberry32 draw. Versioned forever.
export const RNG_VERSION = 'fnv1a-utf8-mulberry32-v1';
export function seed32(parts) {
  let h = 2166136261;
  for (const b of new TextEncoder().encode(JSON.stringify(parts))) h = Math.imul(h ^ b, 16777619) >>> 0;
  return h;
}
export function randomUnit(parts) {
  let t = (seed32(parts) + 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
// Explicit semantic fields: IDs, timestamps and quality do not count as variety.
export function fingerprint(c) {
  return JSON.stringify([c.family, c.count, c.layout, c.route, c.appearance, c.byproducts ?? []]);
}
