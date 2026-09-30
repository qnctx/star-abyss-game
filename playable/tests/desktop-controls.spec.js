const { test, expect } = require('@playwright/test');
const path = require('node:path');
const url = 'file:///' + path.resolve(__dirname, '..', 'star-abyss.html').replace(/\\/g, '/') + '?test=1';
test.use({ viewport: { width: 1440, height: 900 } });
test.beforeEach(async ({ page }) => { await page.goto(url); await page.locator('#start-button').click(); });
const snapshot = page => page.evaluate(() => __STAR_ABYSS_TEST__.snapshot());

async function frames(page, milliseconds, minimumNewContacts = 0) {
  return page.evaluate(({ duration, minimumNewContacts }) => new Promise(resolve => {
    const result = [], start = performance.now();
    const initial = __STAR_ABYSS_TEST__.snapshot().gait.stepCount;
    const collect = () => {
      const state = __STAR_ABYSS_TEST__.snapshot(); result.push(state);
      if ((performance.now() - start >= duration && state.gait.stepCount - initial >= minimumNewContacts) || performance.now() - start > 20000) resolve(result);
      else requestAnimationFrame(collect);
    };
    requestAnimationFrame(collect);
  }), { duration: milliseconds, minimumNewContacts });
}
function uniqueContacts(states) {
  const contacts = new Map();
  for (const state of states) if (state.lastContact) contacts.set(state.lastContact.stanceId, state.lastContact);
  return [...contacts.values()];
}
function assertReachable(states) {
  const feet = states.flatMap(state => state.avatarPose.feet.map(foot => ({ ...foot, player: state.player, surface: state.surface })));
  expect(feet.length).toBeGreaterThan(4);
  for (const foot of feet) { expect(foot.error, JSON.stringify(foot)).toBeLessThan(.035); expect(foot.reachError).toBeLessThan(.035); }
}
function assertContactSource(states) {
  for (const state of states) {
    if (state.lastContact) expect(state.lastContact.stanceId).toBe(state.gait.stepCount);
    if (state.audio.lastContact) expect(state.audio.lastContact.stanceId).toBeLessThanOrEqual(state.gait.stepCount);
  }
}
function assertPlantedAnchors(states) {
  let checked = 0;
  for (let i = 1; i < states.length; i++) {
    const previous = states[i - 1], current = states[i];
    if (previous.gait.stepCount !== current.gait.stepCount) continue;
    for (const foot of current.gait.feet) {
      const before = previous.gait.feet.find(item => item.side === foot.side);
      if (!foot.anchored || foot.anchorId!==before.anchorId || !before.stance || foot.phase < before.phase || foot.phase - before.phase > .5) continue;
      expect(Math.hypot(foot.x - before.x, foot.y - before.y, foot.z - before.z)).toBeLessThan(.0001);
      expect(Math.abs(Math.atan2(Math.sin(foot.yaw - before.yaw), Math.cos(foot.yaw - before.yaw)))).toBeLessThan(.20);
      checked++;
    }
  }
  return checked;
}
const speed = state => Math.hypot(state.player.vx, state.player.vz);
const span = values => Math.max(...values) - Math.min(...values);
async function setWalkMode(page, enabled) {
  // Restore deliberately clears held input. A browser-held Ctrl must be
  // released first, otherwise down() is a repeat and correctly cannot resume it.
  await page.keyboard.up('ControlLeft');if(enabled)await page.keyboard.down('ControlLeft');
  await page.waitForFunction(value=>__STAR_ABYSS_TEST__.snapshot().walkMode===value,enabled);
}

test('backward and lateral cautious/default steps retain body heading, and Shift cannot grant sprint or recovery', async ({ page }) => {
  test.setTimeout(240000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const { collides } = await import('../src/layout.mjs');
  const origin = [60, 100, 20].map(z => ({ x: 0, z, yaw: 0 })).find(point => {
    for (let distance = -20; distance <= 20; distance += .5) if (collides(point.x + distance, point.z) || collides(point.x, point.z + distance)) return false;
    return true;
  });
  expect(origin, 'a clear crossing for directional input fixtures').toBeTruthy();
  await page.keyboard.press('KeyV');
  for (const mode of [{ name: 'cautious', walk: true, backSpeed: 1.2, sideSpeed: 1.3 }, { name: 'default', walk: false, backSpeed: 2.8, sideSpeed: 3.2 }]) {
    await setWalkMode(page, mode.walk);
    for (const direction of [{ key: 'KeyS', name: 'backward', axis: 'z', sign: 1 }, { key: 'KeyA', name: 'left', axis: 'x', sign: -1 }, { key: 'KeyD', name: 'right', axis: 'x', sign: 1 }]) {
      const expectedSpeed=direction.name==='backward'?mode.backSpeed:mode.sideSpeed;
      // A spatial fixture resets only position, not controller mode or earned progression.
      await page.evaluate(point => __STAR_ABYSS_TEST__.place(point), origin);
      const start = await snapshot(page);
      await page.keyboard.down(direction.key); const motion = await frames(page, 1100, 3);
      await page.screenshot({ path: `docs/ui-implementation/echo-human-${mode.name}-${direction.name}.png` });
      await page.keyboard.up(direction.key);
      const last = motion.at(-1);
      expect((last.player[direction.axis] - start.player[direction.axis]) * direction.sign, `${mode.name}/${direction.name}`).toBeGreaterThan(.8);
      expect(speed(last)).toBeCloseTo(expectedSpeed, 1);
      expect(last.gait.gaitMode).toBe(mode.walk?'walk':'jog');
      expect(last.player.heading).toBeCloseTo(start.player.heading,6);
      expect(last.avatarPose.headingYaw).toBeCloseTo(start.player.heading,6);
      expect(last.gait.direction[direction.name]).toBeGreaterThan(.8);
      expect(last.avatarPose.style.direction[direction.name]).toBeGreaterThan(.8);
      expect(last.avatarPose.style[mode.walk?'walk':'jog']).toBeGreaterThan(.5);
      const total = ['forward', 'backward', 'left', 'right'].reduce((sum, name) => sum + last.gait.direction[name], 0);
      expect(total).toBeCloseTo(1, 4);
      assertReachable(motion); assertContactSource(motion); assertPlantedAnchors(motion);
      expect(uniqueContacts(motion).length).toBeGreaterThanOrEqual(2);
      // Lateral arms must balance across a real cycle, not freeze because forward speed is zero.
      const shoulderX = motion.map(state => state.avatarPose.arms[0].shoulder[0]);
      const shoulderZ = motion.map(state => state.avatarPose.arms[0].shoulder[2]);
      expect(Math.max(span(shoulderX), span(shoulderZ)), `${mode.name}/${direction.name} arm motion`).toBeGreaterThan(.08);
      await frames(page, 400);
      // Partial-stamina fixture isolates the held-Shift boundary; no story,
      // mobility or evolution unlock is granted. Full stamina would hide regen.
      await page.evaluate(() => {
        const api = __STAR_ABYSS_TEST__, save = JSON.parse(api.serialize());
        save.stamina = { ...save.stamina, value: 40, recoveryRemaining: 0 };
        api.restore(JSON.stringify(save));
      });
      await setWalkMode(page,mode.walk);await page.keyboard.down('Shift'); await page.keyboard.down(direction.key);
      const beforeShift = await snapshot(page), unsupportedSprint = await frames(page, 800, 2);
      await page.keyboard.up(direction.key); await page.keyboard.up('Shift');
      expect(speed(unsupportedSprint.at(-1))).toBeCloseTo(expectedSpeed, 1);
      expect(unsupportedSprint.at(-1).stamina.sprinting).toBeFalsy();
      if(mode.walk)expect(unsupportedSprint.at(-1).stamina.value).toBeGreaterThanOrEqual(beforeShift.stamina.value);else expect(unsupportedSprint.at(-1).stamina.value).toBeCloseTo(beforeShift.stamina.value,6);
      expect(unsupportedSprint.at(-1).gait.gaitMode).toBe(mode.walk?'walk':'jog');
      assertContactSource(unsupportedSprint);
    }
  }
  expect(errors).toEqual([]);
});
