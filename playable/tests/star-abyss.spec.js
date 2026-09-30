const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { routeWaypoints } = require('./walk-route.js');
const { tuneCalibration } = require('./calibration-controls.js');
const url = 'file:///' + path.resolve(__dirname, '..', 'star-abyss.html').replace(/\\/g, '/') + '?test=1';
test.use({viewport:{width:1440,height:900}});
test.beforeEach(async({page})=>{await page.goto(url);await page.locator('#start-button').click();});
const snapshot = page => page.evaluate(()=>__STAR_ABYSS_TEST__.snapshot());
async function walk(page,x,z){const distance=await page.evaluate(([x,z])=>__STAR_ABYSS_TEST__.walkTo(x,z),[x,z]);expect(distance).toBeLessThan(.2);}
async function use(page,x,z){
  await page.evaluate(([x,z])=>__STAR_ABYSS_TEST__.face(x,z),[x,z]);await page.keyboard.press('KeyF');
  if ((await snapshot(page)).screen === 'calibration') { await tuneCalibration(page); await page.locator('#calibration-confirm').click(); }
}
async function walkOutside(page,x,z){
  const state=await snapshot(page);
  const route=await routeWaypoints(state.player,{x,z},state.story.flags.gateOpen);
  for(const point of route)await walk(page,point.x,point.z);
}
test('file:// starts real WebGL scene; physical WASD and fixed eye height',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.keyboard.down('KeyW');await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().player.z<188);await page.keyboard.up('KeyW');
  let s=await snapshot(page);expect(s.player.z).toBeLessThan(188);expect(s.camera[1]).toBeCloseTo(1.72,4);
  await page.keyboard.down('KeyD');await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().player.x>1.5);await page.keyboard.up('KeyD');
  s=await snapshot(page);expect(s.player.x).toBeGreaterThan(1.5);expect(s.camera[0]).toBeCloseTo(s.player.x,0);
  expect(s.triangles).toBeGreaterThan(10000);expect(errors).toEqual([]);
});
test('continuous world walk into wreck and solve mystery through real nearby E interactions',async({page})=>{
  test.setTimeout(240000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await walk(page,12,-328);await use(page,12,-330);expect((await snapshot(page)).story.flags.signal).toBeTruthy();
  await walk(page,0,-465);await walk(page,0,-530);expect((await snapshot(page)).story.flags.entered).toBeTruthy();
  await walk(page,-27,-542);await use(page,-29,-544);expect((await snapshot(page)).story.flags.fuse).toBeTruthy();
  await walk(page,0,-544);await walk(page,-3,-578);await use(page,-5,-579);expect((await snapshot(page)).story.flags.power).toBeTruthy();
  await walk(page,0,-630);await walk(page,24,-634);await use(page,26,-635);expect((await snapshot(page)).story.flags.log).toBeTruthy();
  await walk(page,26,-644.5);await use(page,26,-647);
  await walk(page,15,-644.5);await use(page,15,-647);
  await walk(page,37,-644.5);await use(page,37,-647);expect((await snapshot(page)).story.flags.gateOpen).toBeTruthy();
  await walk(page,0,-635);await walk(page,0,-764);await use(page,0,-766);expect((await snapshot(page)).story.flags.blackbox).toBeTruthy();
  await page.screenshot({path:'docs/ui-implementation/echo-core.png'});
  const saved=await page.evaluate(()=>__STAR_ABYSS_TEST__.serialize());
  await page.evaluate(raw=>__STAR_ABYSS_TEST__.restore(raw),saved);expect((await snapshot(page)).story.flags.blackbox).toBeTruthy();
  await walk(page,0,-465);await walk(page,0,194);await use(page,0,196);
  let state=await snapshot(page);expect(state.story.flags.returned).toBeTruthy();expect(state.story.flags.complete).toBeFalsy();
  expect(state.screen).toBe('playing');expect(state.knownPoints).toContain('echo');expect(state.knownPoints).toContain('capsule');expect(state.knownPoints).not.toContain('rift');
  await walkOutside(page,-420,-157.5);await use(page,-420,-160);
  state=await snapshot(page);expect(state.story.flags.echoCalibrated).toBeTruthy();expect(state.knownPoints).not.toContain('rift');
  await walkOutside(page,610,-447.2);await use(page,610,-450);
  state=await snapshot(page);expect(state.story.flags.capsuleCalibrated).toBeTruthy();expect(state.knownPoints).toContain('rift');
  await walkOutside(page,-300,-517.2);await use(page,-300,-520);
  state=await snapshot(page);expect(state.story.flags.riftClosed).toBeTruthy();expect(state.story.flags.complete).toBeFalsy();
  await page.screenshot({path:'docs/ui-implementation/echo-rift.png'});
  await walkOutside(page,0,194);await use(page,0,196);expect((await snapshot(page)).story.flags.complete).toBeTruthy();
  expect((await snapshot(page)).screen).toBe('complete');
  await page.locator('#complete-journal-button').click();await page.keyboard.press('Tab');
  expect((await snapshot(page)).screen).toBe('complete');expect(errors).toEqual([]);
});
test('legacy completed save resumes at the first return and accepts a real new field calibration',async({page})=>{
  test.setTimeout(90000);
  // Only this migration test manufactures an old save. The continuous mainline
  // above earns every flag by moving and interacting with physical objects.
  const legacy=JSON.parse(await page.evaluate(()=>__STAR_ABYSS_TEST__.serialize()));
  legacy.story={flags:{signal:true,entered:true,fuse:true,power:true,log:true,gateOpen:true,blackbox:true,complete:true},sequence:[2,1,3],logs:['echo','capsule','complete']};
  await page.evaluate(raw=>__STAR_ABYSS_TEST__.restore(raw),JSON.stringify(legacy));
  let state=await snapshot(page);
  expect(state.story.chapterVersion).toBe(2);expect(state.story.flags.returned).toBeTruthy();expect(state.story.flags.complete).toBeFalsy();
  expect(state.story.flags.echoCalibrated).toBeFalsy();expect(state.story.flags.capsuleCalibrated).toBeFalsy();expect(state.screen).toBe('playing');
  expect(state.knownPoints).not.toContain('rift');
  await walkOutside(page,-420,-157.5);await use(page,-420,-160);
  state=await snapshot(page);expect(state.story.flags.echoCalibrated).toBeTruthy();expect(state.story.flags.complete).toBeFalsy();
  const migrated=await page.evaluate(()=>__STAR_ABYSS_TEST__.serialize());
  await page.evaluate(raw=>__STAR_ABYSS_TEST__.restore(raw),migrated);
  state=await snapshot(page);expect(state.story.flags.echoCalibrated).toBeTruthy();expect(state.story.flags.capsuleCalibrated).toBeFalsy();
});
test('journal and pause freeze held keys; release requires fresh input',async({page})=>{
  await page.keyboard.down('KeyW');await page.waitForTimeout(100);await page.keyboard.press('Tab');
  const before=await snapshot(page);expect(before.screen).toBe('journal');await page.waitForTimeout(200);expect((await snapshot(page)).player.z).toBe(before.player.z);
  await page.keyboard.press('Tab');await page.waitForTimeout(200);expect((await snapshot(page)).player.z).toBe(before.player.z);await page.keyboard.up('KeyW');
  await page.keyboard.press('Escape');expect((await snapshot(page)).screen).toBe('pause');
});
test('scanner cooldown and flashlight controls; HUD and journal fit narrow desktop',async({page})=>{
  await page.setViewportSize({width:900,height:812});
  // Inspect the activation instant, not an arbitrary <1 s browser round trip.
  // Rendering/trace overhead may legitimately advance cooldown before a read.
  await page.evaluate(()=>__STAR_ABYSS_TEST__.freezeFrame());
  await page.keyboard.press('KeyX');expect((await snapshot(page)).scannerCooldown).toBe(8);
  await page.evaluate(()=>__STAR_ABYSS_TEST__.freezeFrame(false));
  await page.screenshot({path:'docs/ui-implementation/echo-surface.png'});
  await page.keyboard.press('Tab');
  const clipped=await page.locator('button:visible').evaluateAll(elements=>elements.filter(el=>{const r=el.getBoundingClientRect();return r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1;}).map(el=>el.textContent));expect(clipped).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBeFalsy();
  await page.screenshot({path:'docs/ui-implementation/echo-journal.png'});
});
test('normal offline save reloads position; new investigation requires confirmation',async({page})=>{
  test.setTimeout(60000);
  await page.goto(url.replace('?test=1',''));await page.locator('#start-button').click();
  await page.keyboard.down('KeyW');
  await page.waitForFunction(()=>document.querySelector('#coordinates').textContent.includes('Z 18'));
  await page.keyboard.up('KeyW');await page.keyboard.press('Escape');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('star-abyss-silent-echo-v1')));
  expect(saved.player.z).toBeLessThan(190);
  await page.reload();await page.locator('#continue-button').click();
  await page.keyboard.press('Escape');
  const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('star-abyss-silent-echo-v1')));
  expect(restored.player.z).toBeCloseTo(saved.player.z,2);
  await page.reload();await page.locator('#start-button').click();await expect(page.locator('#new-confirm')).toBeVisible();
  await page.locator('#cancel-new-button').click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('star-abyss-silent-echo-v1')).player.z)).toBeCloseTo(saved.player.z,2);
});
test('mouse look changes real camera heading; Escape releases capture and pauses',async({page})=>{
  await page.locator('#world').click({position:{x:720,y:450}});
  const before=await snapshot(page);
  await page.mouse.move(800,475,{steps:3});
  await page.waitForFunction(yaw=>Math.abs(__STAR_ABYSS_TEST__.snapshot().player.yaw-yaw)>.01,before.player.yaw);
  const turned=await snapshot(page);expect(turned.player.pitch).not.toBe(before.player.pitch);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>__STAR_ABYSS_TEST__.snapshot().screen==='pause');
  expect(await page.evaluate(()=>document.pointerLockElement)).toBeNull();
});
test('Tab journal closes back into captured mouse look without any extra click',async({page})=>{
  test.setTimeout(60000);
  await page.waitForFunction(()=>document.pointerLockElement?.id==='world');
  await page.keyboard.press('Tab');
  await expect(page.locator('#journal-screen')).toBeVisible();
  await page.waitForFunction(()=>document.pointerLockElement===null);
  await page.keyboard.press('Tab');
  await page.waitForFunction(()=>document.pointerLockElement?.id==='world');
  expect((await snapshot(page)).screen).toBe('playing');
  const before=await snapshot(page);
  await page.mouse.move(760,460,{steps:2});
  await page.waitForFunction(yaw=>Math.abs(__STAR_ABYSS_TEST__.snapshot().player.yaw-yaw)>.01,before.player.yaw);
  await page.keyboard.press('Tab');
  await page.locator('#close-journal-button').click();
  await page.waitForFunction(()=>document.pointerLockElement?.id==='world');
  expect((await snapshot(page)).screen).toBe('playing');
  await page.keyboard.press('Tab');await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.pointerLockElement?.id==='world');
  expect((await snapshot(page)).screen).toBe('playing');
});
test('held Tab opens once and rapid journal toggles do not cause a stray pause',async({page})=>{
  test.setTimeout(60000);
  await page.keyboard.down('Tab');
  await page.keyboard.down('Tab'); // Playwright produces a repeated keydown.
  expect((await snapshot(page)).screen).toBe('journal');
  await page.keyboard.up('Tab');
  await page.keyboard.press('Tab');
  for(let i=0;i<3;i++){await page.keyboard.press('Tab');await page.keyboard.press('Tab');}
  await expect.poll(async()=>{const s=await snapshot(page);return {screen:s.screen,captureStatus:s.captureStatus,locked:s.locked};},{timeout:5000}).toEqual({screen:'playing',captureStatus:'locked',locked:true});
  expect((await snapshot(page)).screen).toBe('playing');
});
test('journal remembers pause origin; resume button immediately restores mouse look',async({page})=>{
  test.setTimeout(60000);
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-screen')).toBeVisible();
  await page.locator('#pause-journal-button').click();
  await expect(page.locator('#close-journal-button')).toContainText('返回暂停');
  await page.keyboard.press('Tab');
  expect((await snapshot(page)).screen).toBe('pause');
  expect(await page.evaluate(()=>document.pointerLockElement)).toBeNull();
  await page.locator('#resume-button').click();
  await page.waitForFunction(()=>document.pointerLockElement?.id==='world');
  const before=await snapshot(page);await page.mouse.move(800,460,{steps:2});
  await page.waitForFunction(yaw=>Math.abs(__STAR_ABYSS_TEST__.snapshot().player.yaw-yaw)>.01,before.player.yaw);
});
test('sprint drains to zero, never recharges while held, and needs recovery plus a fresh press',async({page})=>{
  test.setTimeout(60000);
  await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');
  await page.evaluate(()=>__STAR_ABYSS_TEST__.advance(30.2,{forward:true,sprint:true}));
  const drained=await snapshot(page);expect(drained.stamina.value).toBe(0);expect(drained.stamina.armed).toBeFalsy();
  await expect(page.locator('#stamina-status')).toContainText('松开 Shift');
  const held=await page.evaluate(()=>{__STAR_ABYSS_TEST__.advance(20,{forward:true,sprint:true});return __STAR_ABYSS_TEST__.snapshot();});
  expect(held.stamina.value).toBe(0);expect(held.stamina.sprinting).toBeFalsy();
  expect(Math.abs(held.player.vz)).toBeCloseTo(4.7,1);
  const saved=JSON.parse(await page.evaluate(()=>__STAR_ABYSS_TEST__.serialize()));
  expect(saved.stamina).toEqual({value:0,recoveryRemaining:1.5});expect(saved).not.toHaveProperty('charge');
  await page.keyboard.press('Tab');
  await page.evaluate(()=>__STAR_ABYSS_TEST__.advance(30,{}));expect((await snapshot(page)).stamina.value).toBe(0);
  await page.keyboard.up('ShiftLeft');await page.keyboard.up('KeyW');await page.keyboard.press('Tab');
  const recovery=await page.evaluate(()=>{
    const api=__STAR_ABYSS_TEST__, delay=api.snapshot().stamina.recoveryRemaining;
    api.advance(Math.max(0,delay-.1),{});const waiting=api.snapshot().stamina.value;
    api.advance(.6,{});const regained=api.snapshot().stamina.value;
    api.advance(.1,{forward:true,sprint:true});const early=api.snapshot().stamina;
    api.advance(8,{forward:true,sprint:true});const stuck=api.snapshot().stamina;
    api.advance(4,{forward:true});const ready=api.snapshot().stamina;
    api.advance(.2,{forward:true,sprint:true});const restarted=api.snapshot().stamina;
    return {waiting,regained,early,stuck,ready,restarted};
  });
  expect(recovery.waiting).toBe(0);expect(recovery.regained).toBeCloseTo(7,1);
  expect(recovery.early.armed).toBeFalsy();expect(recovery.stuck.value).toBeCloseTo(recovery.regained,1);
  expect(recovery.ready.value).toBeGreaterThanOrEqual(25);expect(recovery.restarted.sprinting).toBeTruthy();
  expect(recovery.restarted.value).toBeLessThan(recovery.ready.value);
  await page.setViewportSize({width:900,height:812});
  const overflow=await page.locator('.suit-status').evaluate(el=>{const r=el.getBoundingClientRect();return el.scrollWidth>el.clientWidth||r.left<0||r.bottom>innerHeight;});expect(overflow).toBeFalsy();
  await page.screenshot({path:'docs/ui-implementation/echo-stamina.png'});
});
