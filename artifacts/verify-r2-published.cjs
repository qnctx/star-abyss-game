const fs=require('fs'),p=require('path'),crypto=require('crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const release=JSON.parse(fs.readFileSync('artifacts/r2-published.json'));
const baseline=JSON.parse(fs.readFileSync('artifacts/playtest-r2-deployment-baseline.json'));
const results={at:new Date().toISOString(),disk:[],preserved:[],http:[],complete:false};
(async()=>{
 for(const row of release.files){const actual=hash(fs.readFileSync(p.join(release.destination,row.file)));if(actual!==row.sourceSHA)throw Error('Published file mismatch: '+row.file);results.disk.push(row.file);}
 const changed=new Set(release.files.map(r=>r.file));
 for(const [file,sha] of Object.entries(baseline.hashes)){if(!sha||changed.has(file))continue;const target=p.join(release.destination,file);if(!fs.existsSync(target)||hash(fs.readFileSync(target))!==sha)throw Error('Unrelated baseline changed: '+file);results.preserved.push(file);}
 for(const file of ['playable/star-abyss.html','playable/game.js','playable/assets/camp-v2/command.glb','playable/assets/camp-v2/medical.glb','playable/assets/camp-v2/workshop.glb']){
  const url='http://127.0.0.1:4173/'+file.replace(/^playable\//,'');const response=await fetch(url);if(!response.ok)throw Error('HTTP '+response.status+' '+url);
  const actual=hash(Buffer.from(await response.arrayBuffer()));if(actual!==hash(fs.readFileSync(p.join(release.destination,file))))throw Error('Served stale file: '+file);results.http.push({file,status:response.status,sha:actual});
 }
 results.complete=true;
})().catch(e=>{results.error=e.stack;process.exitCode=1;}).finally(()=>{fs.writeFileSync('artifacts/r2-published-verification.json',JSON.stringify(results,null,2));console.log(JSON.stringify({complete:results.complete,publishedFiles:results.disk.length,preservedFiles:results.preserved.length,http:results.http,error:results.error},null,2));});
