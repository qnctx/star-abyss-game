const fs=require('fs'),crypto=require('crypto');const b=JSON.parse(fs.readFileSync('artifacts/r8-release-baseline.json'));const hash=p=>fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;
console.log(Object.entries(b).filter(([p,v])=>hash(p)!==v.local).map(([p])=>p).join('\n'));
