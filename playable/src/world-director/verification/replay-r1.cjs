// Developer replay only. Reads R1 evidence; writes no files and does not edit R1 tests.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');

async function main() {
  const evidenceDir = path.resolve(process.argv[2]);
  const moduleDir = path.resolve(__dirname, '..');
  const moduleURL = pathToFileURL(moduleDir + path.sep).href;
  const files = ['independent.test.mjs', 'repro-historical-fragment.mjs', 'repro-state.json'];
  const hashes = () => files.map(f => createHash('sha256').update(fs.readFileSync(path.join(evidenceDir, f))).digest('hex'));
  const beforeHashes = hashes();
  const read = name => fs.readFileSync(path.join(evidenceDir, name), 'utf8')
    .replaceAll('./frozen/playable/src/world-director/', moduleURL);
  const independent = spawnSync(process.execPath, ['--input-type=module', '--eval', read(files[0])], { encoding: 'utf8' });
  process.stdout.write(independent.stdout);
  process.stderr.write(independent.stderr);
  assert.equal(independent.status, 0, 'R1 independent cases failed against current DEV implementation');

  // R1 repro deliberately has no catch and always exits 1 if it reaches its end.
  // On repaired code it must throw at the attempted reserve, before producing output.
  // Remove its evidence write in memory so even a regression cannot alter R1 evidence.
  const repro = spawnSync(process.execPath, ['--input-type=module', '--eval',
    read(files[1]).replace('fs.writeFileSync(', 'console.log(')], { encoding: 'utf8' });
  assert.equal(repro.status, 1);
  assert.match(repro.stderr, /Error: uniqueIdentityConflict/);
  assert.equal(repro.stdout, '');
  console.log('R1 minimal repro: expected uniqueIdentityConflict; no evidence write reached.');

  const { createDirector } = await import(moduleURL + 'director.mjs');
  const options = { definitions: { schemaVersion: 1, rulesVersion: 'repro', anchors: [] },
    worldId: 'w', worldSeed: 's', clock: () => 0, spatialQuery: () => ({}) };
  const evidence = JSON.parse(fs.readFileSync(path.join(evidenceDir, files[2]), 'utf8'));
  const before = structuredClone(evidence);
  assert.deepEqual(createDirector({ ...options, savedState: evidence.before }).serializeDirector(), evidence.before);
  for (const savedState of [evidence.after, evidence.reloaded]) {
    assert.throws(() => createDirector({ ...options, savedState }), /uniqueLedgerConflict/);
  }
  assert.deepEqual(evidence, before);
  assert.deepEqual(hashes(), beforeHashes);
  console.log('R1 real snapshots: valid pre-state loads; both erroneous post-states rejected; source/evidence hashes unchanged.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
