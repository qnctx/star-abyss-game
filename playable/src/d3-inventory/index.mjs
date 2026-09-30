/** Pure inventory snapshots. Persistence/world coordination belongs to the injected CAS adapter. */
export class InventoryError extends Error {
  constructor(code, details = {}) { super(code); this.name = 'InventoryError'; this.code = code; this.details = details; }
}
const fail = (code, details) => { throw new InventoryError(code, details); };
const assert = (ok, code, details) => { if (!ok) fail(code, details); };
const id = value => typeof value === 'string' && value.length > 0;
const integer = (value, min = 0) => Number.isSafeInteger(value) && value >= min;
const decimal = value => typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value);
function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { assert(Number.isSafeInteger(value), 'invalidJsonNumber'); return String(value); }
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  assert(value && Object.getPrototypeOf(value) === Object.prototype, 'invalidJsonValue');
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
}
const copy = value => JSON.parse(canonical(value));
const find = (rows, key, value) => { const row = rows.find(x => x[key] === value); assert(row, 'notFound', { key, value }); return row; };
const ceilDiv = (n, d) => (n + d - 1n) / d;
const stackKey = item => canonical({ definitionId: item.definitionId, quality: item.quality, tier: item.tier,
  status: item.status, attributes: item.attributes, maxStack: item.maxStack,
  unitVolumeMl: item.unitVolumeMl, unitMassGrams: item.unitMassGrams, slotsPerStack: item.slotsPerStack });

export function createState({ worldId, containers = [], holders = [], items = [] }) {
  const state = { schemaVersion: 1, worldId, revision: 0,
    containers: containers.map(c => ({ kind: 'backpack', access: 'open', holderId: null,
      shellMassGrams: '0', transmissionPpm: 1000000, sourceInstanceId: null, depleted: false, ...copy(c) })),
    holders: holders.map(h => ({ baseMassGrams: '0', ...copy(h) })),
    items: items.map(i => ({ tier: 0, quality: 3, status: 'normal', attributes: {}, slotsPerStack: 1,
      uniqueDefinitionId: null, rootArtifactId: null, rootItemId: i.itemInstanceId, splitId: null,
      ...copy(i), lots: i.lots ? copy(i.lots) : [{ rootItemId: i.rootItemId ?? i.itemInstanceId,
        sourceInstanceId: i.sourceInstanceId ?? null, quantity: i.quantity }] })),
    receipts: [], outbox: [] };
  validateState(state);
  return state;
}

export function measureContainer(state, containerId) {
  const c = find(state.containers, 'containerId', containerId);
  let slots = 0n, volume = 0n, mass = 0n;
  for (const item of state.items.filter(i => i.containerId === containerId)) {
    slots += BigInt(item.slotsPerStack);
    volume += BigInt(item.unitVolumeMl) * BigInt(item.quantity);
    mass += BigInt(item.unitMassGrams) * BigInt(item.quantity);
  }
  return { slots: slots.toString(), volumeMl: volume.toString(), massGrams: mass.toString(),
    effectiveMassGrams: (BigInt(c.shellMassGrams) + ceilDiv(mass * BigInt(c.transmissionPpm), 1000000n)).toString() };
}

export function measureHolder(state, holderId) {
  const holder = find(state.holders, 'holderId', holderId);
  let mass = BigInt(holder.baseMassGrams);
  for (const c of state.containers.filter(c => c.holderId === holderId)) mass += BigInt(measureContainer(state, c.containerId).effectiveMassGrams);
  const safe = BigInt(holder.safeCarryGrams);
  // The ratio only controls movement; all capacity comparisons remain exact BigInt.
  const q = Number(mass * 1000000n / safe) / 1000000;
  const overloaded = mass * 5n > safe * 6n;
  const restricted = mass > safe;
  return { massGrams: mass.toString(), safeCarryGrams: safe.toString(), overloaded,
    moveMultiplier: overloaded ? 0 : q <= 0.6 ? 1 : q <= 1 ? 1 - (q - 0.6) * 0.625 : 0.75 - (q - 1) * 1.25,
    staminaMultiplier: q <= 0.6 ? 1 : q <= 1 ? 1 + (q - 0.6) * 0.625 : 1.25,
    canSprint: !restricted, canDodge: !restricted, canTakeOff: !restricted };
}

/** Validation preserves passive overload, but never silently repairs or deletes conflicting items. */
export function validateState(state) {
  canonical(state);
  assert(state.schemaVersion === 1 && id(state.worldId) && integer(state.revision), 'invalidState');
  for (const field of ['containers', 'holders', 'items', 'receipts', 'outbox']) assert(Array.isArray(state[field]), 'invalidState');
  const distinct = (rows, key) => {
    const seen = new Set(); for (const row of rows) { assert(id(row[key]) && !seen.has(row[key]), 'duplicateId', { key, id: row[key] }); seen.add(row[key]); }
  };
  distinct(state.containers, 'containerId'); distinct(state.holders, 'holderId'); distinct(state.items, 'itemInstanceId');
  distinct(state.receipts, 'transactionId'); distinct(state.outbox, 'eventId');
  const sources = new Set(), unique = new Set();
  for (const h of state.holders) assert(decimal(h.baseMassGrams) && decimal(h.safeCarryGrams) && BigInt(h.safeCarryGrams) > 0n, 'invalidHolder');
  for (const c of state.containers) {
    assert(integer(c.maxSlots) && decimal(c.maxVolumeMl) && decimal(c.maxMassGrams) && decimal(c.shellMassGrams), 'invalidCapacity');
    assert(integer(c.transmissionPpm) && c.transmissionPpm <= 1000000 && ['open', 'sealed'].includes(c.access), 'invalidContainer');
    assert(['backpack', 'cargo', 'warehouse', 'resource', 'ground', 'space'].includes(c.kind) && typeof c.depleted === 'boolean', 'invalidContainer');
    if (c.holderId !== null) find(state.holders, 'holderId', c.holderId);
    if (c.kind === 'resource') { assert(id(c.sourceInstanceId) && !sources.has(c.sourceInstanceId), 'invalidResource'); sources.add(c.sourceInstanceId); }
    else assert(c.sourceInstanceId === null && !c.depleted, 'invalidResource');
  }
  for (const i of state.items) {
    const container = find(state.containers, 'containerId', i.containerId);
    assert(!container.depleted && id(i.definitionId) && id(i.rootItemId) && (i.splitId === null || id(i.splitId)), 'invalidItem');
    assert(integer(i.quantity, 1) && integer(i.maxStack, 1) && i.quantity <= i.maxStack && integer(i.slotsPerStack, 1), 'invalidQuantity');
    assert(integer(i.quality, 1) && i.quality <= 6 && integer(i.tier) && i.tier <= 9 && id(i.status), 'invalidItem');
    assert(decimal(i.unitMassGrams) && decimal(i.unitVolumeMl) && i.attributes && !Array.isArray(i.attributes) && typeof i.attributes === 'object', 'invalidItem');
    assert(Array.isArray(i.lots) && i.lots.length > 0, 'invalidProvenance');
    let quantity = 0n;
    for (const lot of i.lots) { assert(id(lot.rootItemId) && (lot.sourceInstanceId === null || id(lot.sourceInstanceId)) && integer(lot.quantity, 1), 'invalidProvenance'); quantity += BigInt(lot.quantity); }
    assert(quantity === BigInt(i.quantity), 'invalidProvenance');
    if (i.uniqueDefinitionId !== null) {
      assert(container.kind !== 'resource', 'uniqueNotRenewableResource');
      assert(id(i.uniqueDefinitionId) && id(i.rootArtifactId) && i.quantity === 1 && i.maxStack === 1, 'invalidUniqueItem');
      assert(!unique.has(i.uniqueDefinitionId), 'uniqueConflict', { uniqueDefinitionId: i.uniqueDefinitionId }); unique.add(i.uniqueDefinitionId);
    } else assert(i.rootArtifactId === null, 'invalidUniqueItem');
  }
  for (const r of state.receipts) {
    assert(typeof r.fingerprint === 'string' && integer(r.revision, 1) && r.revision <= state.revision && Array.isArray(r.changes) && Array.isArray(r.eventIds), 'invalidReceipt');
  }
  for (const e of state.outbox) {
    assert(e.worldId === state.worldId && id(e.sourceInstanceId) && e.kind === 'resourceDepleted' && e.committed === true, 'invalidEvent');
    assert(state.receipts.some(r => r.eventIds.includes(e.eventId)), 'orphanEvent');
  }
  return true;
}

function takeLots(item, quantity) {
  const taken = []; let remaining = quantity;
  for (const lot of item.lots) {
    const n = Math.min(lot.quantity, remaining);
    if (n) { taken.push({ ...lot, quantity: n }); lot.quantity -= n; remaining -= n; }
  }
  item.lots = item.lots.filter(l => l.quantity);
  return taken;
}

function checkCapacity(before, next) {
  for (const c of next.containers) {
    const usage = measureContainer(next, c.containerId), old = measureContainer(before, c.containerId);
    for (const [metric, limit, code] of [['slots', String(c.maxSlots), 'slotsFull'], ['volumeMl', c.maxVolumeMl, 'volumeFull'], ['massGrams', c.maxMassGrams, 'massFull']]) {
      assert(BigInt(usage[metric]) <= BigInt(limit) || BigInt(usage[metric]) <= BigInt(old[metric]), code, { containerId: c.containerId, usage: usage[metric], limit });
    }
  }
  for (const h of next.holders) {
    const usage = measureHolder(next, h.holderId), old = measureHolder(before, h.holderId);
    assert(!usage.overloaded || BigInt(usage.massGrams) <= BigInt(old.massGrams), 'holderOverloaded', { holderId: h.holderId });
  }
}

function calculate(state, request) {
  validateState(state);
  const req = copy(request);
  assert(id(req.transactionId) && integer(req.expectedRevision) && Array.isArray(req.operations) && req.operations.length > 0, 'invalidRequest');
  const fingerprint = canonical(req);
  const prior = state.receipts.find(r => r.transactionId === req.transactionId);
  if (prior) { assert(prior.fingerprint === fingerprint, 'transactionIdConflict'); return { replayed: true, nextState: copy(state), receipt: copy(prior), events: [] }; }
  assert(req.expectedRevision === state.revision, 'revisionConflict');
  const next = copy(state), changes = [], touchedResources = new Set();
  for (const [index, op] of req.operations.entries()) {
    assert(['transfer', 'split', 'consume'].includes(op.kind) && integer(op.quantity, 1), 'invalidOperation');
    const item = find(next.items, 'itemInstanceId', op.itemInstanceId);
    const source = find(next.containers, 'containerId', op.fromContainerId);
    assert(item.containerId === source.containerId, 'ownershipConflict');
    assert(source.access === 'open' && !['locked', 'opened'].includes(item.status), 'inaccessible');
    assert(op.quantity <= item.quantity, 'insufficientQuantity');
    if (op.kind === 'consume') {
      assert(source.kind !== 'resource' && source.kind !== 'cargo' && source.kind !== 'warehouse', 'inaccessible');
      assert(item.uniqueDefinitionId === null, 'uniqueConsumptionRequiresCoordinator');
      assert(id(op.reason), 'consumeReasonRequired');
      const lots = takeLots(item, op.quantity); item.quantity -= op.quantity;
      if (!item.quantity) next.items.splice(next.items.indexOf(item), 1);
      changes.push({ kind: 'consume', itemInstanceId: item.itemInstanceId, fromContainerId: source.containerId, quantity: op.quantity, lots, reason: op.reason });
      continue;
    }
    const target = find(next.containers, 'containerId', op.kind === 'split' ? source.containerId : op.toContainerId);
    assert(target.access === 'open' && target.kind !== 'resource', 'inaccessible');
    assert(op.kind === 'split' || target !== source, 'sameContainer');
    assert(op.kind !== 'split' || op.quantity < item.quantity, 'invalidSplit');
    const full = op.quantity === item.quantity;
    assert(item.uniqueDefinitionId === null || (full && op.kind === 'transfer'), 'uniqueCannotSplit');
    const moved = copy(item);
    moved.lots = takeLots(item, op.quantity); moved.quantity = op.quantity; moved.containerId = target.containerId;
    if (!full) {
      moved.itemInstanceId = JSON.stringify(['inventorySplit', req.transactionId, index]);
      moved.splitId = moved.itemInstanceId;
      assert(!next.items.some(i => i.itemInstanceId === moved.itemInstanceId), 'splitIdConflict');
    }
    item.quantity -= op.quantity;
    if (!item.quantity) next.items.splice(next.items.indexOf(item), 1);
    const destinations = [];
    if (op.kind === 'transfer' && moved.uniqueDefinitionId === null) {
      for (const stack of next.items.filter(i => i.containerId === target.containerId && i.uniqueDefinitionId === null && stackKey(i) === stackKey(moved))) {
        const amount = Math.min(stack.maxStack - stack.quantity, moved.quantity);
        if (amount) { stack.lots.push(...takeLots(moved, amount)); stack.quantity += amount; moved.quantity -= amount; destinations.push({ itemInstanceId: stack.itemInstanceId, quantity: amount }); }
        if (!moved.quantity) break;
      }
    }
    if (moved.quantity) { next.items.push(moved); destinations.push({ itemInstanceId: moved.itemInstanceId, quantity: moved.quantity }); }
    changes.push({ kind: op.kind, itemInstanceId: op.itemInstanceId, splitId: full ? null : moved.splitId,
      fromContainerId: source.containerId, toContainerId: target.containerId, quantity: op.quantity, destinations,
      uniqueDefinitionId: moved.uniqueDefinitionId, rootArtifactId: moved.rootArtifactId });
    if (source.kind === 'resource') touchedResources.add(source.containerId);
  }
  checkCapacity(state, next);
  assert(integer(next.revision + 1), 'revisionOverflow'); next.revision++;
  const events = [];
  for (const containerId of touchedResources) {
    const source = find(next.containers, 'containerId', containerId);
    if (!next.items.some(i => i.containerId === containerId) && !source.depleted) {
      source.depleted = true;
      events.push({ eventId: JSON.stringify(['resourceDepleted', state.worldId, source.sourceInstanceId]),
        worldId: state.worldId, sourceInstanceId: source.sourceInstanceId, kind: 'resourceDepleted', committed: true });
    }
  }
  const receipt = { transactionId: req.transactionId, fingerprint, revision: next.revision, changes, eventIds: events.map(e => e.eventId) };
  next.receipts.push(receipt); next.outbox.push(...events);
  validateState(next);
  return { replayed: false, nextState: next, receipt, events };
}

/** Serializable intent + preview. Preview events are deliberately NOT marked committed. */
export function planTransaction(state, request) {
  const result = calculate(state, request);
  return { worldId: state.worldId, baseRevision: state.revision, request: copy(request), replayed: result.replayed,
    preview: { changes: copy(result.receipt.changes),
      events: result.events.map(e => ({ ...e, committed: false })),
      containers: result.nextState.containers.map(c => ({ containerId: c.containerId, ...measureContainer(result.nextState, c.containerId) })),
      holders: result.nextState.holders.map(h => ({ holderId: h.holderId, ...measureHolder(result.nextState, h.holderId) })) } };
}

/**
 * compareAndSwap({worldId, expectedRevision, nextState, receipt, events}) => true ONLY after durable commit.
 * Adapter must atomically version-check and save snapshot + receipts + outbox; false means no write.
 * A thrown/ambiguous write requires reloading authoritative storage before retrying.
 * Integrators may coordinate world/unique updates inside this boundary; this module does not do so.
 */
export async function commitTransaction(state, plan, { compareAndSwap, authorize } = {}) {
  state = copy(state); // Hold a stable snapshot across asynchronous authorization/persistence.
  assert(plan.worldId === state.worldId, 'worldConflict');
  const result = calculate(state, plan.request); // Recompute: serialized preview is never trusted as state.
  if (result.replayed) return { state: result.nextState, receipt: result.receipt, events: [], replayed: true };
  assert(plan.baseRevision === state.revision, 'revisionConflict');
  assert(typeof compareAndSwap === 'function', 'commitAdapterRequired');
  if (authorize) assert(await authorize(copy(state), copy(plan.request)) === true, 'accessDenied');
  const saved = await compareAndSwap({ worldId: state.worldId, expectedRevision: state.revision,
    nextState: copy(result.nextState), receipt: copy(result.receipt), events: copy(result.events) });
  assert(saved === true, 'commitRejected');
  return { state: result.nextState, receipt: result.receipt, events: result.events, replayed: false };
}

export function serializeState(state) { validateState(state); return canonical(state); }
export function deserializeState(json) { const state = JSON.parse(json); validateState(state); return state; }
