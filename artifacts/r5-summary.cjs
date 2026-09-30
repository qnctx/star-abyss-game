const fs=require('fs');
for(const name of ['r5c-candidate']){
 const p='artifacts/'+name+'/report.json';if(!fs.existsSync(p))continue;
 const r=JSON.parse(fs.readFileSync(p));console.log(name,JSON.stringify({complete:r.complete,bundleSHA:r.bundleSHA,errors:r.errors,runs:r.runs.map(({samples,...s})=>s),release:r.releaseHover},null,2));
}
