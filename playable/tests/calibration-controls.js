const { expect } = require('@playwright/test');

// Solve only the instrument readings visible to the player; never write story flags.
async function tuneCalibration(page, count = 3) {
  await expect(page.locator('#calibration-screen')).toBeVisible();
  for (let index = 0; index < count; index++) {
    const card = page.locator(`.calibration-channel[data-channel="${index}"]`);
    const source = Number.parseInt(await card.locator('.calibration-source').innerText(), 10);
    const target = Number.parseInt(await card.locator('.calibration-target').innerText(), 10);
    const range = page.locator(`#calibration-channel-${index}`);
    const compensation = (target - source + 360) % 360;
    await range.focus(); await range.press('Home');
    for (let step = 0; step < compensation / 15; step++) await range.press('ArrowRight');
    await expect(range).toHaveValue(String(compensation));
    await expect(card.locator('.calibration-residual')).toHaveText('0°');
  }
  if (count === 3) {
    await expect(page.locator('#calibration-confirm')).toBeEnabled();
    await expect(page.locator('#calibration-channel-count')).toHaveText('3 / 3 通道对齐');
  }
}

module.exports = { tuneCalibration };
