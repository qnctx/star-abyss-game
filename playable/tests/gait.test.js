const test = require('node:test');
const assert = require('node:assert/strict');
let createGait, updateGait, gaitView, CLIP_INFO;
test.before(async () => {
  ({ createGait, updateGait, gaitView } = await import('../src/gait.mjs'));
  ({ CLIP_INFO } = await import('../src/authored-motion.mjs'));
});

const flat = () => ({ height: 0, surface: 'dust', indoor: false });
function fixture(sample = flat) {
  const player = { x: 0, y: 0, z: 0, yaw: 0, vx: 0, vz: 0 };
  return { player, state: createGait(player, sample), sample };
}
function advance(f, seconds, speed = 4.7, dt = 1 / 60, extras = {}) {
  const events = [], snapshots = [];
  for (let elapsed = 0; elapsed < seconds - 1e-8;) {
    const step = Math.min(dt, seconds - elapsed), direction = extras.direction || { x: 0, z: -1 };
    f.player.x += speed * direction.x * step; f.player.z += speed * direction.z * step;
    events.push(...updateGait(f.state, { player: f.player, dt: step, grounded: true, mounted: false,
      sprinting: speed > 5, sampleGround: f.sample, ...extras }));
    snapshots.push(gaitView(f.state)); elapsed += step;
  }
  return { events, snapshots };
}

test('cadence follows translated distance; ordinary 4.7 m/s travel is a jog, sprint is a run', () => {
  for (const [speed,clip] of [[1.4,'walk'], [4.7,'jog'], [8.6,'sprint']]) {
    const f = fixture(), result = advance(f, 10, speed);
    assert.ok(Math.abs(result.events.length / 10-2*speed/CLIP_INFO[clip].stride)<.25,
      `${speed} m/s: ${result.events.length / 10} steps/s`);
    assert.equal(new Set(result.events.map(e => e.stanceId)).size, result.events.length);
    for (let i = 1; i < result.events.length; i++) assert.notEqual(result.events[i].foot, result.events[i - 1].foot);
    if (speed >= 4.7) assert.ok(gaitView(f.state).runBlend > .99);
  }
});

test('clip support has bounded world-anchor correction; swing feet clear the floor', () => {
  const f = fixture(); let previous = gaitView(f.state); let locked = 0, lifted = 0, airborne = 0, maxReach = 0;
  for (let i = 0; i < 360; i++) {
    advance(f, 1 / 60, 8.6);
    const view = gaitView(f.state);
    view.feet.forEach((foot, index) => {
      if (foot.anchored && previous.feet[index].stance) {
        assert.equal(foot.x, previous.feet[index].x); assert.equal(foot.z, previous.feet[index].z); locked++;
      }
      if (!foot.stance && foot.lift > .08) { assert.ok(foot.y > .08); lifted++; }
      maxReach = Math.max(maxReach, Math.hypot(foot.x - f.player.x, foot.z - f.player.z));
      assert.ok(Math.hypot(foot.correction.x,foot.correction.z)<.091);
      assert.ok(Math.abs(foot.correction.y)<=.14);
    });
    if (view.feet.every(foot => !foot.stance)) airborne++;
    previous = view;
  }
  assert.ok(locked > 40 && lifted > 80 && airborne > 30);
  assert.ok(maxReach < 1.0, `horizontal target reach ${maxReach}`);
});

test('blocked movement cannot advance the gait from held sprint or nonzero requested velocity', () => {
  const f = fixture(); f.player.vz = -8.6;
  const result = advance(f, 3, 0, 1 / 60, { sprinting: true });
  assert.equal(result.events.length, 0); assert.equal(gaitView(f.state).weight, 0);
  assert.equal(gaitView(f.state).phase, 0);
});

test('stopping settles a current swing, then produces neither drift nor repeated footfalls', () => {
  const f = fixture(); advance(f, 1.31, 4.7);
  const settling = advance(f, .6, 0); assert.ok(settling.events.length <= 2);
  const before = gaitView(f.state), stopped = advance(f, 4, 0), after = gaitView(f.state);
  assert.equal(stopped.events.length, 0); assert.deepEqual(after.feet.map(f => [f.x, f.y, f.z]), before.feet.map(f => [f.x, f.y, f.z]));
  assert.ok(after.weight < .0001);
});

test('backwards and sideward travel preserve body heading and use distinct directional steps', () => {
  for (const direction of [{ x: 0, z: 1 }, { x: 1, z: 0 }, { x: -1, z: 0 }]) {
    const f = fixture(), result = advance(f, 3, 4.7, 1 / 60, { direction });
    assert.ok(result.events.length >= 4);
    assert.equal(gaitView(f.state).facing,0);assert.equal(f.player.yaw,0);
    for (const foot of gaitView(f.state).feet) assert.ok(Math.hypot(foot.x - f.player.x, foot.z - f.player.z) < 1);
  }
});

test('mouse orbit cannot rotate a walking or resting body when heading is explicit',()=>{
  const f=fixture();f.player.heading=.4;
  for(let i=0;i<240;i++){
    f.player.yaw+=.04;
    advance(f,1/120,i<120?1.4:0,1/120,{direction:{x:-Math.sin(.4),z:-Math.cos(.4)}});
  }
  assert.ok(Math.abs(gaitView(f.state).facing-.4)<1e-6);
  assert.equal(gaitView(f.state).turningInPlace,false);
});

test('braking lateral and backward steps retain direction below a millimetre per substep',()=>{
  for(const [name,direction]of [['left',{x:-1,z:0}],['right',{x:1,z:0}],['backward',{x:0,z:1}]]){
    const f=fixture();f.player.heading=0;
    advance(f,1,1.3,1/120,{direction});
    for(const speed of [.11,.075,.04,.026,0]){
      advance(f,.1,speed,1/120,{direction});
      assert.ok(gaitView(f.state).direction[name]>.999,`${name} must not snap to forward while braking at ${speed}`);
      assert.equal(gaitView(f.state).facing,0);
    }
    advance(f,1,0,1/120,{direction});
    assert.ok(gaitView(f.state).direction[name]>.999);
    assert.equal(gaitView(f.state).transition,'idle');
  }
});

test('turning is finite, continuous and keeps the current support contacts planted', () => {
  const f = fixture(); advance(f, 1, 4.7); let previous = gaitView(f.state);
  for (let i = 0; i < 180; i++) {
    f.player.yaw += .016;
    advance(f, 1 / 60, 4.7, 1 / 60, { direction: { x: -Math.sin(f.player.yaw), z: -Math.cos(f.player.yaw) } });
    const view = gaitView(f.state);
    view.feet.forEach((foot, index) => {
      assert.ok([foot.x, foot.y, foot.z, foot.pitch].every(Number.isFinite));
      if (foot.anchored && previous.feet[index].stance) assert.deepEqual([foot.x, foot.y, foot.z], [previous.feet[index].x, previous.feet[index].y, previous.feet[index].z]);
    });
    previous = view;
  }
});

test('abrupt sprint reversals recover the feet without squatting through the ground', () => {
  for (const direction of [{ x: 0, z: 1 }, { x: 1, z: 0 }, { x: -.707, z: .707 }]) {
    const f = fixture(); advance(f, 1.8, 8.6);
    const result = advance(f, 2, 2, 1 / 60, { direction });
    for (const view of result.snapshots) assert.ok(view.body.offsetY >= -.26);
    for (const foot of gaitView(f.state).feet) assert.ok(Math.hypot(foot.x - f.player.x, foot.z - f.player.z) < .64);
    assert.ok(result.events.length > 2);
  }
});

test('reversing immediately before touchdown finishes that plant instead of teleporting the boot', () => {
  const f = fixture(); advance(f, 1.5, 8.6);
  while (!gaitView(f.state).feet.some(foot => foot.phase > .95 && foot.phase < .98)) advance(f, 1 / 120, 8.6, 1 / 120);
  let previous = gaitView(f.state);
  for (let i = 0; i < 20; i++) {
    advance(f, 1 / 120, 2, 1 / 120, { direction: { x: 0, z: 1 } });
    const view = gaitView(f.state);
    for (let index = 0; index < 2; index++) {
      const foot = view.feet[index], before = previous.feet[index];
      assert.ok(Math.hypot(foot.x - before.x, foot.y - before.y, foot.z - before.z) < .25);
    }
    previous = view;
  }
});

test('a stale reverse landing anchor is never submitted as an unreachable support', () => {
  const f = fixture(); advance(f, 2.5, 8.6);
  let steps = 0;
  for (let i = 0; i < 180; i++) {
    steps += advance(f, 1 / 120, 2, 1 / 120, { direction: { x: 0, z: 1 } }).events.length;
    const view = gaitView(f.state);
    for (const foot of view.feet.filter(foot => foot.stance)) {
      assert.ok(Math.hypot(foot.correction.x,foot.correction.z)<.091);
    }
    assert.ok(view.body.offsetY >= -.26);
  }
  assert.ok(steps >= 2, 'the retry must not leave the feet suspended indefinitely');
});

test('turning in place repositions the feet with actual small steps, then becomes quiet', () => {
  const f = fixture(); let events = [];
  for (let i = 0; i < 60; i++) {
    f.player.yaw += Math.PI / 120;
    events.push(...advance(f, 1 / 60, 0).events);
  }
  events.push(...advance(f, 1, 0).events);
  assert.ok(events.length >= 1 && events.length <= 6);
  assert.equal(advance(f, 3, 0).events.length, 0);
  assert.equal(gaitView(f.state).speed, 0);
});

test('each contact samples its own ground height, material and enclosure', () => {
  const f = fixture((x, z) => ({ height: x < 0 ? 0 : .18, surface: x < 0 ? 'gravel' : 'metal', indoor: x >= 0 }));
  const result = advance(f, 3, 1.4);
  for (const event of result.events) {
    assert.equal(event.surface, event.foot < 0 ? 'gravel' : 'metal');
    assert.equal(event.indoor, event.foot > 0);
  }
  for (const view of result.snapshots) for (const foot of view.feet.filter(f => f.stance)) assert.equal(foot.y, foot.side < 0 ? 0 : .18);
});

test('air and mounted travel are silent; a real landing emits one impact and no duplicate pair', () => {
  const f = fixture(); advance(f, 1, 4.7);
  f.player.y = 1;
  assert.equal(advance(f, 1, 5, 1 / 60, { grounded: false, verticalSpeed: -3 }).events.length, 0);
  f.player.y = 0;
  const touchdown = advance(f, 1 / 60, 0, 1 / 60, { verticalSpeed: -3 });
  assert.equal(touchdown.events.length, 1); assert.equal(touchdown.events[0].type, 'land');
  assert.ok(touchdown.events[0].intensity > .7);
  assert.equal(advance(f, 2, 0).events.length, 0);
  assert.equal(advance(f, 2, 24, 1 / 60, { mounted: true }).events.length, 0);
  assert.equal(advance(f, 1 / 60, 0).events.length, 0);
});

test('impact intensity grows with descent speed but is finite and capped', () => {
  const impacts = [0, 2, 8, 100].map(vertical => {
    const f = fixture(); f.player.y = 1;
    advance(f, .2, 0, 1 / 60, { grounded: false, verticalSpeed: -vertical }); f.player.y = 0;
    return advance(f, 1 / 60, 0, 1 / 60, { verticalSpeed: -vertical }).events[0].intensity;
  });
  assert.ok(impacts[0] < impacts[1] && impacts[1] < impacts[2]); assert.equal(impacts[3], 1.5);
});

test('braking a fall before touchdown reduces the eventual impact rather than storing peak speed', () => {
  const f = fixture(); f.player.y = 1;
  advance(f, .2, 0, 1 / 60, { grounded: false, verticalSpeed: -8 });
  advance(f, .2, 0, 1 / 60, { grounded: false, verticalSpeed: -.2 });
  f.player.y = 0;
  const event = advance(f, 1 / 60, 0, 1 / 60, { verticalSpeed: -.2 }).events[0];
  assert.ok(event.intensity < .4);
});

test('delta partitioning gives the same contact order and nearly identical timing', () => {
  const fine = fixture(), coarse = fixture();
  const a = advance(fine, 8, 4.7, 1 / 120), b = advance(coarse, 8, 4.7, 1 / 20);
  assert.deepEqual(a.events.map(e => e.foot), b.events.map(e => e.foot));
  assert.ok(Math.abs(gaitView(fine.state).phase - gaitView(coarse.state).phase) < .015);
});

test('pause-sized deltas and teleports rebase without replaying contacts; views cannot mutate state', () => {
  const f = fixture(); advance(f, 1, 4.7); const count = f.state.stepCount;
  f.player.z -= 200;
  assert.deepEqual(updateGait(f.state, { player: f.player, dt: 3, grounded: true }), []);
  assert.equal(f.state.stepCount, count);
  const view = gaitView(f.state); view.feet[0].x = 999; view.body.offsetY = 100;
  assert.notEqual(f.state.feet[0].x, 999); assert.notEqual(f.state.body.offsetY, 100);
});

test('raised blocked surfaces shorten the next footfall instead of planting feet on wall tops', () => {
  const f = fixture((x, z) => ({ height: z < -3 ? 3 : 0, surface: 'stone', indoor: false, blocked: z < -3 }));
  const result = advance(f, .55, 4.7);
  for (const view of result.snapshots) for (const foot of view.feet.filter(f => f.stance)) assert.ok(foot.y < .32);
});

test('a raised fragment under a swinging boot is cleared rather than intersected', () => {
  const sample = (x, z) => ({ height: z < -1.35 && z > -1.8 ? .23 : 0, surface: 'stone', indoor: false });
  const f = fixture(sample), result = advance(f, .6, 4.7);
  for (const view of result.snapshots) for (const foot of view.feet.filter(f => !f.stance)) {
    assert.ok(foot.y >= sample(foot.x, foot.z).height);
  }
});
