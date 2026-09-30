// Explicit logical fixtures for the local storage verifier, NOT live scene queries/authorization.
import { createCombatState } from '../d3-combat/index.mjs';
import { createState } from '../d3-inventory/index.mjs';
import { createDirector } from '../world-director/director.mjs';
import { sampleDefinitions } from '../world-director/definitions.mjs';
import { createRoot } from './index.mjs';
export const capacity = { maxSlots: 20, maxVolumeMl: '100000', maxMassGrams: '100000' };
export const item = { definitionId: 'herb', quantity: 1, maxStack: 20, unitVolumeMl: '1', unitMassGrams: '1' };
export const definitions = sampleDefinitions;
export const spatialQuery = plan => ({ ecologyAllowed: true, groundSupported: true, collisionFree: true,
  reachable: true, outsideProtectedVolumes: true, pathClear: true, budgetAllowed: true, corpseClear: true,
  playerDistance: 100, visible: false, unsettledLootContainers: 0, placementId: plan.anchorId });
export const materialize = instance => instance.kind === 'resource'
  ? { container: capacity, items: [{ ...item, quantity: instance.remaining }] }
  : { members: instance.members.map(() => ({ actor: { realm: 0, hp: '1', maxHp: '1', defense: '80' },
    container: capacity, loot: [{ ...item, definitionId: 'monster-material', quantity: 2 }] })) };
export const config = { definitions, spatialQuery, materialize, authorize: () => true };
export function fixture(worldId = 'DEV-I-local') {
  const d = createDirector({ definitions, worldId, worldSeed: 'DEV-I-v1', clock: () => 0, spatialQuery });
  d.reserveUnique({ transactionId: 'initial-reservation', sourceEventId: 'authored-initial-unique',
    claims: [{ uniqueDefinitionId: 'MYW-demo', itemInstanceId: 'original-weapon', rootArtifactId: 'original-root' }], expectedRevision: 0 });
  d.transitionUnique({ transactionId: 'initial-manifest', uniqueDefinitionId: 'MYW-demo', action: 'manifest', expectedRevision: 1, expectedUniqueRevision: 0 });
  d.transitionUnique({ transactionId: 'initial-claim', uniqueDefinitionId: 'MYW-demo', action: 'claim', ownerId: 'player', expectedRevision: 2, expectedUniqueRevision: 1 });
  return createRoot({ worldId, director: d.serializeDirector(),
    combat: createCombatState({ worldId, actors: [{ id: 'player', realm: 0, hp: '100', maxHp: '100', attack: '4' }] }),
    inventory: createState({ worldId, holders: ['player', 'other'].map(holderId => ({ holderId, safeCarryGrams: '100000' })),
      containers: [{ ...capacity, containerId: 'pack', holderId: 'player' }, { ...capacity, containerId: 'other-pack', holderId: 'other' },
        { ...capacity, maxSlots: 0, containerId: 'full-pack', holderId: 'player' }],
      items: [{ ...item, itemInstanceId: 'original-weapon', definitionId: 'weapon', quantity: 1, maxStack: 1,
        containerId: 'pack', uniqueDefinitionId: 'MYW-demo', rootArtifactId: 'original-root' }] }) });
}
export const request = (root, transactionId, kind, fields = {}, simTime = root.simTime + 1) => ({
  worldId: root.worldId, expectedRevision: root.revision, transactionId, simTime, kind, ...fields });
export const transfer = (root, transactionId, sourceItem, target, quantity = sourceItem.quantity) => request(root, transactionId, 'transfer', {
  operations: [{ kind: 'transfer', itemInstanceId: sourceItem.itemInstanceId, fromContainerId: sourceItem.containerId, toContainerId: target, quantity }] });
export const cast = (root, transactionId = 'cast') => request(root, transactionId, 'cast', { cast: {
  worldId: root.worldId, sourceId: 'player', castId: transactionId,
  skill: { id: 'basic', kind: 'basic', minimumRealm: 0, channel: 'physical', weights: ['0.25', '0.25', '0.5'], maxTargets: 20 } } });
export const hit = (root, targetId, segment, hitId = 'hit-' + segment, castId = 'cast') => request(root, hitId, 'hit', {
  hit: { worldId: root.worldId, targetId, segment, hitId, castId } });
