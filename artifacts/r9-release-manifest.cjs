const fs=require('fs'),crypto=require('crypto');
const hash=p=>fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;
const baseline=JSON.parse(fs.readFileSync('artifacts/r9-release-baseline.json'));
const changed=Object.entries(baseline).filter(([p,b])=>hash(p)!==b.local&&!p.includes('/evidence-r3/')).map(([p])=>p);
const additions=['playable/src/aerial-melee-animation.mjs','playable/src/aerial-sparring-visual.mjs','playable/src/air-combat-pose.mjs','playable/src/expedition-runtime/aerial-melee.mjs','playable/tests/aerial-animation-r9.test.mjs','playable/tests/aerial-melee-r9.test.mjs','playable/tests/air-recoil-r9.test.mjs','playable/tests/flight-steering-r9.test.mjs','docs/development/AERIAL-FLIGHT-COMBAT-R9.md','docs/development/AERIAL-MELEE-R9.md','docs/development/FLIGHT-STEERING-R9.md'];
additions.push('playable/src/aerial-footwork.mjs','playable/tests/aerial-footwork-r9.test.mjs');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);}
const files=[...new Set([...changed,...additions,...['playable/assets/air-combat-r9','docs/art/air-combat-r9','tools/art/air-combat-r9'].flatMap(walk)])].sort();
for(const p of files){if(!fs.existsSync(p))throw Error('Missing '+p);if(baseline[p]?.local&&baseline[p].local!==baseline[p].live)console.log('Preexisting local/live delta:',p);}
fs.writeFileSync('artifacts/r9-release-files.json',JSON.stringify(files,null,2));console.log('Whitelist',files.length,files);
