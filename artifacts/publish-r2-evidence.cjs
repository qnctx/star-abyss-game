const fs=require('fs'),p=require('path'),crypto=require('crypto');
const root='E:/myProject/star-abyss-game';const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const dirs=['artifacts/r2-integrated-browser','artifacts/r2-candidate-performance','artifacts/r2-browser-hud-final','artifacts/r2-browser-ground-ready-retest'];
const files=['artifacts/r2-build-inputs.json','artifacts/r2-published.json','artifacts/r2-published-verification.json',...dirs.flatMap(d=>fs.readdirSync(d).filter(n=>/\.(json|png)$/.test(n)).map(n=>d+'/'+n))];
const rows=files.map(file=>({file,sha:hash(file),destination:p.resolve(root,file)}));
for(const r of rows){if(!r.destination.startsWith(p.resolve(root)+p.sep))throw Error('Outside project');if(fs.existsSync(r.destination)&&hash(r.destination)!==r.sha)throw Error('Existing evidence conflict: '+r.file);}
for(const r of rows){fs.mkdirSync(p.dirname(r.destination),{recursive:true});if(!fs.existsSync(r.destination))fs.copyFileSync(r.file,r.destination,fs.constants.COPYFILE_EXCL);if(hash(r.destination)!==r.sha)throw Error('Evidence copy mismatch');}
fs.writeFileSync('artifacts/r2-evidence-published.json',JSON.stringify({root,files:rows},null,2));console.log('Verified '+rows.length+' evidence files in formal project; existing different files were not overwritten.');
