const fs=require('fs'),path=require('path'),crypto=require('crypto'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{const published=JSON.parse(fs.readFileSync('artifacts/r9-published.json')),checks=[];
for(const p of published.files.filter(p=>p.startsWith('playable/'))){const r=await fetch('http://127.0.0.1:4173/'+p.slice(9),{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status+' '+p);if(hash(Buffer.from(await r.arrayBuffer()))!==hash(fs.readFileSync(p)))throw Error('HTTP byte mismatch '+p);checks.push(p);}
if(hash(fs.readFileSync('playable/game.js'))!==published.bundleSHA)throw Error('Bundle changed');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);}
const evidence=walk('artifacts/r9-candidate').filter(p=>/\.(png|json)$/.test(p));
const result={complete:true,bundleSHA:published.bundleSHA,servedFiles:checks,evidence,at:new Date().toISOString()};fs.writeFileSync('artifacts/r9-published-verification.json',JSON.stringify(result,null,2));
for(const p of [...evidence,'artifacts/r9-published.json','artifacts/r9-published-verification.json','artifacts/r9-cpu-validation.json']){const dest=path.join('E:/myProject/star-abyss-game',p),bytes=fs.readFileSync(p);if(fs.existsSync(dest)&&hash(fs.readFileSync(dest))!==hash(bytes))throw Error('Evidence conflict '+p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);}
console.log(JSON.stringify({complete:true,bundleSHA:result.bundleSHA,servedFiles:checks.length,evidence:evidence.length}));})().catch(e=>{console.error(e);process.exitCode=1});
