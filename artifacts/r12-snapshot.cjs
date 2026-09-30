const fs=require('fs'),crypto=require('crypto');
const files=['playable/game.js','playable/star-abyss.html','playable/src/flight-hud.mjs','playable/src/planet-gameplay/flight.mjs','playable/src/test-lab.mjs','playable/tests/ascension-flight-r8.test.mjs','playable/tests/flight-hud-r2.test.mjs'];
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const out='artifacts/r12-baseline.json';if(fs.existsSync(out))throw Error('Already captured');
fs.writeFileSync(out,JSON.stringify(Object.fromEntries(files.map(p=>[p,{local:sha(p),live:sha('E:/myProject/star-abyss-game/'+p)}])),null,2));
console.log('Captured',files.length);
