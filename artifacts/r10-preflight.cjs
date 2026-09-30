const fs=require('fs'),crypto=require('crypto'),b=JSON.parse(fs.readFileSync('artifacts/r10-release-baseline.json'));
const hash=p=>fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;
for(const[p,v]of Object.entries(b))console.log(JSON.stringify({file:p,changed:hash(p)!==v.local,preexisting:v.local!==v.live,liveConflict:hash('E:/myProject/star-abyss-game/'+p)!==v.live}));
