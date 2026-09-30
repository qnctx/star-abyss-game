const fs=require('fs'),p=require('path'),crypto=require('crypto');const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name]);
const files=['playable/src','playable/css','playable/assets/flight-r2','playable/assets/camp-v2'].flatMap(walk).filter(f=>/\.(mjs|glb|css|json)$/.test(f)&&!f.endsWith('.test.mjs'));
fs.writeFileSync('artifacts/r2-build-inputs.json',JSON.stringify({at:new Date().toISOString(),bundleSHA:hash('playable/game.js'),hashes:Object.fromEntries(files.map(f=>[f,hash(f)]))},null,2));console.log('Recorded build inputs and bundle SHA');
