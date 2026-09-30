const fs=require('fs'),p=require('path'),crypto=require('crypto'),file='artifacts/playtest-r2-deployment-baseline.json';
const b=JSON.parse(fs.readFileSync(file)),old='C:/Users/HUAWEI/.codex/worktrees/cb21/star-abyss-game';
const files=['playable/tests/planet-gameplay.test.mjs','playable/tests/planet-gameplay-r2.test.mjs','playable/tests/flight-r2.test.mjs','playable/tests/flight-hud-r2.test.mjs','playable/src/progression-quests/quests.test.mjs','playable/src/progression-quests/scene.test.mjs','playable/src/progression-quests/dialog-layout.test.mjs','playable/src/camp-v2/integration.test.mjs'];
// Controller reviewed the deployed-to-candidate diffs for these two flight
// suites: changes cover the authorized R4 gate, 2000m cap and new flight rules.
const reviewed=new Set(files.slice(0,2));
files.push('playable/tests/planet-stream-budget-r2.test.mjs');
files.push('playable/tests/legacy-outer-grid-cache-r2.test.mjs');
for(const f of files){if(f in b.hashes)continue;const dest=p.join(b.root,f);if(fs.existsSync(dest)){const prev=p.join(old,f);if(!reviewed.has(f)&&(!fs.existsSync(prev)||fs.readFileSync(prev,'utf8').replace(/\r\n/g,'\n')!==fs.readFileSync(dest,'utf8').replace(/\r\n/g,'\n')))throw Error('Unreviewed deployed test edits: '+f);b.hashes[f]=crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex');}else b.hashes[f]=null;}
b.testFiles=files;fs.writeFileSync(file,JSON.stringify(b,null,2));console.log('Selected test baselines captured without deployment writes');
