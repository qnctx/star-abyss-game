import {applySkillOperation,validateSkills,recordBarrierPractice,checkMarkedHit,settleMarkedHit} from '../combat-skills/state.mjs';
import { createCombatState, commitCast, resolveHit } from '../d3-combat/index.mjs';
import { createState, validateState, measureContainer, planTransaction, commitTransaction } from '../d3-inventory/index.mjs';
import { createDirector } from '../world-director/director.mjs';
import { validateScene, validateSceneConfig, checkSceneRequest, rescue } from './scene.mjs';
import {applyCampOperation,validateCamp} from '../foundation/camp-state.mjs';
import {applyProgressionOperation,validateProgression,creditProgressionCombat} from '../progression-quests/index.mjs';
import {applyExploration,validateExploration} from '../exploration-content/state.mjs';
export { validateScene, validateSceneConfig } from './scene.mjs';

export const copy = value => JSON.parse(canonical(value));
export function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  check(value && Object.getPrototypeOf(value) === Object.prototype, 'invalidJson');
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
}
const check = (ok, code) => { if (!ok) throw new Error(code); };
const id = s => typeof s === 'string' && s.length > 0;
const key = (...parts) => JSON.stringify(['session', ...parts]);
const sum = (inventory, containerId) => inventory.items.filter(i => i.containerId === containerId).reduce((n, i) => n + i.quantity, 0);
const cancelled = signal => check(!signal?.aborted, 'cancelled');

/** Import/bootstrap only. Runtime rewards can only enter through materialized C instances and A death. */
export function createRoot({ worldId, combat, inventory, director, simTime = 0 }) {
  const root = copy({ schemaVersion: 1, worldId, revision: 0, simTime, combat, inventory, director,
    receipts: [], events: [], drops: [] });
  validateRoot(root);
  return root;
}

export function validateRoot(root, sceneConfig) {
  if(sceneConfig !== undefined) validateSceneConfig(sceneConfig);
  canonical(root);
  check(root.schemaVersion === 1 && id(root.worldId) && Number.isSafeInteger(root.revision) && root.revision >= 0, 'invalidRoot');
  check(Number.isFinite(root.simTime) && root.simTime >= 0 && root.director.simHighWater <= root.simTime, 'invalidClock');
  for (const field of ['combat', 'inventory', 'director']) check(root[field].worldId === root.worldId, 'worldConflict');
  check(Array.isArray(root.receipts) && Array.isArray(root.events) && Array.isArray(root.drops), 'invalidRoot');
  validateState(root.inventory);
  if(root.camp)validateCamp(root.camp);
  if(root.combatSkills)validateSkills(root.combatSkills);
  if(root.camp?.progression)validateProgression(root.camp.progression);
  validateExploration(root);
  for (const [rows, field] of [[root.receipts, 'transactionId'], [root.events, 'eventId'], [root.drops, 'memberId']]) {
    check(rows.every(r => id(r[field])) && new Set(rows.map(r => r[field])).size === rows.length, 'duplicateRootId');
  }
  for (const r of root.receipts) check(id(r.signature) && Number.isSafeInteger(r.revision) && r.revision <= root.revision && r.revision > 0, 'invalidRootReceipt');
  for (const slot of Object.values(root.director.anchors)) {
    const current = slot.current;
    if (!current) continue;
    if (current.kind === 'resource') {
      const c = root.inventory.containers.find(c => c.sourceInstanceId === current.instanceId);
      check(c && sum(root.inventory, c.containerId) === current.remaining && c.depleted === (current.remaining === 0), 'resourceRootMismatch');
    } else for (const m of current.members) {
      const actor = root.combat.actors.find(a => a.id === m.instanceId);
      const drop = root.drops.find(d => d.memberId === m.instanceId);
      check(actor && actor.defeatEligible === true && drop && (actor.hp === '0') === m.consumed && drop.created === m.consumed, 'memberRootMismatch');
    }
  }
  for (const item of root.inventory.items.filter(i => i.uniqueDefinitionId !== null)) {
    const ledger = root.director.uniqueLedger[item.uniqueDefinitionId];
    const container = root.inventory.containers.find(c => c.containerId === item.containerId);
    check(ledger && ledger.itemInstanceId === item.itemInstanceId && ledger.rootArtifactId === item.rootArtifactId &&
      ledger.ownerId === container.holderId && ['claimed', 'transferred'].includes(ledger.status) && ledger.fragments.length === 0, 'uniqueRootMismatch');
  }
  // This slice supports only complete, held unique objects: no ledger-only issued item.
  for (const entry of Object.values(root.director.uniqueLedger)) {
    check(['claimed', 'transferred'].includes(entry.status) && entry.fragments.length === 0 &&
      root.inventory.items.some(i => i.uniqueDefinitionId === entry.uniqueDefinitionId), 'unsupportedUniqueState');
  }
  if (Object.prototype.hasOwnProperty.call(root, 'scene')) validateScene(root.scene, root, sceneConfig);
  return true;
}

function directorFor(root, config, time) {
  return createDirector({ definitions: config.definitions, worldId: root.worldId, savedState: root.director,
    clock: () => time, spatialQuery: config.spatialQuery,
    // Synchronous private scratch replacement, NOT a durable persistence acknowledgment.
    persist(next) {
      check(next.revision === root.director.revision + 1, 'scratchRevisionConflict');
      root.director = copy(next); return true;
    } });
}

function appendInventory(root, containers, items) {
  const normalized = createState({ worldId: root.worldId, holders: root.inventory.holders,
    containers: [...root.inventory.containers, ...containers], items: [...root.inventory.items, ...items] });
  root.inventory = { ...normalized, revision: root.inventory.revision + 1,
    receipts: root.inventory.receipts, outbox: root.inventory.outbox };
  validateState(root.inventory);
  for (const c of containers) {
    const usage = measureContainer(root.inventory, c.containerId);
    check(BigInt(usage.slots) <= BigInt(c.maxSlots) && BigInt(usage.volumeMl) <= BigInt(c.maxVolumeMl) &&
      BigInt(usage.massGrams) <= BigInt(c.maxMassGrams), 'manifestCapacityExceeded');
  }
}

function materialize(root, instance, config) {
  check(typeof config.materialize === 'function', 'materializerRequired');
  const spec = copy(config.materialize(copy(instance))); // Must be synchronous, deterministic and side-effect free.
  if (instance.kind === 'resource') {
    check(Array.isArray(spec.items) && spec.items.length > 0, 'resourceManifestRequired');
    const containerId = key('resource', instance.instanceId);
    check(spec.items.reduce((n, i) => n + i.quantity, 0) === instance.remaining, 'resourceCountMismatch');
    appendInventory(root, [{ ...spec.container, containerId, kind: 'resource', sourceInstanceId: instance.instanceId,
      holderId: null, depleted: false }], spec.items.map((i, n) => ({ ...i, itemInstanceId: key('resourceItem', instance.instanceId, n),
      containerId, sourceInstanceId: instance.instanceId, uniqueDefinitionId: null, rootArtifactId: null })));
  } else {
    check(Array.isArray(spec.members) && spec.members.length === instance.members.length, 'memberManifestRequired');
    for (const [n, member] of instance.members.entries()) {
      const configMember = spec.members[n];
      check(Array.isArray(configMember.loot), 'lootManifestRequired');
      const actor = createCombatState({ worldId: root.worldId, actors: [{ ...configMember.actor, id: member.instanceId, defeatEligible: true }] }).actors[0];
      check(actor.hp !== '0' && !root.combat.actors.some(a => a.id === actor.id), 'invalidSpawnActor');
      root.combat.actors.push(actor);
      const containerId = key('corpse', member.instanceId);
      // Validate/normalize the fixed loot now. Death never rerolls this saved manifest.
      const inv = createState({ worldId: root.worldId, containers: [{ ...configMember.container, containerId, kind: 'ground', holderId: null }],
        items: configMember.loot.map((item, i) => ({ ...item, itemInstanceId: key('loot', member.instanceId, i), containerId,
          sourceInstanceId: member.instanceId, uniqueDefinitionId: null, rootArtifactId: null })) });
      const usage = measureContainer(inv, containerId), cap = inv.containers[0];
      check(BigInt(usage.slots) <= BigInt(cap.maxSlots) && BigInt(usage.volumeMl) <= BigInt(cap.maxVolumeMl) &&
        BigInt(usage.massGrams) <= BigInt(cap.maxMassGrams), 'manifestCapacityExceeded');
      root.drops.push({ memberId: member.instanceId, lootSeed: member.lootSeed, created: false,
        container: inv.containers[0], manifest: inv.items });
    }
  }
}

async function inventoryMove(root, director, request) {
  const req = { transactionId: key('inventory', request.transactionId), expectedRevision: root.inventory.revision, operations: request.operations };
  check(Array.isArray(req.operations) && req.operations.every(o => o.kind === 'transfer'), 'onlyTransferSupported');
  const before = copy(root.inventory);
  const result = await commitTransaction(before, planTransaction(before, req), {
    compareAndSwap({ worldId, expectedRevision, nextState }) {
      if (worldId !== root.worldId || expectedRevision !== root.inventory.revision) return false;
      root.inventory = copy(nextState); return true; // Private transactional scratch; root CAS still required.
    }
  });
  const touched = new Set(result.receipt.changes.map(c => c.fromContainerId));
  for (const e of result.events) director.consumeCommitted(e, root.director.revision);
  for (const c of before.containers.filter(c => c.kind === 'resource' && touched.has(c.containerId))) {
    const remaining = sum(root.inventory, c.containerId);
    if (remaining > 0) director.recordResourceRemaining({ transactionId: key('partial', request.transactionId, c.containerId),
      worldId: root.worldId, sourceInstanceId: c.sourceInstanceId, remaining, committed: true, expectedRevision: root.director.revision });
  }
  for (const change of result.receipt.changes.filter(c => c.uniqueDefinitionId !== null)) {
    const entry = root.director.uniqueLedger[change.uniqueDefinitionId];
    const source = before.containers.find(c => c.containerId === change.fromContainerId);
    const target = root.inventory.containers.find(c => c.containerId === change.toContainerId);
    check(entry && entry.ownerId === source.holderId && id(target.holderId), 'uniqueOwnerMismatch');
    director.transitionUnique({ transactionId: key('unique', request.transactionId, change.itemInstanceId, change.toContainerId),
      uniqueDefinitionId: change.uniqueDefinitionId, action: 'transfer', ownerId: target.holderId,
      expectedUniqueRevision: entry.revision, expectedRevision: root.director.revision });
  }
  return result.events;
}

/** No public mutable cache: every request/retry starts by reading authoritative storage. */
export function createSession({ storage, definitions, spatialQuery, authorize, materialize: factory, sceneConfig, skillGeometry }) {
  check(storage && typeof storage.load === 'function' && typeof storage.compareAndSwap === 'function', 'storageRequired');
  check(definitions && typeof spatialQuery === 'function' && typeof authorize === 'function', 'configurationRequired');
  if (sceneConfig !== undefined) validateSceneConfig(sceneConfig);
  storage.assertSceneConfig?.(sceneConfig);
  const config = { definitions: copy(definitions), spatialQuery, materialize: factory, sceneConfig: sceneConfig === undefined ? null : copy(sceneConfig) };
  async function load(worldId) {
    const state = await storage.load(worldId); check(state, 'rootNotFound'); validateRoot(state, config.sceneConfig ?? undefined);
    if(state.scene && config.sceneConfig) validateScene(state.scene,state,config.sceneConfig);
    directorFor(copy(state), config, state.simTime); // Validate C import, including historical unique identity constraints.
    return copy(state);
  }
  async function execute(input, { signal } = {}) {
    const request = copy(input); cancelled(signal);
    check(id(request.transactionId) && id(request.worldId) && Number.isSafeInteger(request.expectedRevision), 'invalidRequest');
    const state = await load(request.worldId); cancelled(signal);
    const signature = canonical(request);
    const prior = state.receipts.find(r => r.transactionId === request.transactionId);
    if (prior) { check(prior.signature === signature, 'transactionIdConflict'); return { state, receipt: copy(prior), events: [], replayed: true }; }
    check(request.expectedRevision === state.revision, 'revisionConflict');
    check(Number.isFinite(request.simTime) && request.simTime >= state.simTime, 'clockWentBackwards');
    checkSceneRequest(request);
    check(await authorize(copy(state), copy(request)) === true, 'accessDenied'); cancelled(signal);
    const next = copy(state); next.simTime = request.simTime;
    const director = directorFor(next, config, request.simTime);
    let events = [];
    if (request.kind === 'checkpoint') check(config.sceneConfig, 'sceneConfigurationRequired');
    else if (request.kind === 'rescue') {
      rescue(next, config.sceneConfig);
      if(next.camp?.use){const item=next.inventory.items.find(i=>i.itemInstanceId===next.camp.use.itemId);if(item)item.status='normal';next.camp.use=null;}
      if(next.camp)next.camp.heal=null;
    }
    else if (request.kind === 'camp') {check(config.sceneConfig,'sceneConfigurationRequired');applyCampOperation(next,request,config.sceneConfig.playerId);}
    else if (request.kind === 'progression') {check(config.sceneConfig,'sceneConfigurationRequired');applyProgressionOperation(next,request,config.sceneConfig.playerId);}
    else if(request.kind==='skill') {check(config.sceneConfig,'sceneConfigurationRequired');events=applySkillOperation(next,request,config.sceneConfig.playerId,skillGeometry);}
    else if (request.kind === 'transfer') events = await inventoryMove(next, director, request);
    else if (request.kind === 'exploration') await applyExploration(next,request);
    else if (request.kind === 'cast') next.combat = commitCast(next.combat, request.cast).state;
    else if (request.kind === 'hit') {
      const hits=request.hits||[request.hit];
      check(Array.isArray(hits)&&hits.length>0&&hits.length<=12&&new Set(hits.map(hit=>hit.targetId)).size===hits.length,'invalidHitBatch');
      for(const hit of hits){
        checkMarkedHit(next,hit);
        const result=resolveHit(next.combat,hit);
        settleMarkedHit(next,hit);
        next.combat=result.state; // All targets and their drops share the outer root CAS.
        events.push(...result.events);
        if(config.sceneConfig)recordBarrierPractice(next,config.sceneConfig.playerId,result.result);
      }
    } else if (request.kind === 'spawn') {
      const plan = director.planTick(request.context ?? {}).plans.find(p => p.anchorId === request.anchorId);
      check(plan, 'noEligiblePlan');
      const reservation = director.reservePlan(plan, next.director.revision, request.context ?? {});
      const instance = director.commitPlan({ transactionId: key('spawn', request.transactionId), anchorId: request.anchorId,
        reservationId: reservation.reservationId, expectedRevision: next.director.revision }, request.context ?? {});
      materialize(next, instance, config);
    } else throw new Error('unsupportedOperation');
    // Skill defeats use the same committed corpse/director path as the original pulse.
    for (const e of events.filter(e=>e.kind==='defeatCommitted')) {
      const drop = next.drops.find(d => d.memberId === e.sourceInstanceId);
      check(drop && !drop.created, 'missingOrCreatedDrop');
      appendInventory(next, [drop.container], drop.manifest);
      drop.created = true; drop.eventId = e.eventId;
      director.consumeCommitted(e, next.director.revision);
    }
    if (Object.prototype.hasOwnProperty.call(request, 'scene')) {
      check(config.sceneConfig && request.kind !== 'rescue', 'sceneConfigurationRequired');
      validateScene(request.scene, next, config.sceneConfig); next.scene=copy(request.scene);
    } else if (next.scene && request.kind !== 'rescue') {
      // Legacy callers with an established scene keep their spatial snapshot while time advances.
      next.scene.time=next.simTime;
    }
    if(config.sceneConfig)creditProgressionCombat(next,request,events,config.sceneConfig.playerId);
    next.events.push(...copy(events));
    next.revision++; check(Number.isSafeInteger(next.revision), 'revisionOverflow');
    const receipt = { transactionId: request.transactionId, signature, revision: next.revision, simTime: request.simTime,
      eventIds: events.map(e => e.eventId) };
    next.receipts.push(receipt); validateRoot(next, config.sceneConfig ?? undefined); cancelled(signal);
    const saved = await storage.compareAndSwap({ worldId: next.worldId, expectedRevision: state.revision, nextState: copy(next), signal });
    check(saved === true, 'commitRejected');
    return { state: copy(next), receipt: copy(receipt), events: copy(events), replayed: false };
  }
  return { load, execute };
}
