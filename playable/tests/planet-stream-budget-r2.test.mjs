import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildChunkSteps} from '../src/planet/chunks.mjs';
import {createPlanetTerrain} from '../src/planet/scene-adapter.mjs';
import {createPlanetField} from '../src/planet/field.mjs';

test('terrain geometry advances one expensive surface vertex per cooperative step', () => {
  const source = createPlanetField();
  let calls = 0;
  const field = {...source, surfacePoint(direction) { calls++; return source.surfacePoint(direction); }};
  const steps = buildChunkSteps({face:'px',level:1,x:0,y:0}, field, {segments:4});
  for (let vertex = 0; vertex < 25; vertex++) {
    const before = calls;
    assert.equal(steps.next().done, false);
    assert.equal(calls - before, vertex === 0 ? 2 : 1);
  }
  const done = steps.next();
  assert.equal(done.done, true);
  assert.equal(done.value.positions.length / 3, 25 + 4 * 5);
  assert.equal(done.value.surfaceIndexCount, 4 * 4 * 6);
  assert.equal(done.value.indices.length, (4 * 4 + 4 * 4) * 6);
});

test('cancel and publish retain old six-face coverage; cached mesh and attributes survive reuse', () => {
  const field = createPlanetField();
  const terrain = createPlanetTerrain({THREE, scene:new THREE.Scene(), field, segments:4, capacity:18, lod:{maxChunks:9,maxLevel:3}});
  const position = direction => field.surfacePoint(direction);
  const start = position({x:1,y:0,z:0});
  const north = position({x:0,y:1,z:0});
  const opposite = position({x:-1,y:0,z:0});
  terrain.update(start);
  const firstRevision = terrain.revision;
  const initialMeshes = [...terrain.root.children];
  const oldDetail = initialMeshes.find(mesh => mesh.name.startsWith('px/1/'));
  assert.ok(oldDetail);
  let disposals = 0;
  oldDetail.geometry.addEventListener('dispose', () => disposals++);

  terrain.update(north, {budgetMs:0,maxLoads:1});
  assert.equal(terrain.pending, true);
  assert.equal(terrain.revision, firstRevision);
  assert.deepEqual(terrain.root.children, initialMeshes);

  // Forced destination supersedes the unfinished north-face job. Publication is atomic.
  terrain.update(opposite);
  assert.equal(terrain.pending, false);
  assert.equal(new Set(terrain.root.children.map(mesh => mesh.name.split('/')[0])).size, 6);
  assert.equal(terrain.sampleRenderedSurface(opposite).ready, true);
  assert.equal(disposals, 0);

  // Return to a recently used location with a finite budget. Reuse preserves the
  // exact geometry object, color values, normals, and collision triangles.
  terrain.update(start, {budgetMs:0,maxLoads:1});
  let pumps = 0;
  while (terrain.pending) {
    terrain.update(start, {budgetMs:0,maxLoads:1});
    assert.ok(++pumps < 5000);
  }
  const reused = terrain.root.children.find(mesh => mesh.name === oldDetail.name);
  assert.equal(reused, oldDetail);
  assert.equal(reused.geometry.getAttribute('color').count, reused.geometry.getAttribute('position').count);
  assert.equal(reused.geometry.getAttribute('normal').count, reused.geometry.getAttribute('position').count);
  assert.equal(terrain.sampleRenderedSurface(start).ready, true);
  assert.equal(disposals, 0);
  terrain.destroy();
  assert.equal(disposals, 1);
});

test('cooperative and synchronous publication have identical terrain geometry, normals and colors', () => {
  const field = createPlanetField();
  const make = () => createPlanetTerrain({THREE, scene:new THREE.Scene(), field, segments:4, capacity:18, lod:{maxChunks:9,maxLevel:3}});
  const target = field.surfacePoint({x:1,y:0,z:0});
  const synchronous = make(), cooperative = make();
  synchronous.update(target);
  cooperative.update(target, {budgetMs:0,maxLoads:1});
  let pumps = 0;
  while (cooperative.pending) {
    cooperative.update(target, {budgetMs:0,maxLoads:1});
    assert.ok(++pumps < 5000);
  }
  const byName = terrain => new Map(terrain.root.children.map(mesh => [mesh.name, mesh]));
  const expected = byName(synchronous), actual = byName(cooperative);
  assert.deepEqual([...actual.keys()].sort(), [...expected.keys()].sort());
  for (const [name, mesh] of actual) {
    const reference = expected.get(name);
    for (const attribute of ['position','normal','color']) {
      assert.deepEqual(mesh.geometry.getAttribute(attribute).array, reference.geometry.getAttribute(attribute).array, `${name} ${attribute}`);
    }
    assert.deepEqual(mesh.geometry.index.array, reference.geometry.index.array, `${name} triangles`);
  }
  synchronous.destroy();
  cooperative.destroy();
});
