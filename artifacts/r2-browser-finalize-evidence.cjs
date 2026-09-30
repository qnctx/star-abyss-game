const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const root = path.resolve(__dirname, '..');
const build = require('./r2-build-inputs.json');
const expected = build.bundleSHA || build.bundleSha || build.gameJS?.sha256;
assert.match(expected, /^[a-f0-9]{64}$/);

for (const [sourceName, destName] of [
  ['r2-integrated-browser-final', 'r2-integrated-browser'],
  ['r2-candidate-performance-final', 'r2-candidate-performance'],
]) {
  const source = path.resolve(__dirname, sourceName);
  const dest = path.resolve(__dirname, destName);
  assert.equal(path.dirname(source), __dirname);
  assert.equal(path.dirname(dest), __dirname);
  const report = JSON.parse(fs.readFileSync(path.join(source, 'report.json')));
  assert.equal(report.bundleSHA, expected, `${sourceName} bundle SHA`);
  assert.equal(report.complete, true, `${sourceName} complete`);
  assert.equal(report.errors?.length || 0, 0, `${sourceName} errors`);
  fs.mkdirSync(dest, {recursive: true});
  for (const name of fs.readdirSync(dest)) {
    if (/^(?:report\.json|[A-Za-z0-9-]+\.png)$/.test(name)) fs.unlinkSync(path.join(dest, name));
  }
  for (const name of fs.readdirSync(source)) {
    assert.match(name, /^(?:report\.json|[A-Za-z0-9-]+\.png)$/);
    fs.copyFileSync(path.join(source, name), path.join(dest, name));
  }
  console.log(`${sourceName} -> ${destName}: ${fs.readdirSync(dest).join(', ')}`);
}
const hud = JSON.parse(fs.readFileSync(path.join(__dirname, 'r2-browser-hud-final', 'report.json')));
assert.equal(hud.bundleSHA, expected);
assert.equal(hud.complete, true);
assert.equal(hud.errors?.length || 0, 0);
console.log(`HUD SHA ${expected}`);
