const { test } = require('node:test');
const assert = require('node:assert/strict');
const api = import('../src/d3-inventory/index.mjs');

const container = (containerId, extra = {}) => ({ containerId, maxSlots: 24, maxVolumeMl: '40000', maxMassGrams: '35000', ...extra });
const item = (itemInstanceId, containerId, quantity = 1, extra = {}) => ({ itemInstanceId, containerId, definitionId: 'herb', quantity,
  maxStack: 20, unitVolumeMl: '200', unitMassGrams: '100', ...extra });
async function fixture(extra = {}) {
  const { createState } = await api;
  return createState({ worldId: 'world-1', containers: [container('pack'), container('cargo', { kind: 'cargo' }),
    container('plant', { kind: 'resource', sourceInstanceId: 'plant-generation-1' })], items: [item('herb-1', 'plant', 5, { sourceInstanceId: 'plant-generation-1' })], ...extra });
}
const request = (state, transactionId, operations) => ({ transactionId, expectedRevision: state.revision, operations });
const transfer = (itemInstanceId, fromContainerId, toContainerId, quantity) => ({ kind: 'transfer', itemInstanceId, fromContainerId, toContainerId, quantity });
function memoryStorage(state) {
  let saved = structuredClone(state), writes = 0;
  return { read: () => structuredClone(saved), writes: () => writes,
    compareAndSwap: async ({ worldId, expectedRevision, nextState }) => {
      if (saved.worldId !== worldId || saved.revision !== expectedRevision) return false;
      saved = structuredClone(nextState); writes++; return true;
    } };
}
async function run(storage, transactionId, operations) {
  const { planTransaction, commitTransaction } = await api;
  const state = storage.read();
  return commitTransaction(state, planTransaction(state, request(state, transactionId, operations)), storage);
}
const code = expected => error => error.code === expected;

test('harvest partial -> final stock -> one committed depletion, pack -> cargo, save round trip and replay', async () => {
  const { planTransaction, commitTransaction, serializeState, deserializeState } = await api;
  const initial = await fixture(), storage = memoryStorage(initial);
  const partial = await run(storage, 'harvest-1', [transfer('herb-1', 'plant', 'pack', 2)]);
  assert.equal(partial.events.length, 0);
  assert.equal(partial.state.items.find(i => i.itemInstanceId === 'herb-1').quantity, 3);
  const current = storage.read(), req = request(current, 'harvest-2', [transfer('herb-1', 'plant', 'pack', 3)]);
  const plan = planTransaction(current, req);
  assert.equal(plan.preview.events[0].committed, false);
  const result = await commitTransaction(current, JSON.parse(JSON.stringify(plan)), storage);
  assert.equal(result.events.length, 1);
  assert.deepEqual(result.events[0], { eventId: '["resourceDepleted","world-1","plant-generation-1"]', worldId: 'world-1', sourceInstanceId: 'plant-generation-1', kind: 'resourceDepleted', committed: true });
  assert.equal(result.state.containers.find(c => c.containerId === 'plant').depleted, true);
  const packItem = result.state.items[0];
  assert.equal(packItem.quantity, 5);
  assert.equal(packItem.lots.reduce((n, l) => n + l.quantity, 0), 5);
  const moved = await run(storage, 'unload', [transfer(packItem.itemInstanceId, 'pack', 'cargo', 5)]);
  assert.equal(moved.events.length, 0);
  assert.equal(moved.state.items[0].itemInstanceId, packItem.itemInstanceId);
  const loaded = deserializeState(serializeState(storage.read()));
  assert.deepEqual(loaded, storage.read());
  const replay = await commitTransaction(loaded, plan, { compareAndSwap: () => assert.fail('retry must not write') });
  assert.equal(replay.replayed, true); assert.equal(replay.events.length, 0);
  assert.equal(replay.state.items[0].containerId, 'cargo'); assert.equal(replay.state.outbox.length, 1);
  assert.deepEqual(initial, await fixture());
});

test('cancelled preview and rejected/throwing storage leave resource, inventory and outbox unchanged', async () => {
  const { planTransaction, commitTransaction } = await api;
  const state = await fixture(), old = structuredClone(state);
  const plan = planTransaction(state, request(state, 'cancel', [transfer('herb-1', 'plant', 'pack', 5)]));
  assert.deepEqual(state, old);
  await assert.rejects(commitTransaction(state, plan), code('commitAdapterRequired'));
  await assert.rejects(commitTransaction(state, plan, { compareAndSwap: async () => false }), code('commitRejected'));
  await assert.rejects(commitTransaction(state, plan, { compareAndSwap: async () => { throw new Error('disk full'); } }), /disk full/);
  assert.deepEqual(state, old); assert.equal(state.outbox.length, 0);
});

for (const [name, capacity, expected] of [
  ['slots', { maxSlots: 0 }, 'slotsFull'],
  ['volume', { maxVolumeMl: '999' }, 'volumeFull'],
  ['mass', { maxMassGrams: '499' }, 'massFull']
]) test(`${name} capacity failure rolls back the entire multi-operation harvest`, async () => {
  const { planTransaction } = await api;
  const state = await fixture({ containers: [container('pack', capacity), container('plant', { kind: 'resource', sourceInstanceId: 'plant-generation-1' })] });
  const before = JSON.stringify(state);
  assert.throws(() => planTransaction(state, request(state, name, [transfer('herb-1', 'plant', 'pack', 2), transfer('herb-1', 'plant', 'pack', 3)])), code(expected));
  assert.equal(JSON.stringify(state), before);
});

test('stack matching includes quality, tier, state and canonical attributes; merging does not reduce volume/mass', async () => {
  const { measureContainer } = await api;
  const state = await fixture({ items: [item('existing', 'pack', 18, { attributes: { b: 2, a: 1 } }),
    item('incoming', 'cargo', 4, { attributes: { a: 1, b: 2 } }), item('quality', 'cargo', 1, { quality: 4 }),
    item('tier', 'cargo', 1, { tier: 1 }), item('state', 'cargo', 1, { status: 'damaged' }), item('attributes', 'cargo', 1, { attributes: { x: 1 } })] });
  const storage = memoryStorage(state);
  await run(storage, 'merge', [transfer('incoming', 'cargo', 'pack', 4)]);
  assert.equal(storage.read().items.find(i => i.itemInstanceId === 'existing').quantity, 20);
  for (const key of ['quality', 'tier', 'state', 'attributes']) await run(storage, key, [transfer(key, 'cargo', 'pack', 1)]);
  assert.deepEqual(measureContainer(storage.read(), 'pack'), { slots: '6', volumeMl: '5200', massGrams: '2600', effectiveMassGrams: '2600' });
});

test('explicit split costs a slot, persists split/root identity and conserves quantity', async () => {
  const { planTransaction } = await api;
  const state = await fixture({ items: [item('ore', 'pack', 10)] }), storage = memoryStorage(state);
  const result = await run(storage, 'split', [{ kind: 'split', itemInstanceId: 'ore', fromContainerId: 'pack', quantity: 3 }]);
  assert.deepEqual(result.state.items.map(i => i.quantity), [7, 3]);
  assert.equal(result.state.items[1].rootItemId, 'ore');
  assert.equal(result.state.items[1].splitId, '["inventorySplit","split",0]');
  const full = structuredClone(state); full.containers[0].maxSlots = 1;
  assert.throws(() => planTransaction(full, request(full, 'full', [{ kind: 'split', itemInstanceId: 'ore', fromContainerId: 'pack', quantity: 3 }])), code('slotsFull'));
});

test('unique item moves original instance/root between owners and cannot be consumed or duplicated', async () => {
  const { createState, planTransaction } = await api;
  const unique = item('original-sword', 'pack', 1, { maxStack: 1, definitionId: 'sword', uniqueDefinitionId: 'MYW01', rootArtifactId: 'original-sword' });
  const state = await fixture({ items: [unique] }), storage = memoryStorage(state);
  const moved = await run(storage, 'trade', [transfer('original-sword', 'pack', 'cargo', 1)]);
  assert.equal(moved.state.items.length, 1); assert.equal(moved.state.items[0].itemInstanceId, 'original-sword');
  assert.equal(moved.receipt.changes[0].rootArtifactId, 'original-sword');
  await run(storage, 'recover', [transfer('original-sword', 'cargo', 'pack', 1)]);
  assert.throws(() => planTransaction(storage.read(), request(storage.read(), 'consume', [{ kind: 'consume', itemInstanceId: 'original-sword', fromContainerId: 'pack', quantity: 1, reason: 'test' }])), code('uniqueConsumptionRequiresCoordinator'));
  assert.throws(() => createState({ worldId: 'w', containers: [container('pack')], items: [unique, { ...unique, itemInstanceId: 'copy' }] }), code('uniqueConflict'));
});

test('consumption is a real receipt and never a resource vacancy; locked/inaccessible inventory is rejected', async () => {
  const { planTransaction } = await api;
  const state = await fixture({ items: [item('medicine', 'pack', 2, { maxStack: 10 })] }), storage = memoryStorage(state);
  const result = await run(storage, 'dose', [{ kind: 'consume', itemInstanceId: 'medicine', fromContainerId: 'pack', quantity: 1, reason: 'effect-frame' }]);
  assert.equal(result.state.items[0].quantity, 1); assert.equal(result.events.length, 0);
  assert.equal(result.receipt.changes[0].lots[0].quantity, 1);
  await run(storage, 'stow', [transfer('medicine', 'pack', 'cargo', 1)]);
  assert.throws(() => planTransaction(storage.read(), request(storage.read(), 'remote-dose', [{ kind: 'consume', itemInstanceId: 'medicine', fromContainerId: 'cargo', quantity: 1, reason: 'effect-frame' }])), code('inaccessible'));
  const locked = structuredClone(state); locked.items[0].status = 'locked';
  assert.throws(() => planTransaction(locked, request(locked, 'locked', [transfer('medicine', 'pack', 'cargo', 1)])), code('inaccessible'));
  const sealed = structuredClone(state); sealed.containers[0].access = 'sealed';
  assert.throws(() => planTransaction(sealed, request(sealed, 'sealed', [transfer('medicine', 'pack', 'cargo', 1)])), code('inaccessible'));
});

test('holder sums owned containers once, including shell and transmitted mass, and can unload passive overload', async () => {
  const { measureHolder, measureContainer, planTransaction } = await api;
  const state = await fixture({ holders: [{ holderId: 'player', safeCarryGrams: '30000', baseMassGrams: '10000' }],
    containers: [container('pack', { holderId: 'player', shellMassGrams: '2000' }), container('cargo', { kind: 'cargo', maxMassGrams: '100000' })],
    items: [item('ore', 'cargo', 13, { unitMassGrams: '2000' })] });
  const storage = memoryStorage(state);
  await run(storage, 'exact-limit', [transfer('ore', 'cargo', 'pack', 12)]);
  let h = measureHolder(storage.read(), 'player');
  assert.equal(h.massGrams, '36000'); assert.equal(h.moveMultiplier, 0.5); assert.equal(h.canDodge, false);
  assert.throws(() => planTransaction(storage.read(), request(storage.read(), 'over', [transfer('ore', 'cargo', 'pack', 1)])), code('holderOverloaded'));
  const passive = storage.read(); passive.holders[0].safeCarryGrams = '20000';
  assert.equal(measureHolder(passive, 'player').moveMultiplier, 0);
  const overloadedStore = memoryStorage(passive), packOre = passive.items.find(i => i.containerId === 'pack');
  await run(overloadedStore, 'unload', [transfer(packOre.itemInstanceId, 'pack', 'cargo', 12)]);
  assert.equal(measureHolder(overloadedStore.read(), 'player').massGrams, '12000');
  const space = await fixture({ containers: [container('ring', { kind: 'space', transmissionPpm: 1000, shellMassGrams: '50' })], items: [item('heavy', 'ring', 1, { unitMassGrams: '1001' })] });
  assert.equal(measureContainer(space, 'ring').effectiveMassGrams, '52');
});

test('two concurrent last-stock commits: CAS permits exactly one owner and one outbox event', async () => {
  const { planTransaction, commitTransaction } = await api;
  const state = await fixture(), storage = memoryStorage(state);
  const plans = ['player', 'npc'].map((tx, index) => planTransaction(state, request(state, tx, [transfer('herb-1', 'plant', index ? 'cargo' : 'pack', 5)])));
  const results = await Promise.allSettled(plans.map(plan => commitTransaction(state, plan, storage)));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'commitRejected');
  assert.equal(storage.read().items.reduce((n, i) => n + i.quantity, 0), 5);
  assert.equal(storage.read().outbox.length, 1); assert.equal(storage.writes(), 1);
});

test('changed retry payload, stale plan, spoofed preview and denied authorization cannot duplicate or bypass checks', async () => {
  const { planTransaction, commitTransaction } = await api;
  const state = await fixture(), storage = memoryStorage(state);
  const plan = planTransaction(state, request(state, 'original', [transfer('herb-1', 'plant', 'pack', 5)]));
  plan.preview.changes[0].quantity = 1000;
  const result = await commitTransaction(state, plan, storage);
  assert.equal(result.state.items[0].quantity, 5);
  const changed = structuredClone(plan); changed.request.operations[0].quantity = 1;
  await assert.rejects(commitTransaction(storage.read(), changed, storage), code('transactionIdConflict'));
  const stale = structuredClone(plan); stale.request.transactionId = 'stale';
  await assert.rejects(commitTransaction(storage.read(), stale, storage), code('revisionConflict'));
  const deniedStore = memoryStorage(state);
  await assert.rejects(commitTransaction(state, plan, { ...deniedStore, authorize: async () => false }), code('accessDenied'));
  assert.equal(deniedStore.writes(), 0);
});

test('ambiguous response after persisted commit is resolved by reload + original transaction replay', async () => {
  const { planTransaction, commitTransaction } = await api;
  const state = await fixture(), storage = memoryStorage(state);
  const plan = planTransaction(state, request(state, 'lost-response', [transfer('herb-1', 'plant', 'pack', 5)]));
  await assert.rejects(commitTransaction(state, plan, { compareAndSwap: async payload => { await storage.compareAndSwap(payload); throw new Error('response lost'); } }), /response lost/);
  const retry = await commitTransaction(storage.read(), plan, storage);
  assert.equal(retry.replayed, true); assert.equal(retry.events.length, 0); assert.equal(storage.writes(), 1);
});

test('big integer volume/mass round trips without precision loss and rejects unsafe quantities', async () => {
  const { measureContainer, serializeState, deserializeState, createState } = await api;
  const huge = '9007199254740993123456789';
  const state = await fixture({ containers: [container('pack', { maxVolumeMl: huge, maxMassGrams: huge })],
    items: [item('dense', 'pack', 2, { unitVolumeMl: huge, unitMassGrams: huge })] });
  assert.equal(measureContainer(state, 'pack').massGrams, (BigInt(huge) * 2n).toString());
  assert.deepEqual(deserializeState(serializeState(state)), state);
  assert.throws(() => createState({ worldId: 'w', containers: [container('pack')], items: [item('bad', 'pack', Number.MAX_SAFE_INTEGER + 1)] }), code('invalidJsonNumber'));
});

test('later invalid operation rolls back earlier changes; finite movement sequence conserves all stock and provenance', async () => {
  const { planTransaction } = await api;
  const state = await fixture({ items: [item('stock', 'pack', 20)] }), storage = memoryStorage(state);
  assert.throws(() => planTransaction(state, request(state, 'bad-batch', [transfer('stock', 'pack', 'cargo', 5), transfer('stock', 'pack', 'cargo', 16)])), code('insufficientQuantity'));
  assert.deepEqual(storage.read(), state);
  for (let n = 0; n < 30; n++) {
    const source = storage.read().items[n % storage.read().items.length];
    await run(storage, `move-${n}`, [transfer(source.itemInstanceId, source.containerId, source.containerId === 'pack' ? 'cargo' : 'pack', Math.min(source.quantity, n % 4 + 1))]);
    assert.equal(storage.read().items.reduce((sum, i) => sum + i.quantity, 0), 20);
    assert.equal(storage.read().items.flatMap(i => i.lots).reduce((sum, l) => sum + l.quantity, 0), 20);
    assert.ok(storage.read().items.flatMap(i => i.lots).every(l => l.rootItemId === 'stock'));
  }
});

test('unique rewards cannot be configured as renewable harvesting stock', async () => {
  await assert.rejects(fixture({ items: [item('original', 'plant', 1, { uniqueDefinitionId: 'MYW01', rootArtifactId: 'original', maxStack: 1 })] }), code('uniqueNotRenewableResource'));
});

test('async authorization holds a stable version snapshot despite caller mutation', async () => {
  const { planTransaction, commitTransaction } = await api;
  const state = await fixture(), storage = memoryStorage(state);
  const plan = planTransaction(state, request(state, 'stable', [transfer('herb-1', 'plant', 'pack', 5)]));
  const result = await commitTransaction(state, plan, { ...storage, authorize: async () => { state.revision = 99; return true; } });
  assert.equal(result.state.revision, 1); assert.equal(storage.read().revision, 1);
});
