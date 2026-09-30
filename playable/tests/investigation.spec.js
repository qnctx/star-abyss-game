const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { routeWaypoints } = require('./walk-route.js');
const { tuneCalibration: tuneVisibleClues } = require('./calibration-controls.js');
const url = 'file:///' + path.resolve(__dirname, '..', 'star-abyss.html').replace(/\\/g, '/') + '?test=1';
test.use({ viewport: { width: 1440, height: 900 } });
test.beforeEach(async ({ page }) => { await page.goto(url); await page.locator('#start-button').click(); });
const snapshot = page => page.evaluate(() => __STAR_ABYSS_TEST__.snapshot());
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

async function fixture(page, { complete = false, mounted = false } = {}) {
  // Explicit old-save boundary fixture: the earlier two-chapter walking route
  // and finding/repairing this vehicle already have independent browser tests.
  const raw = JSON.parse(await page.evaluate(() => __STAR_ABYSS_TEST__.serialize()));
  for (const flag of Object.keys(raw.story.flags)) raw.story.flags[flag] = complete
    || !['echoCalibrated', 'capsuleCalibrated', 'riftClosed', 'complete'].includes(flag);
  raw.story.chapterVersion = 2;
  raw.mobility.vehicle = { ...raw.mobility.vehicle, repaired: true, partTaken: true, mounted, x: 72, z: 80, battery: 100 };
  delete raw.survey; // Actual pre-feature saves must gain the new route, not a free completion.
  await page.evaluate(saved => __STAR_ABYSS_TEST__.restore(saved), JSON.stringify(raw));
}

async function placeNear(page, x, z, offset = 2.8) {
  // Only boundary tests and the later two transit legs use explicit placement.
  await page.evaluate(({ x, z, offset }) => {
    __STAR_ABYSS_TEST__.place({ x, z: z + offset });
    __STAR_ABYSS_TEST__.face(x, z);
  }, { x, z, offset });
}

async function use(page, x, z) {
  await page.evaluate(({ x, z }) => __STAR_ABYSS_TEST__.face(x, z), { x, z });
  await page.keyboard.press('KeyF');
}

async function walk(page, x, z) {
  const state = await snapshot(page);
  const route = await routeWaypoints(state.player, { x, z }, state.story.flags.gateOpen, state.mobility);
  for (const point of route) expect(await page.evaluate(p => __STAR_ABYSS_TEST__.walkTo(p.x, p.z), point)).toBeLessThan(.2);
}

async function measure(page, x, z) {
  await use(page, x, z);
  await tuneVisibleClues(page);
  await page.locator('#calibration-confirm').click();
  await expect(page.locator('#calibration-screen')).toBeHidden();
}

class RouteHeap {
  constructor() { this.items = []; }
  push(value) {
    const a = this.items; a.push(value); let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p].score <= value.score) break; a[i] = a[p]; i = p; }
    a[i] = value;
  }
  pop() {
    const a = this.items, first = a[0], last = a.pop();
    if (a.length) {
      let i = 0;
      while (i * 2 + 1 < a.length) {
        let child = i * 2 + 1;
        if (child + 1 < a.length && a[child + 1].score < a[child].score) child++;
        if (a[child].score >= last.score) break;
        a[i] = a[child]; i = child;
      }
      a[i] = last;
    }
    return first;
  }
}

async function drivingRoute(from, to) {
  const { WORLD, WALLS, PROP_SOLIDS, ROCK_FIELD } = await import('../src/layout.mjs');
  const { touchesRock } = await import('../src/rocks.mjs');
  // The actual car radius is 1.1 m. This planner leaves another 1.1 m for
  // steering and braking; it reads geometry only and never moves the player.
  const radius = 2.2, boxes = [...WALLS, ...PROP_SOLIDS];
  const clear = p => Math.abs(p.x) < WORLD.halfSize - radius && Math.abs(p.z) < WORLD.halfSize - radius
    && !(Math.abs(p.x) < 50 + radius && p.z < -469 + radius && p.z > -793 - radius)
    && !boxes.some(b => Math.abs(p.x - b.x) < b.w / 2 + radius && Math.abs(p.z - b.z) < b.d / 2 + radius)
    && !ROCK_FIELD.query(p.x, p.z, radius).some(rock => rock.solid && touchesRock(rock, p.x, p.z, radius));
  const visible = (a, b) => {
    const count = Math.max(1, Math.ceil(distance(a, b) / .65));
    for (let i = 0; i <= count; i++) if (!clear({ x: a.x + (b.x - a.x) * i / count, z: a.z + (b.z - a.z) * i / count })) return false;
    return true;
  };
  if (!clear(from) || !clear(to)) throw new Error(`Vehicle route endpoint lacks clearance: ${JSON.stringify({ from, to })}`);
  let route = [from, to];
  if (!visible(from, to)) {
    const step = 8, key = p => `${p.x},${p.z}`;
    const anchor = point => {
      const center = { x: Math.round(point.x / step) * step, z: Math.round(point.z / step) * step }, candidates = [];
      for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) candidates.push({ x: center.x + i * step, z: center.z + j * step });
      candidates.sort((a, b) => distance(point, a) - distance(point, b));
      const result = candidates.find(p => visible(point, p));
      if (!result) throw new Error('No clear vehicle route anchor');
      return result;
    };
    const start = anchor(from), goal = anchor(to), open = new RouteHeap(), seen = new Map(), edges = new Map();
    const first = { ...start, g: 0, parent: null, score: distance(start, goal) }; open.push(first); seen.set(key(first), first);
    let found;
    while (open.items.length) {
      const current = open.pop(); if (seen.get(key(current)) !== current) continue;
      if (key(current) === key(goal)) { found = current; break; }
      for (const [dx, dz] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
        const next = { x: current.x + dx * step, z: current.z + dz * step };
        if (next.x < Math.min(from.x, to.x) - 100 || next.x > Math.max(from.x, to.x) + 100
          || next.z < Math.min(from.z, to.z) - 100 || next.z > Math.max(from.z, to.z) + 100) continue;
        const g = current.g + distance(current, next), previous = seen.get(key(next));
        if (previous && previous.g <= g) continue;
        const edge = [key(current), key(next)].sort().join('/');
        if (!edges.has(edge)) edges.set(edge, visible(current, next));
        if (!edges.get(edge)) continue;
        const entry = { ...next, g, parent: current, score: g + distance(next, goal) }; seen.set(key(entry), entry); open.push(entry);
      }
    }
    if (!found) throw new Error(`No physical driving route: ${JSON.stringify({ from, to })}`);
    const points = []; for (let p = found; p; p = p.parent) points.unshift({ x: p.x, z: p.z });
    route = [from, ...points, to];
    const simplified = [from];
    for (let i = 0; i < route.length - 1;) {
      let next = route.length - 1; while (next > i + 1 && !visible(route[i], route[next])) next--;
      simplified.push(route[next]); i = next;
    }
    route = simplified;
  }
  const chunks = [];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i], n = Math.max(1, Math.ceil(distance(a, b) / 100));
    for (let j = 1; j <= n; j++) chunks.push({ x: a.x + (b.x - a.x) * j / n, z: a.z + (b.z - a.z) * j / n });
  }
  return chunks;
}

async function drive(page, x, z) {
  const { planVehicleControls } = await import('./vehicle-route-planner.mjs');
  await page.evaluate(()=>__STAR_ABYSS_TEST__.advance(2,{lift:true}));
  const start = await snapshot(page), route = await drivingRoute(start.player, { x, z });
  expect(start.mobility.vehicle.mounted).toBeTruthy();
  let traveled = 0;
  for (const point of route) {
    const current=await snapshot(page);
    // Predict on clones; replay ONLY physical throttle/steering/brake controls.
    // Mouse yaw must never be used as vehicle steering after EXPLORATION-R2.
    const plan=planVehicleControls(current.player,current.mobility,point,{gateOpen:current.story.flags.gateOpen});
    const result = await page.evaluate(({target,segments}) => {
      const api=__STAR_ABYSS_TEST__;let state=api.snapshot(),length=0,blocked=false;
      for(const segment of segments)for(let i=0;i<segment.frames;i++){
        const previous=state.player;api.advance(1/60,segment.input);state=api.snapshot();
        length+=Math.hypot(state.player.x-previous.x,state.player.z-previous.z);blocked ||= state.blocked;
      }
      return {length,distance:Math.hypot(target.x-state.player.x,target.z-state.player.z),blocked,battery:state.mobility.vehicle.battery};
    }, {target:point,segments:plan.segments});
    traveled += result.length;
    expect(result.distance, `actual driving waypoint ${JSON.stringify(point)}: ${JSON.stringify(result)}`).toBeLessThan(.9);
    expect(result.battery).toBeGreaterThan(0);
    expect(result.blocked).toBeFalsy();
  }
  return traveled;
}

test('manual phase tuning pauses resources, rejects wrong phases, cancels cleanly and only confirms real second-chapter samples', async ({ page }) => {
  test.setTimeout(180000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await fixture(page);
  await placeNear(page, -420, -160);
  await use(page, -420, -160);
  await expect(page.locator('#calibration-screen')).toBeVisible();
  await expect(page.locator('#calibration-confirm')).toBeDisabled();
  const initial = await snapshot(page);
  await page.evaluate(() => __STAR_ABYSS_TEST__.advance(60, { forward: true, sprint: true, lift: true }));
  const frozen = await snapshot(page);
  for (const field of ['player', 'stamina', 'mobility', 'evolution', 'elapsed', 'survey']) expect(frozen[field]).toEqual(initial[field]);
  await tuneVisibleClues(page, 2);
  await expect(page.locator('#calibration-confirm')).toBeDisabled();
  expect((await snapshot(page)).story.flags.echoCalibrated).toBeFalsy();
  await page.locator('#calibration-cancel').click();
  await page.waitForFunction(() => document.pointerLockElement?.id === 'world');
  expect((await snapshot(page)).screen).toBe('playing');
  expect((await snapshot(page)).story.flags.echoCalibrated).toBeFalsy();
  const yaw = (await snapshot(page)).player.yaw;
  await page.mouse.move(250, 200); await page.mouse.move(300, 210);
  expect((await snapshot(page)).player.yaw).not.toBe(yaw);
  await use(page, -420, -160);
  await tuneVisibleClues(page);
  const unsubmitted = await page.evaluate(() => __STAR_ABYSS_TEST__.serialize());
  expect(JSON.parse(unsubmitted).calibration).toBeUndefined();
  await page.evaluate(raw => __STAR_ABYSS_TEST__.restore(raw), unsubmitted);
  expect((await snapshot(page)).story.flags.echoCalibrated).toBeFalsy();
  await expect(page.locator('#calibration-screen')).toBeHidden();
  await use(page, -420, -160);
  await expect(page.locator('#calibration-confirm')).toBeDisabled();
  await expect(page.locator('#calibration-channel-0')).toHaveValue('0');
  await tuneVisibleClues(page);
  // A ready UI is not authority to submit after leaving the actual terminal.
  await placeNear(page, -420, -160, 8);
  await page.locator('#calibration-confirm').click();
  await expect(page.locator('#calibration-screen')).toBeHidden();
  expect((await snapshot(page)).story.flags.echoCalibrated).toBeFalsy();
  await expect(page.locator('#toast')).toContainText('现场连接已中断');
  for (const lifecycle of ['blur', 'hidden']) {
    await placeNear(page, -420, -160); await use(page, -420, -160);
    await tuneVisibleClues(page, 2);
    // Synthetic browser lifecycle fixtures exercise the production listeners;
    // they never call a progression API or change investigation data.
    await page.evaluate(event => {
      if (event === 'blur') window.dispatchEvent(new Event('blur'));
      else {
        const descriptor = Object.getOwnPropertyDescriptor(document, 'hidden');
        try {
          Object.defineProperty(document, 'hidden', { configurable: true, value: true });
          document.dispatchEvent(new Event('visibilitychange'));
        } finally {
          if (descriptor) Object.defineProperty(document, 'hidden', descriptor);
          else delete document.hidden;
        }
      }
    }, lifecycle);
    await expect(page.locator('#pause-screen')).toBeVisible();
    await expect(page.locator('#calibration-screen')).toBeHidden();
    const paused = await snapshot(page);
    expect(paused.calibration).toBeNull(); expect(paused.story.flags.echoCalibrated).toBeFalsy();
    await page.evaluate(() => __STAR_ABYSS_TEST__.advance(30, { forward: true }));
    expect((await snapshot(page)).elapsed).toBe(paused.elapsed);
    await page.locator('#resume-button').click();
    await use(page, -420, -160);
    await expect(page.locator('#calibration-channel-0')).toHaveValue('0');
    await expect(page.locator('#calibration-confirm')).toBeDisabled();
    await page.locator('#calibration-cancel').click();
  }
  await use(page, -420, -160);
  await tuneVisibleClues(page);
  for (const width of [900, 768, 640]) {
    await page.setViewportSize({ width, height: 720 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBeFalsy();
    for (const selector of ['#calibration-cancel', '#calibration-confirm']) {
      const button = page.locator(selector); await button.scrollIntoViewIfNeeded();
      expect(await button.evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1 && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button') === el; })).toBeTruthy();
    }
  }
  await page.screenshot({ path: 'docs/ui-implementation/echo-calibration-narrow.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('#calibration-confirm').click();
  expect((await snapshot(page)).story.flags.echoCalibrated).toBeTruthy();
  await placeNear(page, 610, -450);
  await measure(page, 610, -450);
  expect((await snapshot(page)).story.flags.capsuleCalibrated).toBeTruthy();
  await placeNear(page, -300, -520);
  await use(page, -300, -520);
  await expect(page.locator('#calibration-mode')).toContainText('180°');
  await tuneVisibleClues(page);
  await page.screenshot({ path: 'docs/ui-implementation/echo-calibration-inverse.png' });
  await page.locator('#calibration-confirm').click();
  const isolated = await snapshot(page);
  expect(isolated.story.flags.riftClosed).toBeTruthy(); expect(isolated.story.flags.complete).toBeFalsy();
  expect(isolated.surveyStatus.available).toBeFalsy();
  await placeNear(page, 0, 196, -2.8);
  await use(page, 0, 196);
  expect((await snapshot(page)).story.flags.complete).toBeTruthy();
  expect((await snapshot(page)).surveyStatus.current.id).toBe('survey-west');
  expect(errors).toEqual([]);
});

test('a completed old save drives a real first expedition round trip, archives each of three samples at the beacon and preserves the independent ending', async ({ page }) => {
  test.setTimeout(300000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await fixture(page, { complete: true, mounted: true });
  let state = await snapshot(page);
  expect(state.survey).toEqual({ version: 1, archived: [], pending: null });
  expect(state.surveyStatus.current.id).toBe('survey-west');
  expect(state.knownPoints).not.toContain('survey-east'); expect(state.knownPoints).not.toContain('survey-north');
  const outbound = await drive(page, -1100, 662);
  expect(outbound).toBeGreaterThan(1250);
  expect((await snapshot(page)).mobility.vehicle.battery).toBeLessThan(88);
  await page.keyboard.press('KeyF');
  expect((await snapshot(page)).mobility.vehicle.mounted).toBeFalsy();
  await walk(page, -1100, 652.8);
  await measure(page, -1100, 650);
  state = await snapshot(page);
  expect(state.survey.pending).toBe('survey-west'); expect(state.survey.archived).toEqual([]);
  expect(state.surveyStatus.objective.target).toBe('beacon');
  expect(state.knownPoints).not.toContain('survey-east');
  // A submitted but not archived sample survives reload at the exact same
  // world position. No restore/place skips any part of this driving round trip.
  const pendingSave = await page.evaluate(() => __STAR_ABYSS_TEST__.serialize());
  const sampledPosition = state.player;
  await page.evaluate(raw => __STAR_ABYSS_TEST__.restore(raw), pendingSave);
  state = await snapshot(page);
  expect(state.survey.pending).toBe('survey-west'); expect(state.survey.archived).toEqual([]);
  expect(state.player.x).toBeCloseTo(sampledPosition.x, 4); expect(state.player.z).toBeCloseTo(sampledPosition.z, 4);
  await page.screenshot({ path: 'docs/ui-implementation/echo-survey-west-sampled.png' });
  const vehicle = state.mobility.vehicle;
  await walk(page, vehicle.x + 2.5, vehicle.z);
  await use(page, vehicle.x, vehicle.z);
  expect((await snapshot(page)).mobility.vehicle.mounted).toBeTruthy();
  const returning = await drive(page, 12, 188);
  expect(returning).toBeGreaterThan(1190);
  await page.keyboard.press('KeyF');
  expect((await snapshot(page)).mobility.vehicle.mounted).toBeFalsy();
  await walk(page, 0, 193.2);
  expect((await snapshot(page)).survey.archived).toEqual([]);
  await use(page, 0, 196);
  state = await snapshot(page);
  expect(state.survey.archived).toEqual(['survey-west']); expect(state.survey.pending).toBeNull();
  expect(state.surveyStatus.current.id).toBe('survey-east');
  expect(state.knownPoints).toContain('survey-east'); expect(state.knownPoints).not.toContain('survey-north');
  // Later transit legs are isolated spatial fixtures. Their actual field
  // controls, ordered sampling, beacon confirmation and ending are not mocked.
  for (const [id, x, z, archived] of [['survey-east', 1200, 650, 2], ['survey-north', 1250, -1100, 3]]) {
    await placeNear(page, x, z);
    await measure(page, x, z);
    state = await snapshot(page);
    expect(state.survey.pending).toBe(id); expect(state.survey.archived).toHaveLength(archived - 1);
    await placeNear(page, 0, 196, -2.8);
    await use(page, 0, 196);
    state = await snapshot(page);
    expect(state.survey.pending).toBeNull(); expect(state.survey.archived).toHaveLength(archived);
    if (archived < 3) expect(state.surveyStatus.current.id).toBe('survey-north');
  }
  expect(state.surveyStatus.complete).toBeTruthy(); expect(state.story.flags.complete).toBeTruthy();
  expect(state.surveyStatus.records.some(entry => entry.title === '远野终记 · 留下问号')).toBeTruthy();
  const completed = await page.evaluate(() => __STAR_ABYSS_TEST__.serialize());
  await page.evaluate(raw => __STAR_ABYSS_TEST__.restore(raw), completed);
  expect((await snapshot(page)).surveyStatus.complete).toBeTruthy();
  expect((await snapshot(page)).survey.archived).toEqual(['survey-west', 'survey-east', 'survey-north']);
  await page.keyboard.press('Tab'); await page.keyboard.press('KeyJ');
  await expect(page.locator('#journal-entries')).toContainText('远野终记 · 留下问号');
  await page.getByRole('heading', { name: '远野终记 · 留下问号', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'docs/ui-implementation/echo-survey-ending.png' });
  expect(errors).toEqual([]);
});

test('unverified far sites cannot reveal or collect later samples, and a pending sample cannot be remotely archived', async ({ page }) => {
  test.setTimeout(90000);
  // Position fixtures deliberately touch locked sites; no story flags or
  // survey records are granted by proximity, E presses or cancelled tuning.
  await placeNear(page, -1100, 650);
  await use(page, -1100, 650);
  await expect(page.locator('#calibration-screen')).toBeHidden();
  expect((await snapshot(page)).survey.pending).toBeNull();
  await fixture(page, { complete: true });
  for (const [id, x, z] of [['survey-east', 1200, 650], ['survey-north', 1250, -1100]]) {
    await placeNear(page, x, z); await use(page, x, z);
    const state = await snapshot(page);
    expect(state.survey.pending).toBeNull(); expect(state.survey.archived).toEqual([]);
    expect(state.knownPoints).not.toContain(id);
    await expect(page.locator('#calibration-screen')).toBeHidden();
  }
  await placeNear(page, -1100, 650); await use(page, -1100, 650);
  await tuneVisibleClues(page);
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => document.pointerLockElement?.id === 'world');
  expect((await snapshot(page)).survey.pending).toBeNull();
  await measure(page, -1100, 650);
  const pending = (await snapshot(page)).survey;
  await use(page, -1100, 650);
  await expect(page.locator('#calibration-screen')).toBeHidden();
  expect((await snapshot(page)).survey).toEqual(pending);
  await placeNear(page, 1200, 650); await use(page, 1200, 650);
  expect((await snapshot(page)).survey).toEqual(pending);
  await placeNear(page, 0, 196, -12);
  await use(page, 0, 196);
  expect((await snapshot(page)).survey).toEqual(pending);
  await placeNear(page, 0, 196, -2.8); await use(page, 0, 196);
  expect((await snapshot(page)).survey.archived).toEqual(['survey-west']);
  await use(page, 0, 196);
  expect((await snapshot(page)).survey.archived).toEqual(['survey-west']);
});
