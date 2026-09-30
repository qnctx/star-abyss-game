const test = require('node:test');
const assert = require('node:assert/strict');
const api = import('../src/d3-combat/index.mjs');
const fixedApi = import('../src/d3-combat/fixed.mjs');

const source = (overrides = {}) => ({ id: 'source', realm: 0, maxHp: '1000', hp: '1000', attack: '200', spellPower: '160', ...overrides });
const target = (overrides = {}) => ({ id: 'target', realm: 1, maxHp: '1000', hp: '1000', defense: '300', ...overrides });
const skill = (overrides = {}) => ({ id: 'test-skill', minimumRealm: 0, C: '12', a: '1.2', b: '0.4', mastery: 3, channel: 'physical', ...overrides });
const castRequest = (overrides = {}) => ({ worldId: 'world', castId: 'cast', sourceId: 'source', skill: skill(), ...overrides });
const hitRequest = (overrides = {}) => ({ worldId: 'world', castId: 'cast', hitId: 'hit', targetId: 'target', segment: 0, ...overrides });
const roundTrip = state => JSON.parse(JSON.stringify(state));

test('19 reference: 597.24 -> geometry 100 -> defense 120 -> personal 50 -> HP 241', async () => {
  const { createCombatState, commitCast, resolveHit } = await api;
  const original = createCombatState({ worldId: 'world', actors: [source(), target({
    barriers: [{ id: 'wall', amount: 100 }], shields: [{ id: 'personal', amount: 50 }],
    physicalReductions: [{ id: 'armor-break', flat: 30, percent: '0.2' }],
    vulnerability: ['0.1'], damageReduction: ['0.2']
  })] });
  const committed = commitCast(original, castRequest({ skill: skill({ penetration: { percent: '0.25', flat: 42 }, costPercent: '0.1' }), damageBonuses: ['0.2', '0.15'] }));
  assert.equal(committed.cast.snapshot.raw, '442.4');
  assert.equal(committed.cast.snapshot.total, '597.24');
  assert.equal(committed.cast.cost, '10');
  assert.equal(committed.state.actors[0].resource, '90');
  const resolved = resolveHit(committed.state, hitRequest({ barrierIds: ['wall'] }));
  assert.equal(resolved.result.lifeLoss, '241');
  const log = resolved.result.components[0];
  assert.equal(log.overflow, '497.24');
  assert.equal(log.effectiveDefense, '120');
  // The prose example has an intermediate arithmetic typo; retain the formula.
  assert.equal(log.beforePersonalShield, '291.71413333');
  assert.deepEqual(log.barrierAbsorption, [{ id: 'wall', absorbed: '100' }]);
  assert.deepEqual(log.shieldAbsorption, [{ id: 'personal', absorbed: '50' }]);
  assert.equal(resolved.result.target.hp, '759');
  assert.equal(original.actors[1].hp, '1000');
  assert.equal(original.actors[0].resource, '100');
});

test('all five damage/support/control vectors and basic/heavy attacks exclude active mastery', async () => {
  const { masteryMultipliers, snapshotSkill, supportAmount } = await api;
  const values = [1, 2, 3, 4, 5].map(mastery => snapshotSkill({ source: source({ attack: 12 }), skill: skill({ C: 6, a: '1.3', b: 0, mastery }) }).raw);
  assert.deepEqual(values, ['21.6', '25.488', '30.24', '36.288', '43.2']);
  assert.deepEqual([1, 2, 3, 4, 5].map(k => masteryMultipliers(k).shield), ['1', '1.1', '1.22', '1.36', '1.5']);
  assert.deepEqual([1, 2, 3, 4, 5].map(k => masteryMultipliers(k).control), ['1', '1.05', '1.1', '1.15', '1.2']);
  assert.equal(snapshotSkill({ source: source(), skill: skill({ kind: 'basic', mastery: 5 }) }).raw, '200');
  assert.equal(snapshotSkill({ source: source(), skill: skill({ kind: 'heavy', mastery: 5 }) }).raw, '360');
  assert.equal(supportAmount({ base: 100, mastery: 5, kind: 'healing', missingHp: 999, healingBonuses: ['0.8'], healingSuppression: ['0.8'] }), '112.5');
  assert.equal(supportAmount({ base: 100, mastery: 5, kind: 'healing', missingHp: 0 }), '0');
  assert.equal(supportAmount({ base: 100, mastery: 5, kind: 'shield', healingBonuses: [1] }), '150');
});

test('attributes add then multiply, cap same buckets, Q affects only passive increment, single core max with pill', async () => {
  const { computeAttributes, passiveMultiplier, baseResource } = await api;
  assert.equal(passiveMultiplier(5, 6), '1.455');
  assert.equal(passiveMultiplier(1, 6), '1');
  const ordinary = computeAttributes({ realm: 0, level: 10, modifiers: {
    attack: { constitutionBonuses: ['0.4'], practiceBonuses: ['0.35'], equipmentBonuses: ['0.4'] },
    defense: { constitutionBonuses: ['0.4'], practiceBonuses: ['0.35'], equipmentBonuses: ['0.4'] }
  } });
  assert.equal(ordinary.permanent.attack, '83.19024');
  assert.equal(ordinary.permanent.defense, '69.3252');
  const core = computeAttributes({ realm: 0, modifiers: { attack: { equipmentFlat: [8], temporaryFlat: [10], constitutionBonuses: ['0.5', '0.5'], practiceBonuses: ['0.6', '0.6'], equipmentBonuses: ['0.6', '0.6'], temporaryMultiplier: '1.7' } }, heavenOverride: { coreId: 'MYC01', multipliers: { attack: '3.2' } } });
  assert.equal(core.permanent.attack, '174.96');
  assert.equal(core.effective.attack, '559.872');
  assert.equal(core.effective.spellPower, '10');
  assert.equal(baseResource(0, 10), '100');
  assert.equal(baseResource(1, 10), '344');
  assert.throws(() => computeAttributes({ realm: 0, heavenOverride: [{ coreId: 'a' }, { coreId: 'b' }] }), /one/);
});

test('defense order, same-ID strongest refresh, caps and overpenetration', async () => {
  const { effectiveDefense } = await api;
  assert.equal(effectiveDefense({ defense: 300, reductions: [{ id: 'one', flat: 30, percent: '0.2' }, { id: 'one', flat: 20, percent: '0.1' }], penetration: { percent: '0.25', flat: 42 } }), '120');
  assert.equal(effectiveDefense({ defense: 300, reductions: [{ id: 'one', flat: 30 }, { id: 'two', flat: 30 }], penetration: { percent: 2 } }), '120');
  assert.equal(effectiveDefense({ defense: 10, penetration: { flat: 999 } }), '0');
  assert.equal(effectiveDefense({ defense: 0 }), '0');
});

test('direct retains geometry, universal reduction and typed personal shields; element penetration stays local', async () => {
  const { resolveDamage } = await api;
  const result = resolveDamage({ target: target({ defense: '999999', resistance: '999999', damageReduction: ['0.2'], barriers: [{ id: 'wall', amount: 100 }], shields: [{ id: 'physical', amount: 50, channels: ['physical'] }, { id: 'all', amount: 50 }] }), barrierIds: ['wall'], components: [{ id: 'direct', channel: 'direct', amount: 200 }] });
  assert.equal(result.lifeLoss, '30');
  assert.equal(result.target.shields[0].amount, '50');
  const mixed = resolveDamage({ target: target({ realm: 0, defense: 40, resistance: 40, elementResistance: { fire: 40 } }), components: [
    { id: 'physical', channel: 'physical', amount: 100, penetration: { flat: 40 } },
    { id: 'fire', channel: 'spiritual', element: 'fire', amount: 120 }
  ] });
  assert.deepEqual(mixed.components.map(c => c.lifeLoss), ['100', '40']);
  assert.equal(mixed.lifeLoss, '140');
});

test('damage bonus, vulnerability, independent reduction and total defense caps', async () => {
  const { snapshotSkill, resolveDamage } = await api;
  assert.equal(snapshotSkill({ source: source({ attack: 100 }), skill: skill({ kind: 'basic' }), damageBonuses: ['0.6', '0.6'], weakPoint: true }).total, '175');
  const result = resolveDamage({ target: target({ defense: '999999999999999', damageReduction: ['0.8', '0.8'], vulnerability: ['0.9'] }), components: [{ id: 'physical', channel: 'physical', amount: 1000 }] });
  assert.equal(result.lifeLoss, '225'); // 1000 * 1.5 * 0.15
  const general = resolveDamage({ target: target({ defense: 0, damageReduction: ['0.2', '0.2'] }), components: [{ id: 'p', channel: 'physical', amount: 100 }] });
  assert.equal(general.lifeLoss, '64');
});

test('shields same name keep strongest, different names cap at 60%, geometry only when intersected', async () => {
  const { personalShields, resolveDamage } = await api;
  assert.deepEqual(personalShields(100, [{ id: 'a', amount: 20 }, { id: 'a', amount: 40 }, { id: 'b', amount: 50 }]).map(s => s.amount), ['40', '20']);
  const result = resolveDamage({ target: target({ defense: 0, barriers: [{ id: 'behind', amount: 999 }] }), components: [{ id: 'p', channel: 'physical', amount: 100 }] });
  assert.equal(result.lifeLoss, '100');
  assert.equal(result.target.barriers[0].amount, '999');
});

test('cast snapshot survives equipment changes; current target armor and shields are read on hit', async () => {
  const { createCombatState, commitCast, resolveHit } = await api;
  let state = createCombatState({ worldId: 'world', actors: [source({ attack: 100 }), target({ defense: 0 })] });
  state = commitCast(state, castRequest({ skill: skill({ kind: 'basic' }) })).state;
  state = roundTrip(state);
  state.actors[0].attack = '99999';
  state.actors[1].defense = '240';
  state.actors[1].shields = [{ id: 'new-shield', amount: '10' }];
  const result = resolveHit(state, hitRequest()).result;
  assert.equal(result.lifeLoss, '40');
  assert.equal(result.components[0].incoming, '100');
});

test('multi-hit fixed-point remainder allocation conserves total and fractional HP; no minimum-one inflation', async () => {
  const { createCombatState, commitCast, resolveHit } = await api;
  const { fixed } = await fixedApi;
  const run = async (weights, attack, defense = 0) => {
    let state = createCombatState({ worldId: 'world', actors: [source({ attack }), target({ realm: 0, defense })] });
    const committed = commitCast(state, castRequest({ skill: skill({ kind: 'basic', weights }) }));
    state = committed.state;
    const allocated = committed.cast.snapshot.segments.flat().reduce((n, c) => n + fixed(c.amount), 0n);
    assert.equal(allocated, fixed(attack));
    let lost = 0n;
    for (let segment = 0; segment < weights.length; segment++) {
      const outcome = resolveHit(roundTrip(state), hitRequest({ segment, hitId: `hit-${segment}` }));
      lost += BigInt(outcome.result.lifeLoss); state = outcome.state;
    }
    return lost;
  };
  assert.equal(await run(Array(10).fill('0.1'), '1', 100000), 0n);
  assert.equal(await run(Array(10).fill('0.1'), '10', 160), 2n);
  assert.equal(await run(['0.25', '0.3', '0.45'], '101.00000001'), 101n);
  assert.equal(await run(['0.1', '0.1', '0.1', '0.1', '0.15', '0.2', '0.25'], '101'), 101n);
});

test('mixed components split the total once and target count is explicit', async () => {
  const { createCombatState, commitCast, resolveHit } = await api;
  let state = createCombatState({ worldId: 'world', actors: [source({ attack: 100 }), target({ defense: 240 }), target({ id: 'other' })] });
  const committed = commitCast(state, castRequest({ skill: skill({ kind: 'basic', components: [{ id: 'half-physical', channel: 'physical', weight: '0.5' }, { id: 'half-direct', channel: 'direct', weight: '0.5' }] }) }));
  assert.deepEqual(committed.cast.snapshot.segments[0].map(c => c.amount), ['50', '50']);
  const outcome = resolveHit(committed.state, hitRequest());
  assert.equal(outcome.result.lifeLoss, '75');
  assert.throws(() => resolveHit(outcome.state, hitRequest({ hitId: 'other-hit', targetId: 'other' })), /target limit/);
});

test('cast and hit retries after JSON reload are idempotent, including new hit ID for same segment', async () => {
  const { createCombatState, commitCast, resolveHit } = await api;
  const request = castRequest({ skill: skill({ costPercent: '0.1' }) });
  const start = createCombatState({ worldId: 'world', actors: [source(), target()] });
  const committed = commitCast(start, request);
  const retried = commitCast(roundTrip(committed.state), request);
  assert.equal(retried.duplicate, true);
  assert.equal(retried.state.actors[0].resource, '90');
  assert.throws(() => commitCast(committed.state, { ...request, damageBonuses: ['0.1'] }), /conflict/);
  const outcome = resolveHit(committed.state, hitRequest());
  const repeat = resolveHit(roundTrip(outcome.state), hitRequest());
  assert.equal(repeat.duplicate, true);
  assert.deepEqual(repeat.state, outcome.state);
  assert.equal(resolveHit(outcome.state, hitRequest({ hitId: 'new-frame-id' })).duplicate, true);
  assert.throws(() => resolveHit(outcome.state, hitRequest({ targetId: 'other' })), /conflict/);
});

test('only committed defeat emits world event once; overkill logs actual HP and no player defeat event', async () => {
  const { createCombatState, commitCast, resolveHit } = await api;
  for (const defeatEligible of [true, false]) {
    let state = createCombatState({ worldId: 'world', actors: [source(), target({ hp: '10', defense: 0, defeatEligible })] });
    state = commitCast(state, castRequest()).state;
    const hit = resolveHit(state, hitRequest());
    assert.equal(hit.result.lifeLoss, '10');
    assert.equal(hit.events.length, defeatEligible ? 1 : 0);
    if (defeatEligible) assert.deepEqual(hit.events[0], { eventId: 'defeat:["world","target"]', worldId: 'world', sourceInstanceId: 'target', kind: 'defeatCommitted', committed: true });
    assert.deepEqual(resolveHit(roundTrip(hit.state), hitRequest()).events, []);
  }
});

test('failed cast/hit rolls back; interrupted cast never refunds; absent/cross-world target rejected', async () => {
  const { createCombatState, commitCast, resolveHit, interruptCast } = await api;
  const initial = createCombatState({ worldId: 'world', actors: [source({ resource: 5 }), target()] });
  const saved = roundTrip(initial);
  assert.throws(() => commitCast(initial, castRequest({ skill: skill({ costPercent: '0.1' }) })), /insufficient/);
  assert.deepEqual(initial, saved);
  let state = commitCast(initial, castRequest({ skill: skill({ costPercent: '0.05' }) })).state;
  const before = roundTrip(state);
  assert.throws(() => resolveHit(state, hitRequest({ barrierIds: ['missing'] })), /unknown/);
  assert.deepEqual(state, before);
  assert.throws(() => resolveHit(state, hitRequest({ worldId: 'another-world' })), /world/);
  const absent = roundTrip(state); absent.actors[1].present = false;
  assert.throws(() => resolveHit(absent, hitRequest()), /absent/);
  state = interruptCast(roundTrip(state), 'cast');
  assert.equal(state.actors[0].resource, '0');
  assert.throws(() => resolveHit(state, hitRequest()), /interrupted/);
});

test('practice same-event ordinary -> precise -> trial awards only delta, ineffective events award zero', async () => {
  const { createCombatState, awardPractice } = await api;
  let state = createCombatState({ worldId: 'world', actors: [source()] });
  for (const [evidence, expected] of [['ordinary', 5], ['precise', 5], ['ordinary', 0], ['trial', 20], ['trial', 0]]) {
    const out = awardPractice(roundTrip(state), { actorId: 'source', skillId: 'WS01', eventId: 'same-event', evidence, effective: true });
    assert.equal(out.awarded, expected); state = out.state;
  }
  assert.equal(state.practice[0].total, '30');
  assert.equal(awardPractice(state, { actorId: 'source', skillId: 'WS01', eventId: 'dummy', evidence: 'precise', effective: false }).total, '30');
});

test('R9 exact arithmetic above Number.MAX_SAFE_INTEGER, learned tier is never inferred from target', async () => {
  const { computeAttributes, snapshotSkill, resolveDamage } = await api;
  const { fixed } = await fixedApi;
  assert.equal(computeAttributes({ realm: 9, level: 10 }).effective.attack, '316842762.24');
  const huge = '9007199254740993';
  const snapshot = snapshotSkill({ source: source({ realm: 9, attack: huge, spellPower: 0 }), skill: skill({ C: 1, a: 1, b: 0, mastery: 5, learnedTier: 9 }) });
  const exact = (BigInt(huge) + 6n ** 9n) * 2n;
  assert.equal(snapshot.raw, exact.toString());
  const result = resolveDamage({ target: target({ realm: 9, hp: '999999999999999999', maxHp: '999999999999999999', defense: (40n * 6n ** 9n).toString() }), components: snapshot.segments[0] });
  assert.equal(result.lifeLoss, (exact / 2n).toString());
  assert.ok(fixed(huge) > BigInt(Number.MAX_SAFE_INTEGER));
  const lowTier = snapshotSkill({ source: source({ realm: 9, attack: 0, spellPower: 0 }), skill: skill({ C: 12, a: 0, b: 0, mastery: 1 }) });
  assert.equal(lowTier.raw, '12');
});

test('invalid scalars, tier, weights, channel, resource and state IDs are rejected', async () => {
  const { fixed } = await fixedApi;
  const { computeAttributes, snapshotSkill, createCombatState, resolveDamage } = await api;
  for (const invalid of [-1, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, null, true, '', '1e20', '0.000000001', ' 1', {}, '-3']) assert.throws(() => fixed(invalid));
  for (const invalid of [-1, 10, 0.1, NaN]) assert.throws(() => computeAttributes({ realm: invalid }));
  for (const change of [{ mastery: 6 }, { minimumRealm: 1 }, { learnedTier: 1 }, { weights: ['0.4', '0.4'] }, { weights: [] }, { channel: 'water' }, { channel: 'spiritual', element: 'unknown' }]) assert.throws(() => snapshotSkill({ source: source(), skill: skill(change) }));
  assert.throws(() => createCombatState({ worldId: 'world', actors: [source(), source()] }), /duplicate/);
  assert.throws(() => resolveDamage({ target: target({ damageReduction: ['1.1'] }), components: [{ id: 'x', channel: 'physical', amount: 10 }] }));
});

test('R2 F1: thirds across same and mixed components kill exactly one HP, without epsilon', async () => {
  const { resolveDamage, createCombatState, commitCast, resolveHit } = await api;
  const thirds = resolveDamage({ target: target({ realm: 0, hp: 1, defense: 80 }),
    components: ['a', 'b', 'c'].map(id => ({ id, channel: 'physical', amount: 1 })) });
  assert.equal(thirds.lifeLoss, '1'); assert.equal(thirds.defeated, true);
  assert.deepEqual(thirds.carryExact, { numerator: '0', denominator: '1' });
  const state = commitCast(createCombatState({ worldId: 'world', actors: [source(), target({ realm: 0, hp: 1, defense: 80, resistance: 20, defeatEligible: true })] }),
    castRequest({ skill: skill({ C: 2, a: 0, b: 0, mastery: 1, components: [
      { id: 'p', channel: 'physical', weight: '0.5' }, { id: 'f', channel: 'spiritual', element: 'fire', weight: '0.5' }
    ] }) })).state;
  const mixed = resolveHit(state, hitRequest());
  assert.equal(mixed.result.lifeLoss, '1'); assert.equal(mixed.result.target.hp, '0'); assert.equal(mixed.events.length, 1);
  assert.equal(mixed.result.carry, '0');
  const under = resolveDamage({ target: target({ realm: 0, hp: 1, defense: 80 }), components: [
    { id: 'a', channel: 'physical', amount: 1 }, { id: 'b', channel: 'direct', amount: '0.66666666' }
  ] });
  assert.equal(under.lifeLoss, '0'); assert.equal(under.defeated, false);
  assert.deepEqual(under.carryExact, { numerator: '149999999', denominator: '150000000' });
});

test('R2 F1: changed defense after JSON reload preserves exact thirds across segments', async () => {
  const { createCombatState, commitCast, resolveHit } = await api;
  let state = commitCast(createCombatState({ worldId: 'world', actors: [source(), target({ realm: 0, hp: 1, defense: 80, defeatEligible: true })] }),
    castRequest({ skill: skill({ C: 2, a: 0, b: 0, mastery: 1, weights: ['0.5', '0.5'] }) })).state;
  const first = resolveHit(state, hitRequest());
  assert.equal(first.result.lifeLoss, '0');
  assert.deepEqual(first.result.carryExact, { numerator: '1', denominator: '3' });
  state = roundTrip(first.state); state.actors[1].defense = '20';
  const second = resolveHit(state, hitRequest({ hitId: 'second', segment: 1 }));
  assert.equal(second.result.lifeLoss, '1'); assert.equal(second.result.target.hp, '0'); assert.equal(second.events.length, 1);
  assert.deepEqual(second.result.carryExact, { numerator: '0', denominator: '1' });
});

test('R2 F1: exact shield remainders survive reload and flow into exact life carry', async () => {
  const { resolveDamage } = await api;
  const hit = (t, amount, previous = {}) => resolveDamage({ target: t, components: [{ id: 'p', channel: 'physical', amount }], carry: previous.carry, carryExact: previous.carryExact });
  const first = hit(target({ realm: 0, defense: 80, shields: [{ id: 'body', amount: 1 }] }), 1);
  assert.deepEqual(first.target.shields[0].amountExact, { numerator: '2', denominator: '3' });
  const second = hit(roundTrip(first.target), 4, roundTrip(first));
  assert.deepEqual(second.carryExact, { numerator: '2', denominator: '3' });
  assert.equal(second.lifeLoss, '0'); assert.equal(second.target.shields[0].amount, '0');
  const third = hit(roundTrip(second.target), 1, roundTrip(second));
  assert.equal(third.lifeLoss, '1'); assert.equal(third.carry, '0');
});

test('R2 F2: alias IDs bind immutable signatures including after death and JSON reload', async () => {
  const { createCombatState, commitCast, resolveHit } = await api;
  let state = commitCast(createCombatState({ worldId: 'world', actors: [source(), target({ defense: 0 })] }),
    castRequest({ skill: skill({ C: 2, a: 0, b: 0, mastery: 1, weights: ['0.5', '0.5'] }) })).state;
  state = resolveHit(state, hitRequest()).state;
  const before = roundTrip(state);
  const alias = resolveHit(state, hitRequest({ hitId: 'alias' }));
  assert.deepEqual(state, before); assert.equal(alias.duplicate, true); assert.deepEqual(alias.events, []);
  assert.equal(alias.state.hits.at(-1).aliasOf, 'hit');
  state = roundTrip(alias.state);
  assert.deepEqual(resolveHit(state, hitRequest({ hitId: 'alias' })).state, state);
  for (const patch of [{ segment: 1 }, { barrierIds: ['other'] }, { castId: 'other-cast' }, { targetId: 'other-target' }]) {
    assert.throws(() => resolveHit(state, hitRequest({ hitId: 'alias', ...patch })), /conflict/);
  }
  assert.equal(state.actors[1].hp, '999');
  state.actors[1].hp = '0';
  const deadAlias = resolveHit(state, hitRequest({ hitId: 'dead-alias' }));
  assert.equal(deadAlias.duplicate, true); assert.equal(deadAlias.state.hits.at(-1).hitId, 'dead-alias');
  assert.deepEqual(deadAlias.events, []);
});

test('R2 precision metadata rejects malformed/stale fractions without state mutation', async () => {
  const { resolveDamage } = await api;
  for (const carryExact of [{ numerator: '1', denominator: '0' }, { numerator: '-1', denominator: '3' }, { numerator: 1, denominator: '3' }, { numerator: '1', denominator: '2' }]) {
    const t = target(); const before = roundTrip(t);
    assert.throws(() => resolveDamage({ target: t, components: [{ id: 'p', channel: 'physical', amount: 1 }], carry: '0.33333333', carryExact }));
    assert.deepEqual(t, before);
  }
  assert.throws(() => resolveDamage({ target: target({ shields: [{ id: 's', amount: '0.2', amountExact: { numerator: '1', denominator: '3' } }] }), components: [{ id: 'p', channel: 'physical', amount: 1 }] }), /does not match/);
});

test('R2 reads R1 finite precision saves and upgrades returned state on mutation', async () => {
  const { createCombatState, commitCast, resolveHit } = await api;
  let state = commitCast(createCombatState({ worldId: 'world', actors: [source(), target({ realm: 0, defense: 40 })] }),
    castRequest({ skill: skill({ C: 2, a: 0, b: 0, mastery: 1, weights: ['0.5', '0.5'] }) })).state;
  state = resolveHit(state, hitRequest()).state;
  state = JSON.parse(JSON.stringify(state, (key, value) => ['carryExact', 'amountExact'].includes(key) ? undefined : value));
  state.version = 1;
  const result = resolveHit(state, hitRequest({ hitId: 'second', segment: 1 }));
  assert.equal(state.version, 1); assert.equal(result.state.version, 2);
  assert.equal(result.result.lifeLoss, '1'); assert.equal(result.result.carry, '0');
});

// Optional developer replay of the unchanged independent R1 assertions against R2.
// No files are written: only import target and observation sink are redirected in memory.
if (process.argv.includes('--replay-r1')) test('R2 developer replay: original independent R1 suite and minimal reproductions', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { pathToFileURL } = require('node:url');
  const { createHash } = require('node:crypto');
  const { spawnSync } = require('node:child_process');
  const root = 'C:/Users/HUAWEI/.codex/worktrees/8266/star-abyss-game/artifacts/tests/TEST-A-R1';
  const frozenRoot = 'C:/Users/HUAWEI/.codex/worktrees/c0e3/star-abyss-game/artifacts/deliveries/DEV-A-R1';
  const frozenImport = `${pathToFileURL(frozenRoot).href}/playable/src/d3-combat/index.mjs`;
  const repairedImport = pathToFileURL(path.resolve(__dirname, '../src/d3-combat/index.mjs')).href;
  const tracked = fs.readdirSync(root).map(name => path.join(root, name));
  const frozenFiles = [
    ['playable/src/d3-combat/fixed.mjs', '191a300c1f07ec010ff92bf2a72c246aaba08cd3a55a7501cd318280a3eac925'],
    ['playable/src/d3-combat/index.mjs', 'f5e27463c6391f658658e5ccb638e7f78dcbe306386fc820d0788b09a284b6e8'],
    ['playable/tests/d3-combat.test.js', 'ffbf59119a2b77a891b4990fcf505d3a58c5fdba6f36f124452fbf3ccd113672']
  ];
  const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const before = new Map(tracked.map(file => [file, hash(file)]));
  for (const [file, digest] of frozenFiles) assert.equal(hash(path.join(frozenRoot, file)), digest);
  for (const name of ['independent.test.mjs', 'minimal-repro.mjs']) {
    let code = fs.readFileSync(path.join(root, name), 'utf8');
    assert.ok(code.includes(frozenImport), 'original frozen import must be located exactly');
    code = code.replace(frozenImport, repairedImport);
    if (name === 'independent.test.mjs') {
      const evidence = "fileURLToPath(new URL('./independent-observations.json',import.meta.url))";
      const write = 'fs.writeFileSync(evidence,JSON.stringify(records,null,2));';
      assert.ok(code.includes(evidence) && code.includes(write));
      code = code.replace(evidence, "'in-memory-only'").replace(write, '');
    }
    const run = spawnSync(process.execPath, ['--input-type=module'], { input: code, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    process.stdout.write(run.stdout.split('\n').map(line => `# R1 replay ${line}`).join('\n') + '\n');
    assert.equal(run.status, 0, run.stderr || run.error?.message || name);
  }
  for (const [file, digest] of before) assert.equal(hash(file), digest, `independent original preserved: ${file}`);
  for (const [file, digest] of frozenFiles) assert.equal(hash(path.join(frozenRoot, file)), digest);
  console.log('R1 frozen implementation and all independent artifact SHA-256 values unchanged.');
});
