const fs=require('fs');
for(const line of fs.readFileSync('artifacts/camp-v2-real-path-before.jsonl','utf8').trim().split(/\r?\n/)){
 const r=JSON.parse(line);console.log(JSON.stringify({id:r.id,dt:r.dt,final:r.final,maxY:r.maxY,blocked:r.blocked,path:r.maxY<.5?r.path:undefined}));
}
