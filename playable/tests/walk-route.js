// Test-only route planning. Every waypoint is traversed by the real movement loop;
// this helper cannot set a browser player position or mutate investigation state.
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

class MinHeap {
  constructor() { this.items = []; }
  push(value) {
    const items = this.items; items.push(value);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].score <= value.score) break;
      items[i] = items[parent]; i = parent;
    }
    items[i] = value;
  }
  pop() {
    const items = this.items, first = items[0], last = items.pop();
    if (items.length) {
      let i = 0;
      while (i * 2 + 1 < items.length) {
        let child = i * 2 + 1;
        if (child + 1 < items.length && items[child + 1].score < items[child].score) child++;
        if (items[child].score >= last.score) break;
        items[i] = items[child]; i = child;
      }
      items[i] = last;
    }
    return first;
  }
}

async function routeWaypoints(from, to, gateOpen = false, mobility = null) {
  const { collides } = await import('../src/layout.mjs');
  const { groundMobilityBlocked } = await import('../src/mobility.mjs');
  // The player's own radius is already included by collides. Extra clearance
  // allows for the real acceleration curve and walkTo's 12 cm stop tolerance.
  const margin = .3;
  const clear = p => [[0, 0], [margin, 0], [-margin, 0], [0, margin], [0, -margin]]
    .every(([dx, dz]) => !(mobility ? groundMobilityBlocked(p.x + dx,p.z + dz,mobility,gateOpen) : collides(p.x + dx, p.z + dz, gateOpen)));
  const visible = (a, b) => {
    const steps = Math.max(1, Math.ceil(distance(a, b) / .35));
    for (let i = 0; i <= steps; i++) {
      if (!clear({ x: a.x + (b.x - a.x) * i / steps, z: a.z + (b.z - a.z) * i / steps })) return false;
    }
    return true;
  };
  if (!clear(from) || !clear(to)) throw new Error(`Route endpoint lacks walkable clearance: ${JSON.stringify({ from, to })}`);
  let route = [from, to];
  if (!visible(from, to)) {
    const step = 6;
    const anchor = point => {
      const x = Math.round(point.x / step) * step, z = Math.round(point.z / step) * step;
      const candidates = [];
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) candidates.push({ x: x + i * step, z: z + j * step });
      candidates.sort((a, b) => distance(point, a) - distance(point, b));
      const result = candidates.find(candidate => visible(point, candidate));
      if (!result) throw new Error(`No walkable route anchor near ${JSON.stringify(point)}`);
      return result;
    };
    const start = anchor(from), goal = anchor(to), key = p => `${p.x},${p.z}`;
    const lowX = Math.min(from.x, to.x) - 84, highX = Math.max(from.x, to.x) + 84;
    const lowZ = Math.min(from.z, to.z) - 84, highZ = Math.max(from.z, to.z) + 84;
    const open = new MinHeap(), seen = new Map(), edges = new Map();
    const first = { ...start, g: 0, parent: null, score: distance(start, goal) };
    open.push(first); seen.set(key(first), first);
    let found = null;
    while (open.items.length) {
      const current = open.pop();
      if (seen.get(key(current)) !== current) continue;
      if (key(current) === key(goal)) { found = current; break; }
      for (const [dx, dz] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
        const next = { x: current.x + dx * step, z: current.z + dz * step };
        if (next.x < lowX || next.x > highX || next.z < lowZ || next.z > highZ) continue;
        const g = current.g + distance(current, next), previous = seen.get(key(next));
        if (previous && previous.g <= g) continue;
        const edge = [key(current), key(next)].sort().join('/');
        if (!edges.has(edge)) edges.set(edge, visible(current, next));
        if (!edges.get(edge)) continue;
        const candidate = { ...next, g, parent: current, score: g + distance(next, goal) };
        seen.set(key(next), candidate); open.push(candidate);
      }
    }
    if (!found) throw new Error(`No physical outdoor path: ${JSON.stringify({ from, to })}`);
    const path = [];
    for (let point = found; point; point = point.parent) path.unshift({ x: point.x, z: point.z });
    route = [from, ...path, to];
    const smooth = [from];
    for (let i = 0; i < route.length - 1;) {
      let next = route.length - 1;
      while (next > i + 1 && !visible(route[i], route[next])) next--;
      smooth.push(route[next]); i = next;
    }
    route = smooth;
  }
  // Yield back to the browser between short actual walks, keeping page.evaluate
  // responsive while a full investigation covers several kilometres.
  const result = [];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i], sections = Math.max(1, Math.ceil(distance(a, b) / 90));
    for (let j = 1; j <= sections; j++) result.push({ x: a.x + (b.x - a.x) * j / sections, z: a.z + (b.z - a.z) * j / sections });
  }
  return result;
}

module.exports = { routeWaypoints };
