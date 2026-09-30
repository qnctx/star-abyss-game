// Broad, continuous deposits shared by terrain tint and foot-contact material.
// No camera/time dependence: walking cannot move a patch underneath the player.
export function dustCoverage(x, z) {
  const deposit = .5 + Math.sin(x * .009 + 1.2) * .28 + Math.cos(z * .012 - .4) * .22
    + Math.sin((x + z) * .021) * .13;
  const t = Math.max(0, Math.min(1, (deposit - .35) / .35));
  return t * t * (3 - 2 * t);
}
