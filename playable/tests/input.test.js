const { test, before } = require('node:test');
const assert = require('node:assert/strict');

let createInput,flightControls,routeInnateTakeoff;
before(async () => { ({ createInput } = await import('../src/input.mjs'));({flightControls}=await import('../src/planet-gameplay/index.mjs'));({routeInnateTakeoff}=await import('../src/innate-takeoff.mjs')); });

test('Space is held jump input, clears on pause, and preserves modified shortcuts', () => {
  const h = harness();
  h.input.setEnabled(true);
  assert.equal(h.key('Space').defaultPrevented, true);
  assert.equal(h.input.snapshot().jump, true);
  h.key('Space', { repeat: true });
  assert.equal(h.input.snapshot().jump, true);
  h.up('Space'); assert.equal(h.input.snapshot().jump, false);
  h.key('Space', { ctrlKey: true }); assert.equal(h.input.snapshot().jump, false);
  h.key('Space'); h.input.setEnabled(false); assert.equal(h.input.snapshot().jump, false);
  h.input.setEnabled(true); assert.equal(h.input.snapshot().jump, false);
  assert.deepEqual(h.calls.actions, []);
  h.input.dispose();
});

class Target {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
  emit(type, properties = {}) {
    const event = {
      target: this, repeat: false, buttons: 0, movementX: 0, movementY: 0,
      defaultPrevented: false, preventDefault() { this.defaultPrevented = true; },
      ...properties,
    };
    for (const handler of [...(this.listeners.get(type) || [])]) handler(event);
    return event;
  }
}

test('unlocked drag uses client coordinates when embedded browser omits relative mouse deltas',()=>{
 const h=harness({unavailable:true});h.input.setEnabled(true);h.canvas.emit('mousedown',{button:0,buttons:1,clientX:100,clientY:100});
 h.mouse(0,0,{buttons:1,clientX:140,clientY:80});assert.deepEqual(h.calls.look,[[40,-20]]);
 h.doc.emit('mouseup');h.mouse(0,0,{buttons:0,clientX:200,clientY:200});assert.equal(h.calls.look.length,1);h.input.dispose();
});
test('Ctrl slow-walk permits Z posture and Q/E actions only during gameplay',()=>{
 const h=harness();h.input.setEnabled(true);h.key('ControlLeft',{ctrlKey:true});h.key('KeyZ',{ctrlKey:true});h.key('KeyQ',{ctrlKey:true});h.key('KeyE',{ctrlKey:true});assert.deepEqual(h.calls.actions,['prone','scan','dash']);
 h.input.setEnabled(false);h.key('KeyZ',{ctrlKey:true});assert.equal(h.calls.actions.length,3);h.input.dispose();
});
test('desktop mapping separates jump, thruster, scanner, dash, interaction and automatic movement',()=>{
 const h=harness();h.input.setEnabled(true);
 h.key('KeyQ');h.key('KeyE');assert.equal(h.input.snapshot().leanLeft,false);assert.equal(h.input.snapshot().leanRight,false);assert.deepEqual(h.calls.actions,['scan','dash']);h.calls.actions.length=0;
 h.key('KeyG');assert.equal(h.input.snapshot().lift,true);h.up('KeyG');
 h.key('Space');assert.equal(h.input.snapshot().jump,true);assert.equal(h.input.snapshot().lift,false);assert.equal(h.input.snapshot({mounted:true}).lift,true);h.up('Space');
 h.key('ControlLeft',{ctrlKey:true});h.key('KeyW',{ctrlKey:true});assert.ok(h.input.snapshot().walk&&h.input.snapshot().forward);h.up('ControlLeft');h.up('KeyW');
 h.key('Equal');assert.ok(h.input.snapshot().autoRun&&h.input.snapshot().forward);h.key('KeyS');assert.equal(h.input.snapshot().autoRun,false);h.up('KeyS');
 for(const key of ['KeyF','KeyL','KeyX','KeyB','KeyZ','KeyM'])h.key(key);
 assert.deepEqual(h.calls.actions,['interact','light','scan','dash','prone','journal']);
 h.key('Equal');h.win.emit('blur');assert.equal(h.input.snapshot().autoRun,false);assert.equal(h.input.snapshot().leanLeft,false);h.input.dispose();
});
test('only G enters unlocked innate flight while Space remains jump or vehicle brake',()=>{
 const h=harness();h.input.setEnabled(true);
 h.key('Space');const foot=h.input.snapshot();
 assert.equal(foot.jump,true);assert.equal(foot.lift,false);
 const unlocked=routeInnateTakeoff(foot,{unlocked:true});
 assert.equal(unlocked.redirected,false);assert.equal(unlocked.planet.lift,false);
 assert.equal(unlocked.legacy.jump,true);
 const lowRealm=routeInnateTakeoff(foot,{unlocked:false});
 assert.equal(lowRealm.legacy.jump,true);assert.equal(lowRealm.planet.lift,false);
 const forbidden=routeInnateTakeoff({...foot,jump:false,lift:false},{unlocked:true});
 assert.equal(forbidden.redirected,false);assert.equal(forbidden.planet.lift,false);
 h.up('Space');h.key('KeyG');
 const g=routeInnateTakeoff(h.input.snapshot(),{unlocked:true});
 assert.equal(g.redirected,true);assert.equal(g.planet.lift,true);assert.equal(g.legacy.lift,false);
 h.up('KeyG');h.key('Space');
 const vehicle=routeInnateTakeoff(h.input.snapshot({mounted:true}),{unlocked:true,mounted:true});
 assert.equal(vehicle.redirected,false);assert.equal(vehicle.planet.lift,true);assert.equal(vehicle.legacy.lift,true);
 h.input.dispose();
});

function harness({ legacy = false, unavailable = false, groundMelee=false } = {}) {
  const doc = new Target(), win = new Target(), canvas = new Target();
  const flight={active:false};
  let now = 1000;
  doc.defaultView = win; doc.hidden = false; doc.pointerLockElement = null;
  win.performance = { now: () => now };
  canvas.ownerDocument = doc;
  const calls = { requests: 0, releases: 0, focus: 0, blur: 0, changed: 0, actions: [], look: [],freeLook:[],guards:[] };
  const attempts = [];
  canvas.focus = () => { calls.focus++; doc.activeElement = canvas; };
  if (!unavailable) canvas.requestPointerLock = () => {
    calls.requests++;
    if (legacy) { attempts.push({}); return undefined; }
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    attempts.push({ resolve, reject });
    return promise;
  };
  // Real pointer-lock transitions arrive asynchronously. Tests decide when each
  // event lands so modal open/close races cannot hide behind a synchronous mock.
  doc.exitPointerLock = () => { calls.releases++; };
  const input = createInput(canvas, {
    isFlying:()=>flight.active,
    ...(groundMelee?{canMelee:()=>true}:{}),
    guard:held=>calls.guards.push(held),
    action: name => calls.actions.push(name),
    look: (x, y) => calls.look.push([x, y]),
    freeLook:active=>calls.freeLook.push(active),
    blur: () => { calls.blur++; },
    captureChanged: () => { calls.changed++; },
  });
  const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
  return {
    input, calls, doc, win, canvas, attempts, flush, flight,
    tick: milliseconds => { now += milliseconds; },
    key: (code, properties = {}) => doc.emit('keydown', { target: canvas, code, ...properties }),
    up: code => doc.emit('keyup', { target: canvas, code }),
    mouse: (x, y, properties = {}) => doc.emit('mousemove', { target: canvas, movementX: x, movementY: y, ...properties }),
    async lock(index = attempts.length - 1) {
      doc.pointerLockElement = canvas;
      doc.emit('pointerlockchange');
      attempts[index]?.resolve?.();
      await flush();
    },
    unlock() { doc.pointerLockElement = null; doc.emit('pointerlockchange'); },
    async reject(index = attempts.length - 1) {
      attempts[index]?.reject?.(new Error('Pointer lock rejected by browser policy'));
      if (legacy) doc.emit('pointerlockerror');
      await flush();
    },
  };
}

for (const legacy of [false, true]) {
  const model = legacy ? 'legacy events' : 'Promise API';
  test(`explicit gameplay capture locks and enables mouse look (${model})`, async () => {
    const h = harness({ legacy });
    h.input.setEnabled(true);
    assert.equal(h.calls.requests, 0, 'enable alone is not authority to recapture');
    h.input.setEnabled(true, { capture: true });
    assert.equal(h.calls.requests, 1);
    assert.equal(h.input.captureStatus, 'pending');
    await h.lock();
    assert.equal(h.input.locked, true);
    assert.equal(h.input.captureStatus, 'locked');
    h.mouse(12, -3);
    assert.deepEqual(h.calls.look, [[12, -3]]);
    h.input.dispose();
  });

  test(`return after programmatic unlock captures without another click (${model})`, async () => {
    const h = harness({ legacy });
    h.input.setEnabled(true, { capture: true }); await h.lock();
    h.input.setEnabled(false);
    assert.equal(h.calls.releases, 1);
    h.unlock();
    assert.equal(h.calls.blur, 0, 'opening a panel is not an external loss of capture');
    h.input.setEnabled(true, { capture: true });
    assert.equal(h.calls.requests, 2);
    await h.lock(); h.mouse(8, 2);
    assert.deepEqual(h.calls.look, [[8, 2]]);
    assert.equal(h.calls.blur, 0);
    h.input.dispose();
  });

  test(`rapid return waits for pending unlock without false pause (${model})`, async () => {
    const h = harness({ legacy });
    h.input.setEnabled(true, { capture: true }); await h.lock();
    h.input.setEnabled(false);
    h.input.setEnabled(true, { capture: true });
    assert.equal(h.calls.requests, 1, 'do not race a lock request against its pending release');
    assert.equal(h.input.captureStatus, 'pending');
    h.unlock();
    assert.equal(h.calls.requests, 2);
    assert.equal(h.calls.blur, 0);
    await h.lock();
    assert.equal(h.input.captureStatus, 'locked');
    h.input.dispose();
  });

  test(`capture arriving after panel opens is released (${model})`, async () => {
    const h = harness({ legacy });
    h.input.setEnabled(true, { capture: true });
    h.input.setEnabled(false);
    await h.lock();
    assert.equal(h.calls.releases, 1, 'a late successful request must not hide the panel cursor');
    h.mouse(10, 10);
    assert.deepEqual(h.calls.look, []);
    h.unlock();
    assert.equal(h.input.captureStatus, 'free');
    assert.equal(h.calls.blur, 0);
    h.input.dispose();
  });

  test(`request rejection is handled and retried only by a fresh gameplay key (${model})`, async () => {
    const h = harness({ legacy });
    h.input.setEnabled(true, { capture: true }); await h.reject();
    assert.equal(h.input.captureStatus, 'blocked');
    h.key('KeyW', { repeat: true });
    h.win.emit('focus');
    assert.equal(h.calls.requests, 1);
    h.key('KeyW');
    assert.equal(h.calls.requests, 2);
    assert.equal(h.input.snapshot().forward, true);
    await h.lock();
    assert.equal(h.input.captureStatus, 'locked');
    h.input.dispose();
  });
}

test('external unlock pauses once and never recaptures from focus or held keys', async () => {
  const h = harness();
  h.input.setEnabled(true, { capture: true }); await h.lock();
  h.key('KeyW');
  h.unlock();
  assert.equal(h.calls.blur, 1);
  assert.equal(h.input.snapshot().forward, false);
  h.key('Escape');
  assert.deepEqual(h.calls.actions, [], 'the Escape causing browser unlock must not also resume');
  h.win.emit('focus'); h.key('KeyW');
  assert.equal(h.calls.requests, 1);
  h.tick(300); h.key('Escape');
  assert.deepEqual(h.calls.actions, ['pause']);
  h.input.dispose();
});

for (const settleBeforeEvents of [true, false]) {
  test(`queued lock events observing only null do not strand the old capture request (${settleBeforeEvents ? 'Promise first' : 'events first'})`, async () => {
    const h = harness();
    h.input.setEnabled(true, { capture: true });
    // Browser grants capture, but its lockchange event is still in the task
    // queue when a rapid Tab opens the journal and immediately releases it.
    h.doc.pointerLockElement = h.canvas;
    h.input.setEnabled(false);
    assert.equal(h.calls.releases, 1);
    h.doc.pointerLockElement = null;
    h.input.setEnabled(true, { capture: true });
    assert.equal(h.calls.requests, 1);
    if (settleBeforeEvents) { h.attempts[0].resolve(); await h.flush(); }
    // Both the queued grant event and queued release event inspect current
    // pointerLockElement, not the value that existed when they were queued.
    h.doc.emit('pointerlockchange');
    h.doc.emit('pointerlockchange');
    if (!settleBeforeEvents) { h.attempts[0].resolve(); await h.flush(); }
    assert.equal(h.calls.requests, 2, 'completed old request must not suppress return-to-game capture');
    assert.equal(h.calls.blur, 0, 'the programmatic release must not become an external-unlock pause');
    await h.lock(1);
    assert.equal(h.input.locked, true);
    assert.equal(h.input.captureStatus, 'locked');
    h.mouse(14, 2);
    assert.deepEqual(h.calls.look, [[14, 2]]);
    h.input.dispose();
  });
}

test('panel transitions clear movement and one-shot actions ignore key repeat', () => {
  const h = harness();
  h.input.setEnabled(true);
  h.key('KeyW'); h.key('KeyD'); h.key('ShiftLeft');
  assert.deepEqual(h.input.snapshot(), { forward: true, backward: false, left: false, right: true, turnLeft:false, turnRight:false, sprint: true, lift: false, jump:false,walk:false,descend:false,leanLeft:false,leanRight:false,autoRun:false });
  h.key('KeyF'); h.key('KeyF', { repeat: true });
  h.key('Tab'); h.key('Tab', { repeat: true });
  assert.deepEqual(h.calls.actions, ['interact', 'journal']);
  h.input.setEnabled(false);
  h.input.setEnabled(true);
  h.key('KeyW', { repeat: true });
  assert.deepEqual(h.input.snapshot(), { forward: false, backward: false, left: false, right: false, turnLeft:false, turnRight:false, sprint: false, lift: false, jump:false,walk:false,descend:false,leanLeft:false,leanRight:false,autoRun:false });
  h.up('KeyW'); h.key('KeyW');
  assert.equal(h.input.snapshot().forward, true);
  h.win.emit('blur');
  assert.equal(h.input.snapshot().forward, false);
  assert.equal(h.calls.blur, 1);
  h.input.dispose();
});

test('camera switch is a single gameplay action, never repeats or fires through menus', () => {
  const h = harness();
  h.key('KeyV');
  assert.deepEqual(h.calls.actions, []);
  h.input.setEnabled(true);
  h.key('KeyV'); h.key('KeyV', { repeat: true });
  assert.deepEqual(h.calls.actions, ['camera']);
  h.input.setEnabled(false); h.up('KeyV'); h.key('KeyV');
  assert.deepEqual(h.calls.actions, ['camera']);
  h.input.setEnabled(true); h.key('KeyV', { ctrlKey: true });
  assert.deepEqual(h.calls.actions, ['camera']);
  h.input.dispose();
});

test('blink is one-shot, keeps held Shift mode and never fires through disabled controls or Ctrl+Y',()=>{
  const h=harness();h.key('KeyY');assert.deepEqual(h.calls.actions,[]);
  h.input.setEnabled(true);h.key('ShiftLeft');h.key('KeyY',{shiftKey:true});h.key('KeyY',{repeat:true,shiftKey:true});
  assert.deepEqual(h.calls.actions,['blink']);assert.equal(h.input.snapshot().sprint,true);
  h.input.setEnabled(false);h.key('KeyY');assert.deepEqual(h.calls.actions,['blink']);
  h.input.setEnabled(true);h.key('KeyY',{ctrlKey:true});assert.deepEqual(h.calls.actions,['blink']);h.input.dispose();
});

test('air melee is one-shot and held guard releases on keyup, blur and modal entry without stealing shortcuts',()=>{
  const h=harness();h.input.setEnabled(true);h.key('KeyN');h.key('KeyO');assert.deepEqual(h.calls.actions,[]);assert.deepEqual(h.calls.guards,[]);
  h.flight.active=true;h.key('KeyN');h.key('KeyN',{repeat:true});assert.deepEqual(h.calls.actions,['air-melee']);
  h.key('KeyO');h.key('KeyO',{repeat:true});h.up('KeyO');assert.deepEqual(h.calls.guards,[true,false]);
  h.key('KeyO');h.input.setEnabled(false);assert.deepEqual(h.calls.guards,[true,false,true,false]);
  h.key('KeyN');h.key('KeyO');assert.equal(h.calls.actions.length,1);assert.equal(h.calls.guards.length,4);
  h.input.setEnabled(true);h.key('KeyO',{ctrlKey:true});assert.equal(h.calls.guards.length,4);
  h.key('KeyO');h.win.emit('blur');assert.deepEqual(h.calls.guards.slice(-2),[true,false]);h.input.dispose();
});

test('mouse aerial combat isolates capture, menus, drag look and guard ownership',async()=>{
 const h=harness();h.flight.active=true;h.input.setEnabled(true);
 h.canvas.emit('mousedown',{button:0});assert.deepEqual(h.calls.actions,[],'capture click does not attack');
 await h.lock();h.canvas.emit('mousedown',{button:0});assert.deepEqual(h.calls.actions,['air-melee']);
 h.canvas.emit('mousedown',{button:2});h.key('KeyO');h.doc.emit('mouseup',{button:2});assert.deepEqual(h.calls.guards,[true]);h.up('KeyO');assert.deepEqual(h.calls.guards,[true,false]);
 h.canvas.emit('mousedown',{button:2});h.input.setEnabled(false);h.canvas.emit('mousedown',{button:0});assert.equal(h.calls.actions.length,1);assert.deepEqual(h.calls.guards.slice(-2),[true,false]);
 h.input.dispose();
 const f=harness({unavailable:true});f.flight.active=true;f.input.setEnabled(true);
 f.canvas.emit('mousedown',{button:0,clientX:10,clientY:10});f.doc.emit('mouseup',{button:0,target:f.canvas});assert.deepEqual(f.calls.actions,['air-melee']);
 f.canvas.emit('mousedown',{button:0,clientX:10,clientY:10});f.mouse(20,0,{buttons:1,clientX:30,clientY:10});f.doc.emit('mouseup',{button:0,target:f.canvas});assert.equal(f.calls.actions.length,1,'camera drag never attacks');
 f.canvas.emit('mousedown',{button:2});f.win.emit('blur');assert.deepEqual(f.calls.guards,[true,false]);f.input.dispose();
});

test('ground melee uses the same mouse controls without changing ground C or Space',async()=>{
 const h=harness({groundMelee:true});h.input.setEnabled(true,{capture:true});await h.lock();h.canvas.emit('mousedown',{button:0});h.canvas.emit('mousedown',{button:2});assert.deepEqual(h.calls.actions,['air-melee']);assert.deepEqual(h.calls.guards,[true]);h.doc.emit('mouseup',{button:2});h.key('KeyC');h.key('Space');assert.deepEqual(h.calls.actions,['air-melee','crouch']);assert.equal(h.input.snapshot().jump,true);assert.equal(h.input.snapshot().lift,false);h.input.dispose();
});

test('A/D are lateral movement while arrows turn only on foot and remain vehicle steering', () => {
  const h=harness();h.input.setEnabled(true);h.key('ArrowLeft');
  assert.equal(h.input.snapshot().left,false);assert.equal(h.input.snapshot().turnLeft,true);
  assert.equal(h.input.snapshot({mounted:true}).left,true);assert.equal(h.input.snapshot({mounted:true}).turnLeft,false);
  h.up('ArrowLeft');h.key('ArrowRight');
  assert.equal(h.input.snapshot().right,false);assert.equal(h.input.snapshot().turnRight,true);
  assert.equal(h.input.snapshot({mounted:true}).right,true);assert.equal(h.input.snapshot({mounted:true}).turnRight,false);
  h.up('ArrowRight');h.key('KeyA');h.key('KeyD');
  assert.equal(h.input.snapshot().left,true);assert.equal(h.input.snapshot().right,true);
  assert.equal(h.input.snapshot().turnLeft,false);assert.equal(h.input.snapshot().turnRight,false);
  h.input.setEnabled(false);assert.equal(h.input.snapshot().left,false);assert.equal(h.input.snapshot().turnRight,false);
  h.input.dispose();
});

test('C crouch toggle fires once in gameplay, preserves movement and never steals copy or panel text', () => {
  const h = harness();
  h.input.setEnabled(true); h.key('KeyW');
  assert.equal(h.key('KeyC').defaultPrevented, true);
  h.key('KeyC', { repeat: true });
  assert.deepEqual(h.calls.actions, ['crouch']);
  assert.equal(h.input.snapshot().forward, true);
  assert.equal(h.key('KeyC', { ctrlKey: true }).defaultPrevented, false);
  h.input.setEnabled(false); h.up('KeyC');
  h.key('KeyC');
  h.key('KeyC', { target: { closest: () => ({ tagName: 'INPUT' }) } });
  assert.deepEqual(h.calls.actions, ['crouch']);
  h.input.dispose();
});
test('C is held descent only during active flight while Ctrl remains ground slow walk',()=>{
 const h=harness();h.input.setEnabled(true);
 h.key('KeyC');assert.deepEqual(h.calls.actions,['crouch']);assert.equal(h.input.snapshot().descend,true);h.up('KeyC');
 h.flight.active=true;h.key('KeyC');assert.deepEqual(h.calls.actions,['crouch']);
 assert.equal(flightControls(h.input.snapshot()).descend,true);
 h.up('KeyC');assert.equal(h.input.snapshot().descend,false);
 h.key('ControlLeft',{ctrlKey:true});assert.equal(h.input.snapshot().walk,true);
 assert.equal(h.input.snapshot().descend,false);assert.equal(flightControls(h.input.snapshot()).descend,false);
 h.up('ControlLeft');h.flight.active=false;h.key('KeyC');assert.deepEqual(h.calls.actions,['crouch','crouch']);
 h.input.setEnabled(false);assert.equal(h.input.snapshot().descend,false);h.input.dispose();
});

test('evolution shortcut toggles from gameplay and panel buttons without stealing text input', () => {
  const h = harness();
  h.input.setEnabled(true);
  h.key('KeyU'); h.key('KeyU', { repeat: true });
  assert.deepEqual(h.calls.actions, ['evolution']);
  h.input.setEnabled(false);
  const button = { closest: () => ({ tagName: 'BUTTON' }) };
  assert.equal(h.key('KeyU', { target: button }).defaultPrevented, true);
  assert.deepEqual(h.calls.actions, ['evolution', 'evolution']);
  for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT', 'A']) {
    const event = h.key('KeyU', { target: { closest: () => ({ tagName }) } });
    assert.equal(event.defaultPrevented, false);
  }
  h.key('KeyU', { target: button, ctrlKey: true });
  assert.deepEqual(h.calls.actions, ['evolution', 'evolution']);
  h.input.dispose();
});

test('browser and operating-system modifier shortcuts remain untouched', () => {
  const h = harness();
  h.input.setEnabled(true, { capture: true });
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey']) {
    for (const code of ['Tab', 'KeyW', 'KeyF', 'KeyQ', 'Escape']) {
      const event = h.key(code, { [modifier]: true });
      assert.equal(event.defaultPrevented, false, `${modifier} + ${code} must retain its normal shortcut`);
    }
  }
  assert.equal(h.calls.requests, 1);
  assert.deepEqual(h.calls.actions, []);
  assert.equal(h.input.snapshot().forward, false);
  h.input.dispose();
});

test('Alt free look permits movement and sprint, preserves Alt+Tab and clears on pause or blur',()=>{
  const h=harness();h.input.setEnabled(true);
  h.key('AltLeft',{altKey:true});h.key('AltLeft',{altKey:true,repeat:true});
  assert.equal(h.input.freeLook,true);assert.deepEqual(h.calls.freeLook,[true]);
  h.key('KeyW',{altKey:true});h.key('ShiftLeft',{altKey:true});h.key('KeyD',{altKey:true});
  assert.equal(h.input.snapshot().forward,true);assert.equal(h.input.snapshot().sprint,true);assert.equal(h.input.snapshot().right,true);
  assert.equal(h.key('Tab',{altKey:true}).defaultPrevented,false);assert.deepEqual(h.calls.actions,[]);
  h.key('AltRight',{altKey:true});h.up('AltLeft');assert.equal(h.input.freeLook,true);
  h.up('AltRight');assert.equal(h.input.freeLook,false);assert.deepEqual(h.calls.freeLook,[true,false]);
  h.key('AltLeft',{altKey:true});h.input.setEnabled(false);assert.equal(h.input.freeLook,false);
  h.input.setEnabled(true);h.key('AltLeft',{altKey:true});h.win.emit('blur');assert.equal(h.input.freeLook,false);
  assert.equal(h.input.snapshot().forward,false);h.input.dispose();
});
test('Ctrl slow walk can also hold Alt free look without capturing OS switching shortcuts',()=>{
 const h=harness();h.input.setEnabled(true);h.key('ControlLeft',{ctrlKey:true});h.key('AltLeft',{ctrlKey:true,altKey:true});
 h.key('KeyW',{ctrlKey:true,altKey:true});assert.ok(h.input.freeLook&&h.input.snapshot().walk&&h.input.snapshot().forward);
 assert.equal(h.key('Tab',{ctrlKey:true,altKey:true}).defaultPrevented,false);h.input.dispose();
});
test('unavailable pointer lock retains drag fallback and detects a missed mouse release', () => {
  const h = harness({ unavailable: true });
  h.input.setEnabled(true, { capture: true });
  assert.equal(h.input.captureStatus, 'unavailable');
  h.canvas.emit('mousedown', { button: 0, buttons: 1 });
  h.mouse(5, -2, { buttons: 1 });
  h.mouse(20, 20, { buttons: 0 });
  h.mouse(30, 30, { buttons: 1 });
  assert.deepEqual(h.calls.look, [[5, -2]], 'button release outside the window must end drag-to-look');
  h.canvas.emit('mousedown', { button: 0, buttons: 1 });
  h.mouse(2, 3, { buttons: 1 });
  h.doc.emit('mouseup'); h.mouse(8, 8, { buttons: 1 });
  assert.deepEqual(h.calls.look, [[5, -2], [2, 3]]);
  h.input.dispose();
});

test('disposing pending Promise capture releases its late success and removes input handlers', async () => {
  const h = harness();
  h.input.setEnabled(true, { capture: true });
  h.input.dispose();
  await h.lock();
  assert.equal(h.calls.releases, 1, 'destroyed input must not leave a late pointer lock active');
  h.key('KeyQ'); h.mouse(9, 9); h.win.emit('blur');
  assert.deepEqual(h.calls.actions, []);
  assert.deepEqual(h.calls.look, []);
  assert.equal(h.calls.blur, 0);
  h.unlock();
});
