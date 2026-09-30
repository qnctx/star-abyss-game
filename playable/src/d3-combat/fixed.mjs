// Decimal amounts use eight fractional places; multiplication never uses Number.
export const SCALE = 100000000n;
export const min = (a, b) => a < b ? a : b;
export const max = (a, b) => a > b ? a : b;
export const mul = (a, b) => a * b / SCALE;

export function fixed(value, name = 'value') {
  if (typeof value === 'number' && (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(`${name}: use an exact decimal string for large amounts`);
  }
  if (!['number', 'string'].includes(typeof value) || !/^(0|[1-9]\d*)(\.\d{1,8})?$/.test(String(value))) {
    throw new TypeError(`${name}: expected a nonnegative decimal with at most 8 places`);
  }
  const [whole, fraction = ''] = String(value).split('.');
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(8, '0'));
}

export function decimal(value) {
  const fraction = (value % SCALE).toString().padStart(8, '0').replace(/0+$/, '');
  return `${value / SCALE}${fraction ? `.${fraction}` : ''}`;
}

export function integer(value, low, high, name) {
  if (!Number.isSafeInteger(value) || value < low || value > high) throw new RangeError(`${name}: expected integer ${low}..${high}`);
  return value;
}

export function id(value, name = 'id') {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name}: expected stable nonempty string`);
  return value;
}

export function sum(values = []) {
  if (!Array.isArray(values)) throw new TypeError('expected decimal array');
  return values.reduce((total, value) => total + fixed(value), 0n);
}

export function weights(values = [1]) {
  if (!Array.isArray(values) || !values.length || values.length > 256) throw new RangeError('expected 1..256 weights');
  const result = values.map(value => fixed(value, 'weight'));
  if (result.some(value => value === 0n) || result.reduce((a, b) => a + b, 0n) !== SCALE) throw new RangeError('positive weights must sum to 1');
  return result;
}

// Largest-remainder allocation, deterministic ties by index, conserves every unit.
export function allocate(total, shares) {
  const result = shares.map(share => total * share / SCALE);
  let remainder = total - result.reduce((a, b) => a + b, 0n);
  const order = shares.map((share, index) => ({ index, remainder: total * share % SCALE }))
    .sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  for (const { index } of order) if (remainder-- > 0n) result[index] += 1n;
  return result;
}

// R2 exact HP quantities. Decimal strings remain the display/input format;
// fractions preserve defense and shield remainders until whole HP is deducted.
export function ratio(n, d = 1n) {
  if (n < 0n || d <= 0n) throw new RangeError('invalid nonnegative rational');
  let a = n, b = d;
  while (b) [a, b] = [b, a % b];
  return { n: n / a, d: d / a };
}
export const rational = value => ratio(fixed(value), SCALE);
export const rAdd = (a, b) => ratio(a.n * b.d + b.n * a.d, a.d * b.d);
export const rSub = (a, b) => ratio(a.n * b.d - b.n * a.d, a.d * b.d);
export const rMul = (a, b) => ratio(a.n * b.n, a.d * b.d);
export const rCompare = (a, b) => a.n * b.d - b.n * a.d;
export const rMin = (a, b) => rCompare(a, b) < 0n ? a : b;
export const rDecimal = value => decimal(value.n * SCALE / value.d);
export const rSave = value => ({ numerator: value.n.toString(), denominator: value.d.toString() });

export function rRead(display, exact) {
  const fallback = rational(display);
  if (exact === undefined) return fallback; // R1 finite remainder migration.
  if (!exact || typeof exact !== 'object' || Array.isArray(exact)
      || !['numerator', 'denominator'].every(key => typeof exact[key] === 'string' && /^(0|[1-9]\d*)$/.test(exact[key]))) {
    throw new TypeError('invalid exact amount');
  }
  const value = ratio(BigInt(exact.numerator), BigInt(exact.denominator));
  if (rDecimal(value) !== rDecimal(fallback)) throw new RangeError('exact amount does not match decimal display');
  return value;
}
