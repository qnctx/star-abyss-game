import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {applyCampOperation} from '../playable/src/foundation/camp-state.mjs';
import {applyProgressionOperation, evidence, questReady} from '../playable/src/progression-quests/index.mjs';

const oldEvidence = 'C:/Users/HUAWEI/.codex/worktrees/cb21/star-abyss-game/artifacts/npc-loop-breakthrough/medicine-crafted-and-used.json';
const snapshot = JSON.parse(readFileSync(oldEvidence, 'utf8'));
const root = structuredClone(snapshot.root);
const playerId = snapshot.game.expedition.playerId;
const initial = {
  revision: root.revision,
  simTime: root.simTime,
  dueAt: root.camp.use?.dueAt,
  medicine: root.inventory.items.filter(i => i.definitionId === 'MED02').map(i => ({quantity: i.quantity, status: i.status})),
  cooldownUntil: root.camp.cooldownUntil,
  questStatus: root.camp.progression.quests.Q01?.status,
  evidence: evidence(root, playerId),
  questReady: questReady(root, 'Q01', playerId),
};
assert.equal(initial.revision, 50);
assert.equal(initial.questStatus, 'active');
assert.equal(initial.questReady, true);
assert.equal(initial.medicine[0].status, 'locked');
assert.equal(initial.cooldownUntil, 0);
assert.ok(initial.simTime < initial.dueAt);

const early = structuredClone(root);
assert.throws(() => applyCampOperation(early, {transactionId: 'audit-early', camp: {action: 'use-finish'}}, playerId), /campUseNotDue/);
assert.deepEqual(root, snapshot.root);

// Reducer-level possibility only: this bypasses the runtime action gate and persistent CAS.
const simulated = structuredClone(root);
simulated.simTime = initial.dueAt;
applyCampOperation(simulated, {transactionId: 'audit-finish', camp: {action: 'use-finish'}}, playerId);
assert.equal(simulated.camp.use, null);
assert.ok(simulated.camp.cooldownUntil > simulated.simTime);
assert.equal(simulated.inventory.items.filter(i => i.definitionId === 'MED02').length, 0);
applyProgressionOperation(simulated, {transactionId: 'audit-deliver', progression: {action: 'deliver', npc: 'N01', quest: 'Q01'}}, playerId);
assert.equal(simulated.camp.progression.quests.Q01.status, 'claimed');

const result = {source: oldEvidence, initial, reducerOnly: {
  earlyUseRejected: true,
  afterDueUseCleared: simulated.camp.use === null,
  medicineRemaining: simulated.inventory.items.filter(i => i.definitionId === 'MED02').length,
  cooldownUntil: simulated.camp.cooldownUntil,
  q01Status: simulated.camp.progression.quests.Q01.status,
}, limitation: 'Reducer replay does not verify runtime authorization, browser timing, persistent CAS, or natural level-one completion.'};
writeFileSync(new URL('./independent-loop-r2-cpu.json', import.meta.url), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
