const { test, expect } = require('@playwright/test');
const path = require('node:path');
const url = 'file:///' + path.resolve(__dirname, '..', 'star-abyss.html').replace(/\\/g, '/') + '?test=1';
test.use({ viewport: { width: 1440, height: 900 } });
test.beforeEach(async ({ page }) => { await page.goto(url); await page.locator('#start-button').click(); });
const snapshot = page => page.evaluate(() => __STAR_ABYSS_TEST__.snapshot());
async function mapClick(page, x, z) {
  const screen = await page.locator('#survey-map').evaluate((svg, point) => {
    const span = Number(svg.dataset.span), cx = Number(svg.dataset.centerX), cz = Number(svg.dataset.centerZ);
    const location = new DOMPoint(300 + (point.x - cx) * 550 / span, 300 + (point.z - cz) * 550 / span).matrixTransform(svg.getScreenCTM());
    return { x: location.x, y: location.y };
  }, { x, z });
  await page.mouse.click(screen.x, screen.y);
}

test('map click sets persistent navigation, known places can be tracked, and clear restores the task', async ({ page }) => {
  test.setTimeout(60000);
  await page.keyboard.press('Tab');
  await mapClick(page, 5, 100);
  let s = await snapshot(page);
  expect(s.navigation.waypoint.x).toBeCloseTo(5, 0); expect(s.navigation.waypoint.z).toBeCloseTo(100, 0);
  await expect(page.getByTestId('map-waypoint')).toBeVisible();
  await page.screenshot({ path: 'docs/ui-implementation/echo-map-waypoint.png' });
  const saved = await page.evaluate(() => __STAR_ABYSS_TEST__.serialize());
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => document.pointerLockElement?.id === 'world');
  await expect(page.locator('#navigation-name')).toContainText('自定义');
  expect((await snapshot(page)).guidance.kind).toBe('custom');
  await page.evaluate(raw => __STAR_ABYSS_TEST__.restore(raw), saved);
  expect((await snapshot(page)).navigation).toEqual(s.navigation);
  await page.evaluate(() => __STAR_ABYSS_TEST__.walkTo(5, 105));
  expect((await snapshot(page)).guidance.arrived).toBeTruthy();
  await expect(page.locator('#navigation-detail')).toContainText('Tab 可更改');
  await page.keyboard.press('Tab');
  await page.locator('.map-places').evaluate(el => { el.open = true; }); await page.locator('#map-point-list button[data-point-id="signal"]').click();
  expect((await snapshot(page)).guidance.target.id).toBe('signal');
  await page.locator('#map-clear-waypoint').click();
  s = await snapshot(page); expect(s.navigation.waypoint).toBeNull(); expect(s.guidance.kind).toBe('task');
  expect(s.guidance.target.id).toBe('signal');
});

test('map drag and zoom do not create a pin; interior detail and small-screen controls remain usable', async ({ page }) => {
  test.setTimeout(60000);
  await page.keyboard.press('Tab');
  await expect(page.locator('#map-interior')).toBeDisabled();
  const svg = page.locator('#survey-map'), before = await svg.getAttribute('data-center-x');
  const r = await svg.boundingBox();
  await page.mouse.move(r.x + r.width * .62, r.y + r.height * .38);
  await page.mouse.down(); await page.mouse.move(r.x + r.width * .76, r.y + r.height * .48, { steps: 5 }); await page.mouse.up();
  expect(await svg.getAttribute('data-center-x')).not.toBe(before);
  expect((await snapshot(page)).navigation.waypoint).toBeNull();
  const span = Number(await svg.getAttribute('data-span'));
  await page.mouse.wheel(0, -250);
  await expect.poll(async () => Number(await svg.getAttribute('data-span'))).toBeLessThan(span);
  await page.locator('#map-center').click();
  expect(Number(await svg.getAttribute('data-center-x'))).toBeCloseTo((await snapshot(page)).player.x, 1);
  await page.keyboard.press('Tab');
  // Fixture placement isolates the interior-map rendering, not story completion.
  await page.evaluate(() => { __STAR_ABYSS_TEST__.place({ x: 0, z: -480 }); __STAR_ABYSS_TEST__.advance(.1); });
  await page.keyboard.press('Tab'); await page.locator('#map-interior').click();
  expect(Number(await svg.getAttribute('data-span'))).toBeLessThanOrEqual(400);
  for (const size of [{ width: 900, height: 812 }, { width: 768, height: 720 }]) {
    await page.setViewportSize(size);
    const clipped = await page.locator('button:visible').evaluateAll(elements => elements.filter(el => {
      const r = el.getBoundingClientRect(); return r.left < 0 || r.top < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1;
    }).map(el => el.textContent));
    expect(clipped).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBeFalsy();
    await page.keyboard.press('KeyJ'); await expect(page.locator('#journal-entries')).toBeVisible();
    await page.keyboard.press('KeyJ'); await page.keyboard.press('Tab'); await expect(svg).toBeVisible();
  }
  await page.screenshot({ path: 'docs/ui-implementation/echo-map-interior.png' });
});

test('V switches a real third-person camera without moving the player and retracts at the closed seal', async ({ page }) => {
  test.setTimeout(60000);
  const before = await snapshot(page);
  await page.keyboard.press('KeyV');
  await page.waitForFunction(() => __STAR_ABYSS_TEST__.snapshot().cameraRig.mode === 'third');
  let s = await snapshot(page);
  expect(s.player.x).toBe(before.player.x); expect(s.player.z).toBe(before.player.z);
  expect(s.cameraRig.distance).toBeGreaterThan(2); expect(s.cameraRig.avatarVisible).toBeTruthy();
  await page.keyboard.down('KeyW'); await page.waitForTimeout(650); await page.keyboard.up('KeyW');
  s = await snapshot(page); expect(s.player.z).toBeLessThan(before.player.z - .5);
  await page.screenshot({ path: 'docs/ui-implementation/echo-third-person.png' });
  const saved = await page.evaluate(() => __STAR_ABYSS_TEST__.serialize());
  await page.keyboard.press('KeyV'); await page.waitForFunction(() => __STAR_ABYSS_TEST__.snapshot().cameraRig.mode === 'first');
  s = await snapshot(page); expect(s.cameraRig.avatarVisible).toBeFalsy(); expect(s.camera[0]).toBeCloseTo(s.player.x, 2);
  await page.evaluate(raw => __STAR_ABYSS_TEST__.restore(raw), saved);
  expect((await snapshot(page)).cameraMode).toBe('third');
  await page.evaluate(() => __STAR_ABYSS_TEST__.place({ x: 0, z: -709.6, yaw: Math.PI }));
  await page.waitForFunction(() => __STAR_ABYSS_TEST__.snapshot().cameraRig.occluded);
  s = await snapshot(page); expect(s.camera[2]).toBeGreaterThan(-710.3); expect(s.cameraRig.distance).toBeLessThan(2);
  await page.keyboard.press('Tab'); await page.keyboard.press('KeyV');
  expect((await snapshot(page)).cameraMode).toBe('third');
  await page.keyboard.press('Tab'); await page.waitForFunction(() => document.pointerLockElement?.id === 'world');
  await page.keyboard.press('KeyV'); await page.waitForFunction(() => __STAR_ABYSS_TEST__.snapshot().cameraRig.mode === 'first');
});

test('visible near-path boulder physically blocks movement and can be walked around', async ({ page }) => {
  test.setTimeout(60000);
  await page.evaluate(() => __STAR_ABYSS_TEST__.place({ x: 24, z: 135, yaw: 0 }));
  await page.keyboard.down('KeyW');
  const hit = await page.evaluate(() => { __STAR_ABYSS_TEST__.advance(2, { forward: true }); return __STAR_ABYSS_TEST__.snapshot(); });
  expect(hit.blocked).toBeTruthy(); expect(hit.player.z).toBeGreaterThan(130.5); expect(hit.player.z).toBeLessThan(135);
  await expect(page.locator('#surface-status')).toContainText('阻挡');
  await page.screenshot({ path: 'docs/ui-implementation/echo-rock-contact.png' });
  await page.keyboard.up('KeyW');
  await page.evaluate(() => { __STAR_ABYSS_TEST__.advance(1.2, { right: true }); __STAR_ABYSS_TEST__.advance(2, { forward: true }); });
  const passed = await snapshot(page); expect(passed.player.x).toBeGreaterThan(27); expect(passed.player.z).toBeLessThan(130); expect(passed.blocked).toBeFalsy();
});

test('map rejects pins inside solid rocks and remembers discovered anomalies without revealing the final source', async ({ page }) => {
  test.setTimeout(60000);
  await page.keyboard.press('Tab'); await mapClick(page, 24, 130);
  expect((await snapshot(page)).navigation.waypoint).toBeNull();
  await expect(page.locator('#toast')).toContainText('可通行');
  await page.keyboard.press('Tab');
  await page.evaluate(() => __STAR_ABYSS_TEST__.place({ x: -420, z: -165 }));
  expect((await snapshot(page)).knownPoints).toContain('echo');
  await page.evaluate(() => __STAR_ABYSS_TEST__.place({ x: 0, z: 190 }));
  const saved = await page.evaluate(() => __STAR_ABYSS_TEST__.serialize());
  await page.evaluate(raw => __STAR_ABYSS_TEST__.restore(raw), saved);
  const s = await snapshot(page); expect(s.knownPoints).toContain('echo'); expect(s.knownPoints).not.toContain('rift');
  expect(s.story.logs).not.toContain('echo');
  await page.keyboard.press('Tab');
  await page.locator('.map-places').evaluate(el => { el.open = true; }); await page.locator('#map-point-list button[data-point-id="echo"]').click();
  expect((await snapshot(page)).guidance.target.id).toBe('echo');
});

test('navigation, objectives and controls do not overlap at narrow HUD widths', async ({ page }) => {
  test.setTimeout(60000);
  for (const width of [900, 768, 750, 640]) {
    await page.setViewportSize({ width, height: 720 });
    const layout = await page.evaluate(() => {
      const selectors = ['.objective', '.navigation-hud', '.location', '.suit-status', '.hud-controls'];
      const panels = selectors.map(selector => ({ selector, rect: document.querySelector(selector).getBoundingClientRect() }));
      const overlaps = [];
      panels.forEach((a, i) => panels.slice(i + 1).forEach(b => {
        const dx = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
        const dy = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
        if (dx > 1 && dy > 1) overlaps.push([a.selector, b.selector]);
      }));
      const blockedButtons = [...document.querySelectorAll('#hud button')].filter(button => {
        const r = button.getBoundingClientRect();
        return r.left < 0 || r.bottom > innerHeight || r.right > innerWidth || document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button') !== button;
      }).map(button => button.id);
      return { overlaps, blockedButtons };
    });
    expect(layout, `HUD at ${width}px`).toEqual({ overlaps: [], blockedButtons: [] });
  }
  await page.screenshot({ path: 'docs/ui-implementation/echo-hud-narrow.png' });
});
