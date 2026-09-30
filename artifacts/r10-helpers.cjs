const fs=require('fs');
fs.writeFileSync('artifacts/r10-cpu-validate.cjs',fs.readFileSync('artifacts/r9-cpu-validate.cjs','utf8').replaceAll('artifacts/r9-','artifacts/r10-'));
fs.writeFileSync('artifacts/r10-verify-published.cjs',fs.readFileSync('artifacts/r9-verify-published.cjs','utf8').replaceAll('artifacts/r9-','artifacts/r10-'));
const crypto=require('crypto'),b=JSON.parse(fs.readFileSync('artifacts/r10-release-baseline.json'));
const hash=p=>fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;
for(const p of ['playable/src/planet-gameplay/flight.mjs','playable/src/planet-gameplay/index.mjs','playable/tests/flight-steering-r9.test.mjs'])if(!b[p])b[p]={live:hash('E:/myProject/star-abyss-game/'+p),local:hash(p)};
fs.writeFileSync('artifacts/r10-release-baseline.json',JSON.stringify(b,null,2));
