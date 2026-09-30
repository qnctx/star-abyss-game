const fs=require('fs');
const file='artifacts/r4-release.cjs';if(fs.existsSync(file))throw Error('Already prepared');
const src=fs.readFileSync('artifacts/r3-release.cjs','utf8').replaceAll('r3-','r4-').replace("const files=['playable/game.js',","const files=['playable/game.js','playable/star-abyss.html','playable/test-lab.html','playable/css/game.css','playable/css/test-lab.css','playable/css/flight-hud.css',");
fs.writeFileSync(file,src);
