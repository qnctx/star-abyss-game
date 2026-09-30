const fs=require('fs'),crypto=require('crypto');const hash=p=>fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;
const b=require('./r9-release-baseline.json'),files=require('./r9-release-files.json'),conflicts=[];
for(const [p,s]of Object.entries(b))if(hash('E:/myProject/star-abyss-game/'+p)!==s.live)conflicts.push(p);
for(const p of files)if(!b[p]&&fs.existsSync('E:/myProject/star-abyss-game/'+p))conflicts.push(p);
console.log(JSON.stringify({checked:Object.keys(b).length,releaseFiles:files.length,conflicts}));if(conflicts.length)process.exitCode=1;
