const fs=require('fs'),crypto=require('crypto');const b=JSON.parse(fs.readFileSync('artifacts/r4-release-baseline.json'));
const hash=p=>fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;
console.log(Object.keys(b).filter(p=>hash(p)!==b[p].local).join('\n'));
console.log('bundle',hash('playable/game.js'));
