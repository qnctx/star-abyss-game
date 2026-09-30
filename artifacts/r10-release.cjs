const fs=require('fs'),crypto=require('crypto'),path=require('path');
const live='E:/myProject/star-abyss-game';
const files=['playable/game.js','playable/checkpoint-worker.js','playable/src/input.mjs','playable/src/avatar.mjs','playable/src/yuan-ying-flight-pose.mjs','playable/src/aerial-melee-animation.mjs','playable/src/flight-hud.mjs','playable/src/expedition-runtime/aerial-melee.mjs','playable/src/expedition-runtime/index.mjs','playable/tests/input.test.js','playable/tests/aerial-melee-r9.test.mjs','playable/tests/aerial-animation-r9.test.mjs','docs/development/AERIAL-MELEE-R9.md','docs/development/AERIAL-FLIGHT-COMBAT-R10.md'];
const hash=p=>fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;
files.push('playable/src/planet-gameplay/flight.mjs','playable/src/planet-gameplay/index.mjs','playable/tests/flight-steering-r9.test.mjs');
const baseline='artifacts/r10-release-baseline.json';
if(process.argv[2]==='baseline'){
 if(fs.existsSync(baseline))throw Error('Already exists');
 fs.writeFileSync(baseline,JSON.stringify(Object.fromEntries(files.map(p=>[p,{live:hash(path.join(live,p)),local:hash(p)}])),null,2));
 console.log('Baseline',files.length);
}
if(process.argv[2]==='publish'){
 const b=JSON.parse(fs.readFileSync(baseline)),r=JSON.parse(fs.readFileSync('artifacts/r10-candidate/report.json'));
 const cpu=JSON.parse(fs.readFileSync('artifacts/r10-cpu-validation.json'));if(!cpu.complete||cpu.bundleSHA!==hash('playable/game.js'))throw Error('CPU validation stale');
 if(!r.complete||r.bundleSHA!==hash('playable/game.js')||r.errors?.length||r.gameplayErrors?.length||!Object.keys(r.assertions||{}).length||Object.values(r.assertions).some(v=>v!==true))throw Error('Browser verification incomplete');
 const changed=files.filter(p=>hash(p)!==b[p].local);
 for(const p of changed)if(!hash(p)||hash(path.join(live,p))!==b[p].live)throw Error('Conflict '+p);
 const backup='artifacts/r10-backup-'+Date.now();
 for(const p of changed){const dest=path.join(live,p),bak=path.join(backup,p);fs.mkdirSync(path.dirname(bak),{recursive:true});if(fs.existsSync(dest))fs.copyFileSync(dest,bak);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(p,dest);if(hash(dest)!==hash(p))throw Error('Mismatch '+p);}
 fs.writeFileSync('artifacts/r10-published.json',JSON.stringify({complete:true,bundleSHA:r.bundleSHA,files:changed,backup},null,2));console.log('Published',changed);
}
