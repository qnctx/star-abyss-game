const fs=require('fs'),p=require('path'),crypto=require('crypto');
const root='E:/myProject/star-abyss-game',out='artifacts/playtest-r2-deployment-baseline.json';
if(fs.existsSync(out))throw Error('Baseline already exists; preserve it');
const walk=d=>fs.readdirSync(p.join(root,d),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name]);
const files=['playable/src','playable/css','playable/assets'].flatMap(walk).concat(['playable/game.js','playable/checkpoint-worker.js','playable/star-abyss.html','playable/test-lab.html','playable/quest-lab.html']);
const hashes=Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(p.join(root,f))).digest('hex')]));
fs.writeFileSync(out,JSON.stringify({at:new Date().toISOString(),root,hashes},null,2));console.log('Captured '+files.length+' deployed file hashes; no deployment writes');
