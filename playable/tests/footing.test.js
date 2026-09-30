const test = require('node:test');
const assert = require('node:assert/strict');
const modules = Promise.all([import('../src/footing.mjs'), import('../src/layout.mjs'), import('../src/ground-cover.mjs'), import('../src/rocks.mjs')]);
async function setup() { return Object.assign({}, ...await modules); }

test('foot samples identify the material actually under the sole, not a nearby boulder', async () => {
  const m = await setup(), rock = m.ROCK_FIELD.rocks.find(r => r.solid && r.x === 24 && r.z === 130);
  assert.ok(rock);
  const top = m.rockSurfaceHeight(rock, rock.x, rock.z);
  assert.equal(m.sampleFooting(rock.x, rock.z, top).surface, 'rock');
  assert.equal(m.sampleFooting(rock.x, rock.z, top).height, top);
  assert.equal(m.sampleFooting(rock.x, rock.z, top).blocked, false);
  const x = rock.x + rock.radius + .01, z = rock.z;
  assert.equal(m.touchesRock(rock, x, z), false);
  assert.notEqual(m.sampleFooting(x, z).surface, 'rock');
});

test('dust deposits and gravel use the same stable world-space coverage as terrain tint', async () => {
  const m = await setup(); let dust = null, gravel = null;
  for (let x = -600; x < 600 && (!dust || !gravel); x += 19) for (let z = 300; z < 500; z += 23) {
    const sample = m.sampleFooting(x, z);
    if (sample.blocked || Math.abs(sample.height - m.terrainHeight(x, z)) > 1e-6) continue;
    if (m.dustCoverage(x, z) > .9 && sample.surface === 'dust') dust = { x, z };
    if (m.dustCoverage(x, z) < .1 && sample.surface === 'gravel') gravel = { x, z };
  }
  assert.ok(dust); assert.ok(gravel);
  for (const point of [dust, gravel]) {
    assert.deepEqual(m.sampleFooting(point.x, point.z), m.sampleFooting(point.x, point.z));
    assert.equal(m.surfaceAt(point.x, point.z), m.sampleFooting(point.x, point.z).surface);
  }
});

test('metal deck, stone monuments and high obstacles have distinct support and reachability', async () => {
  const m = await setup();
  assert.deepEqual(m.sampleFooting(0, -500, 0), { height: .02, surface: 'metal', indoor: true, blocked: false });
  assert.equal(m.sampleFooting(-49, -620, 0).blocked, true);
  assert.equal(m.sampleFooting(0, -711, 0).blocked, true);
  assert.equal(m.sampleFooting(0, -711, 0, { gateOpen: true }).blocked, false);
  const base = m.terrainHeight(-420, -160);
  const high = m.sampleFooting(-420, -160, base);
  assert.equal(high.blocked, true); assert.equal(high.surface, 'rock');
  assert.equal(m.sampleFooting(-420, -160, base + 4).blocked, false);
});

test('a parked vehicle supports a landed boot as metal but is not an indoor echo chamber', async () => {
  const m = await setup(), vehicle = { x: 72, z: 80, mounted: false };
  const base = m.terrainHeight(72, 80), options = { vehicle, vehicleHeight: 1.3 };
  const sample = m.sampleFooting(72, 80, base + 1.3, options);
  assert.equal(sample.surface, 'metal'); assert.equal(sample.indoor, false);
  assert.equal(sample.height, base + 1.3); assert.equal(sample.blocked, false);
  assert.equal(m.sampleFooting(72, 80, base, options).blocked, true);
});

test('collision timbre follows the contacted hull, vehicle or rock instead of the ground beside it', async () => {
  const m = await setup();
  assert.deepEqual(m.sampleImpact(-7.4, -670), { surface: 'metal', indoor: true });
  assert.deepEqual(m.sampleImpact(50.5, -620), { surface: 'metal', indoor: false });
  assert.deepEqual(m.sampleImpact(24, 133), { surface: 'rock', indoor: false });
  assert.deepEqual(m.sampleImpact(73.4, 80, { vehicle: {x:72,z:80,mounted:false} }), { surface: 'metal', indoor: false });
});
