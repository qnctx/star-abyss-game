const { test, expect } = require('@playwright/test');
const path = require('node:path');
const url = 'file:///' + path.resolve(__dirname, '..', 'star-abyss.html').replace(/\\/g, '/') + '?test=1';
const SITES = [
  { id: 'survey-west', name: '断环观测架', x: -1100, z: 650, suffix: 'west' },
  { id: 'survey-east', name: '埋沙镜阵', x: 1200, z: 650, suffix: 'east' },
  { id: 'survey-north', name: '倾斜石柱', x: 1250, z: -1100, suffix: 'north' },
];
const snapshot = page => page.evaluate(() => __STAR_ABYSS_TEST__.snapshot());
test.use({ viewport: { width: 1440, height: 900 } });

async function fixture(page, index, close = false) {
  // Visual-only fixture: two chapters are already completed, and previous field
  // samples are archived. Placement is explicit, not represented as a walked route.
  const raw = JSON.parse(await page.evaluate(() => __STAR_ABYSS_TEST__.serialize()));
  for (const flag of Object.keys(raw.story.flags)) raw.story.flags[flag] = true;
  raw.story.chapterVersion = 2;
  raw.survey = { version: 1, archived: SITES.slice(0, index).map(site => site.id), pending: null };
  const site = SITES[index];
  const x = site.x + (close ? 0 : 11), z = site.z + (close ? 2.8 : 26);
  raw.player = { x, z, yaw: Math.atan2(x - site.x, z - (site.z - (close ? 0 : 10))), pitch: close ? 0 : .055 };
  raw.cameraMode = 'first';
  await page.evaluate(saved => __STAR_ABYSS_TEST__.restore(saved), JSON.stringify(raw));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test('actual remote-site geometry and connected phase screen remain usable at 1440 and 640 pixels', async ({ page }) => {
  test.setTimeout(90000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(url); await page.locator('#start-button').click();
  for (const [index, site] of SITES.entries()) {
    await fixture(page, index);
    await expect(page.locator('#objective-title')).toContainText(site.name);
    await expect(page.locator('#toast')).toBeHidden({ timeout: 12000 });
    await page.screenshot({ path: `docs/ui-implementation/echo-survey-${site.suffix}.png` });
    expect((await snapshot(page)).surveyStatus.current.id).toBe(site.id);
  }
  await fixture(page, 0, true);
  await page.keyboard.press('KeyF');
  await expect(page.locator('#calibration-screen')).toBeVisible();
  await expect(page.locator('#calibration-channel-0')).toBeFocused();
  await expect(page.locator('#hud')).toBeHidden();
  await expect(page.locator('#calibration-confirm')).toBeDisabled();
  const paused = await snapshot(page);
  await page.evaluate(() => __STAR_ABYSS_TEST__.advance(90, { forward: true, sprint: true, lift: true }));
  const frozen = await snapshot(page);
  for (const field of ['elapsed', 'player', 'stamina', 'mobility', 'evolution', 'survey']) expect(frozen[field]).toEqual(paused[field]);
  for (const width of [1440, 640]) {
    await page.setViewportSize({ width, height: 900 });
    for (let index = 0; index < 3; index++) {
      const card = page.locator(`.calibration-channel[data-channel="${index}"]`);
      const source = Number((await card.locator('.calibration-source').innerText()).replace('°', ''));
      const target = Number((await card.locator('.calibration-target').innerText()).replace('°', ''));
      const slider = page.locator(`#calibration-channel-${index}`);
      await slider.scrollIntoViewIfNeeded(); await slider.focus();
      await slider.press('Home');
      for (let step = 0; step < ((target - source + 360) % 360) / 15; step++) await slider.press('ArrowRight');
      await expect(slider).toBeFocused();
      await expect(card.locator('.calibration-residual')).toHaveText('0°');
      const bottom = (await card.locator('.calibration-step-plus').boundingBox()).y;
      await card.locator('.calibration-step-plus').scrollIntoViewIfNeeded();
      expect(Number.isFinite(bottom)).toBe(true);
    }
    await expect(page.locator('#calibration-confirm')).toBeEnabled();
    const clipped = await page.locator('.calibration-shell p,.calibration-shell button,.calibration-readings dt,.calibration-header h2').evaluateAll(elements => elements.filter(el => el.scrollWidth > el.clientWidth + 1 || parseFloat(getComputedStyle(el).fontSize) < 12).map(el => el.textContent));
    expect(clipped, `${width}px connected terminal`).toEqual([]);
    for (const id of ['calibration-confirm', 'calibration-cancel']) {
      expect(await page.locator('#' + id).evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; })).toBe(true);
    }
    await page.locator('.calibration-scroll').evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: `docs/ui-implementation/echo-phase-terminal${width === 1440 ? '' : '-narrow'}.png` });
  }
  await page.keyboard.press('Tab');
  await expect(page.locator('#calibration-screen')).toBeHidden();
  await page.waitForFunction(() => document.pointerLockElement?.id === 'world');
  expect((await snapshot(page)).survey.pending).toBeNull();
  await page.keyboard.press('KeyF');
  await expect(page.locator('#calibration-channel-0')).toHaveValue('0');
  await page.keyboard.press('Escape');
  await expect(page.locator('#calibration-screen')).toBeHidden();
  expect((await snapshot(page)).screen).toBe('playing');
  expect(errors).toEqual([]);
});
