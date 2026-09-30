const fs=require('fs'),path=require('path'),crypto=require('crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const published=JSON.parse(fs.readFileSync('artifacts/r5-published.json'));
 const response=await fetch('http://127.0.0.1:4173/game.js',{cache:'no-store'});
 if(!response.ok)throw Error('HTTP '+response.status);
 const actual=hash(Buffer.from(await response.arrayBuffer()));
 if(actual!==published.bundleSHA)throw Error('Served bundle mismatch');
 const files=[];
 for(const dir of ['r5-baseline','r5-candidate','r5b-candidate','r5c-candidate','r5-profile','r5-ratio-diagnostic'])for(const file of fs.readdirSync('artifacts/'+dir)){
  if(!/\.(json|png)$/.test(file))continue;
  const relative='artifacts/'+dir+'/'+file,bytes=fs.readFileSync(relative),dest=path.join('E:/myProject/star-abyss-game',relative);
  if(fs.existsSync(dest)&&hash(fs.readFileSync(dest))!==hash(bytes))throw Error('Evidence conflict '+dest);
  fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);files.push(relative);
 }
 const result={complete:true,bundleSHA:actual,evidence:files,at:new Date().toISOString()};
 fs.writeFileSync('artifacts/r5-published-verification.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
