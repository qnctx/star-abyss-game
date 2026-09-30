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

test('real Ctrl walking, default jogging and Shift sprinting share human contacts and stable first-person eyes', async ({ page }) => {
  test.setTimeout(120000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.keyboard.press('KeyV'); expect((await snapshot(page)).walkMode).toBeFalsy();
  await setWalkMode(page,true);await page.keyboard.down('KeyW');
  const walk = await frames(page, 1600, 4);
  expect(speed(walk.at(-1))).toBeCloseTo(1.65, 1); expect(walk.at(-1).gait.gaitMode).toBe('walk');
  expect(walk.at(-1).stamina.value).toBe(100);
  await page.screenshot({ path: 'docs/ui-implementation/echo-human-walk.png' });
  const beforeToggle = (await snapshot(page)).gait.stepCount;
  await setWalkMode(page, false); const jog = await frames(page, 1600, 4);
  expect(jog[0].gait.stepCount).toBeGreaterThanOrEqual(beforeToggle);
  expect(speed(jog.at(-1))).toBeCloseTo(4.7, 1); expect(jog.at(-1).gait.gaitMode).toBe('jog');
  await page.screenshot({ path: 'docs/ui-implementation/echo-human-jog.png' });
  await page.keyboard.down('Shift'); const run = await frames(page, 1600, 6);
  expect(speed(run.at(-1))).toBeCloseTo(6.3, 1); expect(run.at(-1).gait.gaitMode).toBe('sprint');
  await page.screenshot({ path: 'docs/ui-implementation/echo-human-run.png' });
  expect(walk.at(-1).player.z).toBeLessThan(walk[0].player.z - 1);
  expect(run.at(-1).stamina.sprinting).toBeTruthy();
  const all = [...walk, ...jog, ...run], contacts = uniqueContacts(all); expect(contacts.length).toBeGreaterThanOrEqual(10);
  for (const [mode, states] of [['walk', walk], ['jog', jog], ['sprint', run]]) expect(states.at(-1).avatarPose.style[mode]).toBeGreaterThan(.5);
  for (let index = 1; index < contacts.length; index++) if (contacts[index].stanceId === contacts[index - 1].stanceId + 1) expect(contacts[index].foot).toBe(-contacts[index - 1].foot);
  assertContactSource(all);
  expect(assertPlantedAnchors(walk)).toBeGreaterThan(0);
  assertPlantedAnchors(jog); assertPlantedAnchors(run);
  expect(run.at(-1).audio.contactCount).toBeGreaterThanOrEqual(5);
  assertReachable(all);
  const kneeAngles = all.map(state => state.avatarPose.feet[0].knee[0]);
  expect(span(kneeAngles)).toBeGreaterThan(.35);
  const shoulders = run.map(state => state.avatarPose.arms[0].shoulder[0]);
  // Reject frozen arms without locking a new human pose to the old rig's angles.
  expect(span(shoulders)).toBeGreaterThan(.15);
  const {MOTION_VERSION}=await import('../src/humanoid-rig.mjs');
  expect(run.every(state=>state.avatarPose.version===MOTION_VERSION&&state.avatarPose.bones===19)).toBeTruthy();
  const countBeforeView = run.at(-1).gait.stepCount;
  await page.keyboard.press('KeyV');
  await page.waitForFunction(() => __STAR_ABYSS_TEST__.snapshot().cameraRig.mode === 'first');
  const firstPerson = await frames(page, 650);
  expect(firstPerson.at(-1).gait.stepCount).toBeGreaterThan(countBeforeView);
  for (const state of firstPerson) expect(state.camera[1] - state.player.y).toBeCloseTo(1.72, 5);
  await page.keyboard.down('KeyA'); const diagonal = await frames(page, 650, 2); await page.keyboard.up('KeyA');
  expect(speed(diagonal.at(-1))).toBeCloseTo(6.3, 1);
  expect(diagonal.at(-1).stamina.sprinting).toBeTruthy();
  assertContactSource(diagonal);
  await page.keyboard.up('Shift'); await page.keyboard.up('KeyW');
  expect(errors).toEqual([]);
});

test('standing or pushing a wall makes no looping steps', async ({ page }) => {
  test.setTimeout(60000);
  // Spatial input-boundary fixture: wall at x=-8, with a clear corridor on its right.
  await page.evaluate(() => __STAR_ABYSS_TEST__.place({ x: -6.4, z: -500, yaw: Math.PI / 2 }));
  await page.keyboard.press('KeyV'); await page.keyboard.down('KeyW');
  await page.waitForFunction(() => __STAR_ABYSS_TEST__.snapshot().blocked);
  await frames(page, 900); const wall = await snapshot(page);
  const pushing = await frames(page, 750);
  expect(pushing.at(-1).gait.stepCount).toBe(wall.gait.stepCount);
  expect(pushing.at(-1).player.x).toBeCloseTo(wall.player.x, 5);
  await page.keyboard.up('KeyW'); await frames(page, 500);
  const standing = await snapshot(page); const rest = await frames(page, 700);
  expect(rest.at(-1).gait.stepCount).toBe(standing.gait.stepCount);
});

test('Tab pauses walking audio and resumes without replaying old contacts', async ({ page }) => {
  test.setTimeout(60000);
  // Independent input/lifecycle case: no need to repeat wall settling first.
  // Keep both checks and their original timeout instead of hiding a slow test.
  await page.evaluate(() => __STAR_ABYSS_TEST__.place({x:-6.4,z:-500,yaw:-Math.PI/2}));
  await page.keyboard.press('KeyV');
  await page.keyboard.down('KeyW'); await frames(page, 700);
  await page.keyboard.press('Tab'); const paused = await snapshot(page);
  expect(paused.audio.suspended).toBeTruthy();
  const frozen = await frames(page, 350);
  expect(frozen.at(-1).player).toEqual(paused.player);
  expect(frozen.at(-1).gait).toEqual(paused.gait);
  expect(frozen.at(-1).audio.activeVoices).toBe(0);
  await page.keyboard.up('KeyW'); await page.keyboard.press('Tab');
  await page.waitForFunction(() => document.pointerLockElement?.id === 'world');
  await frames(page, 500); const settling = await snapshot(page);
  expect(settling.gait.stepCount - paused.gait.stepCount).toBeLessThanOrEqual(2);
  const silence = await frames(page, 2100);
  expect(silence.at(-1).gait.stepCount).toBe(settling.gait.stepCount);
  expect(silence.at(-1).audio.activeVoices).toBe(0);
  // A fresh W press produces fresh contacts, not a deferred burst from Tab.
  await page.keyboard.down('KeyS'); const renewed = await frames(page, 650); await page.keyboard.up('KeyS');
  expect(renewed.at(-1).audio.contactCount).toBeGreaterThan(settling.audio.contactCount);
});

test('flight has no steps, touchdown emits one landing and real vehicle driving stays footstep-free', async ({ page }) => {
  test.setTimeout(60000);
  await page.keyboard.press('KeyV'); const start = await snapshot(page);
  await page.keyboard.down('KeyG');
  await page.waitForFunction(() => __STAR_ABYSS_TEST__.snapshot().mobilityStatus.altitude > 1.2);
  await page.keyboard.down('KeyW'); const flight = await frames(page, 650); await page.keyboard.up('KeyW');
  expect(flight.every(state => state.gait.stepCount === start.gait.stepCount)).toBeTruthy();
  expect(flight.at(-1).audio.contactCount).toBe(start.audio.contactCount);
  await page.keyboard.up('KeyG');
  await page.waitForFunction(() => !__STAR_ABYSS_TEST__.snapshot().mobility.flight.airborne);
  await frames(page, 500); const landed = await snapshot(page);
  expect(landed.gait.stepCount - start.gait.stepCount).toBe(1);
  expect(landed.lastContact.type).toBe('land');
  expect(landed.audio.lastContact.type).toBe('land');
  // Vehicle fixture isolates locomotion mode, not vehicle unlock progression
  // (the full repair/drive story is exercised in mobility.spec.js).
  await page.evaluate(() => {
    const api = __STAR_ABYSS_TEST__, save = JSON.parse(api.serialize());
    save.mobility.vehicle = { ...save.mobility.vehicle, x: 0, z: 140, yaw: 0, repaired: true, partTaken: true, mounted: true };
    api.restore(JSON.stringify(save));
  });
  const mounted = await snapshot(page); expect(mounted.mobility.vehicle.mounted).toBeTruthy();
  await page.keyboard.down('KeyW');
  // Software-rendered frames can advance less simulation time than wall time.
  // Wait for the physical distance, keeping the original 8 m requirement.
  await page.waitForFunction(z => __STAR_ABYSS_TEST__.snapshot().player.z < z - 8, mounted.player.z);
  const driving = await frames(page, 500); await page.keyboard.up('KeyW');
  expect(driving.at(-1).player.z).toBeLessThan(mounted.player.z - 8);
  expect(driving.at(-1).gait.stepCount).toBe(mounted.gait.stepCount);
  expect(driving.at(-1).audio.contactCount).toBe(mounted.audio.contactCount);
  expect(driving.at(-1).avatarPose.mode).toBe('seated');
  await page.keyboard.down('Space'); await frames(page, 600);
  await page.waitForFunction(() => __STAR_ABYSS_TEST__.snapshot().mobilityStatus.speed < 2);
  await page.keyboard.up('Space'); await page.keyboard.press('KeyF');
  const exited = await frames(page, 850);
  expect(exited.at(-1).mobility.vehicle.mounted).toBeFalsy();
  // Dismount is a positional mode transition, not a high-speed walking stride.
  expect(exited.at(-1).gait.stepCount).toBe(0);
  expect(exited.at(-1).audio.contactCount).toBe(0);
  expect(exited.at(-1).gait.speed).toBeLessThan(.01);
});

test('Ctrl slow walk yields to release; airborne and vehicle speeds remain independent',async({page})=>{
    test.setTimeout(120000);
    await setWalkMode(page,true);await page.keyboard.down('KeyW');await page.keyboard.down('Shift');
    await page.waitForFunction(()=>Math.abs(__STAR_ABYSS_TEST__.snapshot().mobilityStatus.speed-1.65)<.02);
    expect((await snapshot(page)).stamina.sprinting).toBe(false);
    await setWalkMode(page,false);await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().mobilityStatus.speed>6.2);
    await page.keyboard.up('Shift');await setWalkMode(page,true);await page.keyboard.down('KeyG');
    await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().mobilityStatus.speed>11.97);
    await page.keyboard.up('KeyG');await page.keyboard.up('KeyW');await setWalkMode(page,false);
    await page.evaluate(()=>{const api=__STAR_ABYSS_TEST__,save=JSON.parse(api.serialize());save.mobility.vehicle={...save.mobility.vehicle,x:0,z:140,yaw:0,repaired:true,partTaken:true,mounted:true};api.restore(JSON.stringify(save));});
    await setWalkMode(page,true);await page.keyboard.down('KeyW');await page.keyboard.down('Shift');
    await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().mobilityStatus.speed>31.97);
    expect((await snapshot(page)).avatarPose.mode).toBe('seated');
    await page.keyboard.up('KeyW');await page.keyboard.up('Shift');await setWalkMode(page,false);
});

test('C crouch survives real save/reload, legacy saves default standing, and narrow fallback HUD buttons stay clickable', async ({ page }) => {
  test.setTimeout(120000);
  // The Playwright context is isolated from the user's browser/profile. This
  // case deliberately uses normal localStorage, not the non-saving test hook.
  // HUD clicks exercise the supported drag-look fallback without pointer lock.
  await page.addInitScript(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'requestPointerLock', { configurable: true, value: undefined });
  });
  await page.goto(url.replace('?test=1', '')); await page.locator('#start-button').click();
  await expect(page.locator('#walk-button')).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('KeyC');
  await expect(page.locator('#walk-button')).toHaveAttribute('aria-pressed', 'true');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('star-abyss-silent-echo-v1')));
  expect(saved.player.posture).toBe('crouch');
  await page.reload(); await page.locator('#continue-button').click();
  await expect(page.locator('#walk-button')).toHaveAttribute('aria-pressed', 'true');
  // Only remove the new preference field: preserve the actual investigation,
  // endurance and travel data instead of replacing it with a made-up old game.
  const legacy = await page.evaluate(() => JSON.parse(localStorage.getItem('star-abyss-silent-echo-v1')));
  delete legacy.player.posture;delete legacy.walkMode;
  // Seed on the next document, after the old page's legitimate pagehide save.
  await page.addInitScript(raw => localStorage.setItem('star-abyss-silent-echo-v1', raw), JSON.stringify(legacy));
  await page.reload(); await page.locator('#continue-button').click();
  await expect(page.locator('#walk-button')).toHaveAttribute('aria-pressed', 'false');
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('star-abyss-silent-echo-v1')));
  expect(restored.story.flags).toEqual(saved.story.flags);
  for (const width of [900, 640]) {
    await page.setViewportSize({ width, height: 720 });
    await expect(page.locator('#walk-button')).toBeVisible();
    const failures = await page.evaluate(() => {
      const items = [...document.querySelectorAll('.hud-controls > *')].filter(element => element.getBoundingClientRect().width > 0);
      // Inline keycaps may extend beyond a span's line box with visible
      // overflow. Include their painted bounds for overlap/viewport checks;
      // scrollHeight > clientHeight alone does not mean content is clipped.
      const failures = [], boxes = items.map(element => {
        const bounds = [element.getBoundingClientRect(), ...[...element.querySelectorAll('*')].map(child => child.getBoundingClientRect())];
        const range = document.createRange(); range.selectNodeContents(element);
        bounds.push(...range.getClientRects());
        return { element, box: { left: Math.min(...bounds.map(b => b.left)), right: Math.max(...bounds.map(b => b.right)), top: Math.min(...bounds.map(b => b.top)), bottom: Math.max(...bounds.map(b => b.bottom)) } };
      });
      for (let index = 0; index < boxes.length; index++) {
        const { element, box } = boxes[index], label = element.id || element.textContent.trim();
        if (box.left < 0 || box.top < 0 || box.right > innerWidth || box.bottom > innerHeight) failures.push(`${label}: viewport`);
        const style = getComputedStyle(element);
        if ((style.overflowX !== 'visible' && element.scrollWidth > element.clientWidth + 1)
          || (style.overflowY !== 'visible' && element.scrollHeight > element.clientHeight + 1)) failures.push(`${label}: clipped`);
        for (const other of boxes.slice(index + 1)) if (Math.min(box.right, other.box.right) - Math.max(box.left, other.box.left) > 1 && Math.min(box.bottom, other.box.bottom) - Math.max(box.top, other.box.top) > 1) failures.push(`${label}: overlap ${other.element.id}`);
      }
      const footer = document.querySelector('.hud-controls').getBoundingClientRect(), suit = document.querySelector('.suit-status').getBoundingClientRect();
      if (Math.min(footer.right, suit.right) - Math.max(footer.left, suit.left) > 1 && Math.min(footer.bottom, suit.bottom) - Math.max(footer.top, suit.top) > 1) failures.push('footer: overlaps suit HUD');
      const button = document.querySelector('#walk-button'), box = button.getBoundingClientRect(), hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      if (hit !== button && !button.contains(hit)) failures.push('C button: occluded');
      return failures;
    });
    expect(failures, `${width}px footer`).toEqual([]);
    // Exercise both the longer "on" and shorter "off" notices at each width.
    // A clickable footer does not by itself prove a toast leaves the task,
    // navigation and vital status readable.
    for (let toggle = 0; toggle < 2; toggle++) {
      const before = await page.locator('#walk-button').getAttribute('aria-pressed');
      await page.locator('#walk-button').click();
      await expect(page.locator('#walk-button')).toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true');
      await expect(page.locator('#toast')).toBeVisible();
      const toastFailures = await page.evaluate(() => {
        const toast = document.querySelector('#toast'), box = toast.getBoundingClientRect(), failures = [];
        if (box.left < 0 || box.top < 0 || box.right > innerWidth || box.bottom > innerHeight) failures.push('toast: viewport');
        if (toast.scrollWidth > toast.clientWidth + 1 || toast.scrollHeight > toast.clientHeight + 1) failures.push('toast: text overflow');
        for (const selector of ['.objective', '#navigation-hud', '.location', '.suit-status', '.compass', '.hud-controls']) {
          const element = document.querySelector(selector);
          if (!element.getClientRects().length) continue;
          const other = element.getBoundingClientRect();
          if (Math.min(box.right, other.right) - Math.max(box.left, other.left) > 1 && Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top) > 1) failures.push(`toast: overlaps ${selector}`);
        }
        return failures;
      });
      expect(toastFailures, `${width}px C notice`).toEqual([]);
      if (before === 'false') await page.screenshot({ path: `docs/ui-implementation/echo-human-controls-${width}.png` });
    }
  }
});

test('sole-contact material follows dust/gravel/deck/rock, with mute and real-time voice cleanup', async ({ page }) => {
  test.setTimeout(90000);
  const { sampleFooting } = await import('../src/footing.mjs');
  const { collides, terrainHeight, ROCK_FIELD, rockSurfaceHeight } = await import('../src/layout.mjs');
  const patches = {}, terrainStates = [];
  for (let x = -700; x < 700 && Object.keys(patches).length < 2; x += 31) for (let z = 300; z < 600; z += 23) {
    const surface = sampleFooting(x, z).surface;
    if (!['dust', 'gravel'].includes(surface) || patches[surface]) continue;
    const clear = Array.from({ length: 15 }, (_, i) => z - i * .5).every(pz => !collides(x, pz) && [-.1, .1].every(dx => sampleFooting(x + dx, pz).surface === surface));
    if (clear) patches[surface] = { x, z, yaw: 0 };
  }
  expect(Object.keys(patches).sort()).toEqual(['dust', 'gravel']);
  for (const [surface, point] of [...Object.entries(patches), ['metal', { x: 0, z: -480, yaw: 0 }]]) {
    await page.evaluate(p => __STAR_ABYSS_TEST__.place(p), point);
    await page.keyboard.down('KeyW'); const walking = await frames(page, 1050, 3); await page.keyboard.up('KeyW');
    const steps = uniqueContacts(walking); expect(steps.length).toBeGreaterThanOrEqual(2);
    expect(steps.every(event => event.surface === surface && event.indoor === (surface === 'metal'))).toBeTruthy();
    expect(walking.at(-1).audio.lastContact.surface).toBe(surface);
    terrainStates.push(...walking);
  }
  const rock = ROCK_FIELD.rocks.find(r => r.solid && r.x === 24 && r.z === 130);
  const rockTop = rockSurfaceHeight(rock, rock.x, rock.z);
  await page.evaluate(point => {
    const api = __STAR_ABYSS_TEST__, save = JSON.parse(api.serialize());
    save.player = { ...save.player, ...point, vx: 0, vz: 0 }; api.restore(JSON.stringify(save));
  }, { x: rock.x, z: rock.z, y: rockTop + .8, yaw: 0 });
  await page.waitForFunction(() => !__STAR_ABYSS_TEST__.snapshot().mobility.flight.airborne);
  const onRock = await snapshot(page);
  expect(onRock.lastContact.type).toBe('land'); expect(onRock.lastContact.surface).toBe('rock');
  expect(onRock.player.y).toBeGreaterThan(terrainHeight(rock.x, rock.z) + .5);
  // Sound toggle remains an intentional UI control, separate from gait state.
  await page.evaluate(point => __STAR_ABYSS_TEST__.place(point), patches.dust);
  await page.keyboard.press('Escape'); await page.locator('#sound-button').click();
  expect((await snapshot(page)).audio.suspended).toBeTruthy();
  await page.locator('#resume-button').click();
  expect((await snapshot(page)).audio.muted).toBeTruthy();
  await page.keyboard.down('KeyW'); const muted = await frames(page, 900, 1); await page.keyboard.up('KeyW');
  expect(muted.at(-1).gait.stepCount).toBeGreaterThan(0); expect(muted.at(-1).audio.contactCount).toBe(0);
  await frames(page, 500);
  await page.keyboard.press('Escape'); await page.locator('#sound-button').click();
  expect((await snapshot(page)).audio.suspended).toBeTruthy();
  await page.locator('#resume-button').click();
  const unmuted = await snapshot(page); const quiet = await frames(page, 2100);
  expect(quiet.at(-1).audio.contactCount).toBe(unmuted.audio.contactCount);
  expect(quiet.at(-1).audio.activeVoices).toBe(0);
  assertReachable(terrainStates);
});
