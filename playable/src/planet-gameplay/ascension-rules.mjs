// The realm is supplied by the trusted progression runtime, never by input controls.
export const ASCENSION_RULES = Object.freeze({
  4: Object.freeze({ cruise: 420, boost: 600 }),
  5: Object.freeze({ cruise: 460, boost: 720 }),
  6: Object.freeze({ cruise: 500, boost: 900, short: 12, long: 60, shortCooldown: 8, longCooldown: 20 }),
  7: Object.freeze({ cruise: 560, boost: 1100, short: 30, long: 180, shortCooldown: 7, longCooldown: 18 }),
  8: Object.freeze({ cruise: 640, boost: 1300, short: 80, long: 600, shortCooldown: 6, longCooldown: 16 }),
  9: Object.freeze({ cruise: 720, boost: 1500, short: 200, long: 1800, shortCooldown: 5, longCooldown: 14 }),
});

export const BLINK_RULES = Object.freeze({
  short: Object.freeze({ energy: 12 }),
  long: Object.freeze({ energy: 25 }),
  segment: 24,
});

export function realmFlightRules(realm = 4) {
  return ASCENSION_RULES[Number.isInteger(realm) ? realm : 4] || ASCENSION_RULES[4];
}

export function blinkRules(realm, mode) {
  const rank = ASCENSION_RULES[realm];
  const action = BLINK_RULES[mode];
  const distance = rank?.[mode];
  return Number.isFinite(distance) && action ? { distance, energy: action.energy, cooldown: rank[`${mode}Cooldown`] } : null;
}
