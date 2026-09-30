const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const run = args => { const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' }); if(r.status !== 0) throw Error(r.stdout + r.stderr); return r.stdout; };
const dependencies = JSON.parse(run(['playable/src/d3-session/verify-dependencies.cjs']));
const tap = run(['--test', 'playable/tests/d3-session.test.js']);
fs.writeFileSync(path.join(__dirname, 'node-tests.tap'), tap);
for(const f of fs.readdirSync(__dirname).filter(f=> /\.(mjs|cjs)$/.test(f))) run(['--check',path.join(__dirname,f)]);
const evidence = JSON.parse(fs.readFileSync(path.join(__dirname, 'browser-evidence.json')));
if(!evidence.pass || evidence.cases.length !== 6) throw Error('Browser evidence not passing');
const files = [...fs.readdirSync(__dirname).filter(f=>f!=='version.json').map(f=>'playable/src/d3-session/'+f),
  'playable/tests/d3-session.test.js','docs/development/reports/DEV-I.md'].sort().map(relative=>{
  const bytes=fs.readFileSync(path.join(root,relative)); return {relative,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
});
const manifest = { version:'DEV-I-R1', threadId:process.env.CODEX_THREAD_ID, workspace:root,
  baseline:'5fdb455d3c46601ebd584e64bcf72a2b5c82baf4', frozenAt:new Date().toISOString(),
  nodeVersion:process.version, nodeTests:'13/13', browserTests:'6/6; real IndexedDB, developer verification only', dependencies, files };
fs.writeFileSync(path.join(__dirname,'version.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({threadId:manifest.threadId,files:files.length,nodeTests:manifest.nodeTests,browserTests:manifest.browserTests,dependencies:dependencies.length}));
