const fs=require('fs'),crypto=require('crypto');const hash=p=>fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;
const b=JSON.parse(fs.readFileSync('artifacts/r8-release-baseline.json')),files=JSON.parse(fs.readFileSync('artifacts/r8-release-files.json'));
for(const p of files){if(!fs.existsSync(p))throw Error('Local missing '+p);if(hash('E:/myProject/star-abyss-game/'+p)!==(b[p]?.live??null))throw Error('Publish conflict '+p);}
for(const [p,v] of Object.entries(b))if(!files.includes(p)&&hash('E:/myProject/star-abyss-game/'+p)!==v.live)throw Error('Unrelated concurrent change '+p);
console.log('Read-only publish preflight passed:',files.length,'files;',Object.keys(b).length-files.filter(p=>b[p]).length,'untouched baseline entries.');
