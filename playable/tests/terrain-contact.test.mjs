import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleTerrainContact, advanceVerticalContact } from '../src/terrain-contact.mjs';

const close = (actual, expected, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) <= epsilon,
  `${actual} differs from ${expected}`);

for (const [gx, gz] of [[.4, -.7], [-.65, .25]]) {
  test(`support plane matches slope ${gx}, ${gz} independently of heading`, () => {
    for (const yaw of [0, .7, Math.PI / 2, Math.PI]) {
      const result = sampleTerrainContact({ height: (x, z) => 12 + gx * x + gz * z,
        x: 40, z: -70, yaw });
      assert.equal(result.ready, true);
      close(result.height, 12 + gx * 40 + gz * -70);
      close(result.gradient.x, gx); close(result.gradient.z, gz);
      close(result.slope, Math.hypot(gx, gz));
      close(result.normal.x + result.normal.y * gx, 0);
      close(result.normal.z + result.normal.y * gz, 0);
      close(Math.hypot(...Object.values(result.normal)), 1);
    }
  });
}

test('convex ridge support covers center, edges and corners instead of sinking into the crest', () => {
  const height = (x, z) => 5 - Math.abs(x) * .8 + z * .2;
  const result = sampleTerrainContact({ height, x: 0, z: 0, yaw: .43 });
  assert.ok(result.height >= 5 - 1e-12);
  for (const side of [-1, 0, 1]) for (const fore of [-1, 0, 1]) {
    const x = Math.cos(.43) * side * .8 + Math.sin(.43) * fore * 1.05;
    const z = -Math.sin(.43) * side * .8 + Math.cos(.43) * fore * 1.05;
    assert.ok(result.height + result.gradient.x * x + result.gradient.z * z >= height(x, z) - 1e-12);
  }
});

test('one missing corner, a throwing sampler and invalid dimensions fail closed', () => {
  for (const height of [() => NaN, () => null, (x, z) => x > .5 && z > .5 ? undefined : 0,
    () => { throw new Error('chunk missing'); }]) {
    const result = sampleTerrainContact({ height, x: 0, z: 0 });
    assert.equal(result.ready, false); assert.equal(result.height, null);
  }
  assert.equal(sampleTerrainContact({ height: () => 0, x: 0, z: 0, halfWidth: 0 }).ready, false);
});

test('continuous downhill and uphill support stays grounded without oscillation', () => {
  let state = { y: 8, vy: 0, grounded: true };
  for (let i = 1; i <= 100; i++) {
    const target = 8 - i * .06;
    state = advanceVerticalContact(state, target, 1 / 60);
    close(state.y, target); assert.equal(state.grounded, true); close(state.vy, 0);
  }
  state = advanceVerticalContact(state, state.y + .1, 1 / 60);
  close(state.y, 2.1); assert.equal(state.grounded, true);
});

test('driving off a cliff falls continuously then lands, at different frame rates', () => {
  for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
    let state = { y: 10, vy: 0, grounded: true };
    state = advanceVerticalContact(state, 0, dt);
    assert.equal(state.grounded, false); assert.ok(state.y < 10 && state.y > 9);
    for (let elapsed = dt; elapsed < 2; elapsed += dt) {
      const previousY = state.y;
      state = advanceVerticalContact(state, 0, dt);
      assert.ok(state.y <= previousY && state.y >= 0);
    }
    assert.deepEqual(state, { y: 0, vy: 0, grounded: true });
  }
});

test('large grounded steps are not automatically teleported upward', () => {
  assert.deepEqual(advanceVerticalContact({ y: 0, grounded: true }, 3, 1 / 60),
    { y: 0, vy: 0, grounded: true });
});

test('free fall is partition independent before impact and large dt cannot tunnel through terrain', () => {
  let state = { y: 20, vy: -1, grounded: false };
  const whole = advanceVerticalContact(state, 0, .5);
  for (let i = 0; i < 10; i++) state = advanceVerticalContact(state, 0, .05);
  close(state.y, whole.y); close(state.vy, whole.vy);
  assert.deepEqual(advanceVerticalContact(state, 0, 10), { y: 0, vy: 0, grounded: true });
});

test('unloaded ground and invalid time preserve last physical state', () => {
  const state = { y: 9, vy: -2, grounded: false };
  for (const [height, dt] of [[null, .1], [NaN, .1], [0, NaN], [0, -1], [0, 0]]) {
    assert.deepEqual(advanceVerticalContact(state, height, dt), state);
  }
});
