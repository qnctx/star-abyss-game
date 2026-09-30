const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { routeWaypoints } = require('./walk-route.js');
const url = 'file:///' + path.resolve(__dirname, '..', 'star-abyss.html').replace(/\\/g, '/') + '?test=1';
test.use({ viewport: { width: 1440, height: 900 } });
test.beforeEach(async ({ page }) => { await page.goto(url); await page.locator('#start-button').click(); });
const snapshot = page => page.evaluate(() => __STAR_ABYSS_TEST__.snapshot());
async function walk(page, x, z) {
  const state = await snapshot(page);
  const route = await routeWaypoints(state.player, { x, z }, state.story.flags.gateOpen);
  for (const point of route) expect(await page.evaluate(p => __STAR_ABYSS_TEST__.walkTo(p.x, p.z), point)).toBeLessThan(.2);
}
async function use(page, x, z) {
  await page.evaluate(([x, z]) => __STAR_ABYSS_TEST__.face(x, z), [x, z]);
  await page.keyboard.press('KeyF');
}

test('real G input lifts the C suit; altitude, forced landing, pause and held-key recharge are constrained', async ({ page }) => {
  test.setTimeout(90000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.keyboard.press('KeyV');
  await page.keyboard.down('KeyG');
  await page.waitForFunction(() => __STAR_ABYSS_TEST__.snapshot().mobilityStatus.altitude > .5);
  await page.evaluate(() => __STAR_ABYSS_TEST__.advance(2, { lift: true }));
  const air = await snapshot(page);
  expect(air.mobilityStatus.altitude).toBeGreaterThan(3);
  expect(air.mobilityStatus.altitude).toBeLessThanOrEqual(4.501);
  expect(air.mobility.flight.energy).toBeLessThan(94);
  expect(air.stamina.value).toBe(100);
  await expect(page.locator('#mobility-detail')).toContainText('离地');
  await page.screenshot({ path: 'docs/ui-implementation/echo-xuanke-flight.png' });
  await page.keyboard.press('Tab');
  const paused = await snapshot(page);
  await page.evaluate(() => __STAR_ABYSS_TEST__.advance(25, { lift: true, forward: true }));
  const frozen = await snapshot(page);
  expect(frozen.player).toEqual(paused.player); expect(frozen.mobility).toEqual(paused.mobility);
  await page.keyboard.up('KeyG'); await page.keyboard.press('Tab');
  await page.waitForFunction(() => document.pointerLockElement?.id === 'world');
  const landing = await page.evaluate(() => { __STAR_ABYSS_TEST__.advance(3); return __STAR_ABYSS_TEST__.snapshot(); });
  expect(landing.mobility.flight.airborne).toBeFalsy();
  // Screenshot/GPU time also consumes real power. Rest on the ground to earn a
  // fresh launch instead of assuming the previous flight left 25% available.
  await page.evaluate(() => __STAR_ABYSS_TEST__.advance(11));
  await page.keyboard.down('KeyG');
  const exhausted = await page.evaluate(() => { __STAR_ABYSS_TEST__.advance(35, { lift: true }); return __STAR_ABYSS_TEST__.snapshot(); });
  expect(exhausted.mobility.flight.energy).toBe(0); expect(exhausted.mobility.flight.airborne).toBeFalsy();
  const held = await page.evaluate(() => { __STAR_ABYSS_TEST__.advance(10, { lift: true }); return __STAR_ABYSS_TEST__.snapshot(); });
  expect(held.mobility.flight.energy).toBe(0);
  await page.keyboard.up('KeyG');
  const ready = await page.evaluate(() => { __STAR_ABYSS_TEST__.advance(5); return __STAR_ABYSS_TEST__.snapshot(); });
  expect(ready.mobility.flight.energy).toBeGreaterThanOrEqual(25);
  await page.keyboard.down('KeyG');
  await page.waitForFunction(() => __STAR_ABYSS_TEST__.snapshot().mobility.flight.airborne);
  await page.keyboard.up('KeyG');
  expect(errors).toEqual([]);
});

test('find a coupler, repair and drive the real parked skimmer, then brake, dismount and restore its map position', async ({ page }) => {
  test.setTimeout(180000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.keyboard.press('KeyT'); expect((await snapshot(page)).guidance.target.id).toBe('skimmer');
  await walk(page, 72, 83); await use(page, 72, 80);
  expect((await snapshot(page)).mobility.vehicle.repaired).toBeFalsy();
  await expect(page.locator('#toast')).toContainText('缺失');
  await page.keyboard.press('KeyT'); expect((await snapshot(page)).guidance.target.id).toBe('skimmer-part');
  await walk(page, 98, 64.6); await use(page, 98, 62);
  let state = await snapshot(page);
  expect(state.mobility.vehicle.partTaken).toBeTruthy(); expect(state.mobility.vehicle.coupler).toBeTruthy();
  expect(state.guidance.target.id).toBe('skimmer'); expect(state.knownPoints).not.toContain('skimmer-part');
  await walk(page, 74.6, 80); await use(page, 72, 80);
  expect((await snapshot(page)).mobility.vehicle.repaired).toBeTruthy();
  expect((await snapshot(page)).mobility.vehicle.coupler).toBeFalsy();
  await page.keyboard.press('KeyV'); await use(page, 72, 80);
  await page.waitForFunction(() => __STAR_ABYSS_TEST__.snapshot().cameraRig.mode === 'vehicle');
  expect((await snapshot(page)).mobility.vehicle.mounted).toBeTruthy();
  expect((await snapshot(page)).guidance.kind).toBe('task');
  // Keep the legitimately repaired vehicle; isolate body-rest timing with low
  // stamina in its saved state. This fixture does not grant transport/story flags.
  const tired = JSON.parse(await page.evaluate(() => __STAR_ABYSS_TEST__.serialize()));
  tired.stamina = { value: 10, recoveryRemaining: 1.5 };
  await page.evaluate(raw => __STAR_ABYSS_TEST__.restore(raw), JSON.stringify(tired));
  const rested = await page.evaluate(() => { __STAR_ABYSS_TEST__.advance(4); return __STAR_ABYSS_TEST__.snapshot(); });
  expect(rested.stamina.value).toBeGreaterThan(35); expect(rested.mobility.vehicle.mounted).toBeTruthy();
  await expect(page.locator('#interaction')).toBeHidden();
  await page.screenshot({ path: 'docs/ui-implementation/echo-skimmer-repaired.png' });
  // Earned vehicle, actual movement physics: leave the repair clearing in short steps.
  await page.evaluate(() => __STAR_ABYSS_TEST__.face(0, 80));
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => __STAR_ABYSS_TEST__.snapshot().mobilityStatus.speed > 9);
  await page.keyboard.press('KeyF'); expect((await snapshot(page)).mobility.vehicle.mounted).toBeTruthy();
  const drive = await page.evaluate(() => { const api = __STAR_ABYSS_TEST__; api.advance(.4, { forward: true }); return api.snapshot(); });
  expect(drive.mobility.vehicle.battery).toBeLessThan(100);
  expect(Math.hypot(drive.player.x - 72, drive.player.z - 80)).toBeGreaterThan(3);
  expect(drive.player.x).toBeCloseTo(drive.mobility.vehicle.x, 4);
  await page.screenshot({ path: 'docs/ui-implementation/echo-skimmer-driving.png' });
  await page.keyboard.up('KeyW'); await page.keyboard.down('Space');
  await page.evaluate(() => __STAR_ABYSS_TEST__.advance(1, { lift: true }));
  expect((await snapshot(page)).mobilityStatus.speed).toBeLessThan(2);
  await page.keyboard.up('Space'); await page.keyboard.press('KeyF');
  state = await snapshot(page); expect(state.mobility.vehicle.mounted).toBeFalsy();
  await page.waitForFunction(() => __STAR_ABYSS_TEST__.snapshot().cameraRig.mode === 'third');
  await page.keyboard.press('KeyT'); expect((await snapshot(page)).guidance.target.x).toBeCloseTo(state.mobility.vehicle.x, 3);
  await page.keyboard.press('Tab');
  const parked = await snapshot(page);
  await page.evaluate(() => __STAR_ABYSS_TEST__.advance(100));
  expect((await snapshot(page)).mobility.vehicle.battery).toBe(parked.mobility.vehicle.battery);
  await page.locator('.map-places').evaluate(el => { el.open = true; }); await expect(page.locator('#map-point-list button[data-point-id="skimmer"]')).toBeVisible();
  await page.screenshot({ path: 'docs/ui-implementation/echo-skimmer-map.png' });
  const saved = await page.evaluate(() => __STAR_ABYSS_TEST__.serialize());
  await page.evaluate(raw => __STAR_ABYSS_TEST__.restore(raw), saved);
  state = await snapshot(page);
  expect(state.mobility.vehicle.repaired).toBeTruthy(); expect(state.mobility.vehicle.partTaken).toBeTruthy();
  expect(state.mobility.vehicle.x).toBeCloseTo(parked.mobility.vehicle.x, 3);
  expect(state.mobility.vehicle.z).toBeCloseTo(parked.mobility.vehicle.z, 3);
  expect(state.guidance.target.id).toBe('skimmer'); expect(state.story.flags.blackbox).toBeFalsy();
  expect(errors).toEqual([]);
});

test('old saves gain equipment without resetting investigation; expanded HUD fits narrow screens', async ({ page }) => {
  test.setTimeout(60000);
  const legacy = JSON.parse(await page.evaluate(() => __STAR_ABYSS_TEST__.serialize()));
  delete legacy.mobility;
  await page.evaluate(raw => __STAR_ABYSS_TEST__.restore(raw), JSON.stringify(legacy));
  expect((await snapshot(page)).mobility.flight.energy).toBe(100);
  for (const width of [1440, 900, 768, 640]) {
    await page.setViewportSize({ width, height: 720 });
    const result = await page.evaluate(() => {
      const panels = ['.objective', '.navigation-hud', '.location', '.suit-status', '.hud-controls'].map(s => ({ s, r: document.querySelector(s).getBoundingClientRect() }));
      const failures = panels.filter(({ r }) => r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight).map(({ s }) => s);
      panels.forEach((a, i) => panels.slice(i + 1).forEach(b => { if (Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left) > 1 && Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top) > 1) failures.push(`${a.s}/${b.s}`); }));
      for (const el of document.querySelectorAll('.suit-status p,.suit-status button')) if (el.scrollWidth > el.clientWidth + 1) failures.push(el.id);
      return failures;
    });
    expect(result, `travel HUD at ${width}px`).toEqual([]);
  }
  await page.screenshot({ path: 'docs/ui-implementation/echo-mobility-hud-narrow.png' });
});

test('the indoor flight safety lock does not cancel walking or sprinting when G is held', async ({ page }) => {
  test.setTimeout(60000);
  // Spatial fixture tests the input-mode boundary, not mainline progression.
  const indoors = await page.evaluate(() => {
    const api = __STAR_ABYSS_TEST__;
    api.place({ x: 0, z: -480, yaw: 0 });
    api.advance(2, { forward: true, sprint: true, lift: true });
    return api.snapshot();
  });
  expect(indoors.mobility.flight.airborne).toBeFalsy(); expect(indoors.mobility.flight.energy).toBe(100);
  expect(indoors.player.z).toBeLessThan(-490); expect(indoors.stamina.sprinting).toBeTruthy();
  expect(indoors.stamina.value).toBeCloseTo(100 - 2 * 100 / 30, 4);
  await expect(page.locator('#mobility-detail')).toContainText('助推禁用');
});
