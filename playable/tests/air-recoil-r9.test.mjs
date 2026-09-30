import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPlanetRuntime } from '../src/planet-runtime.mjs';
import { createMobility, serializeMobility } from '../src/mobility.mjs';
import { localToGlobal, globalToLocal } from '../src/planet/coordinates.mjs';

function fixture() {
  const context = { player: { x: 0, y: 0, z: 190, yaw: 0, pitch: 0 }, story: { flags: { complete: true } }, mobility: createMobility(), realm: 4 };
  context.mobility.vehicle.repaired = true;
  const runtime = createPlanetRuntime({ world: { scene: new THREE.Scene(), setPlanetController() {} }, getContext: () => context, toast() {} });
  const position = localToGlobal({ x: 0, y: 500, z: 190 });
  const snapshot = { version: 1, player: { ...context.player }, story: context.story,
    mobility: serializeMobility(context.mobility), planet: { version: 1, id: runtime.adapter.id,
      seed: runtime.adapter.seed, radius: runtime.adapter.radius, position,
      gameplay: { version: 1, energy: 100, progression: { surveys: [], commissioned: false } } } };
  runtime.reset(snapshot);
  assert.equal(runtime.active, true);
  assert.equal(runtime.adapter.sample(runtime.position).ready, true);
  return { runtime, context, snapshot };
}

test('committed aerial impact moves the player by the metre displacement over 0.55 simulation seconds', () => {
  const { runtime, context, snapshot } = fixture();
  try {
    const start = globalToLocal(runtime.position);
    assert.equal(runtime.airImpulse({ id: 'hit-1', dx: 3, dy: 0, dz: 0, kind: 'jab' }), true);
    assert.equal(runtime.airImpulse({ id: 'hit-1', dx: 3, dy: 0, dz: 0, kind: 'jab' }), false, 'duplicate hit is ignored');
    for (let i = 0; i < 33; i++) runtime.step({}, 1 / 60);
    const end = globalToLocal(runtime.position);
    assert.equal(runtime.airImpulseSnapshot().active, false);
    assert.equal(runtime.airImpulseSnapshot().last.result, 'moved');
    assert.ok(Math.abs(end.x - start.x - 3) < .03, `recoil ${end.x - start.x} m`);
    assert.ok(Math.abs(context.player.x - end.x) < 1e-6, 'legacy body follows canonical position');
    assert.equal(runtime.save(snapshot).planet.gameplay.energy, 100, 'recoil does not spend flight energy');
  } finally { runtime.dispose(); }
});

test('reset and rescue discard any pending recoil; no replay after restore or landing', () => {
  const { runtime, context, snapshot } = fixture();
  try {
    assert.equal(runtime.airImpulse({ id: 'hit-reset', dx: 3, dy: 0, dz: 0, kind: 'jab' }), true);
    runtime.reset(snapshot);
    assert.equal(runtime.airImpulseSnapshot().active, false);
    assert.equal(runtime.airImpulseSnapshot().last, null);
    const before = { ...runtime.position };
    runtime.step({}, 1 / 60);
    assert.ok(Math.hypot(runtime.position.x - before.x, runtime.position.y - before.y, runtime.position.z - before.z) < 1e-7);
    assert.equal(runtime.airImpulse({ id: 'hit-rescue', dx: 3, dy: 0, dz: 0, kind: 'jab' }), true);
    Object.assign(context.player, { x: 0, y: 0, z: 190 });
    runtime.rescue();
    assert.equal(runtime.active, false);
    runtime.step({}, 1 / 60);
    assert.equal(runtime.airImpulseSnapshot().active, false);
  } finally { runtime.dispose(); }
});

test('the runtime obeys authoritative swept collision and never applies a blocked recoil', () => {
  const { runtime } = fixture();
  try {
    const before = { ...runtime.position };
    runtime.adapter.sweep = () => ({ ready: true, clear: false });
    assert.equal(runtime.airImpulse({ id: 'hit-wall', dx: 3, dy: 0, dz: 0, kind: 'cross' }), true);
    runtime.step({}, 1 / 60);
    assert.equal(runtime.airImpulseSnapshot().last.result, 'blocked');
    assert.equal(runtime.airImpulseSnapshot().active, false);
    assert.deepEqual(runtime.position, before);
  } finally { runtime.dispose(); }
});
