const { test } = require('node:test');
const assert = require('node:assert/strict');
const modules = Promise.all([
  import('../src/world-director/director.mjs'), import('../src/world-director/definitions.mjs'),
  import('../src/world-director/rng.mjs'),
]);
async function fixture(options = {}) {
  const [{ createDirector }, { sampleDefinitions }] = await modules;
  let time = options.time ?? 0;
  const safe = { ecologyAllowed: true, groundSupported: true, collisionFree: true, reachable: true,
    outsideProtectedVolumes: true, pathClear: true, budgetAllowed: true, corpseClear: true,
    playerDistance: 100, visible: false, legalVisibleEntry: false, unsettledLootContainers: 0 };
  const args = { definitions: structuredClone(sampleDefinitions), worldId: 'world-1', worldSeed: 'seed-1',
    clock: () => time, spatialQuery: p => ({ ...safe, placementId: p.combination.layout }), ...options };
  const director = createDirector(args);
  const revision = () => director.serializeDirector().revision;
  const spawn = anchorId => {
    const tick = director.planTick();
    const plan = tick.plans.find(p => p.anchorId === anchorId);
    assert.ok(plan, JSON.stringify(tick));
    const reservation = director.reservePlan(plan, revision());
    return director.commitPlan({ transactionId: `commit:${plan.planId}`, anchorId,
      reservationId: reservation.reservationId, expectedRevision: revision() });
  };
  const consume = (instance, eventId = `consume:${instance.instanceId}`, extra = {}) => director.consumeCommitted({
    eventId, worldId: 'world-1', sourceInstanceId: instance.instanceId, kind: 'resourceDepleted', committed: true, ...extra,
  }, revision());
  return { director, revision, spawn, consume, safe, args, setTime: v => { time = v; } };
}
const herb = 'Z0-HERB-01', lair = 'Z0-LAIR-01';

test('fixed RNG vectors and fingerprints exclude ID/quality but include actual composition', async () => {
  const [, , { seed32, randomUnit, fingerprint }] = await modules;
  assert.equal(seed32([]), 1947613349);
  assert.equal(randomUnit([]), 0.3287313864566386);
  const c = { family: 'M00', count: 2, layout: 'east', route: 'e', appearance: 'a' };
  assert.equal(fingerprint(c), fingerprint({ ...c, id: 'other', quality: 6 }));
  assert.notEqual(fingerprint(c), fingerprint({ ...c, count: 3 }));
});

test('initial placement is once; waiting, pause, reload and offline do not replace unconsumed content', async () => {
  const f = await fixture(), first = f.spawn(herb);
  f.setTime(7200);
  assert.equal(f.director.explainAnchor(herb).reason, 'noConsumption');
  f.director.applyOfflineEligibility({ intervalId: '96h', startWallTime: 0, endWallTime: 96 * 3600, confirmedOffline: true, expectedRevision: f.revision() });
  assert.deepEqual(f.director.serializeDirector().anchors[herb].current, first);
  const reload = await fixture({ savedState: JSON.parse(JSON.stringify(f.director.serializeDirector())), time: 7200 });
  assert.equal(reload.director.explainAnchor(herb).reason, 'noConsumption');
  assert.deepEqual(reload.director.serializeDirector(), f.director.serializeDirector());
});

test('partial collection preserves generation; failed/uncommitted collection creates no token', async () => {
  const f = await fixture(), first = f.spawn(herb);
  const before = f.director.serializeDirector();
  assert.throws(() => f.consume(first, 'cancel', { committed: false }), /uncommitted/);
  assert.throws(() => f.consume(first, 'partial-as-depletion', { remaining: 1 }), /notDepletion/);
  assert.deepEqual(f.director.serializeDirector(), before);
  f.director.recordResourceRemaining({ transactionId: 'partial', worldId: 'world-1', sourceInstanceId: first.instanceId,
    committed: true, remaining: 1, expectedRevision: f.revision() });
  f.setTime(10000);
  assert.equal(f.director.explainAnchor(herb).current.remaining, 1);
  assert.equal(f.director.explainAnchor(herb).reason, 'noConsumption');
  assert.equal(f.director.explainAnchor(herb).current.qualitySeed, first.qualitySeed);
});

test('committed depletion -> one token -> cooldown -> safe reservation -> distinct generation; event retry survives reload', async () => {
  const f = await fixture(), first = f.spawn(herb);
  f.setTime(12);
  const depleted = f.consume(first);
  assert.equal(depleted.vacancyToken.createdAt, 12);
  assert.equal(f.director.explainAnchor(herb).reason, 'cooling');
  const saved = f.director.serializeDirector();
  assert.deepEqual(f.consume(first), depleted);
  assert.deepEqual(f.director.serializeDirector(), saved);
  f.setTime(depleted.vacancyToken.dueAt);
  f.safe.visible = true;
  assert.equal(f.director.explainAnchor(herb).reason, 'unsafePlacement');
  f.safe.visible = false;
  const second = f.spawn(herb);
  assert.notEqual(first.instanceId, second.instanceId);
  assert.notEqual(first.compositionFingerprint, second.compositionFingerprint);
  assert.equal(second.generation, 1);
  assert.equal(Object.keys(f.director.serializeDirector().usedVacancyTokens).length, 1);
  const reload = await fixture({ savedState: f.director.serializeDirector(), time: depleted.vacancyToken.dueAt });
  assert.deepEqual(reload.consume(first), depleted);
  assert.equal(reload.director.explainAnchor(herb).reason, 'noConsumption');
  assert.throws(() => reload.consume(first, 'another-event'), /unknownOrOld/);
});

test('last monster starts group cooldown; member double-report cannot create a vacancy; loot cap is local', async () => {
  const f = await fixture(), group = f.spawn(lair);
  f.consume(group.members[0], 'kill0', { kind: 'defeatCommitted' });
  assert.equal(f.director.explainAnchor(lair).reason, 'noConsumption');
  assert.throws(() => f.consume(group.members[0], 'pet-kill0', { kind: 'defeatCommitted' }), /memberAlreadyConsumed/);
  f.setTime(100);
  for (const m of group.members.slice(1)) f.consume(m, `kill:${m.instanceId}`, { kind: 'populationDeparted' });
  const token = f.director.explainAnchor(lair).token;
  assert.equal(token.createdAt, 100);
  f.setTime(token.dueAt);
  f.safe.unsettledLootContainers = 3;
  assert.equal(f.director.explainAnchor(lair).reason, 'lootContainerLimit');
  assert.ok(f.director.planTick().plans.some(p => p.anchorId === herb));
  f.safe.unsettledLootContainers = 1;
  assert.equal(f.director.explainAnchor(lair).reason, 'eligible');
  f.safe.corpseClear = false;
  assert.equal(f.director.explainAnchor(lair).reason, 'unsafePlacement');
});

test('no distinct combination waits without quality rerolls, including cosmetic ID-only alternatives', async () => {
  const [, { sampleDefinitions }] = await modules;
  const defs = structuredClone(sampleDefinitions);
  const c = defs.anchors[0].combinations[0];
  defs.anchors[0].combinations = [c, { ...c, id: 'same-content' }];
  const f = await fixture({ definitions: defs }), first = f.spawn(herb);
  f.consume(first); f.setTime(5000);
  const before = f.director.serializeDirector();
  assert.equal(f.director.explainAnchor(herb).reason, 'noDistinctCandidate');
  assert.equal(f.director.explainAnchor(herb).reason, 'noDistinctCandidate');
  assert.deepEqual(f.director.serializeDirector(), before);
});

test('96h offline grants at most 1800s on one consumed generation, never spawns or repeats overlapping time', async () => {
  const f = await fixture(), first = f.spawn(herb);
  f.consume(first);
  const request = { intervalId: 'away', startWallTime: 1000, endWallTime: 346600, confirmedOffline: true };
  const result = f.director.applyOfflineEligibility({ ...request, expectedRevision: f.revision() });
  assert.equal(result.credits[0].seconds, 1800);
  assert.equal(f.director.explainAnchor(herb).generation, 0);
  assert.equal(f.director.explainAnchor(herb).reason, 'eligible');
  assert.deepEqual(f.director.applyOfflineEligibility({ ...request, expectedRevision: 0 }), result);
  const second = f.spawn(herb); f.consume(second);
  const overlap = f.director.applyOfflineEligibility({ ...request, intervalId: 'renamed-interval', expectedRevision: f.revision() });
  assert.deepEqual(overlap.credits, []);
  assert.equal(f.director.explainAnchor(herb).reason, 'cooling');
  assert.throws(() => f.director.applyOfflineEligibility({ ...request, intervalId: 'pause', confirmedOffline: false, expectedRevision: f.revision() }), /invalidOffline/);
});

test('reserved generation survives reload, commit rechecks safety and failed persistence rolls everything back', async () => {
  const f = await fixture();
  const plan = f.director.planTick().plans.find(p => p.anchorId === herb);
  const r = f.director.reservePlan(plan, f.revision());
  assert.deepEqual(f.director.reservePlan(plan, 0), r);
  const reload = await fixture({ savedState: f.director.serializeDirector() });
  reload.safe.visible = true;
  const request = { transactionId: 'publish', anchorId: herb, reservationId: r.reservationId, expectedRevision: reload.revision() };
  const before = reload.director.serializeDirector();
  assert.throws(() => reload.director.commitPlan(request), /unsafePlacement/);
  assert.deepEqual(reload.director.serializeDirector(), before);
  const failed = await fixture({ savedState: before, persist: () => false });
  assert.throws(() => failed.director.commitPlan(request), /persistenceFailed/);
  assert.deepEqual(failed.director.serializeDirector(), before);
  reload.safe.visible = false;
  const committed = reload.director.commitPlan(request);
  assert.equal(committed.viewAcknowledged, false);
  assert.deepEqual(reload.director.commitPlan(request), committed);
  reload.director.acknowledgeView({ transactionId: 'view', instanceId: committed.instanceId, expectedRevision: reload.revision() });
  assert.equal(reload.director.explainAnchor(herb).current.viewAcknowledged, true);
});

test('tampered plans, stale revisions, reused transaction payloads and backwards clocks are rejected', async () => {
  const f = await fixture(), tick = f.director.planTick(), plan = tick.plans[0];
  assert.throws(() => f.director.reservePlan({ ...plan, qualitySeed: 1 }, f.revision()), /invalidOrUnsafe/);
  f.director.reservePlan(plan, f.revision());
  assert.throws(() => f.director.reservePlan(tick.plans[1], 0), /revisionConflict/);
  assert.throws(() => f.director.reservePlan({ ...plan, qualitySeed: 1 }, f.revision()), /transactionConflict/);
  f.setTime(-1);
  assert.throws(() => f.director.planTick(), /clockWentBackwards/);
});

test('all required safety checks fail closed', async () => {
  const f = await fixture();
  for (const key of ['ecologyAllowed', 'groundSupported', 'collisionFree', 'reachable', 'outsideProtectedVolumes', 'pathClear', 'budgetAllowed', 'corpseClear']) {
    f.safe[key] = false;
    assert.equal(f.director.planTick().plans.length, 0, key);
    f.safe[key] = true;
  }
  f.safe.playerDistance = 44.99;
  assert.ok(!f.director.planTick().plans.some(p => p.anchorId === lair));
  f.safe.playerDistance = 45; f.safe.visible = true;
  assert.equal(f.director.planTick().plans.length, 0);
  f.safe.legalVisibleEntry = true;
  assert.equal(f.director.planTick().plans.length, 2);
});

test('world unique batch locks both MYF and MYW, rejects other source, and remains occupied after transfers/retirement', async () => {
  const f = await fixture();
  const claims = [{ uniqueDefinitionId: 'MYF06', itemInstanceId: 'event-core', rootArtifactId: 'event-root' },
    { uniqueDefinitionId: 'MYW01', itemInstanceId: 'sword', rootArtifactId: 'sword-root' }];
  const reserve = { transactionId: 'myf', sourceEventId: 'opportunity-1', claims, expectedRevision: f.revision() };
  const original = f.director.reserveUnique(reserve);
  assert.deepEqual(f.director.reserveUnique(reserve), original);
  const before = f.director.serializeDirector();
  assert.throws(() => f.director.reserveUnique({ transactionId: 'direct', sourceEventId: 'direct-loot', claims: [claims[1]], expectedRevision: f.revision() }), /uniqueReserved/);
  assert.deepEqual(f.director.serializeDirector(), before);
  let revision = 0;
  for (const [action, ownerId] of [['manifest', null], ['claim', 'player-a'], ['transfer', 'npc-buyer'], ['recover', 'world-custodian'], ['retire', null]]) {
    f.director.transitionUnique({ transactionId: action, uniqueDefinitionId: 'MYW01', action, ownerId, expectedUniqueRevision: revision++, expectedRevision: f.revision() });
  }
  const reload = await fixture({ savedState: f.director.serializeDirector() });
  const sword = reload.director.serializeDirector().uniqueLedger.MYW01;
  assert.equal(sword.itemInstanceId, 'sword'); assert.equal(sword.rootArtifactId, 'sword-root');
  assert.equal(sword.status, 'retired');
  assert.throws(() => reload.director.reserveUnique({ ...reserve, transactionId: 'new-character', expectedRevision: reload.revision() }), /uniqueReserved/);
  assert.throws(() => reload.director.transitionUnique({ transactionId: 'revive', uniqueDefinitionId: 'MYW01', action: 'claim', ownerId: 'player-c', expectedUniqueRevision: revision, expectedRevision: reload.revision() }), /invalidUniqueTransition/);
});

test('fragments reforge the original identity exactly once; stale concurrent ownership changes fail', async () => {
  const f = await fixture();
  f.director.reserveUnique({ transactionId: 'reserve', sourceEventId: 'source', claims: [{ uniqueDefinitionId: 'MYW01', itemInstanceId: 'sword', rootArtifactId: 'root' }], expectedRevision: f.revision() });
  const change = (action, n, extra = {}) => f.director.transitionUnique({ transactionId: `${action}:${n}`, uniqueDefinitionId: 'MYW01', action,
    expectedUniqueRevision: n, expectedRevision: f.revision(), ...extra });
  change('manifest', 0); change('claim', 1, { ownerId: 'player' });
  change('fragment', 2, { fragmentIds: ['f1', 'f2', 'f3'] });
  assert.throws(() => change('reforge', 3, { fragmentIds: ['f1', 'f2'] }), /missingOriginalFragments/);
  const reforged = change('reforge', 3, { fragmentIds: ['f3', 'f1', 'f2'] });
  assert.equal(reforged.itemInstanceId, 'sword'); assert.equal(reforged.rootArtifactId, 'root');
  assert.throws(() => change('reforge', 4, { fragmentIds: ['f1', 'f2', 'f3'] }), /missingOriginalFragments/);
  assert.throws(() => change('transfer', 3, { ownerId: 'other' }), /uniqueRevisionConflict/);
});

test('unique batch failure and storage exceptions leave no partial claims', async () => {
  const f = await fixture();
  const claims = [{ uniqueDefinitionId: 'MYF06', itemInstanceId: 'core', rootArtifactId: 'root' },
    { uniqueDefinitionId: 'MYW01', itemInstanceId: 'sword', rootArtifactId: 'root' }];
  assert.throws(() => f.director.reserveUnique({ transactionId: 'bad', sourceEventId: 'source', claims, expectedRevision: 0 }), /uniqueIdentityConflict/);
  assert.deepEqual(f.director.serializeDirector().uniqueLedger, {});
  const failed = await fixture({ persist: () => { throw new Error('disk full'); } });
  assert.throws(() => failed.director.reserveUnique({ transactionId: 'save', sourceEventId: 'source', claims: [claims[0]], expectedRevision: 0 }), /disk full/);
  assert.deepEqual(failed.director.serializeDirector().uniqueLedger, {});
});

test('old instances preserve rule snapshots and RNG streams are independent of other anchor ordering', async () => {
  const [, { sampleDefinitions }] = await modules;
  const f = await fixture(), first = f.spawn(herb);
  const definitions = structuredClone(sampleDefinitions);
  definitions.anchors.reverse();
  const other = await fixture({ definitions });
  assert.deepEqual(other.spawn(herb), first);
  definitions.rulesVersion = 'new-rules';
  const reload = await fixture({ definitions, savedState: f.director.serializeDirector() });
  assert.deepEqual(reload.director.serializeDirector().anchors[herb].current, first);
});

test('corrupt saves and duplicate unique identities are rejected without replacing the saved world', async () => {
  const [{ createDirector }] = await modules;
  const f = await fixture(); f.spawn(herb);
  const corrupt = f.director.serializeDirector();
  corrupt.anchors[herb].current.remaining = -1;
  assert.throws(() => createDirector({ ...f.args, savedState: corrupt }), /invalidInstanceSave/);
  const unique = { worldId: 'world-1', itemInstanceId: 'one-sword', rootArtifactId: 'one-root',
    revision: 0, status: 'claimed', fragments: [], history: [] };
  const duplicate = f.director.serializeDirector();
  duplicate.uniqueLedger = { MYW01: { ...unique, uniqueDefinitionId: 'MYW01' }, MYW02: { ...unique, uniqueDefinitionId: 'MYW02' } };
  assert.throws(() => createDirector({ ...f.args, savedState: duplicate }), /uniqueLedgerConflict/);
  assert.equal(duplicate.uniqueLedger.MYW02.itemInstanceId, 'one-sword');
});

test('failed depletion save retains current resources; retry after recovery creates exactly one token', async () => {
  let writable = true;
  const f = await fixture({ persist: () => writable }), first = f.spawn(herb);
  const before = f.director.serializeDirector();
  writable = false;
  assert.throws(() => f.consume(first), /persistenceFailed/);
  assert.deepEqual(f.director.serializeDirector(), before);
  writable = true;
  f.consume(first);
  assert.equal(f.director.explainAnchor(herb).current.remaining, 0);
  assert.equal(f.director.explainAnchor(herb).token.sourceEventIds.length, 1);
});

test('reserved placement cannot move and a failed new-generation save cannot burn the vacancy', async () => {
  let writable = true, placementOverride = null;
  const f = await fixture({ persist: () => writable }), first = f.spawn(herb);
  f.consume(first); f.setTime(5000);
  const plan = f.director.planTick().plans.find(p => p.anchorId === herb);
  const reserved = f.director.reservePlan(plan, f.revision());
  const before = f.director.serializeDirector();
  const request = { transactionId: 'next', anchorId: herb, reservationId: reserved.reservationId, expectedRevision: f.revision() };
  writable = false;
  assert.throws(() => f.director.commitPlan(request), /persistenceFailed/);
  assert.deepEqual(f.director.serializeDirector(), before);
  const changed = await fixture({ savedState: before, time: 5000,
    spatialQuery: p => ({ ...f.safe, placementId: placementOverride ?? p.combination.layout }) });
  placementOverride = 'different-location';
  assert.throws(() => changed.director.commitPlan(request), /placementChanged/);
  assert.deepEqual(changed.director.serializeDirector(), before);
});

test('100 consumed generations remain distinct, use 100 tokens, and roundtrip member loot identities', async () => {
  const f = await fixture();
  let previous = f.spawn(herb);
  const ids = new Set([previous.instanceId]);
  for (let i = 1; i <= 100; i++) {
    const result = f.consume(previous);
    f.setTime(result.vacancyToken.dueAt);
    const next = f.spawn(herb);
    assert.notEqual(next.compositionFingerprint, previous.compositionFingerprint);
    assert.ok(!ids.has(next.instanceId)); ids.add(next.instanceId); previous = next;
  }
  assert.equal(Object.keys(f.director.serializeDirector().usedVacancyTokens).length, 100);
  const group = f.spawn(lair);
  assert.equal(new Set(group.members.map(m => m.lootSeed)).size, group.members.length);
  const reload = await fixture({ savedState: JSON.parse(JSON.stringify(f.director.serializeDirector())), time: 200000 });
  assert.deepEqual(reload.director.serializeDirector().anchors[lair].current.members, group.members);
});

test('offline-disabled definitions receive zero credit; one interval cannot be banked for a future depletion', async () => {
  const [, { sampleDefinitions }] = await modules;
  const definitions = structuredClone(sampleDefinitions); definitions.anchors[0].offlineCredit = false;
  const f = await fixture({ definitions }), first = f.spawn(herb);
  f.consume(first);
  const credit = f.director.applyOfflineEligibility({ intervalId: 'offline', startWallTime: 0, endWallTime: 999999, confirmedOffline: true, expectedRevision: f.revision() });
  assert.deepEqual(credit.credits, []);
  assert.equal(f.director.explainAnchor(herb).reason, 'cooling');
});

test('F01: current and consumed historical fragments cannot be reserved as another original or root', async () => {
  const [{ createDirector }] = await modules;
  const options = { definitions: { schemaVersion: 1, rulesVersion: 'repro', anchors: [] },
    worldId: 'w', worldSeed: 's', clock: () => 0, spatialQuery: () => ({}) };
  let d = createDirector(options);
  const snapshot = () => d.serializeDirector();
  const reserve = { transactionId: 'reserve-MYW01', sourceEventId: 'source-MYW01',
    claims: [{ uniqueDefinitionId: 'MYW01', itemInstanceId: 'original-sword', rootArtifactId: 'root-A' }], expectedRevision: 0 };
  const reserved = d.reserveUnique(reserve);
  const move = (action, extra = {}) => d.transitionUnique({ transactionId: action,
    uniqueDefinitionId: 'MYW01', action, expectedRevision: snapshot().revision,
    expectedUniqueRevision: snapshot().uniqueLedger.MYW01.revision, ...extra });
  move('manifest'); move('claim', { ownerId: 'player' });
  move('fragment', { fragmentIds: ['old-fragment-1', 'old-fragment-2'] });
  for (const phase of ['current', 'historical']) {
    if (phase === 'historical') move('reforge', { fragmentIds: ['old-fragment-1', 'old-fragment-2'] });
    d = createDirector({ ...options, savedState: JSON.parse(JSON.stringify(snapshot())) });
    const before = snapshot();
    for (const field of ['itemInstanceId', 'rootArtifactId']) {
      const claim = { uniqueDefinitionId: 'MYW02', itemInstanceId: 'second-sword', rootArtifactId: 'root-B', [field]: 'old-fragment-1' };
      const request = { transactionId: `reuse-${phase}-${field}`, sourceEventId: 'source-MYW02', claims: [claim], expectedRevision: before.revision };
      for (let retry = 0; retry < 2; retry++) {
        assert.throws(() => d.reserveUnique(request), /uniqueIdentityConflict/);
        assert.deepEqual(snapshot(), before);
      }
      // A conflict in a later claim must also roll back the earlier fresh claim.
      assert.throws(() => d.reserveUnique({ ...request, transactionId: `batch-${phase}-${field}`,
        claims: [{ uniqueDefinitionId: 'MYF06', itemInstanceId: 'fresh-core', rootArtifactId: 'fresh-root' }, claim] }), /uniqueIdentityConflict/);
      assert.deepEqual(snapshot(), before);
    }
  }
  const request = { transactionId: 'transfer', uniqueDefinitionId: 'MYW01', action: 'transfer', ownerId: 'npc',
    expectedRevision: snapshot().revision, expectedUniqueRevision: snapshot().uniqueLedger.MYW01.revision };
  const transferred = d.transitionUnique(request);
  d = createDirector({ ...options, savedState: JSON.parse(JSON.stringify(snapshot())) });
  const beforeRetry = snapshot();
  assert.deepEqual(d.transitionUnique(request), transferred);
  assert.deepEqual(d.reserveUnique(reserve), reserved);
  assert.deepEqual(snapshot(), beforeRetry);
  assert.equal(transferred.itemInstanceId, 'original-sword');
  assert.equal(transferred.rootArtifactId, 'root-A');
});

test('F01: import rejects cross-ledger current/history identity reuse without changing the input save', async () => {
  const [{ createDirector }] = await modules;
  const options = { definitions: { schemaVersion: 1, rulesVersion: 'repro', anchors: [] },
    worldId: 'w', worldSeed: 's', clock: () => 0, spatialQuery: () => ({}) };
  const base = createDirector(options).serializeDirector();
  const item = (key, original, root) => ({ worldId: 'w', uniqueDefinitionId: key, itemInstanceId: original,
    rootArtifactId: root, status: 'claimed', revision: 2, fragments: [],
    history: [{ action: 'fragment', fragmentIds: ['old-fragment-1', 'old-fragment-2'] },
      { action: 'reforge', fragmentIds: ['old-fragment-2', 'old-fragment-1'] }] });
  base.uniqueLedger.MYW01 = item('MYW01', 'original-sword', 'root-A');
  assert.deepEqual(createDirector({ ...options, savedState: base }).serializeDirector(), base);
  for (const collision of ['item', 'root', 'currentFragment', 'historicalFragment']) {
    const save = structuredClone(base);
    const other = { ...item('MYW02', 'second-sword', 'root-B'), history: [] };
    if (collision === 'item') other.itemInstanceId = 'old-fragment-1';
    if (collision === 'root') other.rootArtifactId = 'old-fragment-1';
    if (collision === 'currentFragment') other.fragments = ['old-fragment-1', 'new-fragment'];
    if (collision === 'historicalFragment') other.history = [{ action: 'fragment', fragmentIds: ['old-fragment-1', 'new-fragment'] }];
    save.uniqueLedger.MYW02 = other;
    for (const ledger of [save.uniqueLedger, Object.fromEntries(Object.entries(save.uniqueLedger).reverse())]) {
      save.uniqueLedger = ledger;
      const before = structuredClone(save);
      assert.throws(() => createDirector({ ...options, savedState: save }), /uniqueLedgerConflict/);
      assert.deepEqual(save, before);
    }
  }
});
