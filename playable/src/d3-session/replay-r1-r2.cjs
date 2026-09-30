// Developer regression only. Never execute TEST-I's writers or modify its frozen source/evidence.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const source = 'C:/Users/HUAWEI/.codex/worktrees/62b6/star-abyss-game/artifacts/tests/TEST-I-R1/independent.mjs';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const bytes = fs.readFileSync(source);
const rewritten = bytes.toString('utf8').replaceAll('./frozen/playable/src/', '../');
const target = path.join(__dirname, 'r1-independent-r2.mjs');
fs.writeFileSync(target, rewritten);
if(process.argv.includes('--prepare')) { console.log('Prepared import-only R1 regression copy'); process.exit(0); }
(async () => {
  const { runIndependent } = await import(pathToFileURL(target));
  const { copy } = await import('./index.mjs');
  const worlds = new Map();
  const open = async (name, fault = () => null) => ({
    initialize: async root => { if(worlds.has(name)) return false; worlds.set(name, copy(root)); return true; },
    load: async () => copy(worlds.get(name)), close() {},
    compareAndSwap: async ({ expectedRevision, nextState, signal }) => {
      if(signal?.aborted) throw Error('cancelled');
      if(worlds.get(name).revision !== expectedRevision) return false;
      if(fault('afterPut') === 'abort') throw Error('injectedAbort');
      worlds.set(name, copy(nextState));
      if(fault('afterCommit') === 'loseResponse') throw Error('responseLost'); return true;
    }
  });
  const result = await runIndependent(open, 'DEV-I-R2-memory-regression');
  if(!fs.readFileSync(source).equals(bytes)) throw Error('R1 source changed');
  const evidence = { source, sourceSha256:hash(bytes), copySha256:hash(Buffer.from(rewritten)),
    change:'Only import prefix ./frozen/playable/src/ -> ../; all assertions unchanged', result };
  fs.writeFileSync(path.join(__dirname,'r1-regression-r2.json'),JSON.stringify(evidence,null,2));
  console.log(JSON.stringify({pass:result.pass,cases:result.cases.map(c=>({name:c.name,pass:c.pass,error:c.error}))}));
  process.exitCode = result.pass ? 0 : 1;
})();
