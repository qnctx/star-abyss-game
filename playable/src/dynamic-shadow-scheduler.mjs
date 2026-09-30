/** Coalesce animated shadow changes without delaying static scene invalidations. */
export function createDynamicShadowScheduler(intervalSeconds = .1) {
  if (!(intervalSeconds > 0)) throw new RangeError('Shadow interval must be positive');
  let pending = false;
  let lastRefresh = -Infinity;
  return {
    request() { pending = true; },
    consume(time) {
      if (!pending || !Number.isFinite(time)) return false;
      if (time >= lastRefresh && time - lastRefresh < intervalSeconds - 1e-9) return false;
      pending = false;
      lastRefresh = time;
      return true;
    },
    get pending() { return pending; },
  };
}
