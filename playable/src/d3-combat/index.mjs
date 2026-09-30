import { SCALE, fixed, decimal, min, max, mul, integer, id, sum, weights, allocate,
  ratio, rational, rAdd, rSub, rMul, rCompare, rMin, rDecimal, rSave, rRead } from './fixed.mjs';

const DAMAGE = ['1', '1.18', '1.4', '1.68', '2'];
const SUPPORT = ['1', '1.1', '1.22', '1.36', '1.5'];
const CONTROL = ['1', '1.05', '1.1', '1.15', '1.2'];
const PASSIVE = ['1', '1.08', '1.16', '1.25', '1.35'];
const QUALITY = ['0.8', '0.9', '1', '1.1', '1.2', '1.3'];
const STATS = { maxHp: 120, attack: 12, spellPower: 10, defense: 10, resistance: 8 };
const CHANNELS = ['physical', 'spiritual', 'direct'];
const ELEMENTS = ['metal', 'wood', 'water', 'fire', 'earth', 'wind', 'thunder', 'ice', 'light', 'dark', 'poison', 'space', 'mind'];
const clone = value => structuredClone(value);
const nextState = state => ({ ...clone(state), version: 2 });
const realm = value => integer(value, 0, 9, 'realm');

export function masteryMultipliers(stage) {
  const i = integer(stage, 1, 5, 'mastery') - 1;
  return { damage: DAMAGE[i], healing: SUPPORT[i], shield: SUPPORT[i], control: CONTROL[i] };
}

export function passiveMultiplier(stage, quality = 3) {
  const i = integer(stage, 1, 5, 'mastery') - 1;
  const q = integer(quality, 1, 6, 'quality') - 1;
  return decimal(SCALE + mul(fixed(PASSIVE[i]) - SCALE, fixed(QUALITY[q])));
}

export function baseResource(realmIndex, level = 1) {
  realm(realmIndex); integer(level, 1, 10, 'level');
  return realmIndex === 0 ? '100' : decimal(100n * 2n ** BigInt(realmIndex) * (SCALE + BigInt(level - 1) * fixed('0.08')));
}

/** One explicit core only. Callers supply its currently legal multiplier; no activation/AI is inferred. */
export function computeAttributes({ realm: r, level = 1, modifiers = {}, heavenOverride = null }) {
  realm(r); integer(level, 1, 10, 'level');
  if (heavenOverride !== null) {
    if (typeof heavenOverride !== 'object' || Array.isArray(heavenOverride)) throw new TypeError('only one heavenOverride is permitted');
    id(heavenOverride.coreId, 'coreId');
    for (const key of Object.keys(heavenOverride.multipliers ?? {})) if (!(key in STATS)) throw new TypeError(`unknown core stat ${key}`);
  }
  for (const key of Object.keys(modifiers)) if (!(key in STATS)) throw new TypeError(`unknown stat ${key}`);
  const B = 6n ** BigInt(r) * (SCALE + BigInt(level - 1) * fixed('0.18'));
  const permanent = {}, effective = {};
  for (const [stat, coefficient] of Object.entries(STATS)) {
    const m = modifiers[stat] ?? {};
    const practice = min(fixed('1.8'), SCALE + sum(m.practiceBonuses));
    const equipment = min(fixed('1.8'), SCALE + sum(m.equipmentBonuses));
    let amount = BigInt(coefficient) * B + sum(m.equipmentFlat) + sum(m.temporaryFlat);
    amount = mul(mul(mul(amount, SCALE + min(fixed('0.8'), sum(m.constitutionBonuses))), practice), equipment);
    permanent[stat] = decimal(amount);
    const temporary = fixed(m.temporaryMultiplier ?? 1);
    const core = fixed(heavenOverride?.multipliers?.[stat] ?? 1);
    effective[stat] = decimal(mul(amount, heavenOverride?.multipliers?.[stat] !== undefined ? max(temporary, core) : temporary));
  }
  return { permanent, effective, coreId: heavenOverride?.coreId ?? null, baseResource: baseResource(r, level) };
}

function channel(value, element) {
  if (!CHANNELS.includes(value)) throw new TypeError('unknown damage channel');
  if (value === 'spiritual' && !ELEMENTS.includes(element)) throw new TypeError('spiritual damage needs an element');
}

/** Freeze learned tier, source attributes, bonuses and total multi-hit budget at cast start. */
export function snapshotSkill({ source, skill, damageBonuses = [], weakPoint = false }) {
  realm(source.realm);
  id(skill.id, 'skill.id');
  const tier = skill.learnedTier ?? skill.minimumRealm;
  realm(skill.minimumRealm); realm(tier);
  if (tier < skill.minimumRealm || tier > source.realm) throw new RangeError('unlearned or inaccessible skill tier');
  const stage = skill.mastery ?? 1;
  const mastery = masteryMultipliers(stage);
  const kind = skill.kind ?? 'skill';
  if (!['skill', 'basic', 'heavy'].includes(kind)) throw new TypeError('unknown skill kind');
  const C = kind === 'skill' ? fixed(skill.C) : 0n;
  const a = kind === 'skill' ? fixed(skill.a) : fixed(kind === 'heavy' ? '1.8' : 1);
  const b = kind === 'skill' ? fixed(skill.b) : 0n;
  const raw = mul(C * 6n ** BigInt(tier) + mul(a, fixed(source.attack)) + mul(b, fixed(source.spellPower)), kind === 'skill' ? fixed(mastery.damage) : SCALE);
  if (typeof weakPoint !== 'boolean') throw new TypeError('weakPoint must be boolean');
  const total = mul(raw, SCALE + min(fixed('0.75'), sum(damageBonuses) + (weakPoint ? fixed('0.25') : 0n)));
  const components = skill.components ?? [{ id: 'main', channel: skill.channel, element: skill.element, weight: 1, penetration: skill.penetration }];
  const shares = weights(components.map(c => c.weight));
  const seen = new Set();
  const normalized = components.map(c => {
    id(c.id, 'component.id'); channel(c.channel, c.element);
    if (seen.has(c.id)) throw new TypeError('duplicate component id');
    seen.add(c.id);
    return { id: c.id, channel: c.channel, element: c.element ?? null, penetration: {
      flat: decimal(fixed(c.penetration?.flat ?? 0)), percent: decimal(min(fixed('0.5'), fixed(c.penetration?.percent ?? 0)))
    } };
  });
  const segments = allocate(total, weights(skill.weights)).map(budget => allocate(budget, shares).map((amount, index) => ({ ...normalized[index], amount: decimal(amount) })));
  return { skillId: skill.id, learnedTier: tier, mastery: stage, source: { realm: source.realm, attack: decimal(fixed(source.attack)), spellPower: decimal(fixed(source.spellPower)) },
    raw: decimal(raw), total: decimal(total), maxTargets: integer(skill.maxTargets ?? 1, 1, 256, 'maxTargets'), segments };
}

/** Debuffs with the same stable ID refresh at strongest strength, never stack per hit. */
export function effectiveDefense({ defense, reductions = [], penetration = {} }) {
  if (!Array.isArray(reductions)) throw new TypeError('reductions must be an array');
  const byId = new Map();
  for (const entry of reductions) {
    id(entry.id, 'reduction.id');
    const previous = byId.get(entry.id) ?? { flat: 0n, percent: 0n };
    byId.set(entry.id, { flat: max(previous.flat, fixed(entry.flat ?? 0)), percent: max(previous.percent, fixed(entry.percent ?? 0)) });
  }
  let flat = 0n, percent = 0n;
  for (const entry of byId.values()) { flat += entry.flat; percent += entry.percent; }
  let amount = max(0n, fixed(defense) - flat);
  amount = mul(amount, SCALE - min(fixed('0.5'), percent));
  amount = mul(amount, SCALE - min(fixed('0.5'), fixed(penetration.percent ?? 0)));
  return decimal(max(0n, amount - fixed(penetration.flat ?? 0)));
}

function normalizeShield(shield) {
  id(shield.id, 'shield.id');
  const channels = shield.channels ?? CHANNELS;
  if (!Array.isArray(channels) || channels.some(c => !CHANNELS.includes(c))) throw new TypeError('invalid shield channels');
  const elements = shield.elements ?? ELEMENTS;
  if (!Array.isArray(elements) || elements.some(e => !ELEMENTS.includes(e))) throw new TypeError('invalid shield elements');
  const amount = rRead(shield.amount, shield.amountExact);
  return { id: shield.id, amount: rDecimal(amount), amountExact: rSave(amount), channels: [...channels], elements: [...elements] };
}

/** Ordered shields: same ID takes the highest remainder; other IDs share the 60% cap. */
export function personalShields(maxHp, shields = []) {
  let room = rMul(rational(maxHp), rational('0.6'));
  const result = [];
  for (const input of shields) {
    const shield = normalizeShield(input);
    const previous = result.find(s => s.id === shield.id);
    if (previous) {
      if (JSON.stringify(previous.channels) !== JSON.stringify(shield.channels) || JSON.stringify(previous.elements) !== JSON.stringify(shield.elements)) throw new TypeError('same shield ID must keep its type filter');
      if (rCompare(rRead(previous.amount, previous.amountExact), rRead(shield.amount, shield.amountExact)) < 0n) {
        previous.amount = shield.amount; previous.amountExact = shield.amountExact;
      }
    } else result.push(shield);
  }
  for (const shield of result) {
    const granted = rMin(room, rRead(shield.amount, shield.amountExact));
    shield.amount = rDecimal(granted); shield.amountExact = rSave(granted); room = rSub(room, granted);
  }
  return result;
}

function normalizeTarget(input) {
  id(input.id, 'actor.id'); realm(input.realm);
  const result = { ...clone(input), maxHp: decimal(fixed(input.maxHp)), hp: decimal(fixed(input.hp)),
    defense: decimal(fixed(input.defense ?? 0)), resistance: decimal(fixed(input.resistance ?? 0)),
    shields: personalShields(input.maxHp, input.shields), barriers: (input.barriers ?? []).map(normalizeShield) };
  if (fixed(result.hp) > fixed(result.maxHp)) throw new RangeError('hp exceeds maxHp');
  if (new Set(result.barriers.map(s => s.id)).size !== result.barriers.length) throw new TypeError('duplicate barrier id');
  for (const value of Object.values(input.elementResistance ?? {})) fixed(value);
  sum(input.vulnerability); sum(input.damageReduction);
  for (const value of input.damageReduction ?? []) if (fixed(value) > SCALE) throw new RangeError('damage reduction must be within 0..1');
  return result;
}

function absorb(amount, shields, component, log) {
  for (const shield of shields) {
    if (!shield.channels.includes(component.channel) || (component.channel === 'spiritual' && !shield.elements.includes(component.element))) continue;
    const remaining = rRead(shield.amount, shield.amountExact);
    const blocked = rMin(amount, remaining);
    const next = rSub(remaining, blocked);
    shield.amount = rDecimal(next); shield.amountExact = rSave(next); amount = rSub(amount, blocked);
    if (blocked.n) log.push({ id: shield.id, absorbed: rDecimal(blocked) });
  }
  return amount;
}

/** Geometry is supplied as ordered, actually intersected barrier IDs by the collision adapter. */
export function resolveDamage({ target: input, components, barrierIds = [], carry = '0', carryExact }) {
  const target = normalizeTarget(input);
  if (!Array.isArray(components) || !components.length) throw new TypeError('components required');
  if (!Array.isArray(barrierIds) || new Set(barrierIds).size !== barrierIds.length) throw new TypeError('unique ordered barrierIds required');
  const barriers = barrierIds.map(key => {
    const found = target.barriers.find(b => b.id === key);
    if (!found) throw new TypeError('unknown intersected barrier');
    return found;
  });
  let fractional = rRead(carry, carryExact);
  if (fractional.n >= fractional.d) throw new RangeError('carry must be less than one HP');
  let generalRetained = rational(1);
  for (const reduction of target.damageReduction ?? []) generalRetained = rMul(generalRetained, ratio(SCALE - fixed(reduction), SCALE));
  if (rCompare(generalRetained, rational('0.4')) < 0n) generalRetained = rational('0.4');
  const vulnerability = ratio(SCALE + min(fixed('0.5'), sum(target.vulnerability)), SCALE);
  const logs = [];
  let lifeLoss = 0n;
  for (const component of components) {
    id(component.id, 'component.id'); channel(component.channel, component.element);
    const incoming = rational(component.amount);
    const barrierLog = [], shieldLog = [];
    const overflow = absorb(incoming, barriers, component, barrierLog);
    const defense = component.channel === 'physical' ? target.defense : decimal(fixed(target.resistance) + fixed(target.elementResistance?.[component.element] ?? 0));
    const reductions = component.channel === 'physical' ? target.physicalReductions : target.spiritualReductions?.[component.element];
    const eff = component.channel === 'direct' ? 0n : fixed(effectiveDefense({ defense, reductions, penetration: component.penetration }));
    const K = 40n * 6n ** BigInt(target.realm) * SCALE;
    // Rational retention avoids quantizing 1/3 before a high-realm multiplication.
    let retention = ratio(K, K + eff);
    if (rCompare(retention, rational('0.2')) < 0n) retention = rational('0.2');
    retention = rMul(retention, generalRetained);
    if (rCompare(retention, rational('0.15')) < 0n) retention = rational('0.15');
    const beforeShield = rMul(rMul(overflow, vulnerability), retention);
    const afterShield = absorb(beforeShield, target.shields, component, shieldLog);
    fractional = rAdd(fractional, afterShield);
    const whole = fractional.n / fractional.d;
    const due = whole * SCALE;
    fractional = rSub(fractional, ratio(whole));
    const actual = min(fixed(target.hp), due);
    target.hp = decimal(fixed(target.hp) - actual); lifeLoss += actual;
    logs.push({ componentId: component.id, channel: component.channel, element: component.element ?? null, incoming: rDecimal(incoming),
      barrierAbsorption: barrierLog, overflow: rDecimal(overflow), effectiveDefense: decimal(eff), beforePersonalShield: rDecimal(beforeShield),
      shieldAbsorption: shieldLog, lifeLoss: decimal(actual) });
  }
  return { target, carry: rDecimal(fractional), carryExact: rSave(fractional), lifeLoss: decimal(lifeLoss), defeated: fixed(input.hp) > 0n && fixed(target.hp) === 0n, components: logs };
}

export function supportAmount({ base, mastery = 1, kind, missingHp, healingBonuses = [], healingSuppression = [] }) {
  const multipliers = masteryMultipliers(mastery);
  if (!['healing', 'shield', 'control'].includes(kind)) throw new TypeError('invalid support kind');
  let result = mul(fixed(base), fixed(multipliers[kind]));
  if (kind === 'healing') {
    result = mul(mul(result, SCALE + min(fixed('0.5'), sum(healingBonuses))), SCALE - min(fixed('0.5'), sum(healingSuppression)));
    result = min(fixed(missingHp), result);
  }
  return decimal(result);
}

function canonical(value) {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

export function createCombatState({ worldId, actors }) {
  id(worldId, 'worldId');
  if (!Array.isArray(actors)) throw new TypeError('actors required');
  const normalized = actors.map(input => {
    const actor = normalizeTarget(input);
    actor.attack = decimal(fixed(input.attack ?? 0)); actor.spellPower = decimal(fixed(input.spellPower ?? 0));
    actor.level = integer(input.level ?? 1, 1, 10, 'level');
    actor.resource = decimal(fixed(input.resource ?? baseResource(input.realm, actor.level)));
    return actor;
  });
  if (new Set(normalized.map(a => a.id)).size !== normalized.length) throw new TypeError('duplicate actor id');
  return { version: 2, worldId, actors: normalized, casts: [], hits: [], practice: [] };
}

function actorIn(state, actorId) {
  const actor = state.actors.find(a => a.id === actorId);
  if (!actor || actor.present === false || fixed(actor.hp) === 0n) throw new RangeError('actor absent or defeated');
  return actor;
}

export function commitCast(state, request) {
  id(request.castId, 'castId'); id(request.sourceId, 'sourceId');
  if (request.worldId !== state.worldId) throw new RangeError('wrong world');
  const signature = canonical(request);
  const old = state.casts.find(c => c.castId === request.castId);
  if (old) {
    if (old.signature !== signature) throw new Error('cast ID conflict');
    return { state, cast: clone(old), duplicate: true };
  }
  const source = actorIn(state, request.sourceId);
  if (source.canCast === false) throw new RangeError('source cannot cast');
  const snapshot = snapshotSkill({ ...request, source });
  const percent = fixed(request.skill.costPercent ?? 0);
  if (percent > SCALE) throw new RangeError('costPercent must be 0..1');
  const cost = mul(fixed(baseResource(source.realm, source.level)), percent);
  if (fixed(source.resource) < cost) throw new RangeError('insufficient resource');
  const next = nextState(state);
  next.actors.find(a => a.id === source.id).resource = decimal(fixed(source.resource) - cost);
  const cast = { castId: request.castId, sourceId: source.id, signature, snapshot, cost: decimal(cost), resourceKind: source.realm === 0 ? 'capacitor' : 'qi', targets: [] };
  next.casts.push(cast);
  return { state: next, cast: clone(cast), duplicate: false };
}

export function resolveHit(state, request) {
  id(request.hitId, 'hitId'); id(request.targetId, 'targetId'); id(request.castId, 'castId');
  if (request.worldId !== state.worldId) throw new RangeError('wrong world');
  const signature = canonical(request);
  const old = state.hits.find(h => h.hitId === request.hitId);
  if (old) {
    if (old.signature !== signature) throw new Error('hit ID conflict');
    return { state, result: clone(old.result), duplicate: true, events: [] };
  }
  const cast = state.casts.find(c => c.castId === request.castId);
  if (!cast || cast.interrupted) throw new RangeError('cast absent or interrupted');
  integer(request.segment, 0, cast.snapshot.segments.length - 1, 'segment');
  const prior = state.hits.find(h => h.castId === request.castId && h.targetId === request.targetId && h.segment === request.segment);
  if (prior) {
    const next = nextState(state);
    next.hits.push({ ...clone(prior), hitId: request.hitId, signature, aliasOf: prior.aliasOf ?? prior.hitId });
    return { state: next, result: clone(prior.result), duplicate: true, events: [] };
  }
  const target = actorIn(state, request.targetId);
  const targetLedger = cast.targets.find(t => t.targetId === target.id);
  if (!targetLedger && cast.targets.length >= cast.snapshot.maxTargets) throw new RangeError('target limit exceeded');
  const result = resolveDamage({ target, components: cast.snapshot.segments[request.segment], barrierIds: request.barrierIds,
    carry: targetLedger?.carry ?? '0', carryExact: targetLedger?.carryExact });
  const next = nextState(state);
  next.actors[next.actors.findIndex(a => a.id === target.id)] = result.target;
  const nextCast = next.casts.find(c => c.castId === cast.castId);
  const entry = nextCast.targets.find(t => t.targetId === target.id);
  if (entry) { entry.carry = result.carry; entry.carryExact = result.carryExact; }
  else nextCast.targets.push({ targetId: target.id, carry: result.carry, carryExact: result.carryExact });
  const events = result.defeated && target.defeatEligible === true ? [{ eventId: `defeat:${JSON.stringify([state.worldId, target.id])}`, worldId: state.worldId, sourceInstanceId: target.id, kind: 'defeatCommitted', committed: true }] : [];
  next.hits.push({ hitId: request.hitId, castId: request.castId, targetId: target.id, segment: request.segment, signature, result: clone(result) });
  return { state: next, result, duplicate: false, events };
}

/** Interruption spends no more resources and never refunds the committed startup cost. */
export function interruptCast(state, castId) {
  const next = nextState(state);
  const cast = next.casts.find(c => c.castId === castId);
  if (!cast) throw new RangeError('unknown cast');
  cast.interrupted = true;
  return next;
}

/** Evidence is provided by the gameplay adapter, never by empty casts/training dummies. */
export function awardPractice(state, { actorId, skillId, eventId, evidence, effective }) {
  id(actorId); id(skillId); id(eventId);
  if (!state.actors.some(a => a.id === actorId)) throw new RangeError('unknown actor');
  if (!['ordinary', 'precise', 'trial'].includes(evidence) || typeof effective !== 'boolean') throw new TypeError('invalid practice evidence');
  const points = effective ? { ordinary: 5, precise: 10, trial: 30 }[evidence] : 0;
  const next = nextState(state);
  let entry = next.practice.find(p => p.actorId === actorId && p.skillId === skillId);
  if (!entry) { entry = { actorId, skillId, total: '0', events: [] }; next.practice.push(entry); }
  const prior = entry.events.find(e => e.eventId === eventId);
  const delta = Math.max(0, points - (prior?.points ?? 0));
  if (prior) prior.points += delta;
  else entry.events.push({ eventId, points });
  entry.total = (BigInt(entry.total) + BigInt(delta)).toString();
  return { state: next, awarded: delta, total: entry.total };
}
