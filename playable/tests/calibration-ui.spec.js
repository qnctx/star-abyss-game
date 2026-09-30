const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const source = name => fs.readFileSync(path.resolve(__dirname, '..', 'src', name), 'utf8').replaceAll('export function ', 'function ');

test.beforeEach(async ({ page }) => {
  await page.setContent('<!doctype html><html lang="zh-CN"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="app"></main></body></html>');
  await page.addStyleTag({ path: path.resolve(__dirname, '..', 'css', 'game.css') });
  await page.addStyleTag({ path: path.resolve(__dirname, '..', 'css', 'calibration.css') });
  await page.addScriptTag({ content: `(() => { ${source('calibration.mjs')} ${source('calibration-ui.mjs').replace('const CHANNEL_NAMES', 'const UI_CHANNEL_NAMES').replaceAll('CHANNEL_NAMES.map', 'UI_CHANNEL_NAMES.map')}
    let session = createCalibration('echo');
    window.events = [];
    const ui = createCalibrationUI({
      change(index, value) { window.events.push(['change', index, value]); setCalibrationValue(session, index, value); ui.update(calibrationView(session)); },
      confirm() { window.events.push(['confirm']); },
      cancel() { window.events.push(['cancel']); }
    });
    window.setSession = id => { session = createCalibration(id); ui.update(calibrationView(session)); };
    ui.element.hidden = false;
    ui.update(calibrationView(session));
  })();` });
});

test('manual three-channel terminal preserves focus and delegates completion to rules', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('#calibration-confirm')).toBeDisabled();
  await expect(page.locator('#calibration-screen')).toHaveAttribute('role', 'dialog');
  const first = page.locator('#calibration-channel-0');
  await first.focus();
  await page.evaluate(() => { window.originalSlider = document.querySelector('#calibration-channel-0'); });
  await page.keyboard.press('ArrowRight');
  await expect(first).toHaveValue('15');
  await expect(first).toBeFocused();
  expect(await page.evaluate(() => window.originalSlider === document.querySelector('#calibration-channel-0'))).toBe(true);
  await page.locator('[data-channel="0"] .calibration-step-minus').click();
  await expect(first).toHaveValue('0');
  await page.locator('[data-channel="0"] .calibration-step-minus').click();
  await expect(first).toHaveValue('345');
  await page.locator('[data-channel="0"] .calibration-step-plus').click();
  await expect(first).toHaveValue('0');
  for (const [index, value] of [240, 120, 300].entries()) {
    await page.locator(`#calibration-channel-${index}`).fill(String(value));
  }
  await expect(page.locator('#calibration-confirm')).toBeEnabled();
  await expect(page.locator('#calibration-channel-count')).toHaveText('3 / 3 通道对齐');
  await expect(page.locator('#calibration-quality')).toHaveText('100%');
  await page.locator('#calibration-confirm').click();
  expect((await page.evaluate(() => window.events)).at(-1)).toEqual(['confirm']);
  await page.evaluate(() => window.setSession('rift'));
  await expect(page.locator('#calibration-confirm')).toBeDisabled();
  await expect(page.locator('#calibration-mode')).toHaveText('反相隔离 · 目标 180°');
  for (const [index, value] of [270, 90, 315].entries()) await page.locator(`#calibration-channel-${index}`).fill(String(value));
  await expect(page.locator('#calibration-confirm')).toBeEnabled();
  await expect(page.locator('#calibration-confirm')).toContainText('确认反相隔离');
  await page.locator('#calibration-cancel').click();
  expect((await page.evaluate(() => window.events)).at(-1)).toEqual(['cancel']);
});

test('Chinese controls stay readable, scrollable and clickable at desktop and narrow sizes', async ({ page }) => {
  for (const width of [1440, 768, 640]) {
    await page.setViewportSize({ width, height: 800 });
    for (const selector of ['#calibration-cancel', '#calibration-confirm']) {
      const bounds = await page.locator(selector).boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(800);
    }
    for (let index = 0; index < 3; index++) {
      const button = page.locator(`[data-channel="${index}"] .calibration-step-plus`);
      await button.scrollIntoViewIfNeeded();
      await button.click();
      const bounds = await button.boundingBox();
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual((await page.locator('.calibration-footer').boundingBox()).y);
    }
    const overflow = await page.locator('.calibration-shell p,.calibration-shell h2,.calibration-shell h3,.calibration-shell button,.calibration-readings dt,.calibration-equation').evaluateAll(elements => elements.filter(el => el.scrollWidth > el.clientWidth + 1 || parseFloat(getComputedStyle(el).fontSize) < 12).map(el => el.textContent));
    expect(overflow, `${width}px layout`).toEqual([]);
    await page.locator('.calibration-scroll').evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: `docs/ui-implementation/calibration-terminal-${width}.png` });
  }
});
