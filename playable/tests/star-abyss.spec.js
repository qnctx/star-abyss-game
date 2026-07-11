const { test, expect } = require('@playwright/test');
const path = require('node:path');
const url = 'file:///' + path.resolve(__dirname, '..', 'star-abyss.html').replace(/\\/g, '/');

test.beforeEach(async ({ page }) => { await page.goto(url); });

test('离线启动、输入互斥和受控推进', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.click('#new-btn');
  await expect(page.locator('#hud')).toBeVisible();
  await page.keyboard.press('Digit4');
  const tool = await page.evaluate(() => __STAR_ABYSS_TEST__.snapshot().tool);
  expect(tool).toBe('build');
  await page.mouse.click(500, 400);
  const snap = await page.evaluate(() => __STAR_ABYSS_TEST__.snapshot());
  expect(snap.buildings.length).toBe(0);
  expect(errors).toEqual([]);
});

test('100% 进入坚守而非直接胜利，倒计时后胜利', async ({ page }) => {
  await page.click('#new-btn');
  await page.evaluate(() => __STAR_ABYSS_TEST__.setState({ signal: { progress: 95 }, inventory: { energy: 30 }, buildings: [{ id: 'b', type: 'signal_beacon', x: 1300, y: 900, hp: 100, maxHp: 100, level: 0, timer: 12 }] }));
  let snap = await page.evaluate(() => __STAR_ABYSS_TEST__.advance(0.1));
  expect(snap.signal.extractionActive).toBeTruthy();
  expect(snap.mode).toBe('playing');
  await page.evaluate(() => __STAR_ABYSS_TEST__.setState({ enemies: [], signal: { extractionRemaining: 0.05 } }));
  snap = await page.evaluate(() => __STAR_ABYSS_TEST__.advance(0.1));
  expect(snap.mode).toBe('victory');
});

test('死亡恢复、保存刷新继续与多分辨率 HUD', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.click('#new-btn');
  await page.evaluate(() => __STAR_ABYSS_TEST__.setState({ day: 2, inventory: { iron: 20 }, player: { oxygen: 0.01 } }));
  let snap = await page.evaluate(() => __STAR_ABYSS_TEST__.advance(4));
  expect(snap.player.alive).toBeTruthy();
  expect(snap.player.oxygen).toBeGreaterThan(0);
  await page.evaluate(() => __STAR_ABYSS_TEST__.save());
  await page.reload();
  await page.click('#continue-btn');
  snap = await page.evaluate(() => __STAR_ABYSS_TEST__.snapshot());
  expect(snap.player.alive).toBeTruthy();
  await expect(page.locator('.toolbar')).toBeVisible();
});
