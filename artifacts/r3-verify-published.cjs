const fs=require('fs'),path=require('path'),crypto=require('crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const manifest=JSON.parse(fs.readFileSync('artifacts/r3-published.json'));
 const r=await fetch('http://127.0.0.1:4173/game.js'),httpHash=hash(Buffer.from(await r.arrayBuffer()));
 if(!r.ok||httpHash!==manifest.bundleSHA)throw Error('Published HTTP bundle mismatch');
 const evidence=['artifacts/r3-baseline/report.json','artifacts/r3-shadow-only-report.json','artifacts/r3-candidate/report.json','artifacts/r3-candidate/camp-still.png','artifacts/r3-candidate/camp-turn.png','artifacts/r3-candidate/flight-fast-turn.png','artifacts/r3-published.json'];
 const independent='artifacts/r3-browser-camp-independent/report.json';
 if(fs.existsSync(independent)){evidence.push(...fs.readdirSync(path.dirname(independent)).filter(p=>p.endsWith('.json')||p.endsWith('.png')).map(p=>path.dirname(independent)+'/'+p));}
 for(const p of evidence){const dst=path.join('E:/myProject/star-abyss-game',p);fs.mkdirSync(path.dirname(dst),{recursive:true});if(fs.existsSync(dst)&&hash(fs.readFileSync(dst))!==hash(fs.readFileSync(p)))throw Error('Existing evidence conflict '+p);fs.copyFileSync(p,dst);}
 fs.writeFileSync('artifacts/r3-published-verification.json',JSON.stringify({httpStatus:r.status,httpHash,evidence,complete:true},null,2));console.log('HTTP verified',httpHash,'evidence',evidence.length);
})().catch(e=>{console.error(e);process.exitCode=1;});
