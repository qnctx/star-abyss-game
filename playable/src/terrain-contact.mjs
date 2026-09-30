/** A conservative support plane for a rectangular vehicle footprint.
 * `height` is a world-space height function, not an analytic field that differs
 * from the rendered terrain. Invalid or unloaded samples fail closed.
 */
export function sampleTerrainContact({ height, x, z, yaw = 0, halfWidth = .8, halfLength = 1.05 } = {}) {
  const unavailable = () => ({ height: null, normal: { x: 0, y: 1, z: 0 }, slope: Infinity,
    gradient: { x: 0, z: 0 }, minHeight: null, maxHeight: null, ready: false });
  if (typeof height !== 'function' || ![x, z, yaw, halfWidth, halfLength].every(Number.isFinite)
    || halfWidth <= 0 || halfLength <= 0) return unavailable();
  const cosine = Math.cos(yaw), sine = Math.sin(yaw), samples = [];
  // Symmetry makes the independent local-axis least-squares fits well conditioned.
  for (const side of [-1, 0, 1]) for (const fore of [-1, 0, 1]) {
    const u = side * halfWidth, v = fore * halfLength;
    const dx = cosine * u + sine * v, dz = -sine * u + cosine * v;
    let h;
    try { h = height(x + dx, z + dz); } catch { return unavailable(); }
    if (!Number.isFinite(h)) return unavailable();
    samples.push({ u, v, h });
  }
  const mean = samples.reduce((sum, s) => sum + s.h, 0) / samples.length;
  const gu = samples.reduce((sum, s) => sum + s.u * (s.h - mean), 0) / (6 * halfWidth ** 2);
  const gv = samples.reduce((sum, s) => sum + s.v * (s.h - mean), 0) / (6 * halfLength ** 2);
  const gx = cosine * gu + sine * gv, gz = -sine * gu + cosine * gv;
  // Raise only the intercept: the underside plane never cuts a sampled crest.
  const rootHeight = Math.max(...samples.map(s => s.h - gu * s.u - gv * s.v));
  const slope = Math.hypot(gx, gz), magnitude = Math.hypot(gx, 1, gz);
  if (![rootHeight, slope, magnitude].every(Number.isFinite)) return unavailable();
  return { height: rootHeight, normal: { x: -gx / magnitude, y: 1 / magnitude, z: -gz / magnitude },
    slope, gradient: { x: gx, z: gz }, minHeight: Math.min(...samples.map(s => s.h)),
    maxHeight: Math.max(...samples.map(s => s.h)), ready: true };
}

/** Integrate vertical support after the caller has approved horizontal movement.
 * A grounded upward step larger than snapDistance is rejected here; its horizontal
 * move MUST also be rejected by the caller. Airborne impacts clamp to the ground.
 * Missing terrain or invalid time freezes motion rather than falling through it.
 */
export function advanceVerticalContact({ y, vy = 0, grounded = true }, targetHeight, dt,
  { snapDistance = .25, gravity = 14 } = {}) {
  if (![y, vy, targetHeight, dt, snapDistance, gravity].every(Number.isFinite)
    || dt <= 0 || snapDistance < 0 || gravity <= 0) return { y, vy, grounded };
  const gap = y - targetHeight;
  if (grounded && gap < -snapDistance) return { y, vy: 0, grounded: true };
  if (grounded && Math.abs(gap) <= snapDistance) return { y: targetHeight, vy: 0, grounded: true };
  const initialVelocity = grounded ? Math.min(0, vy) : vy;
  const nextY = y + initialVelocity * dt - .5 * gravity * dt * dt;
  const nextVelocity = initialVelocity - gravity * dt;
  if (nextY <= targetHeight && nextVelocity <= 0) return { y: targetHeight, vy: 0, grounded: true };
  return { y: nextY, vy: nextVelocity, grounded: false };
}
