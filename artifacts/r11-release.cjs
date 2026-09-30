const fs=require('fs'),path=require('path'),crypto=require('crypto'),live='E:/myProject/star-abyss-game';
const hash=p=>fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;
function walk(dir){return fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]):[];}
const baseline='artifacts/r11-release-baseline.json';
if(process.argv[2]==='baseline'){
 if(fs.existsSync(baseline))throw Error('baseline exists');
 const files=['playable/game.js','playable/checkpoint-worker.js',...['playable/src','playable/tests','docs/development'].flatMap(walk)];
 fs.writeFileSync(baseline,JSON.stringify(Object.fromEntries(files.map(p=>[p,{live:hash(live+'/'+p),local:hash(p)}])),null,2));console.log('Captured',files.length);
}
if(['manifest','publish'].includes(process.argv[2])){
 const b=JSON.parse(fs.readFileSync(baseline));
 const additions=['playable/src/ground-combat-recoil.mjs','playable/src/expedition-world/riftwing-asset.mjs','playable/src/expedition-runtime/riftwing-ai.mjs','playable/tests/riftwing-r11.test.mjs','playable/tests/riftwing-integration-r11.test.mjs','docs/development/RIFTWING-R11.md'];
 const files=[...new Set([...Object.entries(b).filter(([p,v])=>hash(p)!==v.local).map(([p])=>p),...additions,...['playable/assets/creatures/riftwing-r11','docs/art/creatures/riftwing-r11','tools/art/riftwing-r11'].flatMap(walk)])].filter(p=>!p.endsWith('.blend1')&&!p.includes('__pycache__')&&!p.includes('/evidence-r3/')).sort((a,b)=>a==='playable/game.js'?1:b==='playable/game.js'?-1:a.localeCompare(b));
 fs.writeFileSync('artifacts/r11-release-files.json',JSON.stringify(files,null,2));
 for(const p of files){if(!hash(p))throw Error('Missing '+p);if(hash(live+'/'+p)!==(b[p]?.live??null))throw Error('Live conflict '+p);}
 if(process.argv[2]==='manifest'){console.log('Verified whitelist',files.length);process.exit(0);}
 const report=JSON.parse(fs.readFileSync('artifacts/r11-candidate/report.json')),cpu=JSON.parse(fs.readFileSync('artifacts/r11-cpu-validation.json'));
 if(!cpu.complete||cpu.bundleSHA!==hash('playable/game.js')||!report.complete||report.bundleSHA!==cpu.bundleSHA||report.assetSHA!==hash('playable/assets/creatures/riftwing-r11/riftwing-r11.glb')||report.errors?.length||report.gameplayErrors?.length||!Object.keys(report.assertions||{}).length||Object.values(report.assertions).some(v=>v!==true))throw Error('Verification gate failed');
 const backup='artifacts/r11-backup-'+Date.now();
 for(const p of files){const dest=live+'/'+p,bak=backup+'/'+p;fs.mkdirSync(path.dirname(bak),{recursive:true});if(fs.existsSync(dest))fs.copyFileSync(dest,bak);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(p,dest);if(hash(dest)!==hash(p))throw Error('Copy mismatch '+p);}
 fs.writeFileSync('artifacts/r11-published.json',JSON.stringify({complete:true,bundleSHA:report.bundleSHA,assetSHA:report.assetSHA,files,backup},null,2));console.log('Published',files.length);
}
