const fs=require('fs');const p=JSON.parse(fs.readFileSync(process.argv[2]||'artifacts/r2-browser-third-person-attempt2/high-flight.cpuprofile'));
const byId=new Map(p.nodes.map(n=>[n.id,n])),parent=new Map();
for(const n of p.nodes)for(const c of n.children||[])parent.set(c,n.id);
const totals=new Map();let overall=0;
for(let i=0;i<p.samples.length;i++){const delta=p.timeDeltas?.[i]||0;overall+=delta;let id=p.samples[i],leaf=true;while(id){const n=byId.get(id);if(!n)break;const f=n.callFrame,key=(f.url||'')+'|'+f.functionName+'|'+f.lineNumber,slot=totals.get(key)||{name:f.functionName,url:f.url,line:f.lineNumber,self:0,cumulative:0};slot.cumulative+=delta;if(leaf)slot.self+=delta;totals.set(key,slot);leaf=false;id=parent.get(id);}}
const arr=[...totals.values()].filter(x=>x.url&&!x.url.startsWith('node:'));
console.log('samples',p.samples.length,'sampledMs',overall/1000);
console.log('top self',JSON.stringify(arr.sort((a,b)=>b.self-a.self).slice(0,15).map(x=>({...x,selfMs:x.self/1000,cumulativeMs:x.cumulative/1000}))));
console.log('top cumulative',JSON.stringify(arr.sort((a,b)=>b.cumulative-a.cumulative).slice(0,15).map(x=>({...x,selfMs:x.self/1000,cumulativeMs:x.cumulative/1000}))));
