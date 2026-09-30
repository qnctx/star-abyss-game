import fs from 'node:fs';
import path from 'node:path';
const folder=path.resolve(process.argv[2]??'godot/assets/motion-r2/evidence/gait-r6/final');
const result={};
for(const view of ['side','front','back']){
  const file=path.join(folder,view+'-trace.json');if(!fs.existsSync(file))continue;
  const t=JSON.parse(fs.readFileSync(file,'utf8')),byTick=new Map(t.records.map(r=>[r.tick,r])),frames=t.images.map(i=>({image:i,record:byTick.get(i.tick)})).filter(x=>x.record);
  result[view]={};
  for(const gait of ['walk','jog','sprint']){
    const stable=frames.filter(f=>f.record.stage===gait&&f.record.stage_age>.5);
    result[view][gait]=[.125,.375,.625,.875].map(phase=>{
      const delta=x=>Math.min(Math.abs(x.record.phase-phase),1-Math.abs(x.record.phase-phase));
      const f=stable.reduce((a,b)=>delta(b)<delta(a)?b:a);return {phase:f.record.phase,tick:f.record.tick,seconds:f.record.seconds,path:path.join(folder,view,f.image.file)};
    });
  }
}
console.log(JSON.stringify(result,null,2));
