import fs from 'node:fs';
import path from 'node:path';

const input=path.resolve(process.argv[2]);
const t=JSON.parse(fs.readFileSync(input,'utf8'));
const result={source:input,view:t.view,time_scale:t.time_scale,glb_sha256:t.glb_sha256,driver_sha256:t.driver_sha256,stages:{}};
for(const gait of ['walk','jog','sprint']) {
  const rs=t.records.filter(r=>r.stage===gait);
  if(!rs.length) continue;
  const ticks=new Set(rs.map(r=>r.tick));
  result.stages[gait]={count:rs.length,start_tick:rs[0].tick,end_tick:rs.at(-1).tick,start_seconds:rs[0].seconds,end_seconds:rs.at(-1).seconds,delta_values:[...new Set(rs.map(r=>r.delta))],images:t.images.filter(i=>ticks.has(i.tick)).map(i=>({file:i.file,tick:i.tick,seconds:i.seconds}))};
}
const output=JSON.stringify(result,null,2)+'\n';
if(process.argv[3]) fs.writeFileSync(path.resolve(process.argv[3]),output); else console.log(output);
