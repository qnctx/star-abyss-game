import { WORLD } from './layout.mjs';

export const MAP = Object.freeze({ inset: 25, pixels: 550, nearby: 1500, interior: 400, minSpan: 150, maxSpan: WORLD.halfSize * 2 });
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);
const bearing = (x, z) => (Math.atan2(x, -z) * 180 / Math.PI + 360) % 360;

export function createNavigation() { return { waypoint: null }; }

export function setWaypoint(state, selection, knownPoints = []) {
  if (typeof selection?.pointId === 'string') {
    if (!knownPoints.some(point => point.id === selection.pointId && finitePoint(point))) return false;
    state.waypoint = { pointId: selection.pointId };
    return true;
  }
  if (!finitePoint(selection)) return false;
  const limit = WORLD.halfSize - WORLD.radius;
  state.waypoint = { x: clamp(selection.x, -limit, limit), z: clamp(selection.z, -limit, limit) };
  return true;
}

export function clearWaypoint(state) { state.waypoint = null; }
export function serializeNavigation(state) { return { waypoint: state.waypoint ? { ...state.waypoint } : null }; }
export function restoreNavigation(raw, knownPoints = []) {
  const state = createNavigation();
  setWaypoint(state, raw?.waypoint, knownPoints);
  return state;
}

/** A bearing aid, deliberately not a route finder: walls and terrain still matter. */
export function navigationView(state, player, knownPoints = [], objectivePoint = null) {
  const selected = state.waypoint;
  const known = selected?.pointId ? knownPoints.find(point => point.id === selected.pointId) : null;
  const custom = !selected?.pointId && finitePoint(selected);
  const target = custom ? { ...selected, name: '自定义标点' } : known || objectivePoint;
  const kind = custom ? 'custom' : known ? 'known' : 'task';
  if (!finitePoint(target)) return { target: null, kind, distance: null, bearing: null, relativeBearing: null, arrived: false };
  const dx = target.x - player.x, dz = target.z - player.z;
  const direction = bearing(dx, dz), heading = -(Number(player.yaw) || 0) * 180 / Math.PI;
  const distance = Math.hypot(dx, dz);
  return { target: { ...target }, kind, distance, bearing: direction, relativeBearing: ((direction - heading + 540) % 360 + 360) % 360 - 180, arrived: distance <= 8 };
}

export function createMapView(player = WORLD.spawn) { return { x: player.x, z: player.z, span: MAP.nearby }; }
export function clampMapView(view) {
  view.span = clamp(Number.isFinite(view.span) ? view.span : MAP.nearby, MAP.minSpan, MAP.maxSpan);
  const limit = Math.max(0, WORLD.halfSize - view.span / 2);
  view.x = clamp(Number.isFinite(view.x) ? view.x : 0, -limit, limit) || 0;
  view.z = clamp(Number.isFinite(view.z) ? view.z : 0, -limit, limit) || 0;
  return view;
}
export function projectMap(point, view) { return { x: 300 + (point.x - view.x) * MAP.pixels / view.span, y: 300 + (point.z - view.z) * MAP.pixels / view.span }; }
export function unprojectMap(point, view) { return { x: view.x + (point.x - 300) * view.span / MAP.pixels, z: view.z + (point.y - 300) * view.span / MAP.pixels }; }
export function panMap(view, dx, dy) {
  view.x -= dx * view.span / MAP.pixels; view.z -= dy * view.span / MAP.pixels;
  return clampMapView(view);
}
export function zoomMap(view, factor, anchor = { x: 300, y: 300 }) {
  if (!Number.isFinite(factor) || factor <= 0) return view;
  const before = unprojectMap(anchor, view);
  view.span = clamp(view.span * factor, MAP.minSpan, MAP.maxSpan);
  const after = unprojectMap(anchor, view);
  view.x += before.x - after.x; view.z += before.z - after.z;
  return clampMapView(view);
}
