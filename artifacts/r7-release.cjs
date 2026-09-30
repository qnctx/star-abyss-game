const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=process.cwd(),live='E:/myProject/star-abyss-game',manifest=path.join(root,'artifacts/r7-release-baseline.json');
const hash=p=>fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;
function walk(dir,base=dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name),base):[path.relative(base,path.join(dir,e.name)).replaceAll('\\','/')]);}
if(process.argv[2]==='baseline'){
 if(fs.existsSync(manifest))throw Error('Baseline already exists');
 const files=['playable/game.js','playable/star-abyss.html','playable/test-lab.html','playable/css/game.css','playable/css/test-lab.css','playable/css/flight-hud.css',...walk(path.join(root,'playable/src')).map(p=>'playable/src/'+p),...walk(path.join(root,'docs/development')).map(p=>'docs/development/'+p),...walk(path.join(root,'playable/tests')).map(p=>'playable/tests/'+p)];
 fs.writeFileSync(manifest,JSON.stringify(Object.fromEntries(files.map(p=>[p,{live:hash(path.join(live,p)),local:hash(path.join(root,p))}])),null,2));console.log('Baseline captured',files.length);
}else if(process.argv[2]==='profile'){
 const p=JSON.parse(fs.readFileSync(process.argv[3]||'artifacts/r7-baseline/camp.cpuprofile'));const lines=fs.readFileSync('playable/game.js','utf8').split(/\r?\n/);console.log(p.nodes.filter(n=>n.hitCount).sort((a,b)=>b.hitCount-a.hitCount).slice(0,25).map(n=>({hits:n.hitCount,name:n.callFrame.functionName,code:(lines[n.callFrame.lineNumber]||'').slice(n.callFrame.columnNumber,n.callFrame.columnNumber+180)})));
}else if(process.argv[2]==='publish'){
 const baseline=JSON.parse(fs.readFileSync(manifest)),files=JSON.parse(fs.readFileSync('artifacts/r7-release-files.json'));
 const report=JSON.parse(fs.readFileSync('artifacts/r7-candidate/report.json'));
 if(!report.complete||report.bundleSHA!==hash('playable/game.js'))throw Error('Candidate build not verified');
 for(const p of files){if(p.includes('..')||path.isAbsolute(p)||!fs.existsSync(path.join(root,p)))throw Error('Invalid path '+p);if(hash(path.join(live,p))!==(baseline[p]?.live??null))throw Error('Live conflict '+p);}
 const backup=path.join(root,'artifacts/r7-release-backup-'+Date.now());fs.mkdirSync(backup,{recursive:true});
 for(const p of files){const dst=path.join(live,p);if(fs.existsSync(dst)){fs.mkdirSync(path.dirname(path.join(backup,p)),{recursive:true});fs.copyFileSync(dst,path.join(backup,p));}fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(path.join(root,p),dst);if(hash(dst)!==hash(path.join(root,p)))throw Error('Copy mismatch '+p);}
 const untouched=Object.entries(baseline).filter(([p])=>!files.includes(p));for(const[p,s]of untouched)if(hash(path.join(live,p))!==s.live)throw Error('Unrelated live change '+p);
 fs.writeFileSync('artifacts/r7-published.json',JSON.stringify({complete:true,bundleSHA:report.bundleSHA,backup,files,untouched:untouched.length},null,2));console.log('Published',files.length,'preserved',untouched.length);
}
