export * from './progression.mjs';
export * from './flight.mjs';
export * from './ascension-rules.mjs';
export * from './save.mjs';
export * from './runtime-world.mjs';

// Legacy yaw 0 faces -Z (north); east/north are tangent-frame displacement axes.
export function flightControls(controls, yaw = 0) {
  const forward = Number(!!controls.forward) - Number(!!controls.backward);
  const right = Number(!!controls.right) - Number(!!controls.left);
  const heading = Number.isFinite(yaw) ? yaw : 0;
  return { east: -Math.sin(heading) * forward + Math.cos(heading) * right,
    north: Math.cos(heading) * forward + Math.sin(heading) * right, lift: controls.lift === true,
    descend: controls.descend === true, boost: controls.boost === true || controls.sprint === true,...(right?{bank:right}:{}),...(controls.precision===true?{precision:true}:{}) };
}
