const assert = require('node:assert/strict');
const { test, before } = require('node:test');
let m;
before(async () => {
  m = Object.assign({}, ...await Promise.all([
    import('../src/survey.mjs'), import('../src/survey-sites.mjs'), import('../src/calibration.mjs'),
    import('../src/layout.mjs'), import('../src/movement.mjs'), import('../src/survey-scene.mjs'), import('../src/camera.mjs'),
  ]));
});
const completedStory = () => ({ chapterVersion: 2, flags: { complete: true } });
function measurement(id) {
  const session = m.createCalibration(id), view = m.calibrationView(session);
  return { values: view.channels.map(channel => (channel.targetAngle - channel.sourceAngle + 360) % 360) };
}

test('far-field investigation is unavailable until both chapters have been sealed', () => {
  const state = m.createSurvey();
  for (const story of [undefined, {}, { flags: { returned: true } }, { flags: { complete: 'true' } }, { flags: Object.create({ complete: true }) }]) {
    const view = m.surveyView(state, story);
    assert.equal(view.available, false);
    assert.equal(view.objective, null);
    assert.deepEqual(view.knownIds, []);
    assert.deepEqual(view.records, []);
    assert.equal(m.collectSurvey(state, 'survey-west', story, measurement('survey-west')).changed, false);
    assert.equal(m.archiveSurvey(state, story).changed, false);
  }
  assert.deepEqual(state, m.createSurvey());
});

test('old completed chapter-two saves start the first far-field site without replaying the story', () => {
  const story = completedStory(), before = JSON.stringify(story), state = m.restoreSurvey(undefined, story);
  const view = m.surveyView(state, story);
  assert.equal(view.available, true);
  assert.equal(view.current.id, 'survey-west');
  assert.equal(view.objective.target, 'survey-west');
  assert.deepEqual(view.knownIds, ['survey-west']);
  assert.equal(view.archivedCount, 0);
  assert.equal(JSON.stringify(story), before);
});

test('three sites form measured sample, return, archive and next-index loops', () => {
  const story = completedStory(), state = m.createSurvey();
  for (let index = 0; index < m.SURVEY_SITES.length; index++) {
    const site = m.SURVEY_SITES[index];
    assert.equal(m.surveyView(state, story).objective.target, site.id);
    assert.equal(m.collectSurvey(state, site.id, story, measurement(site.id)).changed, true);
    const loaded = m.restoreSurvey(JSON.parse(JSON.stringify(m.serializeSurvey(state))), story);
    assert.deepEqual(loaded, state, 'unsealed evidence survives save/continue');
    const pending = m.surveyView(state, story);
    assert.equal(pending.pending, site.id);
    assert.equal(pending.objective.target, 'beacon');
    assert.equal(pending.archivedCount, index);
    assert.equal(pending.knownIds.length, index + 1, 'next index is not disclosed before return');
    assert.ok(pending.records.some(record => record.title.startsWith('待封存')));
    assert.equal(m.archiveSurvey(state, story).changed, true);
    assert.equal(state.pending, null);
    assert.deepEqual(state.archived, m.SURVEY_SITES.slice(0, index + 1).map(site => site.id));
  }
  const view = m.surveyView(state, story);
  assert.equal(view.complete, true);
  assert.equal(view.current, null);
  assert.equal(view.objective.target, null);
  assert.equal(view.records.length, 5);
  assert.ok(view.records.at(-1).title.startsWith('远野终记'));
  assert.match(view.summary, /3 \/ 3/);
});

test('out-of-order visits, wrong channels and duplicate interactions never grant samples', () => {
  const story = completedStory(), state = m.createSurvey();
  for (const id of ['survey-east', 'survey-north', 'beacon', 'wrong']) {
    assert.equal(m.collectSurvey(state, id, story, { values: [0,0,0] }).changed, false);
  }
  for (const raw of [undefined, {}, { values: [0,0,0] }, { values: [285,150] }, { values: ['285',150,30] }, { values: [Infinity,150,30] }]) {
    assert.equal(m.collectSurvey(state, 'survey-west', story, raw).changed, false);
  }
  assert.deepEqual(state, m.createSurvey());
  m.collectSurvey(state, 'survey-west', story, measurement('survey-west'));
  let before = JSON.stringify(state);
  for (const id of ['survey-west', 'survey-east']) assert.equal(m.collectSurvey(state, id, story, measurement(id)).changed, false);
  assert.equal(JSON.stringify(state), before);
  m.archiveSurvey(state, story);
  before = JSON.stringify(state);
  assert.equal(m.archiveSurvey(state, story).changed, false);
  assert.equal(m.collectSurvey(state, 'survey-west', story, measurement('survey-west')).changed, false);
  assert.equal(JSON.stringify(state), before);
});

test('restoration keeps only a sequential archive prefix and the current pending site', () => {
  const story = completedStory();
  for (const raw of [null, undefined, [], 2, 'save', {}, { version: 9 }, Object.create({ version: 1, archived: ['survey-west'] })]) assert.deepEqual(m.restoreSurvey(raw, story), m.createSurvey());
  assert.deepEqual(m.restoreSurvey({ version: 1, archived: ['survey-east'], pending: 'survey-north' }, story), m.createSurvey());
  assert.deepEqual(m.restoreSurvey({ version: 1, archived: ['survey-west', 'survey-west', 'survey-east'], pending: 'survey-east', records: ['injected'] }, story), { version: 1, archived: ['survey-west'], pending: 'survey-east' });
  assert.deepEqual(m.restoreSurvey({ version: 1, archived: ['survey-west', 'survey-east', 'survey-north'], pending: 'survey-north' }, story), { version: 1, archived: ['survey-west', 'survey-east', 'survey-north'], pending: null });
  const sparse = []; sparse.length = 3; sparse[1] = 'survey-east';
  assert.deepEqual(m.restoreSurvey({ version: 1, archived: sparse, pending: 'survey-west' }, story), { version: 1, archived: [], pending: 'survey-west' });
  assert.deepEqual(m.restoreSurvey({ version: 1, archived: ['survey-west'], pending: 'survey-east' }, { flags: { complete: false } }), m.createSurvey());
});

test('serialized evidence and journal prose are isolated copies without injected data', () => {
  const state = { version: 1, archived: ['survey-west'], pending: 'survey-east', text: '<script>', resources: 999 };
  const saved = m.serializeSurvey(state);
  assert.deepEqual(saved, { version: 1, archived: ['survey-west'], pending: 'survey-east' });
  saved.archived.push('survey-east');
  assert.deepEqual(state.archived, ['survey-west']);
  const view = m.surveyView(state, completedStory());
  view.records[0].text = 'changed'; view.knownIds.push('survey-north');
  const fresh = m.surveyView(state, completedStory());
  assert.notEqual(fresh.records[0].text, 'changed');
  assert.deepEqual(fresh.knownIds, ['survey-west', 'survey-east']);
  assert.ok(fresh.records.every(record => !record.text.includes('<script>')));
});

test('all terminals have open ground approaches, shared solids and rock-free exploration clearings', () => {
  for (const site of m.SURVEY_SITES) {
    assert.ok(Math.abs(site.x) < m.WORLD.halfSize - 100 && Math.abs(site.z) < m.WORLD.halfSize - 100);
    const terminal = m.SURVEY_SOLIDS.find(solid => solid.siteId === site.id && solid.key === 'terminal');
    assert.equal(terminal.x, site.x); assert.equal(terminal.z, site.z);
    assert.ok(m.PROP_SOLIDS.includes(terminal));
    assert.equal(m.collides(site.x, site.z, true), true);
    assert.equal(m.collides(site.x, site.z + 2.2, true), false);
    const player = { x: site.x, z: site.z + 2.2, y: m.terrainHeight(site.x, site.z + 2.2) };
    assert.ok(Math.hypot(player.z - site.z, player.y - m.terrainHeight(site.x, site.z)) < 3.2);
    assert.equal(m.hasLineOfSight(player, site, true), true);
    for (let z = site.z + 2.2; z < site.z + 12; z += .2) assert.equal(m.collides(site.x, z, true), false);
    const clearing = m.SURVEY_CLEARINGS.find(c => c.x === site.x);
    assert.equal(m.ROCK_FIELD.rocks.some(rock => Math.hypot(rock.x - clearing.x, rock.z - clearing.z) < rock.radius + clearing.radius), false);
    assert.equal(m.cameraBlocked({ x: site.x, z: site.z, y: m.terrainHeight(site.x, site.z) + .9 }, true), true);
  }
});

test('the scene batches actual structures and changes terminal state without spawning geometry', () => {
  const materials = [], scene = m.createSurveyScene(materials);
  assert.equal(scene.root.children.length, 3);
  const collect = () => { const meshes = []; scene.root.traverse(object => { if (object.isMesh) meshes.push(object); }); return meshes; };
  const meshes = collect();
  assert.ok(meshes.length <= 18, `${meshes.length} static draw batches`);
  for (const group of scene.root.children) {
    assert.equal(group.userData.solidCount, m.SURVEY_SOLIDS.filter(solid => solid.siteId === group.name).length);
    for (const mesh of group.children) assert.ok(mesh.geometry.attributes.position.count > 0);
  }
  const westStatus = scene.root.children[0].children.find(mesh => mesh.name.endsWith('-status'));
  const dormant = westStatus.material.emissiveIntensity;
  scene.update({ storyComplete: true, survey: m.createSurvey() });
  assert.ok(westStatus.material.emissiveIntensity > dormant);
  const active = westStatus.material.color.getHexString();
  scene.update({ storyComplete: true, survey: { archived: [], pending: 'survey-west' } });
  assert.notEqual(westStatus.material.color.getHexString(), active);
  scene.update({ storyComplete: true, survey: m.surveyView({ version: 1, archived: ['survey-west'], pending: null }, completedStory()) });
  assert.equal(westStatus.material.emissiveIntensity, .35);
  assert.deepEqual(collect(), meshes);
  for (const mesh of meshes) mesh.geometry.dispose();
  for (const mat of materials) mat.dispose();
});
