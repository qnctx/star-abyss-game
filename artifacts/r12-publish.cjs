const fs=require('fs'),path=require('path'),crypto=require('crypto');
const live='E:/myProject/star-abyss-game',sha=p=>fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;
(async()=>{
const baseline=JSON.parse(fs.readFileSync('artifacts/r12-baseline.json'));
const report=JSON.parse(fs.readFileSync('artifacts/r12-candidate/report.json'));
if(!report.complete||report.bundleSHA!==sha('playable/game.js')||report.errors?.length||!Object.keys(report.assertions||{}).length||Object.values(report.assertions).some(x=>x!==true))throw Error('Browser gate failed');
const files=['playable/src/flight-hud.mjs','playable/src/test-lab.mjs','docs/development/FLIGHT-ENTRY-R12.md','playable/game.js','playable/star-abyss.html'];
for(const p of files)if(sha(live+'/'+p)!==(baseline[p]?.live??null))throw Error('Live conflict '+p);
const backup='artifacts/r12-backup-'+Date.now();
for(const p of files){const dest=live+'/'+p,bak=backup+'/'+p;fs.mkdirSync(path.dirname(bak),{recursive:true});if(fs.existsSync(dest))fs.copyFileSync(dest,bak);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(p,dest);if(sha(dest)!==sha(p))throw Error('Copy mismatch');}
const checked=[];for(const p of files.filter(p=>p.startsWith('playable/'))){const r=await fetch('http://127.0.0.1:4173/'+p.slice(9),{cache:'no-store'});const bytes=Buffer.from(await r.arrayBuffer());if(!r.ok||crypto.createHash('sha256').update(bytes).digest('hex')!==sha(p))throw Error('HTTP mismatch '+p);checked.push(p);}
const result={complete:true,bundleSHA:sha('playable/game.js'),cpuTests:22,browserAssertions:Object.keys(report.assertions).length,files,checked,backup};
fs.writeFileSync('artifacts/r12-published.json',JSON.stringify(result,null,2));
for(const p of ['artifacts/r12-candidate/report.json','artifacts/r12-published.json']){fs.mkdirSync(path.dirname(live+'/'+p),{recursive:true});fs.copyFileSync(p,live+'/'+p);}
console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1});
