const fs=require('fs'),crypto=require('crypto'),p='artifacts/r9-release-baseline.json';
const b=JSON.parse(fs.readFileSync(p));
const file='playable/checkpoint-worker.js';
if(!b[file])b[file]={live:crypto.createHash('sha256').update(fs.readFileSync('E:/myProject/star-abyss-game/'+file)).digest('hex'),local:null,note:'Live baseline added before publishing; prior local hash was not captured by baseline helper.'};
fs.writeFileSync(p,JSON.stringify(b,null,2));
