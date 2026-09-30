const test = require('node:test');
const assert = require('node:assert/strict');
const modules = Promise.all([import('../src/layout.mjs'), import('../src/rocks.mjs'), import('../src/meteor-scene.mjs')]);
const setup = async () => Object.assign({}, ...await modules);

test('meteor fields are deterministic, clustered, and include readable physical fragments', async () => {
  const m = await setup(), field = m.createRockField(m.POINTS);
  assert.deepEqual(field.rocks, m.ROCK_FIELD.rocks);
  assert.deepEqual(field.impacts, m.ROCK_FIELD.impacts);
  const meteors = field.rocks.filter(r => r.kind === 'meteor');
  assert.ok(field.impacts.length >= 40);
  assert.ok(meteors.filter(r => r.solid && r.height >= .3 && r.height <= .95).length >= 250);
  assert.ok(meteors.filter(r => r.height >= 1.4).length >= 40);
  for (const rock of meteors) {
    const impact = field.impacts[rock.cluster];
    assert.ok(impact);
    assert.ok(Math.hypot(rock.x - impact.x, rock.z - impact.z) <= 17);
    if (rock.height > .12) assert.equal(rock.solid, true, 'visible obstacles must not be ghost decorations');
  }
});

test('every meteor fragment uses the same local solid footprint as the rendered rock', async () => {
  const m = await setup();
  for (const rock of m.ROCK_FIELD.rocks.filter(r => r.kind === 'meteor' && r.solid)) {
    assert.equal(m.touchesRock(rock, rock.x, rock.z), true);
    assert.equal(m.collides(rock.x, rock.z), true);
    assert.ok(m.ROCK_FIELD.query(rock.x, rock.z, .42).includes(rock));
    assert.equal(m.touchesRock(rock, rock.x + rock.radius + .43, rock.z, .42), false);
  }
});

test('recovery sites and the first expedition route stay clear without mobility upgrades', async () => {
  const m = await setup();
  for (const point of m.METEOR_CLEARINGS) {
    assert.equal(m.collides(point.x, point.z), false);
    assert.equal(m.ROCK_FIELD.query(point.x, point.z, point.radius).some(r => Math.hypot(r.x - point.x, r.z - point.z) < r.radius + point.radius), false);
  }
  for (let z = 225; z > -458; z -= 2) {
    for (const x of [-12, 0, 12]) assert.equal(m.ROCK_FIELD.query(x, z, .42).some(r => r.solid && m.touchesRock(r, x, z, .42)), false);
  }
  assert.ok(m.ROCK_FIELD.query(24, 130, 1).some(r => r.x === 24 && r.z === 130 && r.height === 1.7));
  assert.ok(m.ROCK_FIELD.query(24, 130, 1).length < 60, 'local hash query must not turn into a full-field scan');
  for (const point of m.POINTS) {
    assert.equal(m.ROCK_FIELD.rocks.some(r => r.kind === 'meteor' && r.solid && Math.hypot(r.x - point.x, r.z - point.z) < r.radius + 13), false);
  }
});

test('meteor details are three static batches with terrain-conforming scars and no lights', async () => {
  const m = await setup(), materials = [], group = m.createMeteorDetails(materials);
  assert.equal(group.name, 'meteor-details'); assert.equal(group.children.length, 3); assert.equal(materials.length, 3);
  group.traverse(object => assert.ok(!object.isLight));
  const scars = group.getObjectByName('meteor-fall-scars').geometry.attributes.position;
  for (let i = 0; i < scars.count; i++) {
    const x = scars.getX(i), y = scars.getY(i), z = scars.getZ(i);
    assert.ok(Math.abs(y - (m.terrainHeight(x, z) - .026)) < .001, 'flat impact decals follow the actual terrain');
  }
  for (const item of group.children) {
    assert.ok(item.geometry.attributes.position.count > 0);
    assert.ok(item.geometry.attributes.position.array.every(Number.isFinite));
    item.geometry.dispose(); item.material.dispose();
  }
});
