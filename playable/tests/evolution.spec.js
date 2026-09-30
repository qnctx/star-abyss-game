const { test, expect } = require('@playwright/test');
const path = require('node:path');
const url = 'file:///' + path.resolve(__dirname, '..', 'star-abyss.html').replace(/\\/g, '/') + '?test=1';
test.use({ viewport: { width: 1440, height: 900 } });
test.beforeEach(async ({ page }) => { await page.goto(url); await page.locator('#start-button').click(); });
const snapshot = page => page.evaluate(() => __STAR_ABYSS_TEST__.snapshot());
async function walk(page, x, z) { expect(await page.evaluate(([x, z]) => __STAR_ABYSS_TEST__.walkTo(x, z), [x, z])).toBeLessThan(.2); }
async function use(page, x, z) { await page.evaluate(([x, z]) => __STAR_ABYSS_TEST__.face(x, z), [x, z]); await page.keyboard.press('KeyF'); }

test('earn body and equipment upgrades by walking, investigating and powering the real wreck; preserve resources and save', async ({ page }) => {
  test.setTimeout(180000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.keyboard.press('KeyU');
  await expect(page.locator('#evolution-section')).toBeVisible();
  await expect(page.locator('#evolve-body-button')).toBeDisabled();
  await expect(page.locator('#evolve-equipment-button')).toBeDisabled();
  const initial = await snapshot(page);
  expect(initial.evolutionStatus.stats).toMatchObject({ sprintDuration: 30, flightDuration: 30 });
  await expect(page.locator('#body-evolution-duration')).toContainText('30.0');
  await expect(page.locator('#equipment-evolution-duration')).toContainText('30.0');
  for (const branch of ['body', 'equipment']) {
    expect(initial.evolutionStatus[branch].roadmap.map(stage => stage.duration)).toEqual([60, 90, 120]);
  }
  await page.evaluate(() => __STAR_ABYSS_TEST__.advance(50));
  expect((await snapshot(page)).evolution).toEqual(initial.evolution);
  await page.keyboard.press('KeyU'); await page.waitForFunction(() => document.pointerLockElement?.id === 'world');
  await walk(page, 12, -328); await use(page, 12, -330);
  await page.evaluate(() => __STAR_ABYSS_TEST__.advance(3.2));
  expect((await snapshot(page)).evolution.footDistance).toBeGreaterThan(500);
  await page.keyboard.press('KeyU');
  const before = await snapshot(page);
  await expect(page.locator('#evolve-body-button')).toBeEnabled();
  await page.locator('#evolve-body-button').click();
  let current = await snapshot(page);
  expect(current.evolution.bodyLevel).toBe(1); expect(current.evolution.equipmentLevel).toBe(0);
  expect(current.stamina.value).toBe(before.stamina.value);
  expect(current.evolutionStatus.stats.sprintDuration).toBe(60);
  await expect(page.locator('#body-evolution-level')).toContainText('L1');
  await expect(page.locator('#evolve-body-button')).toBeDisabled();
  await page.keyboard.press('KeyU'); await page.waitForFunction(() => document.pointerLockElement?.id === 'world');
  // Move around the solid signal mast before measuring an unobstructed sprint.
  await walk(page, 0, -328);
  const extended = await page.evaluate(() => { const api = __STAR_ABYSS_TEST__; api.face(0, -630); api.advance(12); api.advance(30.2, { forward: true, sprint: true }); return api.snapshot(); });
  expect(extended.stamina.value).toBeGreaterThan(49); expect(extended.stamina.value).toBeLessThan(51); expect(extended.stamina.sprinting).toBeTruthy();
  await walk(page, 0, -465); await walk(page, 0, -530);
  await walk(page, -27, -542); await use(page, -29, -544);
  await walk(page, 0, -544); await walk(page, -3, -578); await use(page, -5, -579);
  expect((await snapshot(page)).story.flags.power).toBeTruthy();
  // Progress is earned above; isolate no-refill semantics with a partially charged
  // resource fixture, without granting a blueprint or changing the player's place.
  const partial = JSON.parse(await page.evaluate(() => __STAR_ABYSS_TEST__.serialize()));
  partial.mobility.flight.energy = 41; partial.mobility.flight.recoveryRemaining = 2;
  await page.evaluate(raw => __STAR_ABYSS_TEST__.restore(raw), JSON.stringify(partial));
  await page.keyboard.press('KeyU');
  const charge = (await snapshot(page)).mobility.flight.energy;
  await expect(page.locator('#evolve-equipment-button')).toBeEnabled();
  await page.locator('#evolve-equipment-button').click();
  current = await snapshot(page);
  expect(current.evolution.equipmentLevel).toBe(1); expect(current.mobility.flight.energy).toBe(charge);
  expect(current.evolutionStatus.stats.flightDuration).toBe(60);
  await page.screenshot({ path: 'docs/ui-implementation/echo-evolution-earned.png' });
  const saved = await page.evaluate(() => __STAR_ABYSS_TEST__.serialize());
  await page.evaluate(raw => __STAR_ABYSS_TEST__.restore(raw), saved);
  current = await snapshot(page);
  expect(current.evolution.bodyLevel).toBe(1); expect(current.evolution.equipmentLevel).toBe(1);
  expect(current.evolution.footDistance).toBeCloseTo(JSON.parse(saved).evolution.footDistance, 4);
  expect(current.evolution.restTime).toBeLessThan(1);
  await page.keyboard.press('KeyU');
  for (const width of [900, 768, 640]) {
    await page.setViewportSize({ width, height: 720 });
    for (const id of ['evolve-body-button', 'evolve-equipment-button', 'track-calibration-button']) {
      const button = page.locator('#' + id); await button.scrollIntoViewIfNeeded();
      const valid = await button.evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && el.scrollWidth <= el.clientWidth + 1; });
      expect(valid, `${id} at ${width}px`).toBeTruthy();
    }
    const overflow = await page.locator('.evolution-stage-heading,.evolution-requirements li,.evolution-activation p').evaluateAll(elements => elements.filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.textContent));
    expect(overflow).toEqual([]);
  }
  await page.screenshot({ path: 'docs/ui-implementation/echo-evolution-narrow.png' });
  expect(errors).toEqual([]);
});

test('flight, driving, wall pushing and paused time cannot farm body adaptation', async ({ page }) => {
  test.setTimeout(90000);
  // Keep the transition atomic: intervening real frames legitimately finish
  // decelerating on foot and must not be mistaken for airborne distance.
  const { foot, airborne } = await page.evaluate(() => {
    const api = __STAR_ABYSS_TEST__; api.advance(1, { forward: true }); const foot = api.snapshot();
    api.advance(3, { lift: true, forward: true }); return { foot, airborne: api.snapshot() };
  });
  expect(foot.evolution.footDistance).toBeGreaterThan(3);
  expect(airborne.mobility.flight.airborne).toBeTruthy(); expect(airborne.evolution.footDistance).toBe(foot.evolution.footDistance);
  await page.keyboard.press('KeyU');
  const paused = await snapshot(page);
  await page.evaluate(() => __STAR_ABYSS_TEST__.advance(60, { forward: true }));
  expect((await snapshot(page)).evolution).toEqual(paused.evolution);
  await page.keyboard.press('KeyU');
  await page.evaluate(() => { __STAR_ABYSS_TEST__.advance(4); __STAR_ABYSS_TEST__.place({ x: 24, z: 135, yaw: 0 }); __STAR_ABYSS_TEST__.advance(2, { forward: true }); });
  const blocked = await snapshot(page);
  const waiting = await page.evaluate(() => { __STAR_ABYSS_TEST__.advance(10, { forward: true }); return __STAR_ABYSS_TEST__.snapshot(); });
  expect(waiting.evolution.footDistance).toBeCloseTo(blocked.evolution.footDistance, 4); expect(waiting.evolution.restTime).toBe(0);
  // Driving-only accounting fixture. The separate transport test earns the car.
  const drive = JSON.parse(await page.evaluate(() => __STAR_ABYSS_TEST__.serialize()));
  drive.mobility.vehicle = { x: 72, z: 80, yaw: 0, battery: 100, repaired: true, mounted: true, partTaken: true };
  await page.evaluate(raw => __STAR_ABYSS_TEST__.restore(raw), JSON.stringify(drive));
  const mounted = await snapshot(page);
  const moved = await page.evaluate(() => { __STAR_ABYSS_TEST__.advance(1, { forward: true }); return __STAR_ABYSS_TEST__.snapshot(); });
  expect(moved.player.z).toBeLessThan(mounted.player.z - 1); expect(moved.evolution.footDistance).toBe(mounted.evolution.footDistance);
  expect(moved.evolution.restTime).toBe(0);
});

test('earned late-game records allow all six ordered upgrades but no remote calibration, free refill or unlimited flight', async ({ page }) => {
  test.setTimeout(90000);
  // Late-game migration fixture: earlier tests earn the first upgrades and the
  // mainline regression earns all story flags through real interactions.
  const late = JSON.parse(await page.evaluate(() => __STAR_ABYSS_TEST__.serialize()));
  for (const key of Object.keys(late.story.flags)) late.story.flags[key] = true;
  late.evolution = { version: 1, bodyLevel: 0, equipmentLevel: 0, footDistance: 900 };
  late.player = { x: 0, z: 170, yaw: 0, pitch: 0 };
  await page.evaluate(raw => __STAR_ABYSS_TEST__.restore(raw), JSON.stringify(late));
  await page.keyboard.press('KeyU');
  await expect(page.locator('#evolve-equipment-button')).toBeDisabled();
  await page.locator('#track-calibration-button').click();
  expect((await snapshot(page)).guidance.target.id).toBe('beacon');
  await page.keyboard.press('KeyU');
  await walk(page, 0, 194); await page.evaluate(() => __STAR_ABYSS_TEST__.advance(3.2));
  await page.keyboard.press('KeyU');
  for (const branch of ['body', 'equipment']) for (let level = 1; level <= 3; level++) {
    const button = page.locator(`#evolve-${branch}-button`); await button.scrollIntoViewIfNeeded();
    await expect(button).toBeEnabled(); await button.click();
    expect((await snapshot(page)).evolution[branch === 'body' ? 'bodyLevel' : 'equipmentLevel']).toBe(level);
  }
  await expect(page.locator('#evolve-body-button')).toBeDisabled(); await expect(page.locator('#evolve-equipment-button')).toBeDisabled();
  expect((await snapshot(page)).evolutionStatus.stats).toMatchObject({ sprintDuration: 120, flightDuration: 120 });
  await page.screenshot({ path: 'docs/ui-implementation/echo-evolution-max.png' });
  const saved = await page.evaluate(() => __STAR_ABYSS_TEST__.serialize());
  await page.evaluate(raw => __STAR_ABYSS_TEST__.restore(raw), saved);
  expect((await snapshot(page)).evolutionStatus.stats).toMatchObject({ sprintDuration: 120, flightDuration: 120 });
  await walk(page, 0, 100);
  // Turn on a clear stretch instead of hitting the wreck's rear wall during a
  // two-minute sprint. Positions remain entirely driven by real movement.
  const run = await page.evaluate(() => {
    const api = __STAR_ABYSS_TEST__; api.advance(12);
    for (let i = 0; i < 12; i++) { api.face(0, i % 2 ? 1000 : -1000); api.advance(i === 11 ? 9 : 10, { forward: true, sprint: true }); }
    const before = api.snapshot(); api.advance(2, { forward: true, sprint: true }); return { before, after: api.snapshot() };
  });
  expect(run.before.stamina.value).toBeGreaterThan(0); expect(run.after.stamina.value).toBe(0);
  const flight = await page.evaluate(() => { const api = __STAR_ABYSS_TEST__; api.advance(60, { lift: true }); const half = api.snapshot(); api.advance(65, { lift: true }); return { half, end: api.snapshot() }; });
  expect(flight.half.mobility.flight.energy).toBeCloseTo(50, 4); expect(flight.half.mobilityStatus.altitude).toBeLessThanOrEqual(4.501);
  expect(flight.end.mobility.flight.energy).toBe(0); expect(flight.end.mobility.flight.airborne).toBeFalsy();
});

test('short flight preserves an existing low-stamina sprint but cannot rearm exhaustion or an airborne released key', async ({ page }) => {
  const flow = await page.evaluate(() => {
    const api = __STAR_ABYSS_TEST__, running = { forward: true, sprint: true };
    api.advance(23.25, running); const low = api.snapshot();
    api.advance(.6, { ...running, lift: true }); const air = api.snapshot();
    api.advance(1.6, running); const landed = api.snapshot();
    api.advance(8, running); const empty = api.snapshot();
    api.advance(.6, { ...running, lift: true }); api.advance(1.6, running);
    const held = api.snapshot();
    api.advance(4); api.advance(.1, running); const recovered = api.snapshot();
    // Ending the sprint while airborne disarms it just as on foot. A fresh
    // press, not merely touching down, is then necessary to start again.
    api.advance(.6, { ...running, lift: true }); api.advance(.1, { forward: true });
    api.advance(1.5, { forward: true }); const released = api.snapshot();
    api.advance(.1, running); return { low, air, landed, empty, held, recovered, released, repressed: api.snapshot() };
  });
  expect(flow.low.stamina.value).toBeLessThan(25); expect(flow.low.stamina.sprinting).toBeTruthy();
  expect(flow.air.mobility.flight.airborne).toBeTruthy(); expect(flow.air.stamina.value).toBe(flow.low.stamina.value);
  expect(flow.landed.mobility.flight.airborne).toBeFalsy(); expect(flow.landed.stamina.sprinting).toBeTruthy();
  expect(flow.landed.stamina.value).toBeGreaterThan(0); expect(flow.landed.stamina.value).toBeLessThan(flow.low.stamina.value);
  expect(flow.empty.stamina.value).toBe(0); expect(flow.held.stamina.value).toBe(0); expect(flow.held.stamina.armed).toBeFalsy();
  expect(flow.recovered.stamina.sprinting).toBeTruthy();
  expect(flow.released.mobility.flight.airborne).toBeFalsy(); expect(flow.released.stamina.armed).toBeFalsy();
  expect(flow.repressed.stamina.sprinting).toBeTruthy();
});
