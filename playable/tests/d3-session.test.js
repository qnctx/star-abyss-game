const { test } = require('node:test');
const assert = require('node:assert/strict');
const modules = Promise.all([import('../src/d3-session/index.mjs'), import('../src/d3-session/demo-fixture.mjs')]);
async function setup() {
  const [api, f] = await modules;
  let saved = api.copy(f.fixture()), mode = '', writes = 0;
  const storage = { load: async () => api.copy(saved), compareAndSwap: async ({ expectedRevision, nextState }) => {
    if (mode === 'throw') throw Error('writeFailed');
    if (mode === 'reject' || saved.revision !== expectedRevision) return false;
    saved = api.copy(nextState); writes++;
    if (mode === 'lost') throw Error('responseLost');
    return true;
  } };
  const session = api.createSession({ storage, ...f.config });
  return { ...api, ...f, storage, session, state: () => api.copy(saved), mode: v => { mode = v; }, writes: () => writes };
}
async function spawn(x, anchor = 'Z0-HERB-01') { return (await x.session.execute(x.request(x.state(), 'spawn-' + x.state().revision, 'spawn', { anchorId: anchor }))).state; }
test('finite harvest, partial mirror, final token, JSON reload and original retry', async () => {
  const x = await setup(); await spawn(x);
  let r = x.state(), source = r.inventory.items.find(i => i.definitionId === 'herb');
  const count = source.quantity;
  await x.session.execute(x.transfer(r, 'partial', source, 'pack', 1));
  r = x.state(); assert.equal(r.director.anchors['Z0-HERB-01'].current.remaining, count - 1);
  assert.equal(r.events.length, 0);
  source = r.inventory.items.find(i => i.containerId === source.containerId);
  const req = x.transfer(r, 'final', source, 'pack');
  await x.session.execute(req); r = x.state();
  assert.equal(r.events.length, 1); assert.equal(r.director.anchors['Z0-HERB-01'].token.createdAt, req.simTime);
  const reloaded = x.createSession({ storage: x.storage, ...x.config });
  const retry = await reloaded.execute(req); assert.equal(retry.replayed, true); assert.deepEqual(retry.events, []);
  assert.deepEqual(retry.state, r); assert.equal(x.writes(), 3);
});
test('full container, cancelled request and denied authorization never write or consume', async () => {
  const x = await setup(); await spawn(x); const before = x.state();
  const item = before.inventory.items.find(i => i.definitionId === 'herb');
  await assert.rejects(x.session.execute(x.transfer(before, 'full', item, 'full-pack')), /slotsFull/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(x.session.execute(x.transfer(before, 'cancel', item, 'pack'), { signal: controller.signal }), /cancelled/);
  const denied = x.createSession({ storage: x.storage, ...x.config, authorize: () => false });
  await assert.rejects(denied.execute(x.transfer(before, 'denied', item, 'pack')), /accessDenied/);
  assert.deepEqual(x.state(), before);
});
test('false and exception root writes leave all children unchanged; original request can recover', async () => {
  for (const mode of ['reject', 'throw']) {
    const x = await setup(); await spawn(x); const before = x.state();
    const req = x.transfer(before, mode, before.inventory.items.find(i => i.definitionId === 'herb'), 'pack');
    x.mode(mode); await assert.rejects(x.session.execute(req)); assert.deepEqual(x.state(), before);
    x.mode(''); await x.session.execute(req); assert.equal(x.state().events.length, 1);
  }
});
test('lost response reloads latest root, old receipt cannot overwrite later progress', async () => {
  const x = await setup(); await spawn(x); const before = x.state();
  const req = x.transfer(before, 'lost', before.inventory.items.find(i => i.definitionId === 'herb'), 'pack');
  x.mode('lost'); await assert.rejects(x.session.execute(req), /responseLost/); x.mode('');
  await x.session.execute(x.transfer(x.state(), 'weapon', x.state().inventory.items.find(i => i.uniqueDefinitionId), 'other-pack'));
  const latest = x.state(), writes = x.writes();
  assert.deepEqual((await x.session.execute(req)).state, latest); assert.equal(x.writes(), writes);
  await assert.rejects(x.session.execute({ ...req, simTime: req.simTime + 1 }), /transactionIdConflict/);
});
test('concurrent harvest contenders: one root CAS wins and quantities conserved', async () => {
  const x = await setup(); await spawn(x); const before = x.state(), item = before.inventory.items.find(i => i.definitionId === 'herb');
  const results = await Promise.allSettled([x.session.execute(x.transfer(before, 'one', item, 'pack')), x.session.execute(x.transfer(before, 'two', item, 'other-pack'))]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(x.state().events.length, 1); assert.equal(x.state().inventory.items.filter(i => i.definitionId === 'herb').reduce((n,i) => n+i.quantity,0), item.quantity);
});
test('real A exact thirds, death once, alias state persisted and corpse loot retained on full pickup', async () => {
  const x = await setup(); await spawn(x, 'Z0-LAIR-01'); const member = x.state().director.anchors['Z0-LAIR-01'].current.members[0].instanceId;
  await x.session.execute(x.cast(x.state()));
  await x.session.execute(x.hit(x.state(), member, 0));
  assert.deepEqual(x.state().combat.casts[0].targets[0].carryExact, { numerator: '1', denominator: '3' });
  await x.session.execute(x.hit(x.state(), member, 1));
  await x.session.execute(x.hit(x.state(), member, 2));
  let r = x.state(); assert.equal(r.combat.actors.find(a => a.id === member).hp, '0');
  assert.equal(r.events.length, 1); assert.equal(r.drops.filter(d => d.created).length, 1);
  const loot = r.inventory.items.find(i => i.definitionId === 'monster-material');
  await assert.rejects(x.session.execute(x.transfer(r, 'full-loot', loot, 'full-pack')), /slotsFull/);
  assert.deepEqual(x.state(), r);
  await x.session.execute(x.hit(r, member, 2, 'alias'));
  r = x.state(); assert.equal(r.combat.hits.at(-1).aliasOf, 'hit-2'); assert.equal(r.events.length, 1);
  const bad = x.hit(r, member, 1, 'alias'); bad.transactionId = 'different-root-id';
  await assert.rejects(x.session.execute(bad), /hit ID conflict/);
  await x.session.execute(x.transfer(r, 'pickup', loot, 'pack'));
  assert.equal(x.state().drops[0].manifest[0].quantity, 2);
  assert.equal(x.state().inventory.items.find(i => i.itemInstanceId === loot.itemInstanceId).containerId, 'pack');
});
test('death root rejection keeps living actor and uncreated manifest; retry creates exactly once', async () => {
  const x = await setup(); await spawn(x, 'Z0-LAIR-01'); const member = x.state().drops[0].memberId;
  await x.session.execute(x.cast(x.state()));
  for (const n of [0, 1]) await x.session.execute(x.hit(x.state(), member, n));
  const before = x.state(), req = x.hit(before, member, 2); x.mode('reject');
  await assert.rejects(x.session.execute(req), /commitRejected/); assert.deepEqual(x.state(), before);
  x.mode(''); await x.session.execute(req); assert.equal(x.state().events.length, 1);
});
test('unique B original identity + C owner move together; failed write cannot split ownership', async () => {
  const x = await setup(); const before = x.state(), req = x.transfer(before, 'unique', before.inventory.items[0], 'other-pack');
  x.mode('reject'); await assert.rejects(x.session.execute(req)); assert.deepEqual(x.state(), before);
  x.mode(''); await x.session.execute(req); const r = x.state();
  assert.equal(r.inventory.items[0].itemInstanceId, 'original-weapon'); assert.equal(r.inventory.items[0].containerId, 'other-pack');
  assert.equal(r.director.uniqueLedger['MYW-demo'].ownerId, 'other'); assert.equal(r.events.length, 0);
});
test('next generation uses C actual IDs and preserves prior saved history', async () => {
  const x = await setup(); await spawn(x); const r = x.state(), source = r.inventory.items.find(i => i.definitionId === 'herb');
  await x.session.execute(x.transfer(r, 'deplete', source, 'pack'));
  const depleted = x.state(), slot = depleted.director.anchors['Z0-HERB-01'];
  await assert.rejects(x.session.execute(x.request(depleted, 'early', 'spawn', { anchorId: 'Z0-HERB-01' })), /noEligiblePlan/);
  await x.session.execute(x.request(depleted, 'new-generation', 'spawn', { anchorId: 'Z0-HERB-01' }, slot.token.dueAt));
  const current = x.state().director.anchors['Z0-HERB-01'].current;
  assert.notEqual(current.instanceId, slot.current.instanceId);
  assert.equal(x.state().inventory.containers.filter(c => c.sourceInstanceId === current.instanceId).length, 1);
  assert.equal(x.state().director.anchors['Z0-HERB-01'].history.length, 1);
});
test('configuration missing, forged event operation and backwards clock are rejected', async () => {
  const x = await setup(); assert.throws(() => x.createSession({ storage: x.storage }), /configurationRequired/);
  await assert.rejects(x.session.execute(x.request(x.state(), 'forged', 'event', { committed: true })), /unsupportedOperation/);
  await assert.rejects(x.session.execute(x.request(x.state(), 'backwards', 'cast', {}, -1)), /clockWentBackwards/);
  assert.equal(x.writes(), 0);
});
test('cancellation during async authorization and mutable caller request cannot leak partial state', async () => {
  const x = await setup(); const before = x.state(), controller = new AbortController();
  const session = x.createSession({ storage: x.storage, ...x.config, authorize: async () => { controller.abort(); return true; } });
  const req = x.transfer(before, 'async-cancel', before.inventory.items[0], 'other-pack');
  await assert.rejects(session.execute(req, { signal: controller.signal }), /cancelled/);
  assert.deepEqual(x.state(), before);
  let release; const gate = new Promise(resolve => { release = resolve; });
  const delayed = x.createSession({ storage: x.storage, ...x.config, authorize: async () => { await gate; return true; } });
  const pending = delayed.execute(req); req.operations[0].toContainerId = 'full-pack'; release();
  await pending; assert.equal(x.state().inventory.items[0].containerId, 'other-pack');
});
test('last actual member death creates one vacancy while all unpicked manifests survive', async () => {
  const x = await setup(); await spawn(x, 'Z0-LAIR-01');
  const members = x.state().drops.map(d => d.memberId); await x.session.execute(x.cast(x.state()));
  for (const [m, member] of members.entries()) {
    for (let segment = 0; segment < 3; segment++) await x.session.execute(x.hit(x.state(), member, segment, `hit-${m}-${segment}`));
    if (m < members.length - 1) assert.equal(x.state().director.anchors['Z0-LAIR-01'].token, null);
  }
  const r = x.state(); assert.equal(r.events.length, members.length);
  assert.equal(r.director.anchors['Z0-LAIR-01'].token.createdAt, r.simTime);
  assert.equal(r.inventory.items.filter(i => i.definitionId === 'monster-material').length, members.length);
  assert.equal(r.drops.filter(d => d.created).length, members.length);
});
test('bad or async materializers reject before any root write', async () => {
  const x = await setup(); const before = x.state();
  for (const materialize of [undefined, async () => ({}), () => ({ container: { ...x.capacity, maxSlots: 0 }, items: [{ ...x.item, quantity: 4 }] })]) {
    const s = x.createSession({ storage: x.storage, ...x.config, materialize });
    await assert.rejects(s.execute(x.request(before, 'invalid-spawn', 'spawn', { anchorId: 'Z0-HERB-01' })));
    assert.deepEqual(x.state(), before);
  }
});
test('R2 checkpoint/rescue: seven scenario groups, explicit memory CAS only', async () => {
  const { runSceneCases } = await import('../src/d3-session/scene-cases-r2.mjs');
  const { copy } = (await modules)[0];const worlds=new Map();
  const open=async(name,fault=()=>null)=>({initialize:async r=>{if(worlds.has(name))return false;worlds.set(name,copy(r));return true;},
    load:async()=>copy(worlds.get(name)),close(){},compareAndSwap:async({expectedRevision,nextState})=>{
      if(worlds.get(name).revision!==expectedRevision)return false;if(fault('afterPut')==='abort')throw Error('injectedAbort');
      worlds.set(name,copy(nextState));if(fault('afterCommit')==='loseResponse')throw Error('responseLost');return true;
    }});
  const evidence=await runSceneCases(open,'node-memory');
  for(const c of evidence.cases)assert.equal(c.pass,true,c.name+' '+c.error);
  require('node:fs').writeFileSync(require('node:path').join(__dirname,'../src/d3-session/evidence-r3/r2-node-regression.json'),JSON.stringify(evidence,null,2));
});
test('R3 configured original-world bounds: five groups, memory CAS only',async()=>{
 const {runBoundsCases}=await import('../src/d3-session/evidence-r3/cases.mjs');const {copy,canonical}= (await modules)[0],worlds=new Map();
 const open=async(name,fault,cfg)=>{const fixed=copy(cfg);return {initialize:async r=>{worlds.set(name,copy(r));return true;},load:async()=>copy(worlds.get(name)),close(){},
  assertSceneConfig:c=>{if(!c||canonical(c)!==canonical(fixed))throw Error('sceneConfigurationMismatch');},
  compareAndSwap:async({expectedRevision,nextState})=>{if(worlds.get(name).revision!==expectedRevision)return false;if(fault('afterPut')==='abort')throw Error('injectedAbort');worlds.set(name,copy(nextState));if(fault('afterCommit')==='loseResponse')throw Error('responseLost');return true;}};};
 const result=await runBoundsCases(open,'memory');for(const c of result.cases)assert.equal(c.pass,true,c.name+' '+c.error);
 require('node:fs').writeFileSync(require('node:path').join(__dirname,'../src/d3-session/evidence-r3/node.json'),JSON.stringify(result,null,2));
});
