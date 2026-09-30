const fs=require('fs'),path=require('path'),crypto=require('crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const published=JSON.parse(fs.readFileSync('artifacts/r8-published.json'));
 const response=await fetch('http://127.0.0.1:4173/game.js',{cache:'no-store'});
 if(!response.ok)throw Error('HTTP '+response.status);
 const actual=hash(Buffer.from(await response.arrayBuffer()));
 if(actual!==published.bundleSHA)throw Error('Served bundle mismatch');
 const checks=[];
 for(const p of published.files.filter(p=>p.startsWith('playable/')&&(p.endsWith('.glb')||p.endsWith('.html')||p.endsWith('.css')||p==='playable/ascension-gallery.js'||p==='playable/checkpoint-worker.js'))){
   const response=await fetch('http://127.0.0.1:4173/'+p.slice('playable/'.length),{cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status+' '+p);
   if(hash(Buffer.from(await response.arrayBuffer()))!==hash(fs.readFileSync(p)))throw Error('Served file mismatch '+p);checks.push(p);
 }
 const files=[];
 for(const file of fs.readdirSync('artifacts/r8-candidate')){
  if(!/\.(json|png)$/.test(file))continue;
  const relative='artifacts/r8-candidate/'+file,bytes=fs.readFileSync(relative),dest=path.join('E:/myProject/star-abyss-game',relative);
  if(fs.existsSync(dest)&&hash(fs.readFileSync(dest))!==hash(bytes))throw Error('Evidence conflict '+dest);
  fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);files.push(relative);
 }
 const result={complete:true,bundleSHA:actual,servedFiles:checks,evidence:files,at:new Date().toISOString()};
 fs.writeFileSync('artifacts/r8-published-verification.json',JSON.stringify(result,null,2));
 for(const name of ['r8-published.json','r8-published-verification.json','r8-cpu-validation.json']){
  const bytes=fs.readFileSync('artifacts/'+name),dest='E:/myProject/star-abyss-game/artifacts/'+name;
  if(fs.existsSync(dest)&&!fs.readFileSync(dest).equals(bytes))throw Error('Record conflict '+name);
  fs.writeFileSync(dest,bytes);
 }
 console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
