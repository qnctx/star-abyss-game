const fs=require('fs'),path=require('path'),crypto=require('crypto');
const hash=p=>fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;
const baseline=JSON.parse(fs.readFileSync('artifacts/r8-release-baseline.json'));
const changed=Object.entries(baseline).filter(([p,b])=>hash(p)!==b.local&&!p.includes('/evidence-r3/')).map(([p])=>p);
const newFiles=['playable/ascension-gallery.html','playable/ascension-gallery.js','playable/css/ascension.css','playable/src/ascension-ui.mjs','playable/src/ascension-effects.mjs','playable/src/ascension-gallery.mjs','playable/src/planet-gameplay/ascension-rules.mjs','playable/src/planet/flight-aim.mjs','playable/src/expedition-runtime/aerial-combat.mjs','playable/tests/ascension-flight-r8.test.mjs','playable/tests/aerial-combat-r8.test.mjs','playable/tests/ascension-effects-r8.test.mjs','playable/tests/flight-aim-r8.test.mjs','docs/development/ASCENSION-R8-DESIGN.md','docs/development/AERIAL-COMBAT-R8.md'];
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);}
const files=[...new Set([...changed,...newFiles,...['playable/assets/ascension-r8','docs/art/ascension-r8','tools/art/ascension-r8'].flatMap(walk)])].sort();
for(const p of files){if(!fs.existsSync(p))throw Error('Missing '+p);if(baseline[p]?.local&&baseline[p].local!==baseline[p].live)console.log('Pre-existing source/live delta:',p);}
fs.writeFileSync('artifacts/r8-release-files.json',JSON.stringify(files,null,2));console.log('Whitelist',files.length,'files');
