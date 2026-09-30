import { RNG_VERSION, randomUnit, fingerprint } from './rng.mjs';

const copy = value => structuredClone(value);
const id = (...parts) => JSON.stringify(parts);
const fail = reason => { throw new Error(reason); };
const check = (condition, reason) => { if (!condition) fail(reason); };
const stable = value => JSON.stringify(value, (_, v) => v && !Array.isArray(v) && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const string = v => typeof v === 'string' && v.length > 0;
const number = v => Number.isFinite(v) && v >= 0;
const own = (o, key) => Object.hasOwn(o, key);
const put = (o, key, value) => Object.defineProperty(o, key, { value, writable: true, enumerable: true, configurable: true });

// Consumed fragments remain bound to their original ledger entry forever.
// The same fragment legitimately appears in both fragment and reforge history.
const uniqueIdentities = item => new Set([item.itemInstanceId, item.rootArtifactId, ...item.fragments,
  ...item.history.flatMap(entry => entry.fragmentIds ?? [])]);

export function validateDefinitions(definitions) {
  check(definitions?.schemaVersion === 1 && string(definitions.rulesVersion), 'invalidDefinitions');
  const ids = new Set();
  for (const a of definitions.anchors) {
    check(string(a.id) && !ids.has(a.id), 'duplicateAnchor'); ids.add(a.id);
    check(string(a.planetId) && string(a.zoneId) && ['resource', 'monster'].includes(a.kind), 'unsupportedAnchor');
    check(a.cooldown?.length === 2 && a.cooldown.every(v => Number.isSafeInteger(v) && v >= 0) && a.cooldown[1] >= a.cooldown[0], 'invalidCooldown');
    check(Number.isSafeInteger(a.populationCap) && a.populationCap > 0, 'invalidPopulationCap');
    check(typeof a.offlineCredit === 'boolean' && a.combinations?.length > 0, 'invalidCombinations');
    const combinations = new Set();
    for (const c of a.combinations) {
      check(string(c.id) && !combinations.has(c.id), 'duplicateCombination'); combinations.add(c.id);
      check([c.family, c.layout, c.route, c.appearance].every(string), 'invalidComposition');
      check(Number.isSafeInteger(c.count) && c.count > 0 && c.count <= a.populationCap, 'invalidCount');
      check(Number.isFinite(c.weight) && c.weight > 0, 'invalidWeight');
    }
  }
  return true;
}

function validateSave(s) {
  check(s.schemaVersion === 1 && s.rngVersion === RNG_VERSION, 'unsupportedSaveVersion');
  check(Number.isSafeInteger(s.revision) && s.revision >= 0 && number(s.simHighWater) && number(s.offlineHighWater), 'invalidSaveClock');
  for (const key of ['anchors', 'transactions', 'usedVacancyTokens', 'uniqueLedger']) {
    check(s[key] && typeof s[key] === 'object' && !Array.isArray(s[key]), 'invalidSaveShape');
  }
  const identities = new Set();
  for (const [key, v] of Object.entries(s.uniqueLedger)) {
    check(key === v.uniqueDefinitionId && v.worldId === s.worldId && string(v.rootArtifactId) && string(v.itemInstanceId), 'uniqueLedgerConflict');
    check(['reserved', 'manifested', 'claimed', 'transferred', 'recoverable', 'retired', 'absorbed'].includes(v.status)
      && Number.isSafeInteger(v.revision) && v.revision >= 0 && Array.isArray(v.history) && Array.isArray(v.fragments), 'invalidUniqueSave');
    check(v.history.every(h => h && (h.fragmentIds === undefined
      || (Array.isArray(h.fragmentIds) && h.fragmentIds.every(string)))), 'invalidUniqueSave');
    for (const identity of uniqueIdentities(v)) {
      check(string(identity) && !identities.has(identity), 'uniqueLedgerConflict'); identities.add(identity);
    }
  }
  for (const [key, slot] of Object.entries(s.anchors)) {
    check(Number.isSafeInteger(slot.generation) && slot.generation >= -1 && Array.isArray(slot.history), 'invalidAnchorSave');
    if (slot.generation === -1) check(slot.current === null && slot.token === null, 'invalidInitialSave');
    else {
      const c = slot.current;
      check(c && c.anchorId === key && c.generation === slot.generation && string(c.instanceId)
        && c.compositionFingerprint === fingerprint(c.combination) && number(c.cooldownSeconds)
        && Number.isSafeInteger(c.remaining) && c.remaining >= 0 && Array.isArray(c.members), 'invalidInstanceSave');
      check((c.lifeState === 'active' && c.remaining > 0) || (c.lifeState === 'consumed' && c.remaining === 0), 'invalidLifeState');
      if (c.kind === 'monster') check(c.members.filter(m => !m.consumed).length === c.remaining, 'invalidMemberSave');
      if (slot.token) check(c.lifeState === 'consumed' && slot.token.sourceInstanceId === c.instanceId
        && number(slot.token.dueAt) && number(slot.token.offlineCreditSeconds)
        && slot.token.offlineCreditSeconds <= 1800 && !own(s.usedVacancyTokens, slot.token.id), 'invalidTokenSave');
      else check(c.lifeState === 'active', 'missingVacancySave');
    }
    check(Boolean(slot.plan) === Boolean(slot.reservation), 'invalidReservationSave');
    if (slot.plan) check(slot.plan.anchorId === key && slot.plan.generation === slot.generation + 1
      && slot.reservation.planId === slot.plan.planId && slot.plan.tokenId === (slot.token?.id ?? null), 'invalidReservationSave');
  }
}

/** Synchronous core. persist(nextSnapshot) must return true, or throw; called before publication.
 * No IO by default: the host owns durable storage and cross-module atomic coordination.
 * All times are seconds from an injected monotonic effective-play clock.
 */
export function createDirector({ definitions, worldId, worldSeed, savedState, clock, spatialQuery,
  random = randomUnit, persist = () => true }) {
  validateDefinitions(definitions);
  definitions = copy(definitions);
  check(typeof clock === 'function' && typeof spatialQuery === 'function', 'missingAdapters');
  let state = savedState ? copy(savedState) : {
    schemaVersion: 1, rngVersion: RNG_VERSION, worldId, worldSeed,
    revision: 0, simHighWater: 0, anchors: {}, transactions: {}, usedVacancyTokens: {},
    uniqueLedger: {}, offlineHighWater: 0,
  };
  validateSave(state);
  check(string(state.worldId) && string(state.worldSeed), 'invalidWorld');
  check((worldId === undefined || worldId === state.worldId) && (worldSeed === undefined || worldSeed === state.worldSeed), 'worldMismatch');
  // Existing combinations/rule snapshots are retained across definition updates.
  for (const a of definitions.anchors) if (!own(state.anchors, a.id)) put(state.anchors, a.id, {
    generation: -1, current: null, token: null, plan: null, reservation: null, history: [],
  });
  const definition = key => definitions.anchors.find(a => a.id === key) ?? fail('unknownAnchor');
  const now = () => {
    const t = clock(); check(number(t) && t >= state.simHighWater, 'clockWentBackwards'); return t;
  };
  const draw = (a, generation, purpose) => {
    const result = random([state.worldSeed, definitions.rulesVersion, a.planetId, a.zoneId, a.id, generation, purpose]);
    check(number(result) && result < 1, 'invalidRandom'); return result;
  };
  function transact(txnId, payload, revision, change) {
    check(string(txnId), 'invalidTransactionId');
    const signature = stable(payload);
    if (own(state.transactions, txnId)) {
      const previous = state.transactions[txnId];
      check(previous.signature === signature, 'transactionConflict'); return copy(previous.result);
    }
    check(revision === state.revision, 'revisionConflict');
    const next = copy(state);
    next.simHighWater = now();
    const result = change(next, next.simHighWater);
    next.revision++;
    put(next.transactions, txnId, { signature, result: copy(result) });
    check(persist(copy(next)) === true, 'persistenceFailed');
    state = next;
    return copy(result);
  }
  function selection(a, slot) {
    const generation = slot.generation + 1;
    const choices = a.combinations.filter(c => fingerprint(c) !== slot.current?.compositionFingerprint);
    if (!choices.length) return null;
    const total = choices.reduce((sum, c) => sum + c.weight, 0);
    let weight = draw(a, generation, 'composition') * total;
    const c = choices.find(c => (weight -= c.weight) < 0) ?? choices.at(-1);
    return { planId: id(state.worldId, a.id, generation, 'plan'), anchorId: a.id, generation,
      tokenId: slot.token?.id ?? null, combination: copy(c), compositionFingerprint: fingerprint(c),
      rulesVersion: definitions.rulesVersion, kind: a.kind, qualityProfileId: a.qualityProfileId ?? null,
      lootProfileId: a.lootProfileId ?? null,
      qualitySeed: draw(a, generation, 'quality'), lootSeed: draw(a, generation, 'loot'),
      cooldownSeconds: a.cooldown[0] + Math.floor(draw(a, generation, 'interval') * (a.cooldown[1] - a.cooldown[0] + 1)),
      offlineCredit: a.offlineCredit,
    };
  }
  function eligibility(slot, t) {
    if (slot.reservation) return 'reserved';
    if (slot.generation < 0) return null;
    if (!slot.token || own(state.usedVacancyTokens, slot.token.id)) return 'noConsumption';
    if (t + slot.token.offlineCreditSeconds < slot.token.dueAt) return 'cooling';
    return null;
  }
  function safety(plan, context) {
    // The adapter evaluates the entire group/layout, including reserved positions and budget.
    const q = spatialQuery(copy(plan), copy(context), copy(state));
    check(q && typeof q === 'object', 'invalidSpatialQuery');
    const required = ['ecologyAllowed', 'groundSupported', 'collisionFree', 'reachable',
      'outsideProtectedVolumes', 'pathClear', 'budgetAllowed', 'corpseClear'];
    for (const key of required) if (q[key] !== true) return { reason: key === 'budgetAllowed' ? 'budgetExceeded' : 'unsafePlacement', detail: key };
    if (plan.kind === 'monster' && (!number(q.playerDistance) || q.playerDistance < 45)) return { reason: 'unsafePlacement', detail: 'playerDistance' };
    if (q.visible !== false && q.legalVisibleEntry !== true) return { reason: 'unsafePlacement', detail: 'visibility' };
    if (!Number.isSafeInteger(q.unsettledLootContainers) || q.unsettledLootContainers < 0) return { reason: 'unsafePlacement', detail: 'lootQueryMissing' };
    if (plan.kind === 'monster' && q.unsettledLootContainers >= 3) return { reason: 'lootContainerLimit' };
    if (!string(q.placementId)) return { reason: 'unsafePlacement', detail: 'missingPlacement' };
    return { placementId: q.placementId };
  }
  function planTick(context = {}) {
    const t = now(), plans = [], rejectionReasons = [];
    for (const a of definitions.anchors) {
      const slot = state.anchors[a.id];
      const reason = eligibility(slot, t);
      if (reason) { rejectionReasons.push({ anchorId: a.id, reason }); continue; }
      const plan = selection(a, slot);
      if (!plan) { rejectionReasons.push({ anchorId: a.id, reason: 'noDistinctCandidate' }); continue; }
      const safe = safety(plan, context);
      if (safe.reason) rejectionReasons.push({ anchorId: a.id, ...safe });
      else plans.push({ ...plan, placementId: safe.placementId });
    }
    return { revision: state.revision, plans, rejectionReasons };
  }
  function reservePlan(plan, expectedRevision, context = {}) {
    return transact(id('reserve', plan.planId), { op: 'reserve', plan }, expectedRevision, next => {
      const valid = planTick(context).plans.find(p => p.planId === plan.planId);
      check(valid && stable(valid) === stable(plan), 'invalidOrUnsafePlan');
      const slot = next.anchors[plan.anchorId];
      slot.plan = copy(plan);
      slot.reservation = { reservationId: id('reservation', plan.planId), planId: plan.planId, revision: next.revision + 1 };
      return slot.reservation;
    });
  }
  function commitPlan({ transactionId, anchorId, reservationId, expectedRevision }, context = {}) {
    return transact(transactionId, { op: 'commitPlan', anchorId, reservationId }, expectedRevision, next => {
      const slot = next.anchors[anchorId];
      check(slot?.reservation?.reservationId === reservationId, 'missingReservation');
      const plan = slot.plan;
      const safe = safety(plan, context);
      check(!safe.reason && safe.placementId === plan.placementId, safe.reason ?? 'placementChanged');
      check(plan.generation === slot.generation + 1 && plan.tokenId === (slot.token?.id ?? null), 'stalePlan');
      if (plan.tokenId) {
        check(!own(next.usedVacancyTokens, plan.tokenId), 'tokenAlreadyUsed');
        put(next.usedVacancyTokens, plan.tokenId, { transactionId, generation: plan.generation });
      } else check(slot.generation < 0, 'noConsumption');
      if (slot.current) slot.history.push(copy(slot.current));
      const instanceId = id(next.worldId, anchorId, plan.generation);
      slot.current = { ...copy(plan), instanceId, remaining: plan.combination.count,
        members: plan.kind === 'monster' ? Array.from({ length: plan.combination.count }, (_, i) => ({ instanceId: id(instanceId, i),
          lootSeed: randomUnit([plan.lootSeed, instanceId, i, 'member-loot']), consumed: false })) : [],
        viewAcknowledged: false, consumptionEvents: [], lifeState: 'active' };
      slot.generation = plan.generation;
      slot.token = null; slot.plan = null; slot.reservation = null;
      return slot.current;
    });
  }
  function consumeCommitted(event, expectedRevision) {
    check(event?.committed === true && event.worldId === state.worldId && string(event.sourceInstanceId), 'uncommittedOrWrongWorld');
    return transact(id('event', event.eventId), { op: 'consume', event }, expectedRevision, (next, t) => {
      check(string(event.eventId), 'invalidEvent');
      const entry = Object.entries(next.anchors).find(([, s]) => s.current?.instanceId === event.sourceInstanceId || s.current?.members.some(m => m.instanceId === event.sourceInstanceId));
      check(entry, 'unknownOrOldInstance');
      const [anchorId, slot] = entry, current = slot.current;
      check(current.lifeState === 'active', 'alreadyConsumed');
      if (current.kind === 'resource') {
        check(event.kind === 'resourceDepleted' && (event.remaining === undefined || event.remaining === 0), 'notDepletion');
        current.remaining = 0;
      } else {
        check(['defeatCommitted', 'populationDeparted'].includes(event.kind), 'invalidConsumptionKind');
        const member = current.members.find(m => m.instanceId === event.sourceInstanceId);
        check(member && !member.consumed, 'memberAlreadyConsumed');
        member.consumed = true; member.eventId = event.eventId; current.remaining--;
      }
      current.consumptionEvents.push(event.eventId);
      if (current.remaining) return { anchorId, vacancyToken: null, remaining: current.remaining };
      current.lifeState = 'consumed';
      slot.token = { id: id(state.worldId, anchorId, slot.generation, 'vacancy'), sourceInstanceId: current.instanceId,
        sourceEventIds: copy(current.consumptionEvents), createdAt: t, dueAt: t + current.cooldownSeconds,
        offlineCreditSeconds: 0, offlineApplied: false };
      return { anchorId, vacancyToken: slot.token, remaining: 0 };
    });
  }
  function recordResourceRemaining({ transactionId, worldId, sourceInstanceId, remaining, committed, expectedRevision }) {
    const payload = { op: 'partial', worldId, sourceInstanceId, remaining, committed };
    return transact(transactionId, payload, expectedRevision, next => {
      check(committed === true && worldId === next.worldId, 'uncommittedOrWrongWorld');
      const current = Object.values(next.anchors).find(s => s.current?.instanceId === sourceInstanceId)?.current;
      check(current?.kind === 'resource' && current.lifeState === 'active', 'invalidResource');
      check(Number.isSafeInteger(remaining) && remaining > 0 && remaining < current.remaining, 'invalidRemaining');
      current.remaining = remaining;
      return { remaining, vacancyToken: null };
    });
  }
  function applyOfflineEligibility({ intervalId, startWallTime, endWallTime, confirmedOffline, expectedRevision }) {
    return transact(id('offline', intervalId), { op: 'offline', intervalId, startWallTime, endWallTime, confirmedOffline }, expectedRevision, next => {
      check(string(intervalId) && confirmedOffline === true && number(startWallTime) && number(endWallTime) && endWallTime >= startWallTime, 'invalidOfflineInterval');
      const elapsed = Math.max(0, endWallTime - Math.max(startWallTime, next.offlineHighWater));
      next.offlineHighWater = Math.max(next.offlineHighWater, endWallTime);
      const credits = [];
      for (const [anchorId, slot] of Object.entries(next.anchors)) {
        if (!elapsed || !slot.token || slot.token.offlineApplied || !slot.current.offlineCredit) continue;
        slot.token.offlineCreditSeconds = Math.min(1800, elapsed);
        slot.token.offlineApplied = true;
        slot.token.offlineIntervalId = intervalId;
        credits.push({ anchorId, seconds: slot.token.offlineCreditSeconds });
      }
      return { credits };
    });
  }
  function acknowledgeView({ transactionId, instanceId, expectedRevision }) {
    return transact(transactionId, { op: 'view', instanceId }, expectedRevision, next => {
      const current = Object.values(next.anchors).find(s => s.current?.instanceId === instanceId)?.current;
      check(current, 'unknownInstance'); current.viewAcknowledged = true; return { instanceId };
    });
  }
  // Batch reservation locks MYF and its corresponding MYW/MYC/MYP in one snapshot.
  function reserveUnique({ transactionId, sourceEventId, claims, expectedRevision }) {
    return transact(transactionId, { op: 'uniqueReserve', sourceEventId, claims }, expectedRevision, next => {
      check(string(sourceEventId) && Array.isArray(claims) && claims.length > 0, 'invalidUniqueClaims');
      const keys = new Set();
      for (const c of claims) {
        check([c.uniqueDefinitionId, c.itemInstanceId, c.rootArtifactId].every(string), 'invalidUniqueIdentity');
        check(!keys.has(c.uniqueDefinitionId) && !own(next.uniqueLedger, c.uniqueDefinitionId), 'uniqueReserved');
        check(!Object.values(next.uniqueLedger).some(v => {
          const identities = uniqueIdentities(v);
          return identities.has(c.itemInstanceId) || identities.has(c.rootArtifactId);
        }), 'uniqueIdentityConflict');
        keys.add(c.uniqueDefinitionId);
        put(next.uniqueLedger, c.uniqueDefinitionId, { ...copy(c), worldId: next.worldId, sourceEventId,
          status: 'reserved', ownerId: null, revision: 0, history: [], fragments: [] });
      }
      return claims.map(c => next.uniqueLedger[c.uniqueDefinitionId]);
    });
  }
  function transitionUnique({ transactionId, uniqueDefinitionId, action, ownerId = null, fragmentIds = [], expectedUniqueRevision, expectedRevision }) {
    return transact(transactionId, { op: 'uniqueTransition', uniqueDefinitionId, action, ownerId, fragmentIds, expectedUniqueRevision }, expectedRevision, next => {
      const item = next.uniqueLedger[uniqueDefinitionId];
      check(own(next.uniqueLedger, uniqueDefinitionId) && item.revision === expectedUniqueRevision, 'uniqueRevisionConflict');
      const routes = {
        manifest: ['reserved'], claim: ['manifested', 'recoverable'],
        transfer: ['claimed', 'transferred', 'recoverable'], recover: ['manifested', 'claimed', 'transferred'],
        retire: ['reserved', 'manifested', 'claimed', 'transferred', 'recoverable', 'absorbed'],
        absorb: ['claimed', 'transferred'], fragment: ['claimed', 'transferred', 'recoverable'],
        reforge: ['claimed', 'transferred', 'recoverable'],
      };
      check(routes[action]?.includes(item.status), 'invalidUniqueTransition');
      if (['claim', 'transfer', 'recover'].includes(action)) check(string(ownerId), 'missingOwnerOrCustodian');
      if (action === 'fragment') {
        check(!item.fragments.length && fragmentIds.length > 1 && fragmentIds.every(string) && new Set(fragmentIds).size === fragmentIds.length && !fragmentIds.includes(item.itemInstanceId), 'invalidFragments');
        const existing = Object.values(next.uniqueLedger).flatMap(v => [...uniqueIdentities(v)]);
        check(!fragmentIds.some(f => existing.includes(f)), 'fragmentIdentityConflict');
        item.fragments = [...fragmentIds];
      } else if (action === 'reforge') {
        check(item.fragments.length > 1 && stable([...fragmentIds].sort()) === stable([...item.fragments].sort()), 'missingOriginalFragments');
        item.fragments = [];
      } else {
        item.status = { manifest: 'manifested', claim: 'claimed', transfer: 'transferred', recover: 'recoverable', retire: 'retired', absorb: 'absorbed' }[action];
        if (ownerId !== null) item.ownerId = ownerId;
      }
      item.revision++;
      item.history.push({ transactionId, action, ownerId, fragmentIds: copy(fragmentIds) });
      return item;
    });
  }
  return { planTick, reservePlan, commitPlan, consumeCommitted, recordResourceRemaining,
    applyOfflineEligibility, acknowledgeView, reserveUnique, transitionUnique,
    serializeDirector: () => copy(state),
    explainAnchor: anchorId => {
      definition(anchorId);
      const result = planTick();
      return { anchorId, reason: result.rejectionReasons.find(r => r.anchorId === anchorId)?.reason ?? 'eligible',
        ...copy(state.anchors[anchorId]) };
    },
  };
}
