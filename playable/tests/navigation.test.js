const test = require('node:test');
const assert = require('node:assert/strict');
const modulePromise = import('../src/navigation.mjs');
const known = [{ id: 'beacon', name: '返回信标', x: 0, z: 196 }];
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test('navigation defaults to the current objective and can track a known location', async () => {
  const m = await modulePromise, state = m.createNavigation();
  const objective = { id: 'signal', name: '信号', x: 0, z: -100 };
  const player = { x: 0, z: 0, yaw: 0 };
  assert.equal(m.navigationView(state, player, known, objective).kind, 'task');
  assert.equal(m.navigationView(state, player, known, objective).target.id, 'signal');
  assert.equal(m.setWaypoint(state, { pointId: 'beacon' }, known), true);
  assert.equal(m.navigationView(state, player, known, objective).kind, 'known');
  assert.equal(m.navigationView(state, player, known, objective).target.id, 'beacon');
  m.clearWaypoint(state);
  assert.equal(m.navigationView(state, player, known, objective).target.id, 'signal');
});

test('unknown targets cannot be selected or restored to disclose hidden locations', async () => {
  const m = await modulePromise, state = m.createNavigation();
  assert.equal(m.setWaypoint(state, { pointId: 'blackbox' }, known), false);
  assert.equal(state.waypoint, null);
  assert.deepEqual(m.restoreNavigation({ waypoint: { pointId: 'blackbox', x: 0, z: -766 } }, known), state);
  assert.deepEqual(m.restoreNavigation({ waypoint: { pointId: 'beacon' } }, known).waypoint, { pointId: 'beacon' });
});

test('custom waypoint replaces a previous marker and saves only its safe coordinates', async () => {
  const m = await modulePromise, state = m.createNavigation();
  m.setWaypoint(state, { x: 30, z: -60, name: 'untrusted label' }, known);
  assert.deepEqual(m.serializeNavigation(state), { waypoint: { x: 30, z: -60 } });
  m.setWaypoint(state, { x: 60, z: -90 }, known);
  assert.deepEqual(state.waypoint, { x: 60, z: -90 });
  assert.deepEqual(m.restoreNavigation(m.serializeNavigation(state), known), state);
  const copy = m.serializeNavigation(state); copy.waypoint.x = 100;
  assert.equal(state.waypoint.x, 60);
});

test('malformed waypoints are rejected, and custom coordinates stay within the walkable world boundary', async () => {
  const m = await modulePromise;
  for (const raw of [null, {}, { x: NaN, z: 0 }, { x: 0, z: Infinity }, { x: '2', z: 2 }]) {
    const state = m.createNavigation();
    assert.equal(m.setWaypoint(state, raw), false);
    assert.deepEqual(m.restoreNavigation({ waypoint: raw }), state);
  }
  const state = m.createNavigation();
  m.setWaypoint(state, { x: 9000, z: -9000 });
  close(state.waypoint.x, 2999.58); close(state.waypoint.z, -2999.58);
});

test('navigation reports world bearing and player-relative arrows in all directions', async () => {
  const m = await modulePromise, state = m.createNavigation();
  for (const [x, z, direction] of [[0, -100, 0], [100, 0, 90], [0, 100, 180], [-100, 0, 270]]) {
    m.setWaypoint(state, { x, z });
    const view = m.navigationView(state, { x: 0, z: 0, yaw: -Math.PI / 2 });
    close(view.bearing, direction); close(view.distance, 100);
    close(view.relativeBearing, (direction - 90 + 540) % 360 - 180);
    assert.equal(view.kind, 'custom'); assert.equal(view.target.name, '自定义标点');
  }
});

test('arrival is an eight-metre proximity indication and does not erase a waypoint', async () => {
  const m = await modulePromise, state = m.createNavigation();
  m.setWaypoint(state, { x: 8, z: 0 });
  assert.equal(m.navigationView(state, { x: 0, z: 0 }).arrived, true);
  assert.equal(m.navigationView(state, { x: -.001, z: 0 }).arrived, false);
  assert.deepEqual(state.waypoint, { x: 8, z: 0 });
  assert.equal(m.navigationView(m.createNavigation(), { x: 0, z: 0 }).target, null);
});

test('map defaults to a useful 1.5 km local view with reversible coordinate projection', async () => {
  const m = await modulePromise, view = m.createMapView({ x: 17, z: 190 });
  assert.equal(view.span, 1500);
  assert.deepEqual(m.projectMap({ x: 17, z: 190 }, view), { x: 300, y: 300 });
  for (const p of [{ x: 100, z: -330 }, { x: -420, z: -160 }, { x: -600, z: 800 }]) {
    const restored = m.unprojectMap(m.projectMap(p, view), view);
    close(restored.x, p.x); close(restored.z, p.z);
  }
});

test('zoom preserves the cursor world point and clamps zoom range and panning to the world', async () => {
  const m = await modulePromise, view = m.createMapView();
  const cursor = { x: 430, y: 240 }, before = m.unprojectMap(cursor, view);
  m.zoomMap(view, .5, cursor);
  const after = m.unprojectMap(cursor, view);
  close(before.x, after.x); close(before.z, after.z); close(view.span, 750);
  m.zoomMap(view, .00001); assert.equal(view.span, 150);
  m.panMap(view, -100000, 100000);
  assert.equal(view.x, 2925); assert.equal(view.z, -2925);
  m.zoomMap(view, 100000); assert.deepEqual(view, { x: 0, z: 0, span: 6000 });
  const saved = { ...view }; m.zoomMap(view, NaN); assert.deepEqual(view, saved);
});

test('panning maps screen displacement to metres without moving the player', async () => {
  const m = await modulePromise, player = { x: 0, z: 190 }, view = m.createMapView(player);
  m.panMap(view, 55, -55);
  close(view.x, -150); close(view.z, 340);
  assert.deepEqual(player, { x: 0, z: 190 });
});
