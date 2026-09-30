const fs=require('fs'),crypto=require('crypto');
const baseline=JSON.parse(fs.readFileSync('artifacts/r5-release-baseline.json'));
const hash=p=>fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;
console.log(Object.entries(baseline).filter(([p,b])=>hash(p)!==b.local).map(([p])=>p));
