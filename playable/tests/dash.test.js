const test = require('node:test');
const assert = require('node:assert/strict');
const modules = Promise.all([import('../src/dash.mjs'), import('../src/movement.mjs'), import('../src/stamina.mjs'), import('../src/mobility.mjs'), import('../src/layout.mjs')]);
async function setup(position = {}) {
  const m = Object.assign({}, ...await modules), p = { ...m.createPlayer(), ...position }, s = m.createStamina(), d = m.createDash();
  return { m, p, s, d, c: { grounded: true, mounted: false, gateOpen: false, mobility: m.createMobility(), sprintDuration: 30 } };
}
function finish(t, seconds = .4) { let motion; for (let i = 0; i < Math.ceil(seconds * 60); i++) motion = t.m.stepDash(t.d, t.p, t.s, 1 / 60, t.c); return motion; }

test('dash covers exactly four metres, charges once and has no residual velocity', async () => {
  const t = await setup(); t.p.vx = 3; t.p.vz = -4;
  assert.equal(t.m.startDash(t.d,t.p,t.s,{},t.c).changed,true);
  finish(t); assert.ok(Math.abs(t.p.z - 186) < 1e-8); assert.equal(t.s.value,80);
  assert.equal(t.d.active,false); assert.equal(t.p.vx,0); assert.equal(t.p.vz,0);
  assert.ok(t.d.cooldown > 5.5); assert.equal(t.m.startDash(t.d,t.p,t.s,{},t.c).changed,false);
  finish(t,6); assert.equal(t.d.cooldown,0); assert.equal(t.m.startDash(t.d,t.p,t.s,{},t.c).changed,true); assert.equal(t.d.serial,2);
});
test('body-relative directions normalize diagonal and freeze direction after launch', async () => {
  for (const controls of [{forward:true},{backward:true},{left:true},{right:true},{forward:true,right:true}]) {
    const t=await setup({heading:Math.PI/2,yaw:-1}); t.m.startDash(t.d,t.p,t.s,controls,t.c);
    const dx=t.d.dirX,dz=t.d.dirZ;t.p.yaw=0;finish(t);
    assert.ok(Math.abs(t.p.x-dx*4)<1e-8);assert.ok(Math.abs(t.p.z-190-dz*4)<1e-8);
  }
});
test('air, vehicle, insufficient stamina and immediately blocked starts are free rejections', async () => {
  for (const scenario of ['air','vehicle','resource','wall']) {
    const t=await setup(scenario==='wall'?{x:0,z:-709.85}:{});
    if(scenario==='air')t.c.grounded=false;if(scenario==='vehicle')t.c.mobility.vehicle.mounted=true;if(scenario==='resource')t.s.value=19;
    const before=JSON.stringify(t.s); assert.equal(t.m.startDash(t.d,t.p,t.s,{},t.c).changed,false);
    assert.equal(JSON.stringify(t.s),before);assert.equal(t.d.cooldown,0);
  }
});
test('closed bulkheads interrupt paid displacement; open gates are traversable', async () => {
  for(const open of [false,true]) {
    const t=await setup({x:0,z:-708});t.c.gateOpen=open;
    assert.equal(t.m.startDash(t.d,t.p,t.s,{},t.c).changed,true);finish(t);
    assert.equal(t.s.value,80);assert.equal(t.d.active,false);
    if(open)assert.ok(Math.abs(t.p.z+712)<1e-8);else assert.ok(t.p.z>-709.89&&t.p.z<-708);
  }
});
test('parked vehicle, fixed boulder and world edge cannot be tunneled through', async () => {
  for(const position of [{x:72,z:83},{x:24,z:134},{x:0,z:2997,heading:Math.PI,yaw:Math.PI}]) {
    const t=await setup(position); assert.equal(t.m.startDash(t.d,t.p,t.s,{},t.c).changed,true);
    finish(t);assert.ok(t.d.distance<4);assert.equal(t.m.groundMobilityBlocked(t.p.x,t.p.z,t.c.mobility),false);
  }
});
test('mouse orbit cannot redirect a forward dash',async()=>{
  for(const yaw of [-3,-1,0,1,3]){
    const t=await setup({heading:Math.PI/2,yaw});t.m.startDash(t.d,t.p,t.s,{forward:true},t.c);finish(t);
    assert.ok(Math.abs(t.p.x+4)<1e-8);assert.ok(Math.abs(t.p.z-190)<1e-8);
  }
});
test('ground dash refuses elevated origins rather than snapping off a ledge', async () => {
  const t=await setup({y:1});assert.equal(t.m.startDash(t.d,t.p,t.s,{},t.c).changed,false);assert.equal(t.s.value,100);
});
test('evolution scales cost without unlocking Shift or recovering during dash', async () => {
  const t=await setup();t.c.sprintDuration=120; t.s.value=5;t.s.shiftHeld=true;t.s.armed=false;
  assert.equal(t.m.startDash(t.d,t.p,t.s,{},t.c).changed,true);finish(t);
  assert.equal(t.s.value,0);assert.equal(t.s.shiftHeld,true);assert.equal(t.s.armed,false);assert.equal(t.s.recoveryRemaining,1.5);
  t.m.updateStamina(t.s,{moving:false},1);assert.equal(t.s.value,0);
  t.s.shiftHeld=false;t.m.updateStamina(t.s,{moving:false},1.5);assert.equal(t.s.value,0);
  t.m.updateStamina(t.s,{moving:false},.5);assert.equal(t.s.value,7);
});
test('pause and invalid delta freeze state; reload retains only bounded cooldown', async () => {
  const t=await setup();t.m.startDash(t.d,t.p,t.s,{},t.c);const before=JSON.stringify([t.d,t.p,t.s]);
  for(const dt of [0,-1,NaN,Infinity])t.m.stepDash(t.d,t.p,t.s,dt,t.c);
  assert.equal(JSON.stringify([t.d,t.p,t.s]),before);
  assert.deepEqual(t.m.serializeDash(t.d),{cooldown:6});const restored=t.m.createDash({...t.d});
  assert.equal(restored.active,false);assert.equal(restored.origin,null);assert.equal(restored.cooldown,6);
  for(const raw of [null,{}, {cooldown:NaN},{cooldown:-5},{cooldown:Infinity}])assert.equal(t.m.createDash(raw).cooldown,0);
  assert.equal(t.m.createDash({cooldown:999}).cooldown,6);
});
test('30/60/144 Hz produce the same travel and cooldown uses one simulation clock', async () => {
  for(const hz of [30,60,144]) {
    const t=await setup();t.m.startDash(t.d,t.p,t.s,{},t.c);
    for(let i=0;i<hz;i++)t.m.stepDash(t.d,t.p,t.s,1/hz,t.c);
    assert.ok(Math.abs(t.d.distance-4)<1e-8);assert.ok(Math.abs(t.d.cooldown-5)<1e-8);
    assert.equal(t.d.active,false);assert.equal(t.s.value,80);
  }
});
test('losing grounded state aborts immediately without a refund or extra travel', async () => {
  const t=await setup();t.m.startDash(t.d,t.p,t.s,{},t.c);t.m.stepDash(t.d,t.p,t.s,.05,t.c);
  const z=t.p.z;t.c.grounded=false;
  const motion=t.m.stepDash(t.d,t.p,t.s,.05,t.c);
  assert.equal(motion.blocked,true);assert.equal(motion.distance,0);assert.equal(t.p.z,z);assert.equal(t.d.active,false);assert.equal(t.s.value,80);
});
test('invalid endurance duration falls back safely and stopping does not refill sprint eligibility', async () => {
  for(const duration of [undefined,NaN,Infinity,-30,0]) {
    const t=await setup();t.c.sprintDuration=duration;t.s.armed=false;t.s.shiftHeld=true;
    assert.equal(t.m.startDash(t.d,t.p,t.s,{},t.c).changed,true);assert.equal(t.s.value,80);
    finish(t);assert.equal(t.s.armed,false);assert.equal(t.s.shiftHeld,true);
  }
});
